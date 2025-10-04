# backend/apps/web/api/views.py (full file)

from __future__ import annotations

import threading
from pathlib import Path
from uuid import UUID

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

import json
from django.http import JsonResponse, HttpResponse, HttpResponseForbidden, Http404
from django.shortcuts import get_object_or_404
from django.utils.text import slugify

from services.pipeline.steps import analyze_upload, save_upload
from apps.web.models import UploadJob  # adjust if your app label/module differs

# Allow VOSK_MODEL_DIR to be None (e.g., env unset) without breaking.
VOSK_MODEL_DIR = getattr(settings, "VOSK_MODEL_DIR", None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _rel_media_path(pth: str | Path | None) -> str:
    if not pth:
        return ""
    s = str(pth)
    i = s.find("/media/")
    return s[i:] if i >= 0 else s


def _principal_filter(request) -> dict:
    """
    Returns a filter dict to scope queries to the current principal:
    - If authenticated, by user
    - Else by session_key (ensure session exists)
    """
    if request.user.is_authenticated:
        return {"user": request.user}
    if not request.session.session_key:
        request.session.save()
    return {"session_key": request.session.session_key}


def _principal_owns(request, job: UploadJob) -> bool:
    if request.user.is_authenticated:
        return job.user_id == request.user.id
    if not request.session.session_key:
        request.session.save()
    return job.session_key == request.session.session_key


# ---------------------------------------------------------------------------
# Background job runner
# ---------------------------------------------------------------------------

def _run_job_in_bg(job_id: UUID):
    """Executes the pipeline for a job in a background daemon thread."""
    job = UploadJob.objects.get(id=job_id)

    job.status = UploadJob.Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])

    try:
        # Run pipeline
        result = analyze_upload(
            upload_path=Path(job.upload_path),
            model_path=VOSK_MODEL_DIR,
            use_mock=False,
        )

        # Sizes + duration
        src_p = Path(result["upload_path"])
        wav_p = Path(result["normalized_path"])

        src_size = src_p.stat().st_size if src_p.exists() else None
        wav_size = wav_p.stat().st_size if wav_p.exists() else None

        transcript = result.get("transcript") or {}
        length_sec = float(transcript.get("duration_sec") or 0.0)

        # Save outcome
        job.normalized_path = result.get("normalized_path")
        job.upload_rel = _rel_media_path(result.get("upload_path", job.upload_path))
        job.normalized_rel = _rel_media_path(result.get("normalized_path", "") or "")
        job.src_size = src_size
        job.wav_size = wav_size
        job.duration_sec = round(length_sec, 3)
        job.full_text = result.get("full_text", "")
        job.labels = result.get("labels", [])
        job.status = UploadJob.Status.SUCCESS
        job.finished_at = timezone.now()
        job.save()

    except FileNotFoundError as e:
        job.status = UploadJob.Status.FAILED
        err = "ASR resources not available."
        if getattr(settings, "DEBUG", False):
            err += f" (model_path={VOSK_MODEL_DIR!r}; err={e})"
        job.error = err
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "error", "finished_at"])

    except Exception as e:
        job.status = UploadJob.Status.FAILED
        job.error = f"{type(e).__name__}: {e}"
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "error", "finished_at"])


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

class PingView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "backend"})


# Legacy single-file analyze (kept for compatibility / debugging)
class AnalyzeView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get("file")
        if not f:
            return Response(
                {"detail": "No file provided.", "code": "no_file"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1) Accept upload
        try:
            src = save_upload(f)
        except ValueError as e:
            return Response(
                {"detail": str(e), "code": "unsupported_media_type"},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )
        except Exception as e:
            return Response(
                {"detail": f"Failed to accept upload: {e}", "code": "upload_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 2) Analyze
        try:
            result = analyze_upload(
                upload_path=Path(src),
                model_path=VOSK_MODEL_DIR,
                use_mock=False,
            )
        except ValueError as e:
            return Response(
                {"detail": str(e), "code": "conversion_failed"},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        except FileNotFoundError as e:
            detail = "ASR resources not available."
            if getattr(settings, "DEBUG", False):
                detail += f" (model_path={VOSK_MODEL_DIR!r}; err={e})"
            return Response({"detail": detail, "code": "asr_unavailable"},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)

        except Exception as e:
            return Response(
                {"detail": f"Analysis failed: {e}", "code": "analysis_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 3) Build payload
        src_p = Path(result["upload_path"])
        wav_p = Path(result["normalized_path"])

        src_size = src_p.stat().st_size if src_p.exists() else None
        wav_size = wav_p.stat().st_size if wav_p.exists() else None

        transcript = result.get("transcript") or {}
        length_sec = round(float(transcript.get("duration_sec") or 0.0), 3)

        return Response(
            {
                "ok": True,
                "upload_rel": _rel_media_path(result["upload_path"]),
                "normalized_rel": _rel_media_path(result["normalized_path"]),
                "src_size": src_size,
                "wav_size": wav_size,
                "length_sec": length_sec,
                "full_text": result.get("full_text", ""),
                "labels": result.get("labels", []),
            },
            status=status.HTTP_200_OK,
        )


class JobsView(APIView):
    """
    POST /api/jobs/           → enqueue multiple files
      FormData: files[]=...   (multiple)
      202 Accepted → {"jobs":[{"id": "...", "filename":"...", "size": 1234} or {"filename":"...", "error":"..."}]}
    GET  /api/jobs/?limit=50  → list current principal's jobs (newest first)
      200 OK → {"jobs":[{"id":"...","filename":"...","size":1234,"status":"RUNNING","error":null,"detail_url":"/job/<id>/"}]}
    """
    parser_classes = [MultiPartParser, FormParser]

    # List my recent jobs
    def get(self, request):
        limit_raw = request.query_params.get("limit", "50")
        try:
            limit = max(1, min(200, int(limit_raw)))
        except Exception:
            limit = 50

        q = (
            UploadJob.objects
            .filter(**_principal_filter(request))
            .order_by("-created_at")[:limit]
        )

        payload = []
        for j in q:
            # always show the original file name
            filename = j.original_name or (Path(j.upload_rel or j.upload_path).name if j.upload_path else None)
            payload.append({
                "id": str(j.id),
                "filename": filename,
                "size": j.src_size,
                "status": j.status,
                "error": j.error,
                "detail_url": f"/job/{j.id}/",
            })

        return Response({"jobs": payload}, status=status.HTTP_200_OK)

    # Enqueue multiple files
    def post(self, request):
        files = request.FILES.getlist("files")
        if not files:
            return Response(
                {"detail": "No files provided.", "code": "no_files"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ensure session for anonymous users
        _ = _principal_filter(request)  # creates session_key if needed
        owner = _principal_filter(request)

        jobs_resp = []

        for f in files:
            try:
                src = save_upload(f)
            except ValueError as e:
                jobs_resp.append({"filename": f.name, "error": str(e)})
                continue
            except Exception as e:
                jobs_resp.append({"filename": f.name, "error": f"Upload error: {e}"})
                continue

            job = UploadJob.objects.create(
                upload_path=str(src),
                stored_name=Path(src).name,           # uuid.ext
                original_name=getattr(f, "name", ""), # original filename from client
                status=UploadJob.Status.PENDING,
                **owner,
            )

            t = threading.Thread(target=_run_job_in_bg, args=(job.id,), daemon=True)
            t.start()

            jobs_resp.append({
                "id": str(job.id),
                "filename": f.name,
                "size": getattr(f, "size", None),
            })

        return Response({"jobs": jobs_resp}, status=status.HTTP_202_ACCEPTED)


class JobDetailView(APIView):
    """
    GET    /api/jobs/<uuid>/    → job detail
    DELETE /api/jobs/<uuid>/    → delete job (and files) if principal owns it
    """
    def get(self, request, job_id: UUID):
        try:
            job = UploadJob.objects.get(id=job_id)
        except UploadJob.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not _principal_owns(request, job):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        payload = {
            "id": str(job.id),
            "status": job.status,
            "error": job.error,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
            "upload_rel": job.upload_rel,
            "normalized_rel": job.normalized_rel,
            "src_size": job.src_size,
            "wav_size": job.wav_size,
            "duration_sec": job.duration_sec,
            "full_text": job.full_text if job.status == UploadJob.Status.SUCCESS else None,
            "labels": job.labels if job.status == UploadJob.Status.SUCCESS else None,
            "detail_url": f"/job/{job.id}/",
            # Names:
            "original_name": job.original_name,
            "stored_name": job.stored_name,
        }
        return Response(payload, status=status.HTTP_200_OK)

    def delete(self, request, job_id: UUID):
        try:
            job = UploadJob.objects.get(id=job_id)
        except UploadJob.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not _principal_owns(request, job):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        job.delete()  # model.delete() removes files safely
        return Response(status=status.HTTP_204_NO_CONTENT)


class ASRHealthView(APIView):
    def get(self, request):
        from pathlib import Path

        p = settings.VOSK_MODEL_DIR
        exists = bool(p) and Path(p).exists()
        listing = []
        try:
            if exists:
                listing = sorted([x.name for x in Path(p).iterdir()][:10])  # first 10 entries
        except Exception as e:
            listing = [f"<ls error: {e}>"]

        return Response({
            "vosk_model_dir": p,
            "exists": exists,
            "sample_listing": listing,
        }, status=200 if exists else 503)



def _load_json(path: str | Path):
    try:
        p = Path(path)
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        pass
    return None


def _build_payload(job: UploadJob) -> dict:
    """
    Build export payload from model fields first; if transcript_text missing,
    try to read the guessed transcript JSON file.

    Output:
    {
      "job_id": "...",
      "filename": "...",
      "transcript_text": "...",
      "flags": [{"label": str, "text": str, "start_sec": float, "end_sec": float}, ...]
    }
    """
    # 1) Transcript text
    transcript = job.full_text or ""

    if not transcript:
      # Try to load from the guessed transcript path
      try:
          tpath = job.guess_transcript_path()
          if tpath:
              pdata = _load_json(tpath)
              if isinstance(pdata, dict):
                  # Common shapes
                  transcript = (
                      pdata.get("text")
                      or pdata.get("transcript")
                      or " ".join(seg.get("text", "") for seg in pdata.get("segments", []))
                      or ""
                  )
      except Exception:
          pass

    # 2) Flags from model.labels (list of [label, text, start, end])
    flags = []
    if isinstance(job.labels, list):
        for item in job.labels:
            if isinstance(item, (list, tuple)) and len(item) >= 4:
                label, text, start, end = item[0], item[1], item[2], item[3]
                flags.append({
                    "label": label,
                    "text": text,
                    "start_sec": float(start) if start is not None else 0.0,
                    "end_sec": float(end) if end is not None else 0.0,
                })
            elif isinstance(item, dict):
                # allow dict-form too
                flags.append({
                    "label": item.get("label") or item.get("type") or "flag",
                    "text": item.get("text") or item.get("span") or "",
                    "start_sec": float(item.get("start_sec") or item.get("start") or 0.0),
                    "end_sec": float(item.get("end_sec") or item.get("end") or 0.0),
                })

    filename = job.original_name or job.stored_name or (Path(job.upload_rel or job.upload_path).name if job.upload_path else "")

    return {
        "job_id": str(job.id),
        "filename": filename,
        "transcript_text": transcript,
        "flags": flags,
    }



def job_data(request, job_id):
    job = get_object_or_404(UploadJob, id=job_id)
    if not _principal_owns(request, job):   # FIX here
        return HttpResponseForbidden("Forbidden")
    if job.status != UploadJob.Status.SUCCESS:
        raise Http404("Job not finished")
    payload = _build_payload(job)
    return JsonResponse(payload, status=200, json_dumps_params={"ensure_ascii": False})


def job_export(request, job_id):
    job = get_object_or_404(UploadJob, id=job_id)
    if not _principal_owns(request, job):   # FIX here
        return HttpResponseForbidden("Forbidden")
    if job.status != UploadJob.Status.SUCCESS:
        raise Http404("Job not finished")

    payload = _build_payload(job)
    blob = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")

    base_name = (
        (getattr(job, "filename_original", None) or getattr(job, "filename", "") or "job")
        .rsplit(".", 1)[0]
    )
    fname = f'{slugify(base_name) or "job"}-transcript.json'

    resp = HttpResponse(blob, content_type="application/json; charset=utf-8")
    resp["Content-Disposition"] = f'attachment; filename="{fname}"'
    return resp

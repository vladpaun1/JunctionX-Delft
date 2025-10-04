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

    except FileNotFoundError:
        job.status = UploadJob.Status.FAILED
        job.error = "ASR resources not available."
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
        except FileNotFoundError:
            return Response(
                {"detail": "ASR resources not available.", "code": "asr_unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
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
            filename = Path(j.upload_rel or j.upload_path).name if j.upload_path else None
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
    GET /api/jobs/<uuid>/
    Returns single job info scoped to the current principal.
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
        }
        return Response(payload, status=status.HTTP_200_OK)

# backend/apps/web/api/views.py (full file)

import threading
from pathlib import Path
from uuid import UUID

from django.conf import settings
from django.utils import timezone
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from services.pipeline.steps import analyze_upload, save_upload
from apps.web.models import UploadJob  # adjust if your app label differs

VOSK_MODEL_DIR = getattr(settings, "VOSK_MODEL_DIR", None)  # ok if None


class PingView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "backend"})


# -----------------------------
# Legacy single-file (still works)
# -----------------------------
class AnalyzeView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get("file")
        if not f:
            return Response(
                {"detail": "No file provided.", "code": "no_file"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1) Pre-save validation & save
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

        p = Path(result["upload_path"])
        src_size = p.stat().st_size
        wav_size = Path(result["normalized_path"]).stat().st_size

        transcript = result.get("transcript") or {}
        length_sec = transcript.get("duration_sec", 0)

        def rel(pth: str) -> str:
            s = str(pth)
            i = s.find("/media/")
            return s[i:] if i >= 0 else s

        return Response(
            {
                "ok": True,
                "upload_rel": rel(result["upload_path"]),
                "normalized_rel": rel(result["normalized_path"]),
                "src_size": src_size,
                "wav_size": wav_size,
                "length_sec": round(float(length_sec or 0), 3),
                "full_text": result.get("full_text", ""),
                "labels": result.get("labels", []),
            },
            status=status.HTTP_200_OK,
        )


# -----------------------------
# Bulk jobs: enqueue + poll
# -----------------------------
def _run_job_in_bg(job_id: UUID):
    """Background job runner (thread)."""
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

        # compute sizes + rel paths
        src_size = Path(result["upload_path"]).stat().st_size
        wav_path = Path(result["normalized_path"])
        wav_size = wav_path.stat().st_size if wav_path.exists() else None

        transcript = result.get("transcript") or {}
        length_sec = float(transcript.get("duration_sec") or 0.0)

        def rel(pth: str) -> str:
            s = str(pth)
            i = s.find("/media/")
            return s[i:] if i >= 0 else s

        job.normalized_path = result.get("normalized_path")
        job.upload_rel = rel(result.get("upload_path", job.upload_path))
        job.normalized_rel = rel(result.get("normalized_path", "") or "")
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


class JobsView(APIView):
    """
    POST /api/jobs/
    FormData: files[]=... (multiple)
    Returns: {"jobs":[{"id": "...", "filename": "...", "size": 1234}]}
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        files = request.FILES.getlist("files")
        if not files:
            return Response({"detail": "No files provided.", "code": "no_files"},
                            status=status.HTTP_400_BAD_REQUEST)

        jobs_resp = []
        for f in files:
            try:
                src = save_upload(f)
            except ValueError as e:
                # For bulk, skip invalid files but report
                jobs_resp.append({"filename": f.name, "error": str(e)})
                continue
            except Exception as e:
                jobs_resp.append({"filename": f.name, "error": f"Upload error: {e}"})
                continue

            # Create job
            job = UploadJob.objects.create(
                upload_path=str(src),
                status=UploadJob.Status.PENDING,
            )

            # Kick off background thread
            t = threading.Thread(target=_run_job_in_bg, args=(job.id,), daemon=True)
            t.start()

            jobs_resp.append({"id": str(job.id), "filename": f.name, "size": getattr(f, "size", None)})

        return Response({"jobs": jobs_resp}, status=status.HTTP_202_ACCEPTED)


class JobDetailView(APIView):
    """
    GET /api/jobs/<uuid>/
    Returns job status + link target for details page
    """
    def get(self, request, job_id: UUID):
        try:
            job = UploadJob.objects.get(id=job_id)
        except UploadJob.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

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
            "detail_url": f"/job/{job.id}/",  # HTML page
        }
        return Response(payload, status=status.HTTP_200_OK)

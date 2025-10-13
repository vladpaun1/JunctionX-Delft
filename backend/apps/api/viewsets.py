# backend/apps/api/viewsets.py
from __future__ import annotations

import json
import shutil
import threading
from pathlib import Path
from uuid import UUID

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone

from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from apps.web.models import UploadJob
from .permissions import IsOwnerByPrincipal
from .serializers import UploadJobDetailSerializer, UploadJobListSerializer
from .utils import normalize_labels_list, principal_filter, rel_media_path
from services.pipeline.steps import analyze_upload, save_upload


VOSK_MODEL_DIR = getattr(settings, "VOSK_MODEL_DIR", None)


# ---------- helpers ----------

def _safe_rm(p: Path) -> None:
    try:
        if p.is_file() or p.is_symlink():
            p.unlink(missing_ok=True)
        elif p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
    except Exception:
        # Best-effort cleanup; intentionally swallow errors
        pass


def _run_job_in_bg(job_id: UUID) -> None:
    """Execute pipeline for a single job in a background thread."""
    job = UploadJob.objects.get(id=job_id)
    job.status = UploadJob.Status.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])

    try:
        result = analyze_upload(
            upload_path=Path(job.upload_path),
            model_path=VOSK_MODEL_DIR,
            use_mock=False,
        )

        src_p = Path(result["upload_path"])
        wav_p = Path(result["normalized_path"])

        transcript = result.get("transcript") or {}
        length_sec = float(transcript.get("duration_sec") or 0.0)

        job.normalized_path = result.get("normalized_path")
        job.upload_rel = rel_media_path(result.get("upload_path", job.upload_path))
        job.normalized_rel = rel_media_path(result.get("normalized_path", "") or "")
        job.src_size = src_p.stat().st_size if src_p.exists() else None
        job.wav_size = wav_p.stat().st_size if wav_p.exists() else None
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


# ---------- viewset ----------

class UploadJobViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Read/list/delete UploadJobs for the current principal (user or session).
    Use the custom 'bulk' action to enqueue multiple files.
    """
    parser_classes = [MultiPartParser, FormParser]
    # default permissions (overridden per-action below)
    permission_classes = [IsAuthenticatedOrReadOnly, IsOwnerByPrincipal]

    # Allow anonymous owner (session) to delete their own jobs
    def get_permissions(self):
        if self.action == "destroy":
            # Only enforce "owner by principal" (no auth required)
            return [IsOwnerByPrincipal()]
        if self.action == "bulk":
            # Anyone may upload; ownership is tied to user or session
            return [AllowAny()]
        return [IsAuthenticatedOrReadOnly(), IsOwnerByPrincipal()]

    def get_queryset(self):
        return (
            UploadJob.objects.filter(**principal_filter(self.request))
            .order_by("-created_at")
        )

    def get_serializer_class(self):
        return (
            UploadJobDetailSerializer
            if self.action in {"retrieve"}
            else UploadJobListSerializer
        )

    # POST /api/jobs/bulk/
    @action(detail=False, methods=["post"], url_path="bulk", permission_classes=[AllowAny])
    def bulk(self, request):
        files = request.FILES.getlist("files")
        if not files:
            return Response({"detail": "No files provided.", "code": "no_files"}, status=400)

        owner_kwargs = principal_filter(request)  # ensures session_key for anonymous
        jobs_resp = []

        for f in files:
            try:
                src = save_upload(f)  # returns absolute path under MEDIA_ROOT/uploads/...
            except ValueError as e:
                jobs_resp.append({"filename": f.name, "error": str(e)})
                continue
            except Exception as e:
                jobs_resp.append({"filename": f.name, "error": f"Upload error: {e}"})
                continue

            job = UploadJob.objects.create(
                upload_path=str(src),
                stored_name=Path(src).name,
                original_name=getattr(f, "name", ""),
                status=UploadJob.Status.PENDING,
                **owner_kwargs,
            )

            threading.Thread(target=_run_job_in_bg, args=(job.id,), daemon=True).start()

            jobs_resp.append({
                "id": str(job.id),
                "filename": f.name,
                "size": getattr(f, "size", None),
            })

        # Maintain legacy semantics (202 Accepted)
        return Response({"jobs": jobs_resp}, status=status.HTTP_202_ACCEPTED)

    # GET /api/jobs/{id}/data/
    @action(detail=True, methods=["get"], url_path="data")
    def data(self, request, pk=None):
        job = self.get_object()  # IsOwnerByPrincipal applies
        if job.status != UploadJob.Status.SUCCESS:
            return Response({"detail": "Job not finished."}, status=404)

        flags = []
        if isinstance(job.labels, list):
            for item in normalize_labels_list(job.labels):
                if isinstance(item, (list, tuple)) and len(item) >= 4:
                    label, text, start, end = item[0], item[1], item[2], item[3]
                    flags.append({
                        "label": label,
                        "text": text,
                        "start_sec": float(start) if start is not None else 0.0,
                        "end_sec": float(end) if end is not None else 0.0,
                    })
                elif isinstance(item, dict):
                    flags.append({
                        "label": item.get("label") or item.get("type") or "flag",
                        "text": item.get("text") or item.get("span") or "",
                        "start_sec": float(item.get("start_sec") or item.get("start") or 0.0),
                        "end_sec": float(item.get("end_sec") or item.get("end") or 0.0),
                    })

        filename = (
            job.original_name
            or job.stored_name
            or (Path(job.upload_rel or job.upload_path).name if job.upload_path else "")
        )

        return Response({
            "job_id": str(job.id),
            "filename": filename,
            "transcript_text": job.full_text or "",
            "flags": flags,
        })

    # GET /api/jobs/{id}/export/
    @action(detail=True, methods=["get"], url_path="export")
    def export(self, request, pk=None):
        job = self.get_object()
        if job.status != UploadJob.Status.SUCCESS:
            return Response({"detail": "Job not finished."}, status=404)

        payload = {
            "job_id": str(job.id),
            "filename": job.original_name or job.stored_name or "",
            "transcript_text": job.full_text or "",
            "flags": normalize_labels_list(job.labels or []),
        }
        blob = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        fname = (job.original_name or "job").rsplit(".", 1)[0] + "-transcript.json"

        resp = HttpResponse(blob, content_type="application/json; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="{fname}"'
        return resp

    # DELETE /api/jobs/{id}/
    def perform_destroy(self, instance: UploadJob) -> None:
        """
        Remove DB row and best-effort delete related artifacts:
          - original upload (uploads/)
          - normalized wav (normalized/)
          - transcript JSON (transcripts/<jobid>.json)
        """
        media_root = Path(settings.MEDIA_ROOT)

        candidates: list[Path] = []

        # original upload
        if instance.upload_rel:
            candidates.append(media_root / instance.upload_rel)
        elif instance.upload_path:
            try:
                candidates.append(Path(instance.upload_path))
            except Exception:
                pass

        # normalized audio
        if getattr(instance, "normalized_rel", ""):
            candidates.append(media_root / instance.normalized_rel)
        elif getattr(instance, "normalized_path", ""):
            candidates.append(Path(instance.normalized_path))

        # transcript JSON (conventional cache)
        candidates.append(media_root / "transcripts" / f"{instance.id}.json")

        for p in candidates:
            _safe_rm(p)

        super().perform_destroy(instance)

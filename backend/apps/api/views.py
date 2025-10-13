# backend/apps/api/views.py
from __future__ import annotations

import shutil
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.web.models import UploadJob
from .utils import principal_filter  # same helper used in the viewset


def _safe_rm(p: Path) -> None:
    """Best-effort remove a file/dir without raising."""
    try:
        if p.is_file() or p.is_symlink():
            p.unlink(missing_ok=True)
        elif p.is_dir():
            shutil.rmtree(p, ignore_errors=True)
    except Exception:
        pass


class PingView(APIView):
    def get(self, request):
        return JsonResponse({"status": "ok", "service": "backend"})


class ResetSessionView(APIView):
    """
    Flush the current anonymous session AND purge all jobs/files owned by it.
    Authenticated users are left alone; this is primarily for demo/testing flows.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        # Identify principal (for anonymous this captures session_key)
        owner_filter = principal_filter(request)

        # Collect jobs for this principal
        qs = UploadJob.objects.filter(**owner_filter)
        deleted_files = 0
        deleted_jobs = 0

        media_root = Path(settings.MEDIA_ROOT)

        # Remove artifacts per job, then delete the row
        for job in qs:
            # original upload
            if job.upload_rel:
                _safe_rm(media_root / job.upload_rel); deleted_files += 1
            elif job.upload_path:
                _safe_rm(Path(job.upload_path)); deleted_files += 1

            # normalized audio
            if getattr(job, "normalized_rel", ""):
                _safe_rm(media_root / job.normalized_rel); deleted_files += 1
            elif getattr(job, "normalized_path", ""):
                _safe_rm(Path(job.normalized_path)); deleted_files += 1

            # transcript json (conventional cache)
            _safe_rm(media_root / "transcripts" / f"{job.id}.json"); deleted_files += 1

            # delete the DB row
            job.delete()
            deleted_jobs += 1

        # Now flush the session (creates a new empty one)
        request.session.flush()

        return JsonResponse({
            "ok": True,
            "deleted_jobs": deleted_jobs,
            "deleted_file_entries": deleted_files,
        })

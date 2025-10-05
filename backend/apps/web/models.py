from __future__ import annotations
from uuid import uuid4
from pathlib import Path

from django.conf import settings
from django.db import models
from django.utils import timezone


class UploadJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING"
        RUNNING = "RUNNING"
        SUCCESS = "SUCCESS"
        FAILED = "FAILED"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    # Ownership
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="upload_jobs",
    )
    session_key = models.CharField(max_length=64, null=True, blank=True, db_index=True)

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )

    # File paths (absolute on disk) + relative paths
    upload_path = models.TextField()
    normalized_path = models.TextField(blank=True, null=True)
    upload_rel = models.CharField(max_length=512, blank=True, null=True)
    normalized_rel = models.CharField(max_length=512, blank=True, null=True)

    # Names
    original_name = models.CharField(max_length=255, blank=True, null=True)  # user-supplied
    stored_name = models.CharField(max_length=255, blank=True, null=True)    # uuid.ext on disk

    # Sizes & meta
    src_size = models.BigIntegerField(blank=True, null=True)
    wav_size = models.BigIntegerField(blank=True, null=True)
    duration_sec = models.FloatField(blank=True, null=True)

    full_text = models.TextField(blank=True, null=True)
    labels = models.JSONField(blank=True, null=True)  # list of [label, text, start, end]
    error = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.id} [{self.status}]"

    # ------------- Ownership helper -------------
    @staticmethod
    def principal_filter(request):
        if request.user.is_authenticated:
            return {"user": request.user}
        if not request.session.session_key:
            request.session.save()
        return {"session_key": request.session.session_key}
    
    class Meta:
        ordering = ['-created_at']   # newest first

    # ------------- Safe file cleanup helpers -------------
    def _inside_media(self, p: Path) -> bool:
        try:
            p = Path(p).resolve()
            media = Path(settings.MEDIA_ROOT).resolve()
            return str(p).startswith(str(media))
        except Exception:
            return False

    def _safe_unlink(self, p: str | None):
        if not p:
            return
        path = Path(p)
        if path.exists() and path.is_file() and self._inside_media(path):
            try:
                path.unlink()
            except Exception:
                # swallow unlink errors (e.g., already gone)
                pass

    def guess_transcript_path(self) -> str | None:
        """We didn't store transcript path on the model; reconstruct it."""
        up = self.upload_path
        if not up:
            return None
        stem = Path(up).stem
        return str(Path(settings.MEDIA_ROOT) / "transcripts" / f"{stem}.json")

    def delete_files(self):
        self._safe_unlink(self.upload_path)
        self._safe_unlink(self.normalized_path)
        self._safe_unlink(self.guess_transcript_path())

    # Ensure files are removed whenever a job row is deleted.
    def delete(self, using=None, keep_parents=False):
        self.delete_files()
        return super().delete(using=using, keep_parents=keep_parents)

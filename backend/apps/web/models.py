from __future__ import annotations
import json
from uuid import uuid4
from django.conf import settings
from django.db import models
from django.utils import timezone

class UploadJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING"
        RUNNING = "RUNNING"
        SUCCESS = "SUCCESS"
        FAILED  = "FAILED"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    # Ownership
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True, related_name="upload_jobs"
    )
    session_key = models.CharField(max_length=64, null=True, blank=True, db_index=True)

    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    upload_path = models.TextField()
    normalized_path = models.TextField(blank=True, null=True)

    upload_rel = models.CharField(max_length=512, blank=True, null=True)
    normalized_rel = models.CharField(max_length=512, blank=True, null=True)

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

    # Convenience helper used by views
    @staticmethod
    def principal_filter(request):
        if request.user.is_authenticated:
          return {"user": request.user}
        # ensure session key exists
        if not request.session.session_key:
            request.session.save()
        return {"session_key": request.session.session_key}

# from django.db import models

# Create your models here.
from __future__ import annotations
import json
from uuid import uuid4
from django.db import models
from django.utils import timezone


class UploadJob(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING"
        RUNNING = "RUNNING"
        SUCCESS = "SUCCESS"
        FAILED  = "FAILED"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    # Absolute filesystem paths (what your pipeline already uses)
    upload_path = models.TextField()
    normalized_path = models.TextField(blank=True, null=True)

    # Convenience mirrors for UI
    upload_rel = models.CharField(max_length=512, blank=True, null=True)
    normalized_rel = models.CharField(max_length=512, blank=True, null=True)

    # Sizes + duration
    src_size = models.BigIntegerField(blank=True, null=True)
    wav_size = models.BigIntegerField(blank=True, null=True)
    duration_sec = models.FloatField(blank=True, null=True)

    # Results
    full_text = models.TextField(blank=True, null=True)
    labels = models.JSONField(blank=True, null=True)  # list of [label, text, start, end]
    error = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(blank=True, null=True)
    finished_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"{self.id} [{self.status}]"

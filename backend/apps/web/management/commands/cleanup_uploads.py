from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.web.models import UploadJob


class Command(BaseCommand):
    help = "Delete upload jobs (and related files) older than the retention window."

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            help="Override the retention window in hours (defaults to settings.UPLOAD_RETENTION_HOURS).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many jobs would be deleted without removing anything.",
        )

    def handle(self, *args, **options):
        retention_hours = options.get("hours") or getattr(settings, "UPLOAD_RETENTION_HOURS", 24)
        cutoff = timezone.now() - timedelta(hours=retention_hours)

        qs = UploadJob.objects.filter(created_at__lt=cutoff).order_by("created_at")
        count = qs.count()
        if not count:
            self.stdout.write(f"No upload jobs older than {retention_hours}h to delete.")
            return

        if options.get("dry_run"):
            self.stdout.write(f"[dry-run] {count} jobs older than {retention_hours}h would be deleted.")
            return

        deleted = 0
        for job in qs.iterator():
            job.delete()  # cascades file cleanup via model override
            deleted += 1

        self.stdout.write(f"Deleted {deleted} upload jobs older than {retention_hours}h.")

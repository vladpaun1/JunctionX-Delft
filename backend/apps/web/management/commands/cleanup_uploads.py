
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.web.models import UploadJob


class Command(BaseCommand):
    help = "Delete UploadJob rows (and files) older than N days."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=7)
        parser.add_argument(
            "--status",
            choices=["ALL", "SUCCESS", "FAILED", "PENDING", "RUNNING"],
            default="ALL",
        )

    def handle(self, *args, **opts):
        cutoff = timezone.now() - timedelta(days=opts["days"])
        qs = UploadJob.objects.filter(created_at__lt=cutoff)
        if opts["status"] != "ALL":
            qs = qs.filter(status=opts["status"])
        count = 0
        for job in qs.iterator():
            job.delete()  # cascades file deletion
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Deleted {count} jobs."))

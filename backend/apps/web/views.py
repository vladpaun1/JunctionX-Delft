from pathlib import Path
from django.views.generic import TemplateView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.shortcuts import get_object_or_404, render
from django.http import HttpResponseForbidden

from apps.web.models import UploadJob

def principal_owns(request, job: UploadJob) -> bool:
    if request.user.is_authenticated:
        return job.user_id == request.user.id
    if not request.session.session_key:
        request.session.save()
    return job.session_key == request.session.session_key

@method_decorator(ensure_csrf_cookie, name="dispatch")
class UploadView(TemplateView):
    template_name = "web/upload.html"

class JobDetailPage(TemplateView):
    template_name = "web/job_detail.html"

    def get(self, request, job_id):
        job = get_object_or_404(UploadJob, id=job_id)
        if not principal_owns(request, job):
            return HttpResponseForbidden("Forbidden")
        return render(request, self.template_name, {
            "job": job,
            "ok": job.status == UploadJob.Status.SUCCESS,
        })

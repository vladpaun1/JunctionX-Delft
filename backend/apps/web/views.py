# backend/apps/web/views.py
from pathlib import Path

from django.contrib import messages
from django.contrib.auth import logout
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404, render, redirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.generic import TemplateView

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
        return render(
            request,
            self.template_name,
            {
                "job": job,
                "ok": job.status == UploadJob.Status.SUCCESS,
            },
        )


# --------- DEV-ONLY: reset identity (new anonymous session) ----------
def reset_session(request):
    """
    Dev helper: delete all jobs for the current principal (and their files),
    then log out & flush the session to issue a brand-new session key.

    Ownership rules:
      - If authenticated: delete all jobs where user == request.user
      - Else: ensure a session_key and delete all jobs with that session_key
    """
    # Determine current principal BEFORE we flush the session
    if request.user.is_authenticated:
        qs = UploadJob.objects.filter(user=request.user)
        scope_desc = "your user account"
    else:
        if not request.session.session_key:
            request.session.save()  # ensure session exists
        sess = request.session.session_key
        qs = UploadJob.objects.filter(session_key=sess)
        scope_desc = f"anonymous session {sess[:8]}"

    # Delete rows one-by-one so UploadJob.delete() runs and files are cleaned
    deleted = 0
    for job in qs.iterator():
        try:
            job.delete()  # calls model.delete() → delete_files()
            deleted += 1
        except Exception:
            # swallow errors so a bad file doesn't block the rest
            pass

    # Now drop auth and flush the session (new sessionid is created)
    logout(request)
    request.session.flush()

    messages.success(
        request,
        f"Reset done. Removed {deleted} job(s) for {scope_desc}. "
        "A fresh anonymous session has been started."
    )
    return redirect("upload")

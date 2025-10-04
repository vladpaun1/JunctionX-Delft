# backend/apps/web/urls.py
from django.urls import path
from apps.api.views import (
    PingView, AnalyzeView, JobsView, JobDetailView, ASRHealthView
)
from apps.web.views import UploadView, JobDetailPage, reset_session

urlpatterns = [
    path("", UploadView.as_view(), name="upload"),
    path("job/<uuid:job_id>/", JobDetailPage.as_view(), name="job_detail"),
    path("reset-session/", reset_session, name="reset_session"),

    # API
    path("api/ping/",   PingView.as_view()),
    path("api/analyze/", AnalyzeView.as_view()),
    path("api/jobs/",    JobsView.as_view()),
    path("api/jobs/<uuid:job_id>/", JobDetailView.as_view()),
    path("api/asr-health/", ASRHealthView.as_view()),
]

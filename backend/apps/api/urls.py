from django.urls import path
# backend/apps/web/api/urls.py
from .views import PingView, AnalyzeView, JobsView, JobDetailView, ASRHealthView
urlpatterns = [
    path("ping/", PingView.as_view(), name="ping"),
    path("asr/health/", ASRHealthView.as_view(), name="asr-health"),
    path("analyze/", AnalyzeView.as_view(), name="analyze"),
    path("jobs/", JobsView.as_view(), name="jobs-create"),
    path("jobs/<uuid:job_id>/", JobDetailView.as_view(), name="jobs-detail"),
]

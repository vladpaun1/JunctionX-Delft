from django.urls import path
from .views import PingView, AnalyzeView, JobsView, JobDetailView

urlpatterns = [
    path("ping/", PingView.as_view(), name="ping"),
    # legacy single-file endpoint (kept for compatibility)
    path("analyze/", AnalyzeView.as_view(), name="analyze"),
    # new bulk jobs
    path("jobs/", JobsView.as_view(), name="jobs-create"),
    path("jobs/<uuid:job_id>/", JobDetailView.as_view(), name="jobs-detail"),
]

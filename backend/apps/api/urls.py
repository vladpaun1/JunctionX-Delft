from django.urls import path
from .views import PingView, AnalyzeView, JobsView, JobDetailView

urlpatterns = [
    path("ping/", PingView.as_view(), name="ping"),
    path("analyze/", AnalyzeView.as_view(), name="analyze"),
    path("jobs/", JobsView.as_view(), name="jobs-create"),          # POST (enqueue) + GET (list mine)
    path("jobs/<uuid:job_id>/", JobDetailView.as_view(), name="jobs-detail"),
]
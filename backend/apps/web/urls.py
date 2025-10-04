from django.urls import path
from .views import UploadView, JobDetailPage

urlpatterns = [
    path("", UploadView.as_view(), name="upload"),
    path("job/<uuid:job_id>/", JobDetailPage.as_view(), name="job-detail"),
]

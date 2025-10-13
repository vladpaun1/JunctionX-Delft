# backend/apps/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .viewsets import UploadJobViewSet
from .views import ResetSessionView, PingView

router = DefaultRouter()
router.register(r"jobs", UploadJobViewSet, basename="jobs")

urlpatterns = [
    path("", include(router.urls)),
    path("ping/", PingView.as_view(), name="ping"),
    path("reset-session/", ResetSessionView.as_view(), name="reset_session"),  # NEW
]

# backend/apps/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .viewsets import UploadJobViewSet
from .views import PingView, ResetSessionView

router = DefaultRouter()
router.register(r"jobs", UploadJobViewSet, basename="uploadjob")

urlpatterns = [
    path("ping/", PingView.as_view(), name="api-ping"),
    path("reset-session/", ResetSessionView.as_view(), name="api-reset-session"),
    path("", include(router.urls)),
]

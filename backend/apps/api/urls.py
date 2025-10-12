# backend/apps/api/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .viewsets import UploadJobViewSet
from .views import PingView

router = DefaultRouter()
router.register(r"jobs", UploadJobViewSet, basename="jobs")

urlpatterns = [
    path("ping/", PingView.as_view(), name="api-ping"),
    path("", include(router.urls)),
]

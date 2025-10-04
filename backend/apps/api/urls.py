from django.urls import path
from .views import PingView, AnalyzeView

urlpatterns = [
    path("ping/", PingView.as_view(), name="ping"),
    path("analyze/", AnalyzeView.as_view(), name="analyze"),
]
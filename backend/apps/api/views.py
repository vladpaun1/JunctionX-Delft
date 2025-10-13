# backend/apps/api/views.py
from __future__ import annotations
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

class PingView(APIView):
    def get(self, request):
        return JsonResponse({"status": "ok", "service": "backend"})

class ResetSessionView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """
        Flush the current session (useful for anonymous testing/demo).
        """
        request.session.flush()
        return JsonResponse({"ok": True})

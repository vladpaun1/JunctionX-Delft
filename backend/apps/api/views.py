# backend/apps/web/api/views.py (full file)

from __future__ import annotations
from rest_framework.response import Response
from rest_framework.views import APIView



# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

class PingView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "backend"})
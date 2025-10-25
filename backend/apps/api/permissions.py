# backend/apps/api/permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS
from apps.web.models import UploadJob

class IsOwnerByPrincipal(BasePermission):
    """
    Allow access to an UploadJob only if it belongs to:
      - request.user (if authenticated), or
      - request.session.session_key (anonymous).
    """

    def has_object_permission(self, request, view, obj: UploadJob):
        if request.user.is_authenticated:
            return obj.user_id == getattr(request.user, "id", None)
        # ensure session exists
        if not request.session.session_key:
            request.session.save()
        return obj.session_key == request.session.session_key

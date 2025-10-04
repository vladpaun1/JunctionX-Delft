import traceback
from pathlib import Path

from django.conf import settings
from django.contrib import messages
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views import View
from services.pipeline.steps import analyze_upload, save_upload


from django.views.generic import TemplateView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie


@method_decorator(ensure_csrf_cookie, name="dispatch")
class UploadView(TemplateView):
    """
    Pure template render. All analyze work happens via /api/analyze/.
    ensure_csrf_cookie guarantees the CSRF cookie for the JS fetch client.
    """
    template_name = "web/upload.html"

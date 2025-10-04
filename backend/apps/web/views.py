import traceback
from pathlib import Path

from django.conf import settings
from django.contrib import messages
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views import View
from services.pipeline.steps import analyze_upload, save_upload


class UploadView(View):
    template_name = "upload.html"

    def get(self, request: HttpRequest) -> HttpResponse:
        return render(request, self.template_name)

    def post(self, request: HttpRequest) -> HttpResponse:
        f = request.FILES.get("file")
        if not f:
            messages.error(request, "Please choose an audio or video file.")
            return render(request, self.template_name, status=400)

        try:
            src = save_upload(f)

            result = analyze_upload(
                upload_path=Path(src),
                model_path=None,
                use_mock=False,
            )

            transcript = result["transcript"]
            src_size = Path(src).stat().st_size
            wav_size = Path(result["normalized_path"]).stat().st_size
            length_sec = transcript.get("duration_sec", 0)

            context = {
                "ok": True,
                "upload_path": result["upload_path"],
                "normalized_path": result["normalized_path"],
                "transcript_path": result["transcript_path"],
                "src_size": src_size,
                "wav_size": wav_size,
                "length_sec": round(length_sec, 3),
                "transcript": transcript,
            }
            return render(request, self.template_name, context)

        except Exception as e:
            # Capture full stack trace as a string
            stack_trace = traceback.format_exc()

            # Option 1: log it (recommended for Django)
            print(stack_trace)  # or use logging.error(stack_trace)

            # Option 2: show a generic error to the user
            messages.error(request, f"Processing failed: {e}")

            # (optional) If you want to also show the trace in the template (not recommended in prod):
            # messages.error(request, stack_trace)

            return render(request, self.template_name, status=500)

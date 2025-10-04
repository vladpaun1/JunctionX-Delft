from pathlib import Path

from django.conf import settings
from django.contrib import messages
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views import View
from services.pipeline.steps import analyze_upload, save_upload


class UploadView(View):
    """
    Simple HTML-based upload interface:
    - GET → render form
    - POST → save upload, normalize audio, (mock) transcribe, show metadata
    """

    template_name = "upload.html"

    def get(self, request: HttpRequest) -> HttpResponse:
        """Render the upload form."""
        return render(request, self.template_name)

    def post(self, request: HttpRequest) -> HttpResponse:
        """Handle file upload and analysis pipeline."""
        f = request.FILES.get("file")
        if not f:
            messages.error(request, "Please choose an audio or video file.")
            return render(request, self.template_name, status=400)

        try:
            # Step 1: save upload to media/uploads
            src = save_upload(f)

            # Step 2: run normalization + ASR (mock for MVP)
            result = analyze_upload(
                upload_path=Path(src),
                model_path=None,
                use_mock=True,  # set to False once VoskASREngine is ready
            )

            transcript = result["transcript"]

            # Step 3: collect metadata for display
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
            messages.error(request, f"Processing failed: {e}")
            return render(request, self.template_name, status=500)

from pathlib import Path

from django.contrib import messages
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.views import View

from backend.services.pipeline.steps import (
    ffmpeg_normalize_to_wav_mono16,
    mock_vosk,
    save_upload,
)


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
            wav = ffmpeg_normalize_to_wav_mono16(src)
            # mock Vosk
            transcript = mock_vosk(wav)

            # metadata
            src_size = Path(src).stat().st_size
            wav_size = Path(wav).stat().st_size
            length_sec = transcript["duration_sec"]

            context = {
                "ok": True,
                "upload_path": str(src),
                "normalized_path": str(wav),
                "src_size": src_size,
                "wav_size": wav_size,
                "length_sec": length_sec,
                "transcript": transcript,
            }
            return render(request, self.template_name, context)
        except Exception as e:
            messages.error(request, f"Processing failed: {e}")
            return render(request, self.template_name, status=500)

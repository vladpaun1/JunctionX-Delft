# backend/apps/web/api/views.py (full file for easy paste)

from pathlib import Path
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from django.conf import settings

from services.pipeline.steps import analyze_upload, save_upload


VOSK_MODEL_DIR = settings.VOSK_MODEL_DIR

class PingView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "backend"})


class AnalyzeView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        f = request.FILES.get("file")
        if not f:
            return Response(
                {"detail": "No file provided.", "code": "no_file"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1) Pre-save validation & save
        try:
            src = save_upload(f)
        except ValueError as e:
            # Raised by save_upload for disallowed types
            return Response(
                {"detail": str(e), "code": "unsupported_media_type"},
                status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )
        except Exception as e:
            return Response(
                {"detail": f"Failed to accept upload: {e}", "code": "upload_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 2) Analyze (convert -> ASR -> labels)
        try:
            result = analyze_upload(
                upload_path=Path(src),
                model_path=VOSK_MODEL_DIR,
                use_mock=False,  # we don't use the mock anymore
            )
        except ValueError as e:
            return Response(
                {"detail": str(e), "code": "conversion_failed"},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except FileNotFoundError:
            return Response(
                {"detail": "ASR resources not available.", "code": "asr_unavailable"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as e:
            return Response(
                {"detail": f"Analysis failed: {e}", "code": "analysis_error"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # 3) Success payload
        p = Path(result["upload_path"])
        src_size = p.stat().st_size
        wav_size = Path(result["normalized_path"]).stat().st_size

        transcript = result.get("transcript") or {}
        length_sec = transcript.get("duration_sec", 0)

        # relative media paths
        media_idx = str(result["upload_path"]).find("/media/")
        upload_rel = result["upload_path"][media_idx:] if media_idx >= 0 else result["upload_path"]

        media_idx2 = str(result["normalized_path"]).find("/media/")
        normalized_rel = result["normalized_path"][media_idx2:] if media_idx2 >= 0 else result["normalized_path"]

        return Response(
            {
                "ok": True,
                "upload_rel": upload_rel,
                "normalized_rel": normalized_rel,

                # sizes + duration (kept because they’re useful in UI)
                "src_size": src_size,
                "wav_size": wav_size,
                "length_sec": round(length_sec, 3),

                # NEW: what the UI actually needs
                "full_text": result.get("full_text", ""),
                "labels": result.get("labels", []),  # list of [label, text, start, end]
            },
            status=status.HTTP_200_OK,
        )

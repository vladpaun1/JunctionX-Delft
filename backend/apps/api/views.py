from pathlib import Path
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from services.pipeline.steps import analyze_upload, save_upload


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

        use_mock = request.data.get("use_mock", "true").lower() in ("1", "true", "yes", "y")

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

        # 2) Analyze (convert -> ASR)
        try:
            result = analyze_upload(
                upload_path=Path(src),
                model_path=None,
                use_mock=use_mock,
            )
        except ValueError as e:
            # From convert_file() when ffmpeg can’t process (corrupt/unsupported media)
            return Response(
                {"detail": str(e), "code": "conversion_failed"},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except FileNotFoundError as e:
            # Likely missing ASR model or resource
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
        transcript = result["transcript"]
        length_sec = transcript.get("duration_sec", 0)

        return Response(
            {
                "ok": True,
                "upload_path": result["upload_path"],
                "normalized_path": result["normalized_path"],
                "transcript_path": result["transcript_path"],
                "src_size": src_size,
                "wav_size": wav_size,
                "length_sec": round(length_sec, 3),
                "transcript": transcript,
            },
            status=status.HTTP_200_OK,
        )

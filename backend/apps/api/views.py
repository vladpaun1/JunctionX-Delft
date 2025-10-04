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
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

        use_mock = request.data.get("use_mock", "true").lower() in ("1", "true", "yes", "y")
        try:
            src = save_upload(f)
            result = analyze_upload(
                upload_path=Path(src),
                model_path=None,
                use_mock=use_mock,
            )
            p = Path(result["upload_path"])
            src_size = p.stat().st_size
            wav_size = Path(result["normalized_path"]).stat().st_size
            transcript = result["transcript"]
            length_sec = transcript.get("duration_sec", 0)

            return Response({
                "ok": True,
                "upload_path": result["upload_path"],
                "normalized_path": result["normalized_path"],
                "transcript_path": result["transcript_path"],
                "src_size": src_size,
                "wav_size": wav_size,
                "length_sec": round(length_sec, 3),
                "transcript": transcript,
            })
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

"""
Pipeline utilities for handling uploads, audio normalization, and ASR transcription.

- save_upload():  save Django-uploaded files to /media/uploads
- normalize_audio(): convert any media file to 16 kHz mono 16-bit PCM WAV
- transcribe_audio(): run real Vosk transcription
- mock_vosk():  mock ASR for demo mode
- analyze_upload(): main orchestrator used by API/view
"""

from __future__ import annotations

import json
import subprocess
import uuid
import wave
from pathlib import Path
from typing import Any, Dict

from django.conf import settings

# ---------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------
MEDIA_ROOT = Path(settings.MEDIA_ROOT)
UPLOAD_DIR = MEDIA_ROOT / "uploads"
NORMALIZED_DIR = MEDIA_ROOT / "normalized"
TRANSCRIPTS_DIR = MEDIA_ROOT / "transcripts"


# ---------------------------------------------------------------------
# Upload handling
# ---------------------------------------------------------------------
def save_upload(django_file) -> Path:
    """Save a Django-uploaded file under MEDIA_ROOT/uploads/<uuid>.<ext>"""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    uid = uuid.uuid4().hex
    ext = Path(django_file.name).suffix or ""
    out = UPLOAD_DIR / f"{uid}{ext}"
    with open(out, "wb") as f:
        for chunk in django_file.chunks():
            f.write(chunk)
    return out


# ---------------------------------------------------------------------
# Normalization (ffmpeg)
# ---------------------------------------------------------------------
def normalize_audio(input_file: Path, output_file: Path) -> Path:
    """
    Convert arbitrary audio/video to 16 kHz mono WAV PCM16 using ffmpeg.
    """
    output_file.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_file),
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(output_file),
    ]
    subprocess.run(
        cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    return output_file


def ffmpeg_normalize_to_wav_mono16(src: Path) -> Path:
    """Convenience wrapper for normalize_audio() that auto-names the output."""
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    dst = NORMALIZED_DIR / (src.stem + ".wav")
    return normalize_audio(src, dst)


# ---------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------
def wav_duration_seconds(wav_path: Path) -> float:
    """Return duration (seconds) of a WAV file."""
    with wave.open(str(wav_path), "rb") as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        return frames / float(rate)


# ---------------------------------------------------------------------
# Mock + Real ASR
# ---------------------------------------------------------------------
def mock_vosk(wav_path: Path) -> Dict[str, Any]:
    """Return fake ASR result for MVP demo."""
    dur = wav_duration_seconds(wav_path)
    return {
        "engine": "mock-vosk",
        "text": "(mock) transcription pending",
        "duration_sec": round(dur, 3),
        "sample_rate": 16000,
        "words": [],
    }


def transcribe_audio(
    input_file: Path, model_path: Path, transcript_out: Path
) -> Dict[str, Any]:
    """
    Run Vosk transcription and persist transcript JSON.
    """
    from services.asr import \
        VoskASREngine  # lazy import so project can start without model

    asr = VoskASREngine(model_path)
    transcript = asr.transcribe(str(input_file))

    transcript_out.parent.mkdir(parents=True, exist_ok=True)
    transcript_out.write_text(json.dumps(transcript, indent=2))
    return transcript


# ---------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------
def analyze_upload(
    upload_path: Path, model_path: Path | None = None, use_mock: bool = True
) -> Dict[str, Any]:
    """
    Orchestrate: normalize → (mock or real ASR) → return transcript dict.
    """
    # Step 1: Normalize
    norm_path = NORMALIZED_DIR / (upload_path.stem + ".wav")
    normalize_audio(upload_path, norm_path)

    # Step 2: Transcribe
    transcript_path = TRANSCRIPTS_DIR / (upload_path.stem + ".json")
    if use_mock:
        transcript = mock_vosk(norm_path)
        transcript_path.parent.mkdir(parents=True, exist_ok=True)
        transcript_path.write_text(json.dumps(transcript, indent=2))
    else:
        transcript = transcribe_audio(norm_path, model_path, transcript_path)

    return {
        "upload_path": str(upload_path),
        "normalized_path": str(norm_path),
        "transcript_path": str(transcript_path),
        "transcript": transcript,
    }

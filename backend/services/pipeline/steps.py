"""
Pipeline utilities for handling uploads, audio normalization, and ASR transcription.

- save_upload():  save Django-uploaded files to /media/uploads
- convert_file(): convert any media file to 16 kHz mono 16-bit PCM WAV
- transcribe_audio(): run real Vosk transcription
- mock_vosk():  mock ASR for demo mode
- analyze_upload(): main orchestrator used by API/view
"""

from __future__ import annotations

import numpy as np
import json
import subprocess
import uuid
import wave
from pathlib import Path
from typing import Any, Dict

from profanity_check import predict, predict_prob

from django.conf import settings

# ---------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------
MEDIA_ROOT = Path(settings.MEDIA_ROOT)
UPLOAD_DIR = MEDIA_ROOT / "uploads"
NORMALIZED_DIR = MEDIA_ROOT / "normalized"
TRANSCRIPTS_DIR = MEDIA_ROOT / "transcripts"
ARTIFACTS = settings.LABEL_MODEL_DIR


# ---------------------------------------------------------------------
# Upload handling (with type validation)
# ---------------------------------------------------------------------
ALLOWED_MIME_PREFIXES = ("audio/", "video/")
ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".oga", ".opus",
    ".wma", ".amr", ".aiff", ".aif", ".mp4", ".m4v", ".mov", ".mkv",
    ".webm", ".avi",
}

def save_upload(django_file) -> Path:
    """
    Save a Django-uploaded file under MEDIA_ROOT/uploads/<uuid>.<ext>.
    Rejects non-audio/video files *before* writing to disk.

    Raises:
        ValueError: if file type is not allowed (includes original filename).
    """
    original_name = getattr(django_file, "name", "uploaded file")
    content_type = getattr(django_file, "content_type", "") or ""
    ext = Path(original_name).suffix.lower()

    # --- Validation ---
    if not (
        any(content_type.startswith(p) for p in ALLOWED_MIME_PREFIXES)
        or ext in ALLOWED_EXTENSIONS
    ):
        raise ValueError(
            f"File type not allowed: '{original_name}'. "
            "Please upload an audio or video file."
        )

    # --- Save file ---
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    uid = uuid.uuid4().hex
    out = UPLOAD_DIR / f"{uid}{ext}"

    with open(out, "wb") as f:
        for chunk in django_file.chunks():
            f.write(chunk)

    return out


# ---------------------------------------------------------------------
# Media conversion (ffmpeg)
# ---------------------------------------------------------------------
def convert_file(input_file: Path, output_file: Path) -> Path:
    """
    Convert any supported audio/video file to 16 kHz mono 16-bit PCM WAV using ffmpeg.
    Raises ValueError if the file cannot be converted (e.g., not a valid media file).
    """
    output_file.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_file),
        "-ar", "16000",  # sample rate
        "-ac", "1",      # mono
        "-c:a", "pcm_s16le",  # 16-bit PCM
        str(output_file),
    ]
    try:
        subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as e:
        raise ValueError(
            f"Failed to convert file '{input_file.name}'. "
            "Ensure it is a valid audio or video file."
        ) from e

    return output_file


def ffmpeg_convert_to_wav_mono16(src: Path) -> Path:
    """Convenience wrapper for convert_file() that auto-names the output WAV."""
    NORMALIZED_DIR.mkdir(parents=True, exist_ok=True)
    dst = NORMALIZED_DIR / (src.stem + ".wav")
    return convert_file(src, dst)



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


# def transcribe_audio(
#     input_file: Path, model_path: Path, transcript_out: Path
# ) -> Dict[str, Any]:
#     """
#     Run Vosk transcription and persist transcript JSON.
#     """
#     from services.asr import \
#         VoskASREngine  # lazy import so project can start without model
#     asr = VoskASREngine(model_path)
#     transcript = asr.transcribe(str(input_file))
#
#     transcript_out.parent.mkdir(parents=True, exist_ok=True)
#     transcript_out.write_text(json.dumps(transcript, indent=2))
#     return transcript

def transcribe_audio(input_file: Path, model_path: Path, transcript_out: Path) -> dict:
    """
    Run Whisper transcription (model_path may be a model name or local path).
    """
    from services.asr import WhisperASREngine

    # You can pass a model name ("tiny", "small", "medium", "base.en") or a local path
    engine = WhisperASREngine(
        # model_name_or_path=str(model_path) if model_path else "base.en",
        model_name_or_path="base.en",
        device=None,          # auto: "cuda" if available else "cpu"
        compute_type=None,    # auto: int8 / int8_float16
        language="en",        # auto-detect; set "en" to lock English
        beam_size=1,          # greedy = fastest
        vad_filter=True,
        enable_word_timestamps=False,  # set True if you need per-word timings
    )
    transcript = engine.transcribe(str(input_file))

    transcript_out.parent.mkdir(parents=True, exist_ok=True)
    transcript_out.write_text(json.dumps(transcript, indent=2))
    return transcript

# ---------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------
def analyze_upload(
    upload_path: Path, model_path: Path | None = None, use_mock: bool = False
) -> Dict[str, Any]:
    """
    Orchestrate: normalize → (mock or real ASR) → return transcript dict.
    """
    # Step 1: Normalize
    norm_path = NORMALIZED_DIR / (upload_path.stem + ".wav")
    convert_file(upload_path, norm_path)

    # Step 2: Transcribe
    transcript_path = TRANSCRIPTS_DIR / (upload_path.stem + ".json")
    if use_mock:
        transcript = mock_vosk(norm_path)
        transcript_path.parent.mkdir(parents=True, exist_ok=True)
        transcript_path.write_text(json.dumps(transcript, indent=2))
    else:
        transcript = transcribe_audio(norm_path, model_path, transcript_path)

    print(transcript)

    # Step 3: formats json data into sentences: [sentence, start time, end time]
    n = len(transcript['segments'])
    timestamps = []
    texts = []
    for seg in transcript['segments']:
        texts.append(seg.get('text', ''))

        res = seg.get('result') or []
        if res:
            start = res[0].get('start', 0)
            end   = res[-1].get('end', start)
        else:
            # FinalResult or empty word list → no word-level times
            # keep None so the UI can still show the span & label
            start = None
            end   = None

        timestamps.append([start, end])

    from services.label.model.predictor import TextPredictor
    TextPredictor.load(ARTIFACTS)

    labels = TextPredictor.predict(texts)
    result = []
    for i in range(n):
        result.append([labels[i], texts[i], timestamps[i][0], timestamps[i][1]])


    full_text = " ".join(texts)

    return {
        "upload_path": str(upload_path),
        "normalized_path": str(norm_path),
        "transcript_path": str(transcript_path),
        "transcript": transcript,
        # NEW:
        "full_text": full_text,
        "labels": result,  # list of [label, text, start, end]
    }

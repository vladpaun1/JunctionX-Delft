import json
from pathlib import Path
from services.asr import VoskASREngine

MEDIA_ROOT = Path("backend/media")


def normalize_audio(input_file: Path, output_file: Path):
    """
    Convert arbitrary user-uploaded file into 16kHz mono WAV PCM16.
    Use ffmpeg/sox here.
    """
    import subprocess
    output_file.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-i", str(input_file),
        "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
        str(output_file)
    ]
    subprocess.run(cmd, check=True)
    return output_file


def transcribe_audio(input_file: Path, model_path: Path, transcript_out: Path):
    asr = VoskASREngine(model_path)
    transcript = asr.transcribe(str(input_file))

    transcript_out.parent.mkdir(parents=True, exist_ok=True)
    transcript_out.write_text(json.dumps(transcript, indent=2))
    return transcript


def analyze_upload(upload_path: Path, model_path: Path):
    # Step 1: Normalize
    norm_path = MEDIA_ROOT / "normalized" / (upload_path.stem + ".wav")
    normalize_audio(upload_path, norm_path)

    # Step 2: Transcribe
    transcript_path = MEDIA_ROOT / "transcripts" / (upload_path.stem + ".json")
    transcript = transcribe_audio(norm_path, model_path, transcript_path)

    return transcript


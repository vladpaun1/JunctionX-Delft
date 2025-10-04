import json
import wave
from pathlib import Path

from vosk import KaldiRecognizer, Model


class VoskASREngine:
    def __init__(self, model_path: str | None = None):
        """
        Initialize the ASR engine.
        If model_path is None, use the default small English model bundled with Vosk.
        """
        if model_path is None:
            try:
                self.model = Model(lang="en-us")
            except Exception as e:
                raise RuntimeError(
                    "Failed to load default Vosk English model. "
                    "Make sure vosk is installed with its language models."
                ) from e
        else:
            print("AHHHHHHHHHHHHHHHHHHHH")
            model_dir = Path(model_path)
            if not model_dir.exists():
                raise FileNotFoundError(f"Vosk model not found at {model_dir}")
            self.model = Model(str(model_dir))

    def transcribe(self, wav_path: str) -> dict:
        """Transcribe a normalized mono 16-bit WAV file into JSON transcript."""
        with wave.open(wav_path, "rb") as wf:
            if (
                wf.getnchannels() != 1
                or wf.getsampwidth() != 2
                or wf.getframerate() not in [8000, 16000]
            ):
                raise ValueError("Input WAV must be mono PCM16 with 8k/16k sample rate")

            sample_rate = wf.getframerate()
            frames = wf.getnframes()
            duration_from_header = frames / float(sample_rate) if sample_rate else 0.0

            rec = KaldiRecognizer(self.model, sample_rate)
            rec.SetWords(True)

            segments = []
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                if rec.AcceptWaveform(data):
                    segments.append(json.loads(rec.Result()))

            segments.append(json.loads(rec.FinalResult()))

        # Build overall text
        overall_text = " ".join(s.get("text", "") for s in segments).strip()

        # Derive duration from last word 'end' (if available) and fall back to header
        last_end = 0.0
        for s in segments:
            for w in s.get("result", []) or []:
                try:
                    e = float(w.get("end", 0) or 0)
                    if e > last_end:
                        last_end = e
                except (TypeError, ValueError):
                    pass

        duration_sec = max(last_end, duration_from_header)

        # Optional: flattened words array (handy for UI/metrics)
        words = []
        for s in segments:
            for w in s.get("result", []) or []:
                words.append(w)

        transcript = {
            "text": overall_text,
            "segments": segments,           # raw Vosk result chunks
            "words": words,                 # flattened words with start/end/conf
            "duration_sec": round(float(duration_sec), 3),
            "sample_rate": sample_rate,
        }
        return transcript

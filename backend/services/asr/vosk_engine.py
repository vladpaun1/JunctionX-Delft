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
            # Use the built-in small English model
            try:
                self.model = Model(lang="en-us")
            except Exception as e:
                raise RuntimeError(
                    "Failed to load default Vosk English model. "
                    "Make sure vosk is installed with its language models."
                ) from e
        else:
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

            rec = KaldiRecognizer(self.model, wf.getframerate())
            rec.SetWords(True)

            results = []
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                if rec.AcceptWaveform(data):
                    results.append(json.loads(rec.Result()))

            results.append(json.loads(rec.FinalResult()))

        # Combine text + segments
        transcript = {
            "text": " ".join(r.get("text", "") for r in results).strip(),
            "segments": results,
        }
        return transcript

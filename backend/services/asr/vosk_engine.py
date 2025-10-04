import json
import wave
from vosk import Model, KaldiRecognizer
from pathlib import Path


class VoskASREngine:
    def __init__(self, model_path: str):
        model_dir = Path(model_path)
        if not model_dir.exists():
            raise FileNotFoundError(f"Vosk model not found at {model_dir}")
        self.model = Model(str(model_dir))

    def transcribe(self, wav_path: str) -> dict:
        """Transcribe a normalized mono 16-bit WAV file into JSON transcript."""
        with wave.open(wav_path, "rb") as wf:
            if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() not in [8000, 16000]:
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

        # combine text + words
        transcript = {
            "text": " ".join(r.get("text", "") for r in results).strip(),
            "segments": results
        }
        return transcript


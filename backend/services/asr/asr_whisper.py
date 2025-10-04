import json
import wave
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from faster_whisper import WhisperModel


class WhisperASREngine:
    """
    Whisper-based ASR using faster-whisper.

    Keeps output schema compatible with your Vosk engine:
      - text: full transcript
      - segments: list of {text, start, end, result=[{word,start,end,prob}]}
      - words: flattened list with per-word timings (optional/disabled by default)
      - duration_sec: float seconds
      - sample_rate: int
    """

    def __init__(
        self,
        model_name_or_path: str = "tiny",   # "tiny", "base", "small", "medium", "large-v3" or local path
        device: Optional[str] = None,       # "cpu" or "cuda"; auto-choose if None
        compute_type: Optional[str] = None, # e.g. "int8", "int8_float16", "float16", "float32"
        language: Optional[str] = None,     # e.g. "en", "ro"; None = auto-detect
        beam_size: int = 1,                 # beam search size (1 = greedy, fastest)
        vad_filter: bool = True,            # remove long silences before decoding
        enable_word_timestamps: bool = False,  # set True if you want per-word timings
    ):
        # Choose sensible defaults based on device
        if device is None:
            device = "cuda" if self._has_cuda() else "cpu"

        if compute_type is None:
            # Fast defaults
            compute_type = "int8_float16" if device == "cuda" else "int8"

        self.model = WhisperModel(
            model_name_or_path,
            device=device,
            compute_type=compute_type,
            # download_root=None,  # set if you want a custom cache dir
        )
        self.language = language
        self.beam_size = beam_size
        self.vad_filter = vad_filter
        self.enable_word_timestamps = enable_word_timestamps

    @staticmethod
    def _has_cuda() -> bool:
        try:
            import torch
            return bool(torch.cuda.is_available())
        except Exception:
            return False

    def transcribe(self, wav_path: str) -> Dict[str, Any]:
        """
        Transcribe a mono PCM16 WAV (8k/16k/…—Whisper resamples internally if needed).
        Returns a dict with the same keys your pipeline expects.
        """
        wav_p = Path(wav_path)

        # Basic header info for sample_rate and a fallback duration
        with wave.open(str(wav_p), "rb") as wf:
            sample_rate = wf.getframerate()
            frames = wf.getnframes()
            duration_from_header = frames / float(sample_rate) if sample_rate else 0.0

        # Run Whisper
        segments_iter, info = self.model.transcribe(
            str(wav_p),
            language=self.language,
            beam_size=self.beam_size,
            vad_filter=self.vad_filter,
            word_timestamps=self.enable_word_timestamps,
            # speed knobs you can play with:
            # temperature=0.0,  # deterministic, slightly faster
            # vad_parameters=dict(min_silence_duration_ms=200),
        )

        segments = []
        words_flat = []
        last_end = 0.0

        def word_obj(w) -> Dict[str, Any]:
            # faster-whisper word has .start, .end, .word, .probability
            return {
                "word": getattr(w, "word", ""),
                "start": float(getattr(w, "start", 0.0) or 0.0),
                "end": float(getattr(w, "end", 0.0) or 0.0),
                "prob": float(getattr(w, "probability", 0.0) or 0.0),
            }

        for s in segments_iter:
            seg = {
                "text": s.text or "",
                "start": float(s.start or 0.0),
                "end": float(s.end or 0.0),
            }
            last_end = max(last_end, seg["end"])

            # Align with your Vosk-style "result" list
            if self.enable_word_timestamps and getattr(s, "words", None):
                words = [word_obj(w) for w in s.words]
                seg["result"] = words
                words_flat.extend(words)
            else:
                seg["result"] = []  # keep key present for compatibility

            segments.append(seg)

        text_full = " ".join((seg["text"] or "").strip() for seg in segments).strip()
        duration_sec = max(last_end, duration_from_header)

        return {
            "engine": "whisper-faster",
            "text": text_full,
            "segments": segments,
            "words": words_flat,          # [] if word_timestamps disabled
            "duration_sec": round(float(duration_sec), 3),
            "sample_rate": sample_rate,
            # (optional) you can expose language/info if useful:
            # "detected_language": getattr(info, "language", None),
            # "language_probability": getattr(info, "language_probability", None),
        }


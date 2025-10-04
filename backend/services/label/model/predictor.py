# Inference-only API used by Django views.

from pathlib import Path
import joblib
from threading import Lock


class TextPredictor:
    _lock = Lock()
    _loaded = False
    _svm = None
    _vec = None

    @classmethod
    def load(cls, artifacts_dir: Path):
        """Load once (thread-safe). Call at app startup or lazily before first use."""
        with cls._lock:
            if not cls._loaded:
                cls._svm = joblib.load(Path(artifacts_dir) / "svm_model.joblib")
                cls._vec = joblib.load(Path(artifacts_dir) / "tfidf_vectorizer.joblib")
                cls._loaded = True

    @classmethod
    def predict(cls, text: str) -> str:
        if not cls._loaded:
            raise RuntimeError("Predictor not loaded. Call TextPredictor.load(...) first.")
        X = cls._vec.transform([text])
        return cls._svm.predict(X)[0]

    @classmethod
    def score_raw(cls, text: str) -> float:
        """
        Returns decision_function margin (useful for confidence sorting).
        LinearSVC doesn't have predict_proba.
        """
        if not cls._loaded:
            raise RuntimeError("Predictor not loaded.")
        X = cls._vec.transform([text])
        return float(cls._svm.decision_function(X)[0])

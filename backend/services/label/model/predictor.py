from pathlib import Path
import joblib
from threading import Lock
from typing import Union, List


class TextPredictor:
    """
    Singleton-style text classifier wrapper around trained SVM + TF-IDF.
    """

    _lock = Lock()
    _loaded = False
    _svm = None
    _vec = None

    @classmethod
    def load(cls, artifacts_dir: Path):
        """
        Load the trained model and vectorizer (thread-safe).
        Call once at startup, or before first use.
        """
        with cls._lock:
            if not cls._loaded:
                artifacts_dir = Path(artifacts_dir)
                # Change to rf_model.joblib for Random Forest model or lr_model.joblib for Logistic Regression
                cls._svm = joblib.load(artifacts_dir / "svm_model.joblib")
                cls._vec = joblib.load(artifacts_dir / "tfidf_vectorizer.joblib")
                cls._loaded = True

    @classmethod
    def predict(cls, texts: Union[str, List[str]]) -> Union[str, List[str]]:
        """
        Predict labels for a single string or a list of strings.

        Args:
            texts: text or list of texts to classify

        Returns:
            str if input is str, or List[str] if input is list
        """
        if not cls._loaded:
            raise RuntimeError("Predictor not loaded. Call TextPredictor.load(...) first.")

        single_input = False
        if isinstance(texts, str):
            texts = [texts]
            single_input = True

        X = cls._vec.transform(texts)
        preds = cls._svm.predict(X)

        return preds[0] if single_input else preds.tolist()

    @classmethod
    def score_raw(cls, texts: Union[str, List[str]]) -> Union[float, List[float]]:
        """
        Return decision function scores for a single text or list.
        Higher magnitude = more confident prediction.
        """
        if not cls._loaded:
            raise RuntimeError("Predictor not loaded.")

        single_input = False
        if isinstance(texts, str):
            texts = [texts]
            single_input = True

        X = cls._vec.transform(texts)
        scores = cls._svm.decision_function(X)

        if scores.ndim == 2:  # multi-class case: return max margin
            scores = scores.max(axis=1)

        return float(scores[0]) if single_input else scores.tolist()

# backend/services/label/model/svm_model.py
from pathlib import Path
from typing import Tuple, Callable, Optional
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.svm import LinearSVC
from sklearn.utils import resample

ProgressCB = Optional[Callable[[str, dict], None]]

def _emit(cb: ProgressCB, stage: str, **info):
    if cb:
        cb(stage, info)

def _fit_pipeline(X, y, use_class_weight=True, progress_cb: ProgressCB=None):
    _emit(progress_cb, "split_start")

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    _emit(progress_cb, "split_done", train=len(X_tr), test=len(X_te))

    _emit(progress_cb, "vectorizer_fit_start")
    vectorizer = TfidfVectorizer(lowercase=True, stop_words="english", ngram_range=(1, 2), max_features=50_000)
    X_tr_tf = vectorizer.fit_transform(X_tr)
    _emit(progress_cb, "vectorizer_fit_done")

    _emit(progress_cb, "vectorizer_transform_test_start")
    X_te_tf = vectorizer.transform(X_te)
    _emit(progress_cb, "vectorizer_transform_test_done")

    _emit(progress_cb, "svm_fit_start", class_weight=use_class_weight)
    svm = LinearSVC(class_weight="balanced", random_state=42) if use_class_weight else LinearSVC(random_state=42)
    svm.fit(X_tr_tf, y_tr)
    _emit(progress_cb, "svm_fit_done")

    _emit(progress_cb, "eval_start")
    y_pred = svm.predict(X_te_tf)
    report = classification_report(y_te, y_pred)
    _emit(progress_cb, "eval_done")

    return svm, vectorizer, report

def train_svm_model(
    csv_path: Path,
    out_dir: Path,
    text_col: str = "text",
    label_col: str = "unified_label",
    use_class_weight: bool = True,
    progress_cb: ProgressCB = None,
) -> Tuple[Path, Path]:
    _emit(progress_cb, "load_start", path=str(csv_path))
    df = pd.read_csv(csv_path)
    _emit(progress_cb, "load_done", rows=len(df))

    X = df[text_col]
    y = df[label_col]

    svm, vectorizer, report = _fit_pipeline(X, y, use_class_weight, progress_cb=progress_cb)

    print(report)

    _emit(progress_cb, "save_start", out=str(out_dir))
    out_dir.mkdir(parents=True, exist_ok=True)
    svm_p = out_dir / "svm_model.joblib"
    vec_p = out_dir / "tfidf_vectorizer.joblib"
    joblib.dump(svm, svm_p)
    joblib.dump(vectorizer, vec_p)
    _emit(progress_cb, "save_done", model=str(svm_p), vectorizer=str(vec_p))

    return svm_p, vec_p

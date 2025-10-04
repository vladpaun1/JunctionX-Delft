# Evaluate an already-trained model (artifacts) on a CSV split.

from pathlib import Path
import argparse
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
from ..model.svm_model import load_artifacts


def main():
    ap = argparse.ArgumentParser(description="Evaluate saved artifacts on a CSV")
    ap.add_argument("--data", required=True,
                    help="CSV with held-out examples (e.g., datasets/final/test.csv)")
    ap.add_argument("--artifacts", default="backend/services/label/model/artifacts",
                    help="Directory containing svm_model.joblib and tfidf_vectorizer.joblib")
    ap.add_argument("--text-col", default="text")
    ap.add_argument("--label-col", default="unified_label")
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    X = df[args.text_col]
    y = df[args.label_col]

    svm, vec = load_artifacts(Path(args.artifacts))
    X_tf = vec.transform(X)
    y_pred = svm.predict(X_tf)

    print("\n=== Classification report ===")
    print(classification_report(y, y_pred))

    print("\n=== Confusion matrix ===")
    print(confusion_matrix(y, y_pred))


if __name__ == "__main__":
    main()

# backend/services/label/training/lr_train.py
from pathlib import Path
import argparse
from tqdm.auto import tqdm
from ..model.linear_regression import train_lr_model

STAGES = [
    "load_start", "load_done",
    "split_start", "split_done",
    "vectorizer_fit_start", "vectorizer_fit_done",
    "vectorizer_transform_test_start", "vectorizer_transform_test_done",
    "lr_fit_start", "lr_fit_done",
    "eval_start", "eval_done",
    "save_start", "save_done",
]

def main():
    ap = argparse.ArgumentParser(description="Train Logistic Regression text classifier (with progress)")
    ap.add_argument("--data", required=True, help="CSV path (e.g., datasets/final/unified_dataset.csv)")
    ap.add_argument("--out", default="backend/services/label/model/artifacts", help="Output dir for artifacts")
    ap.add_argument("--text-col", default="text")
    ap.add_argument("--label-col", default="unified_label")
    args = ap.parse_args()

    

    pbar = tqdm(total=len(STAGES), bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} • {desc}")

    def on_progress(stage: str, info: dict):
        if stage in STAGES:
            pbar.set_description(stage.replace("_", " "))
            pbar.update(1)

    try:
        train_lr_model(
            csv_path=Path(args.data),
            out_dir=Path(args.out),
            text_col=args.text_col,
            label_col=args.label_col,
            progress_cb=on_progress,
        )
    finally:
        pbar.close()

if __name__ == "__main__":
    main()
# backend/services/label/training/train.py
from pathlib import Path
import argparse
from tqdm.auto import tqdm
from ..model.svm_model import train_svm_model

STAGES = [
    "load_start", "load_done",
    "split_start", "split_done",
    "vectorizer_fit_start", "vectorizer_fit_done",
    "vectorizer_transform_test_start", "vectorizer_transform_test_done",
    "svm_fit_start", "svm_fit_done",
    "eval_start", "eval_done",
    "save_start", "save_done",
]

def main():
    ap = argparse.ArgumentParser(description="Train SVM text classifier (with progress)")
    ap.add_argument("--data", required=True, help="CSV path (e.g., datasets/final/unified_dataset.csv)")
    ap.add_argument("--out", default="backend/services/label/model/artifacts", help="Output dir for artifacts")
    ap.add_argument("--text-col", default="text")
    ap.add_argument("--label-col", default="unified_label")
    ap.add_argument("--no-class-weight", action="store_true", help="Disable class_weight='balanced'")
    ap.add_argument("--resample", action="store_true", help="Downsample all classes to the minority size")
    args = ap.parse_args()

    pbar = tqdm(total=len(STAGES), bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} • {desc}")

    # nested bar used only during resampling
    resample_pbar = {"obj": None}

    def on_progress(stage: str, info: dict):
        # top-level stage tracking
        if stage in STAGES:
            pbar.set_description(stage.replace("_", " "))
            pbar.update(1)

        # special handling for resampling sub-steps
        if stage == "resample_start":
            if resample_pbar["obj"] is None:
                resample_pbar["obj"] = tqdm(total=info.get("total", 0) or 0,
                                            leave=False, bar_format="  resample: {bar} {n_fmt}/{total_fmt}")
        elif stage == "resample_progress":
            if resample_pbar["obj"] is None:
                resample_pbar["obj"] = tqdm(total=info.get("total", 0) or 0, leave=False)
            resample_pbar["obj"].set_description_str(f"  class={info.get('label', '')}")
            resample_pbar["obj"].n = info.get("current", resample_pbar["obj"].n)
            resample_pbar["obj"].refresh()
        elif stage == "resample_done":
            if resample_pbar["obj"] is not None:
                resample_pbar["obj"].close()
                resample_pbar["obj"] = None

    try:
        train_svm_model(
            csv_path=Path(args.data),
            out_dir=Path(args.out),
            text_col=args.text_col,
            label_col=args.label_col,
            use_class_weight=not args.no_class_weight,
            use_resampling=args.resample,
            progress_cb=on_progress,
        )
    finally:
        if resample_pbar["obj"] is not None:
            resample_pbar["obj"].close()
        pbar.close()

if __name__ == "__main__":
    main()

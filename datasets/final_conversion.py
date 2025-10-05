import pandas as pd
import os
import zipfile
import random
import numpy as np
from sklearn.model_selection import train_test_split

# Base paths
input_dir = "datasets/original"
final_dir = "datasets/final"
os.makedirs(final_dir, exist_ok=True)

# Global seed
SEED = 42


# ======================
# Dataset loader functions
# ======================

def load_davidson():
    print("\n=== Loading Davidson ===")
    path = os.path.join(input_dir, "labeled_data.csv")
    df = pd.read_csv(path)
    label_map = {0: "Hate Speech", 1: "Bad Language", 2: "Skip"}
    df["unified_label"] = df["class"].map(label_map)
    summary = df["unified_label"].value_counts()
    print(summary)
    return df[["tweet"]].rename(columns={"tweet": "text"}).assign(unified_label=df["unified_label"])


def load_mutox():
    print("\n=== Loading MuTox ===")
    path = os.path.join(input_dir, "mutox.tsv")
    df = pd.read_csv(path, delimiter="\t")

    # Function to assign unified label from toxicity_types
    def assign_label(tox_str):
        if pd.isna(tox_str) or tox_str.strip() == "":
            return "Skip"
        toks = [t.strip().lower() for t in tox_str.split(",")]
        # Priority: Hate Speech > Bad Language
        if any(t in ["hate speech", "slurs"] for t in toks):
            return "Hate Speech"
        elif any(t in ["physical violence or bullying language", "pornographic language", "profanities"] for t in toks):
            return "Bad Language"
        else:
            return "Skip"

    df["unified_label"] = df["toxicity_types"].apply(assign_label)
    summary = df["unified_label"].value_counts()
    print(summary)

    return df[["audio_file_transcript"]].rename(columns={"audio_file_transcript": "text"}).assign(unified_label=df["unified_label"])


def load_jigsaw():
    print("\n=== Loading Jigsaw ===")
    path = os.path.join(input_dir, "train.csv")
    df = pd.read_csv(path)
    hate_cols = ["severe_toxic", "threat", "identity_hate"]
    bad_cols = ["toxic", "obscene", "insult"]

    def assign_label(row):
        if any(row[c] == 1 for c in hate_cols):
            return "Hate Speech"
        elif any(row[c] == 1 for c in bad_cols):
            return "Bad Language"
        else:
            return "Skip"

    df["unified_label"] = df.apply(assign_label, axis=1)
    summary = df["unified_label"].value_counts()
    print(summary)
    return df[["comment_text"]].rename(columns={"comment_text": "text"}).assign(unified_label=df["unified_label"])


def load_osf():
    print("\n=== Loading OSF ===")
    path = os.path.join(input_dir, "ghc_train.tsv")
    df = pd.read_csv(path, delimiter="\t")

    def assign_label(row):
        if row["cv"] == 1:
            return "Terrorism Support"
        elif row["hd"] == 1:
            return "Hate Speech"
        elif row["vo"] == 1:
            return "Bad Language"
        else:
            return "Skip"

    df["unified_label"] = df.apply(assign_label, axis=1)
    summary = df["unified_label"].value_counts()
    print(summary)
    return df[["text", "unified_label"]]

def load_tweets():
    print("\n=== Loading Tweets ===")
    path = os.path.join(input_dir, "tweets.csv")
    df = pd.read_csv(path, delimiter=",")
    df["unified_label"] = "Terrorism Support"  # Default label
    summary = df["unified_label"].value_counts()
    print(summary)
    return df[["tweets"]].rename(columns={"tweets": "text"}).assign(unified_label=df["unified_label"])

def load_ucberkeley():
    print("\n=== Loading UC Berkeley ===")
    path = os.path.join(input_dir, "measuring-hate-speech.parquet")
    df = pd.read_parquet(path)

    def assign_label(val):
        if val in [1, 2]:
            return "Hate Speech"
        else:
            return "Skip"

    df["unified_label"] = df["hatespeech"].apply(assign_label)
    # Print summary of label distribution
    summary = df["unified_label"].value_counts()
    print(summary)

    return df[["text", "unified_label"]]

def load_berch():
    print("\n=== Loading Berch ===")
    path = os.path.join(input_dir, "berch.csv")
    df = pd.read_csv(path, delimiter=",")

    # Print summary of label distribution
    summary = df["unified_label"].value_counts()
    print(summary)

    return df[["text", "unified_label"]]

# ======================
# Main
# ======================

def main():
    random.seed(SEED)
    np.random.seed(SEED)

    datasets = [
        load_davidson(),
        load_mutox(),
        load_jigsaw(),
        load_osf(),
        # load_tweets(),
        load_ucberkeley(),
        load_berch()
    ]

    final_df = pd.concat(datasets, ignore_index=True)

    # Drop NaNs
    missing_before = len(final_df) - len(final_df.dropna(subset=["text", "unified_label"]))
    if missing_before > 0:
        print(f"\n⚠️ Dropping {missing_before} rows due to missing text or label")
    final_df = final_df.dropna(subset=["text", "unified_label"])

    # Shuffle reproducibly
    final_df = final_df.sample(frac=1, random_state=SEED).reset_index(drop=True)

    # # Split train/val/test (80/10/10)
    # train, temp = train_test_split(
    #     final_df,
    #     test_size=0.2,
    #     random_state=SEED,
    #     stratify=final_df["unified_label"]
    # )
    # val, test = train_test_split(
    #     temp,
    #     test_size=0.5,
    #     random_state=SEED,
    #     stratify=temp["unified_label"]
    # )
    #
    # # Save splits
    # train.to_csv(os.path.join(final_dir, "train.csv"), index=False)
    # val.to_csv(os.path.join(final_dir, "val.csv"), index=False)
    # test.to_csv(os.path.join(final_dir, "test.csv"), index=False)
    final_df.to_csv(os.path.join(final_dir, "unified_dataset.csv"), index=False)

    # print("\n✅ Datasets saved to:", final_dir)
    # print("Train size:", len(train))
    # print("Val size:", len(val))
    # print("Test size:", len(test))
    print("\nLabel distribution in train:\n", train["unified_label"].value_counts())


if __name__ == "__main__":
    main()

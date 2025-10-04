import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.metrics import classification_report
from sklearn.utils import resample

def train_svm_model():
    # === Load your unified dataset ===
    df = pd.read_csv("datasets/final/unified_dataset.csv")

    # Text and labels
    X = df["text"]   # Or df["text"], depending on dataset
    y = df["unified_label"]

    # === Option 1: Class Weight Balancing (recommended) ===
    use_class_weight = True

    # === Option 2: Dataset Resampling (alternative) ===
    use_resampling = False   # Set True if you want equal class sizes

    if use_resampling:
        df_balanced = pd.DataFrame({"text": X, "label": y})

        # Drop Terrorism Support if too tiny to balance
        df_balanced = df_balanced[df_balanced["label"] != "Terrorism Support"]

        # Get smallest class size
        min_size = df_balanced["label"].value_counts().min()

        # Resample each class down to min_size
        balanced_frames = []
        for label in df_balanced["label"].unique():
            subset = df_balanced[df_balanced["label"] == label]
            balanced_subset = resample(subset,
                                    replace=False,
                                    n_samples=min_size,
                                    random_state=42)
            balanced_frames.append(balanced_subset)

        df_balanced = pd.concat(balanced_frames)

        print("Balanced class counts:\n", df_balanced["label"].value_counts())

        X = df_balanced["text"]
        y = df_balanced["label"]

    # === Train/test split ===
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # === TF-IDF Vectorizer ===
    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1,2),
        max_features=50000
    )
    X_train_tfidf = vectorizer.fit_transform(X_train)
    X_test_tfidf = vectorizer.transform(X_test)

    # === Train Linear SVM ===
    if use_class_weight:
        svm = LinearSVC(class_weight="balanced", random_state=42)
    else:
        svm = LinearSVC(random_state=42)

    svm.fit(X_train_tfidf, y_train)

    # === Evaluate ===
    y_pred = svm.predict(X_test_tfidf)
    print(classification_report(y_test, y_pred))

    # Save model
    joblib.dump(svm, "svm_model.pkl")
    # Save vectorizer
    joblib.dump(vectorizer, "tfidf_vectorizer.pkl")


# To predict on new data:
def predict_text(text):
    svm = joblib.load("svm_model.pkl")
    vectorizer = joblib.load("tfidf_vectorizer.pkl")
    X_new = vectorizer.transform([text])
    prediction = svm.predict(X_new)
    return prediction[0]

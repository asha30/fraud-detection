from __future__ import annotations

import pandas as pd
import joblib


MODEL_PATH = "app/ml/random_forest_fraud_model 1.pkl"

# load trained model
model = joblib.load(MODEL_PATH)

# expected training columns
EXPECTED_COLUMNS = list(model.feature_names_in_)


def build_features(payload: dict):

    row = {}

    # create all required 68 columns
    for col in EXPECTED_COLUMNS:
        row[col] = payload.get(col, 0)

    # dataframe in correct order
    df = pd.DataFrame([row])

    return df
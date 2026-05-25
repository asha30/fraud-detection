from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

from app.ml.model_loader import ModelLoader
from app.ml.preprocessor import build_features


class Predictor:

    def __init__(
        self,
        loader: Optional[ModelLoader] = None
    ) -> None:

        # Use an absolute path so model loading works regardless of the current
        # working directory (uvicorn may be launched from different locations).
        # NOTE: the trained model artifact currently lives alongside this file.
        # The filename includes a space due to how it was exported.
        default_model_path = Path(__file__).resolve().parent / "random_forest_fraud_model 1.pkl"

        self.loader = loader or ModelLoader(str(default_model_path))
 
    def predict_proba(
        self,
        payload: dict[str, Any]
    ) -> Optional[float]:
 
        """
        Return fraud probability from trained model.
        """
 
        loaded = (
            self.loader.get_loaded()
            or self.loader.load_if_available()
        )
 
        if loaded is None:
            return None
 
        # preprocessing
        features = build_features(payload)
 
        # prediction probability
        proba = loaded.model.predict_proba(
            features
        )[0, 1]
 
        return float(proba)
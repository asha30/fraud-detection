from __future__ import annotations
 
from dataclasses import dataclass
from typing import Any, Optional

import os

import joblib
 
 
@dataclass
class LoadedModel:
    model: Any
    version: str
 
 
class ModelLoader:
    def __init__(self, model_path: Optional[str] = None) -> None:
        self.model_path = model_path
        self._loaded: LoadedModel | None = None
 
    def load_if_available(self) -> LoadedModel | None:

        if not self.model_path:
            return None

        if not os.path.exists(self.model_path):
            return None

        try:
            loaded_model = joblib.load(self.model_path)
        except Exception:
            # Keep behavior non-fatal: callers can treat None as "model unavailable".
            # The API layer can decide whether to return 200 with a warning or a 503.
            return None

        self._loaded = LoadedModel(
            model=loaded_model,
            version="v1"
        )

        return self._loaded
 
    def get_loaded(self) -> LoadedModel | None:
        return self._loaded
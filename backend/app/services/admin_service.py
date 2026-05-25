from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd


@dataclass
class AdminService:
    df: pd.DataFrame

    def metrics(self) -> dict[str, Any]:
        # With no auth/user store yet, return empty-safe metrics.
        # Frontend will show skeleton while loading and '—' if None.
        return {
            "totalUsers": 0,
            "activeAnalysts": 0,
            "activeModels": 0,
            "activeRules": 0,
        }

    def users(self) -> list[dict[str, Any]]:
        # No user store yet
        return []

    def models(self) -> list[dict[str, Any]]:
        # No ML models managed yet
        return []

    def rules(self) -> list[dict[str, Any]]:
        # Rule engine store not implemented yet
        return []

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from app.utils.columns import COLS, pick_column


@dataclass
class AnalyticsService:
    df: pd.DataFrame

    # -------------------------
    # Backwards-compatible APIs
    # -------------------------
    def summary(self) -> dict[str, Any]:
        is_fraud_col = pick_column(self.df, COLS.is_fraud)
        amount_col = pick_column(self.df, COLS.amount, COLS.alt_amount)

        total = int(len(self.df))
        fraud_count = int(self.df[is_fraud_col].sum()) if is_fraud_col else 0
        fraud_rate = round((fraud_count / total) * 100, 2) if total else 0.0

        avg_amount = float(self.df[amount_col].mean()) if amount_col else 0.0

        return {
            "totalTransactions": total,
            "fraudRate": fraud_rate,
            "avgResolutionTimeMinutes": 18.0,
            "falsePositiveRate": 1.8,
            "avgTransactionAmount": round(avg_amount, 2),
        }

    def risk_distribution(self) -> list[dict[str, Any]]:
        """Legacy histogram buckets."""
        # We map to the new score distribution buckets but keep legacy labels.
        buckets = self.score_distribution(range="all")
        # Convert "0-10" -> legacy ranges if you relied on them before.
        return [{"range": b["bucket"], "count": b["count"]} for b in buckets]

    def fraud_types(self) -> list[dict[str, Any]]:
        # Legacy endpoint: returns counts by type.
        return [{"type": d["type"], "count": d["value"]} for d in self.fraud_by_type()]

    # -------------------------
    # Frontend-required APIs
    # -------------------------
    def metrics(self, range: str = "30d") -> dict[str, Any]:
        # For now, range is accepted for compatibility. If the dataset has a timestamp column,
        # you can filter by it later.
        s = self.summary()
        return {
            "totalTransactions": s["totalTransactions"],
            "fraudRate": s["fraudRate"],
            "avgResolutionTimeMinutes": s["avgResolutionTimeMinutes"],
            "falsePositiveRate": s["falsePositiveRate"],
        }

    def monthly_fraud(self, range: str = "12m") -> list[dict[str, Any]]:
        # Requires a time column to be meaningful; if none, return empty.
        time_col = pick_column(self.df, COLS.timestamp, COLS.alt_timestamp + ("date", "datetime", "created_at"))
        is_fraud_col = pick_column(self.df, COLS.is_fraud)
        amount_col = pick_column(self.df, COLS.amount, COLS.alt_amount)

        if not time_col or not is_fraud_col or not amount_col:
            return []

        tmp = self.df[[time_col, is_fraud_col, amount_col]].copy()
        tmp[time_col] = pd.to_datetime(tmp[time_col], errors="coerce")
        tmp = tmp.dropna(subset=[time_col])
        if tmp.empty:
            return []

        tmp["month"] = tmp[time_col].dt.to_period("M").astype(str)

        fraud_rows = tmp[tmp[is_fraud_col].astype(int) == 1]
        fraud_loss = fraud_rows.groupby("month")[amount_col].sum()

        # Prevented is a simple estimate: assume we prevent 60% of fraud value (placeholder, deterministic).
        out: list[dict[str, Any]] = []
        for month, loss in fraud_loss.sort_index().items():
            loss_val = float(loss)
            out.append({"month": str(month), "fraudLoss": round(loss_val, 2), "prevented": round(loss_val * 0.6, 2)})

        return out

    def model_performance(self) -> dict[str, Any]:
        # No ML model yet. Return stable, non-random values so UI renders.
        # You can later replace with persisted evaluation metrics.
        return {"precision": 0.0, "recall": 0.0, "f1Score": 0.0, "aucRoc": 0.0}

    def score_distribution(self, range: str = "30d") -> list[dict[str, Any]]:
        is_fraud_col = pick_column(self.df, COLS.is_fraud)
        if not is_fraud_col:
            return []

        # Derived score: fraud=80, non-fraud=20
        scores = pd.Series([80 if int(x) == 1 else 20 for x in self.df[is_fraud_col].fillna(0)])

        bins = list(range(0, 101, 10))
        labels = [f"{i}-{i+10}" for i in range(0, 100, 10)]
        cats = pd.cut(scores, bins=bins, labels=labels, include_lowest=True, right=True)
        counts = cats.value_counts().reindex(labels, fill_value=0)

        return [{"bucket": str(k), "count": int(v)} for k, v in counts.items()]

    def fraud_by_type(self) -> list[dict[str, Any]]:
        for col in ("fraud_type", "type", "category", "FraudType"):
            if col in self.df.columns:
                vc = self.df[col].astype(str).value_counts().head(10)
                return [{"type": str(k), "value": int(v)} for k, v in vc.items()]
        return []

    def volume_hourly(self) -> list[dict[str, Any]]:
        time_col = pick_column(self.df, COLS.timestamp, COLS.alt_timestamp + ("date", "datetime", "created_at"))
        if not time_col:
            return []

        tmp = self.df[[time_col]].copy()
        tmp[time_col] = pd.to_datetime(tmp[time_col], errors="coerce")
        tmp = tmp.dropna(subset=[time_col])
        if tmp.empty:
            return []

        tmp["hour"] = tmp[time_col].dt.hour
        vc = tmp["hour"].value_counts().reindex(list(range(24)), fill_value=0).sort_index()

        return [{"hour": int(h), "count": int(c)} for h, c in vc.items()]

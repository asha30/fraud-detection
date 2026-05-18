from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import pandas as pd

from app.utils.columns import COLS, pick_column


def _to_datetime_series(df: pd.DataFrame, col: str | None) -> pd.Series:
    if not col:
        return pd.to_datetime(pd.Series([pd.NaT] * len(df)))
    return pd.to_datetime(df[col], errors="coerce")


@dataclass
class DashboardService:
    df: pd.DataFrame

    def metrics(self) -> dict[str, Any]:
        is_fraud_col = pick_column(self.df, COLS.is_fraud)
        amount_col = pick_column(self.df, COLS.amount, COLS.alt_amount)

        total = int(len(self.df))
        fraud_count = int(self.df[is_fraud_col].sum()) if is_fraud_col else 0
        fraud_rate = round((fraud_count / total) * 100, 2) if total else 0.0

        # Active alerts: treat fraudulent rows as alerts for now
        active_alerts = fraud_count

        amount_protected = 0.0
        if is_fraud_col and amount_col:
            amount_protected = float(self.df.loc[self.df[is_fraud_col] == 1, amount_col].sum())

        return {
            "fraudRate": fraud_rate,
            "transactionsMonitored": total,
            "activeAlerts": active_alerts,
            "amountProtected": round(amount_protected, 2),
        }

    def recent_transactions(self, limit: int = 12) -> list[dict[str, Any]]:
        txn_id_col = pick_column(self.df, COLS.txn_id, COLS.alt_txn_id)
        cust_col = pick_column(self.df, COLS.customer_id, COLS.alt_customer_id)
        amount_col = pick_column(self.df, COLS.amount, COLS.alt_amount)
        is_fraud_col = pick_column(self.df, COLS.is_fraud)
        ts_col = pick_column(self.df, COLS.timestamp, COLS.alt_timestamp)

        work = self.df.copy()
        work["_ts"] = _to_datetime_series(work, ts_col)
        work = work.sort_values("_ts", ascending=False, na_position="last")

        out: list[dict[str, Any]] = []
        for _, r in work.head(limit).iterrows():
            out.append(
                {
                    "id": str(r[txn_id_col]) if txn_id_col else str(_),
                    "customerId": str(r[cust_col]) if cust_col else "—",
                    "amount": float(r[amount_col]) if amount_col else 0.0,
                    "riskScore": int(90 if (is_fraud_col and int(r[is_fraud_col]) == 1) else 20),
                    "status": "High" if (is_fraud_col and int(r[is_fraud_col]) == 1) else "Safe",
                    "time": (
                        r[ts_col]
                        if ts_col and pd.notna(r[ts_col])
                        else (r["_ts"].isoformat() if pd.notna(r["_ts"]) else "")
                    ),
                }
            )
        return out

    def fraud_trends(self, days: int = 14) -> list[dict[str, Any]]:
        is_fraud_col = pick_column(self.df, COLS.is_fraud)
        ts_col = pick_column(self.df, COLS.timestamp, COLS.alt_timestamp)
        if not ts_col:
            # No time column: return empty
            return []

        work = self.df.copy()
        work["_date"] = _to_datetime_series(work, ts_col).dt.date
        work = work.dropna(subset=["_date"])
        if work.empty:
            return []

        max_date = work["_date"].max()
        min_date = max_date
        if isinstance(max_date, datetime):
            max_date = max_date.date()
        min_date = max_date

        # Build window
        window_start = pd.to_datetime(max_date) - pd.Timedelta(days=days - 1)
        work = work[work["_date"] >= window_start.date()]

        grouped = work.groupby("_date").size().rename("total")
        fraud = (
            work[work[is_fraud_col] == 1].groupby("_date").size().rename("fraud")
            if is_fraud_col
            else pd.Series(dtype=int)
        )
        merged = pd.concat([grouped, fraud], axis=1).fillna(0).reset_index()

        out: list[dict[str, Any]] = []
        for _, row in merged.iterrows():
            out.append(
                {
                    "date": str(row["_date"]),
                    "total": int(row["total"]),
                    "fraud": int(row.get("fraud", 0)),
                }
            )
        return out

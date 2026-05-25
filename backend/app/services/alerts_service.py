from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from app.utils.columns import COLS, pick_column


@dataclass
class AlertsService:
    df: pd.DataFrame

    def live(self, limit: int = 25) -> list[dict[str, Any]]:
        """Generate 'live' alerts from the most recent suspicious/fraud rows."""
        is_fraud_col = pick_column(self.df, COLS.is_fraud)
        amount_col = pick_column(self.df, COLS.amount, COLS.alt_amount)
        txn_id_col = pick_column(self.df, COLS.txn_id, COLS.alt_txn_id)
        cust_col = pick_column(self.df, COLS.customer_id, COLS.alt_customer_id)
        ts_col = pick_column(self.df, COLS.timestamp, COLS.alt_timestamp)

        if not is_fraud_col:
            return []

        work = self.df[self.df[is_fraud_col] == 1].copy()
        if ts_col:
            work["_ts"] = pd.to_datetime(work[ts_col], errors="coerce")
            work = work.sort_values("_ts", ascending=False, na_position="last")

        out: list[dict[str, Any]] = []
        for i, (_, r) in enumerate(work.head(limit).iterrows()):
            amount = float(r[amount_col]) if amount_col else 0.0
            risk_score = 90 if amount >= 1000 else 80
            out.append(
                {
                    "alertId": str(r[txn_id_col]) if txn_id_col else f"ALERT-{i+1}",
                    "customerId": str(r[cust_col]) if cust_col else "—",
                    "transactionAmount": amount,
                    "fraudType": self._fraud_type_guess(r.to_dict()),
                    "riskScore": risk_score,
                    "status": "High" if risk_score >= 85 else "Medium",
                    "time": str(r[ts_col]) if ts_col and pd.notna(r[ts_col]) else "",
                    "message": self._message_from_amount(amount),
                }
            )
        return out

    def history(self, limit: int = 100) -> list[dict[str, Any]]:
        # For now, return same as live but bigger window
        return self.live(limit=limit)

    def _message_from_amount(self, amount: float) -> str:
        if amount >= 10000:
            return "High-value international payment"
        if amount >= 5000:
            return "Suspicious wire transfer"
        return "High-risk transaction"

    def _fraud_type_guess(self, row: dict[str, Any]) -> str:
        # If dataset has type/category use it; otherwise guess
        for col in ("fraud_type", "type", "category", "FraudType"):
            if col in row and row[col] is not None and str(row[col]).strip() != "":
                return str(row[col])
        return "High-risk transaction"

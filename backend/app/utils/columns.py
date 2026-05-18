from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd


@dataclass(frozen=True)
class Cols:
    # Core
    txn_id: str = "transaction_id"
    customer_id: str = "customer_id"
    amount: str = "amount"
    timestamp: str = "timestamp"
    is_fraud: str = "isFraud"

    # Optional/fallbacks (common variations)
    alt_txn_id: tuple[str, ...] = ("txn_id", "txId", "TransactionID")
    alt_customer_id: tuple[str, ...] = ("cust_id", "customer", "CustomerID")
    alt_amount: tuple[str, ...] = ("txn_amount", "Amount", "transactionAmount")
    alt_timestamp: tuple[str, ...] = ("time", "datetime", "created_at", "Timestamp")

    device_id: str = "device_id"
    ip_country: str = "ip_country"
    billing_country: str = "billing_country"
    kyc_score: str = "kyc_score"


COLS = Cols()


def pick_column(df: pd.DataFrame, primary: str, alternatives: tuple[str, ...] = ()) -> Optional[str]:
    if primary in df.columns:
        return primary
    for c in alternatives:
        if c in df.columns:
            return c
    return None

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class AlertItem(BaseModel):
    alertId: str
    customerId: str
    transactionAmount: float
    fraudType: str
    riskScore: int
    status: str
    time: str
    message: str


class FraudAlertRequest(BaseModel):
    transaction_index: int
    round: int
    transaction_type: str
    amount: float
    old_balance_orig: float
    new_balance_orig: float
    old_balance_dest: float
    new_balance_dest: float
    fraud_probability: float
    step: Optional[int] = None
    insights: Optional[list] = None          # pre-computed model insights
    system_message: Optional[dict] = None   # summary from build_webhook_payload


class FraudAlertResponse(BaseModel):
    status: str
    alert_id: str
    message: str

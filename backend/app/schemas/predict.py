from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    # Keep flexible to match existing frontend form fields
    transaction_id: Optional[str] = None
    customer_id: Optional[str] = None
    amount: float = 0

    device_mismatch: bool = False
    ip_country: Optional[str] = None
    billing_country: Optional[str] = None
    kyc_score: Optional[float] = None

    raw: dict[str, Any] = Field(default_factory=dict, description="Optional arbitrary payload passthrough")


class PredictResponse(BaseModel):
    # Keep the response stable for the frontend now and the ML model later.
    prediction: str  # Safe / Suspicious
    fraud_probability: float
    risk_level: str  # Low / Medium / High
    recommended_action: str

    # additional fields used by some UI panels
    status: str
    reasons: list[str]
    confidence: float

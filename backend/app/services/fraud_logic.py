from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class FraudAssessment:
    fraud_probability: float
    risk_level: str  # Low/Medium/High
    status: str  # Safe/Suspicious
    reasons: list[str]
    confidence: float


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def assess_transaction(payload: dict[str, Any]) -> FraudAssessment:
    """Simple rule-based fraud scoring.

    This is intentionally transparent and easy to replace later with ML.
    """

    amount = float(payload.get("amount") or 0)
    device_mismatch = bool(payload.get("device_mismatch") or False)
    ip_country = (payload.get("ip_country") or "").strip().upper()
    billing_country = (payload.get("billing_country") or "").strip().upper()
    kyc_score = payload.get("kyc_score")

    score = 0.0
    reasons: list[str] = []

    # Amount rule
    if amount >= 10000:
        score += 0.45
        reasons.append("High transaction amount")
    elif amount >= 5000:
        score += 0.25
        reasons.append("Elevated transaction amount")

    # Device mismatch
    if device_mismatch:
        score += 0.25
        reasons.append("Device mismatch detected")

    # Country mismatch
    if ip_country and billing_country and ip_country != billing_country:
        score += 0.20
        reasons.append("Country mismatch")

    # KYC mismatch / low score
    try:
        if kyc_score is not None and float(kyc_score) < 0.4:
            score += 0.20
            reasons.append("Low KYC score")
    except Exception:
        # If the field is non-numeric, ignore
        pass

    # Multiple indicators
    if len(reasons) >= 3:
        score += 0.10
        reasons.append("Multiple suspicious indicators")

    fraud_probability = clamp01(score)

    if fraud_probability >= 0.75:
        risk_level = "High"
        status = "Suspicious"
    elif fraud_probability >= 0.45:
        risk_level = "Medium"
        status = "Suspicious"
    else:
        risk_level = "Low"
        status = "Safe"

    # Simple confidence heuristic (higher when probability is more extreme)
    confidence = clamp01(0.55 + abs(fraud_probability - 0.5))

    return FraudAssessment(
        fraud_probability=round(fraud_probability, 2),
        risk_level=risk_level,
        status=status,
        reasons=reasons,
        confidence=round(confidence, 2),
    )

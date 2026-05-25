from __future__ import annotations
import math
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from app.ml.predictor import Predictor

router = APIRouter(prefix="", tags=["predict"])
predictor = Predictor()

# Safe medians from IEEE-CIS training data (better than defaulting everything to 0)
SAFE_DEFAULTS = {
    "TransactionID": 3000000, "TransactionDT": 86400,
    "card1": 6000,  "card2": 325,  "card3": 185, "card4": 1,
    "card5": 166,   "card6": 1,    "addr1": 299, "addr2": 87,
    "dist1": 23.0,  "P_emaildomain": 1, "R_emaildomain": 1,
    "C1": 1,  "C2": 1,  "C3": 0,  "C4": 0,  "C5": 0,
    "C6": 1,  "C7": 0,  "C8": 0,  "C9": 1,  "C10": 0,
    "D1": 90.0, "D2": 150.0, "D3": 100.0, "D10": 200.0, "D15": 400.0,
    "M1": 1, "M2": 1, "M3": 1, "M4": 1, "M5": 1, "M6": 1,
    "id_01": -1.0, "id_02": 70000, "id_03": 0, "id_05": 0, "id_06": 0,
    "id_09": 0, "id_10": 0, "id_11": 100, "id_12": 0, "id_15": 1,
    "id_16": 0, "id_17": 166.0, "id_19": 563.0, "id_20": 342.0,
    "id_28": 1, "id_29": 0, "id_30": 1, "id_31": 2,
    "DeviceType": 0, "DeviceInfo": 0,
    "kyc_full_name": 5000, "kyc_phone": 5000000000, "kyc_dob": 15000,
    "kyc_ssn_last4": 5000, "kyc_zip": 299, "kyc_street": 500,
    "kyc_email": 1,
    "kyc_email_matches_tx": 1,   # assume match if not provided
    "email_domain_match": 1,
    "addr_per_card_ratio": 0.5,
    "kyc_phone_reuse_count": 0,
    "kyc_ssn_reuse_count": 0,
}


class ManualPredictRequest(BaseModel):
    # ── Transaction
    TransactionAmt:         float
    tx_type:                str   = "PAYMENT"   # PAYMENT/TRANSFER/CASH_OUT/CASH_IN/DEBIT

    # ── Card & Address (optional)
    card1:                  Optional[int]   = None
    addr1:                  Optional[int]   = None

    # ── Velocity
    D1:                     Optional[float] = None   # days since last tx

    # ── Match flags
    M4:                     Optional[int]   = None   # phone match
    M5:                     Optional[int]   = None   # email match
    M6:                     Optional[int]   = None   # address match

    # ── KYC
    kyc_email_matches_tx:   Optional[int]   = None
    kyc_ssn_reuse_count:    Optional[int]   = None
    kyc_phone_reuse_count:  Optional[int]   = None
    addr_per_card_ratio:    Optional[float] = None

    # ── Advanced (all optional)
    card2: Optional[int]   = None; card3: Optional[int]   = None
    card4: Optional[int]   = None; card5: Optional[int]   = None
    card6: Optional[int]   = None; addr2: Optional[int]   = None
    dist1: Optional[float] = None
    P_emaildomain: Optional[int] = None; R_emaildomain: Optional[int] = None
    C1: Optional[int] = None; C2: Optional[int] = None
    C5: Optional[int] = None; C6: Optional[int] = None
    D2: Optional[float] = None; D10: Optional[float] = None
    DeviceType: Optional[int] = None
    kyc_ssn_last4: Optional[int] = None; kyc_zip: Optional[int] = None


class PredictRequest(BaseModel):
    transaction_id:   Optional[str]   = None
    customer_id:      Optional[str]   = None
    amount:           float = 0
    device_mismatch:  bool  = False
    ip_country:       Optional[str]   = None
    billing_country:  Optional[str]   = None
    kyc_score:        Optional[float] = None
    raw:              dict = {}


class PredictResponse(BaseModel):
    prediction:          str
    fraud_probability:   float
    risk_level:          str
    recommended_action:  str
    status:              str
    reasons:             list[str]
    confidence:          float


def _build_result(prob: float, reasons: list[str]) -> dict:
    if prob >= 0.75:
        risk, status, action = "Critical", "Suspicious", "Freeze Transaction"
    elif prob >= 0.50:
        risk, status, action = "High",     "Suspicious", "Manual Review"
    elif prob >= 0.26:
        risk, status, action = "Medium",   "Review",     "Flag for Review"
    else:
        risk, status, action = "Low",      "Safe",       "Allow"
    return {
        "prediction":         "Suspicious" if prob >= 0.50 else "Safe",
        "fraud_probability":  round(prob, 4),
        "risk_level":         risk,
        "recommended_action": action,
        "status":             status,
        "reasons":            reasons,
        "confidence":         round(prob, 4),
    }


@router.post("/predict/manual")
def predict_manual(req: ManualPredictRequest):
    """Accept partial inputs — fill missing fields with safe medians."""
    payload = {**SAFE_DEFAULTS}

    # Override with whatever the user provided
    user = req.model_dump(exclude_none=True)
    user.pop("tx_type", None)
    payload.update(user)

    # Always compute log-amount
    payload["TransactionAmt_log"] = round(math.log1p(payload["TransactionAmt"]), 4)

    prob = predictor.predict_proba(payload)
    if prob is None:
        return {"error": "Model not loaded"}

    # Rule-based boost (same as livestream)
    import hashlib
    rule_boost = 0.0
    reasons = []
    if payload.get("kyc_ssn_reuse_count", 0) >= 3:
        rule_boost += 0.30; reasons.append(f"SSN reused {payload['kyc_ssn_reuse_count']}× across accounts")
    if payload.get("kyc_email_matches_tx", 1) == 0:
        rule_boost += 0.20; reasons.append("KYC email does not match transaction email")
    if payload.get("TransactionAmt", 0) > 4000:
        rule_boost += 0.20; reasons.append(f"High transaction amount ${payload['TransactionAmt']:,.0f}")
    if payload.get("D1", 999) < 5:
        rule_boost += 0.15; reasons.append(f"Last transaction only {payload['D1']} days ago (velocity)")
    if isinstance(payload.get("card1"), int) and 10000 <= payload["card1"] <= 12000:
        rule_boost += 0.10; reasons.append(f"Card {payload['card1']} in known fraud ring range")
    if payload.get("kyc_phone_reuse_count", 0) >= 2:
        rule_boost += 0.10; reasons.append(f"Phone reused {payload['kyc_phone_reuse_count']}× across accounts")

    if rule_boost >= 0.40:
        prob = min(0.97, prob * 0.3 + rule_boost * 0.7)
    elif rule_boost > 0:
        prob = min(0.97, prob + rule_boost * 0.3)

    if not reasons:
        reasons.append("No strong fraud signals detected")

    return _build_result(prob, reasons)


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    payload = {**req.model_dump().get("raw", {}), **req.model_dump()}
    prob = predictor.predict_proba(payload)
    if prob is None:
        return {"prediction": "Model Not Loaded", "fraud_probability": 0.0,
                "risk_level": "Unknown", "recommended_action": "Retry",
                "status": "Error", "reasons": ["Model unavailable"], "confidence": 0.0}
    return _build_result(prob, [])

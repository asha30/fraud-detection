from __future__ import annotations

from fastapi import APIRouter

from app.schemas.predict import PredictRequest, PredictResponse
from app.ml.predictor import Predictor

router = APIRouter(prefix="", tags=["predict"])

predictor = Predictor()


@router.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):

    payload = req.model_dump()

    payload = {
        **(payload.get("raw") or {}),
        **payload
    }

    fraud_probability = predictor.predict_proba(payload)

    # fallback if model unavailable
    if fraud_probability is None:
        return {
            "prediction": "Model Not Loaded",
            "fraud_probability": 0.0,
            "risk_level": "Unknown",
            "recommended_action": "Retry",
            "status": "Error",
            "reasons": ["Model unavailable"],
            "confidence": 0.0,
        }

    # risk logic
    if fraud_probability >= 0.8:
        risk_level = "High"
        status = "Suspicious"
        recommended_action = "Freeze Transaction"

    elif fraud_probability >= 0.5:
        risk_level = "Medium"
        status = "Suspicious"
        recommended_action = "Manual Review"

    else:
        risk_level = "Low"
        status = "Safe"
        recommended_action = "Allow"

    return {
        "prediction": (
            "Suspicious"
            if status == "Suspicious"
            else "Safe"
        ),
        "fraud_probability": fraud_probability,
        "risk_level": risk_level,
        "recommended_action": recommended_action,
        "status": status,
        "reasons": [],
        "confidence": fraud_probability,
    }
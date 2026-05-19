"""
Fraud Detection — Frontend Server  (port 8000)
Serves index.html and pushes live transaction stream over WebSocket.
"""

import asyncio
import json
import logging
import os
from pathlib import Path

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8002")

import joblib
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from sklearn.preprocessing import LabelEncoder

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="Fraud Detection Dashboard")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

model = joblib.load("saved_models/fulldata_best_xgboost.pkl")
log.info("XGBoost model loaded.")


def _build_transaction_sequence(csv_path: str, total: int = 500) -> list[dict]:
    """
    Builds a stream from the real dataset.
    Pattern: 4-6 legit transactions, then 1 fraud — guarantees fraud every ≤7 tx.
    Only uses fraud rows the XGBoost model actually predicts as FRAUD.
    """
    import pandas as pd
    import random

    df = pd.read_csv(csv_path)

    def to_tx(row, label):
        return {
            "label":         label,
            "step":          int(row.step),
            "type":          row.type,
            "amount":        float(row.amount),
            "oldbalanceOrg": float(row.oldbalanceOrg),
            "newbalanceOrig":float(row.newbalanceOrig),
            "oldbalanceDest":float(row.oldbalanceDest),
            "newbalanceDest":float(row.newbalanceDest),
        }

    # Only keep fraud rows the model actually flags
    fraud_rows = df[df["isFraud"] == 1]
    confirmed_fraud = []
    for row in fraud_rows.itertuples(index=False):
        raw = {"type": row.type, "amount": float(row.amount), "step": int(row.step),
               "oldbalanceOrg": float(row.oldbalanceOrg), "newbalanceOrig": float(row.newbalanceOrig),
               "oldbalanceDest": float(row.oldbalanceDest), "newbalanceDest": float(row.newbalanceDest)}
        result = run_model(raw)
        if result["is_fraud"]:
            confirmed_fraud.append(to_tx(row, "FRAUD"))
        if len(confirmed_fraud) >= 200:   # collect enough, stop early
            break

    log.info(f"Confirmed fraud rows (model agrees): {len(confirmed_fraud)}")

    legit_df = df[df["isFraud"] == 0].sample(frac=1, random_state=42).reset_index(drop=True)
    legit_iter = iter(legit_df.itertuples(index=False))

    import random as _rnd
    _rnd.shuffle(confirmed_fraud)
    fraud_iter = iter(confirmed_fraud)

    sequence: list[dict] = []
    legit_used = 0
    fraud_used = 0

    while len(sequence) < total:
        # 4-6 legit transactions
        for _ in range(_rnd.randint(4, 6)):
            if len(sequence) >= total:
                break
            try:
                row = next(legit_iter)
            except StopIteration:
                legit_df = legit_df.sample(frac=1).reset_index(drop=True)
                legit_iter = iter(legit_df.itertuples(index=False))
                row = next(legit_iter)
            sequence.append(to_tx(row, "LEGIT"))
            legit_used += 1

        # 1 confirmed fraud
        if len(sequence) < total:
            try:
                row_f = next(fraud_iter)
            except StopIteration:
                _rnd.shuffle(confirmed_fraud)
                fraud_iter = iter(confirmed_fraud)
                row_f = next(fraud_iter)
            sequence.append(row_f)
            fraud_used += 1

    log.info(f"Stream sequence: {len(sequence)} tx — {legit_used} legit, {fraud_used} fraud")
    return sequence


def build_webhook_payload(idx: int, round_num: int, raw: dict, result: dict) -> dict:
    import uuid
    from datetime import datetime, timezone

    amount      = raw["amount"]
    old_orig    = raw["oldbalanceOrg"]
    new_orig    = raw["newbalanceOrig"]
    old_dest    = raw["oldbalanceDest"]
    new_dest    = raw["newbalanceDest"]
    tx_type     = raw["type"]
    step        = raw.get("step", 12)
    prob        = result["fraud_probability"]
    drain_ratio = amount / (old_orig + 1)
    hour        = step % 24
    risk_level  = "CRITICAL" if prob >= 0.9 else "HIGH" if prob >= 0.7 else "MEDIUM"

    # ── Build structured insights ──
    insights = []

    if new_orig <= 1.0 and old_orig > 0:
        insights.append({
            "signal":      "full_account_drain",
            "severity":    "CRITICAL",
            "description": f"Origin account balance fully drained from ${old_orig:,.2f} to ${new_orig:,.2f}.",
            "explanation": "Fraudsters typically empty the victim's account in a single transaction to maximise theft before detection."
        })

    if drain_ratio > 0.95:
        insights.append({
            "signal":      "high_drain_ratio",
            "severity":    "HIGH",
            "description": f"Transaction amount (${amount:,.2f}) is {drain_ratio*100:.1f}% of the origin balance.",
            "explanation": "A drain ratio above 95% is a strong indicator of fraudulent intent — legitimate transactions rarely consume the entire account balance."
        })

    if old_dest <= 1.0:
        insights.append({
            "signal":      "empty_destination_account",
            "severity":    "HIGH",
            "description": f"Destination account had a near-zero balance (${old_dest:,.2f}) before receiving funds.",
            "explanation": "Mule accounts used in fraud are typically empty before the transfer and are created solely to receive and forward stolen funds."
        })

    if new_dest <= 1.0 and amount > 0:
        insights.append({
            "signal":      "funds_immediately_moved",
            "severity":    "HIGH",
            "description": f"Destination balance is ${new_dest:,.2f} after receiving ${amount:,.2f} — funds vanished.",
            "explanation": "Funds transferred to the destination were immediately withdrawn or forwarded, consistent with a layering step in money laundering."
        })

    if tx_type in ("TRANSFER", "CASH_OUT"):
        insights.append({
            "signal":      "high_risk_transaction_type",
            "severity":    "MEDIUM",
            "description": f"Transaction type is {tx_type}, which accounts for the majority of fraud cases in the training data.",
            "explanation": "TRANSFER and CASH_OUT are the only transaction types where fraud was observed in the dataset. PAYMENT, DEBIT, and CASH_IN had zero fraud instances."
        })

    if hour <= 5:
        insights.append({
            "signal":      "night_transaction",
            "severity":    "MEDIUM",
            "description": f"Transaction initiated at hour {hour} (12 AM – 5 AM window).",
            "explanation": "Fraudulent transactions are disproportionately initiated during night hours when account owners are unlikely to notice alerts."
        })

    if amount > 100_000:
        insights.append({
            "signal":      "large_amount",
            "severity":    "MEDIUM",
            "description": f"Transaction amount ${amount:,.2f} exceeds the $100,000 high-risk threshold.",
            "explanation": "Large single transactions significantly above typical account activity are a key fraud indicator used by the model."
        })

    if not insights:
        insights.append({
            "signal":      "model_anomaly",
            "severity":    "MEDIUM",
            "description": "XGBoost model flagged a combination of subtle feature anomalies.",
            "explanation": "The model detected unusual patterns across balance ratios, transaction type, and timing that individually may seem normal but together indicate high fraud probability."
        })

    return {
        "event":       "fraud.detected",
        "alert_id":    f"ALERT-{uuid.uuid4().hex[:8].upper()}",
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "system_message": {
            "summary":          f"Fraudulent {tx_type} transaction detected with {prob*100:.1f}% confidence.",
            "risk_level":       risk_level,
            "what_happened":    f"A {tx_type} of ${amount:,.2f} was made from an account holding ${old_orig:,.2f}, leaving only ${new_orig:,.2f}. The destination account had ${old_dest:,.2f} before and ${new_dest:,.2f} after.",
            "why_it_is_fraud":  f"The XGBoost model flagged this transaction based on {len(insights)} risk signal(s): " + ", ".join(i["signal"] for i in insights) + ".",
            "recommended_action": (
                "Freeze transaction and escalate to fraud team immediately." if risk_level == "CRITICAL"
                else "Place transaction on hold and trigger manual review." if risk_level == "HIGH"
                else "Flag for monitoring and notify account holder."
            ),
        },
        "transaction": {
            "index":            idx,
            "round":            round_num,
            "type":             tx_type,
            "amount":           amount,
            "old_balance_orig": old_orig,
            "new_balance_orig": new_orig,
            "old_balance_dest": old_dest,
            "new_balance_dest": new_dest,
            "step":             step,
            "hour_of_day":      hour,
            "drain_ratio":      round(drain_ratio, 4),
        },
        "model_output": {
            "fraud_probability": prob,
            "risk_level":        risk_level,
            "prediction":        result["prediction"],
            "signals_triggered": len(insights),
        },
        "insights": insights,
    }


def engineer_features(data: dict):
    import pandas as pd
    df = pd.DataFrame([data])
    df['balance_drain_ratio'] = df['amount'] / (df['oldbalanceOrg'] + 1)
    df['is_full_drain']       = ((df['newbalanceOrig'] <= 1.0) & (df['oldbalanceOrg'] > 0)).astype(int)
    df['dest_was_empty']      = (df['oldbalanceDest'] <= 1.0).astype(int)
    df['dest_still_empty']    = (df['newbalanceDest'] <= 1.0).astype(int)
    df['is_transfer']         = (df['type'] == 'TRANSFER').astype(int)
    df['is_cash_out']         = (df['type'] == 'CASH_OUT').astype(int)
    df['type']                = LabelEncoder().fit_transform(df['type'])
    df['hour_of_day']         = df['step'] % 24
    df['is_night']            = ((df['hour_of_day'] >= 0) & (df['hour_of_day'] <= 5)).astype(int)
    df['log_amount']          = np.log1p(df['amount'])
    return df[['step', 'type', 'amount', 'oldbalanceOrg', 'newbalanceOrig', 'oldbalanceDest', 'newbalanceDest',
               'balance_drain_ratio', 'is_full_drain', 'dest_was_empty', 'dest_still_empty',
               'is_transfer', 'is_cash_out', 'hour_of_day', 'is_night', 'log_amount']]


def run_model(data: dict) -> dict:
    df   = engineer_features(data)
    prob = float(model.predict_proba(df)[0][1])
    label = "FRAUD" if prob > 0.5 else "LEGIT"
    return {"fraud_probability": round(prob, 4), "prediction": label, "is_fraud": label == "FRAUD"}


_CSV = Path("Synthetic_Financial_datasets_log.csv")
TRANSACTIONS = _build_transaction_sequence(str(_CSV), total=500)


TYPE_MAP = {
    "WIRE_TRANSFER": "TRANSFER",
    "CASH_OUT":      "CASH_OUT",
    "CASH_IN":       "CASH_IN",
    "PAYMENT":       "PAYMENT",
    "DEBIT":         "DEBIT",
    "TRANSFER":      "TRANSFER",
}

class PredictRequest(BaseModel):
    type: str
    amount: float
    step: int = 1
    oldbalanceOrg: float = 0.0
    newbalanceOrig: float = 0.0
    oldbalanceDest: float = 0.0
    newbalanceDest: float = 0.0

@app.post("/api/predict")
async def predict(req: PredictRequest):
    raw = {
        "type":           TYPE_MAP.get(req.type.upper(), req.type.upper()),
        "amount":         req.amount,
        "step":           req.step,
        "oldbalanceOrg":  req.oldbalanceOrg,
        "newbalanceOrig": req.newbalanceOrig,
        "oldbalanceDest": req.oldbalanceDest,
        "newbalanceDest": req.newbalanceDest,
    }
    result = run_model(raw)

    risk_factors = []
    drain = req.amount / (req.oldbalanceOrg + 1)
    if drain > 0.95:
        risk_factors.append("Account fully drained")
    if req.newbalanceOrig <= 1.0 and req.oldbalanceOrg > 0:
        risk_factors.append("Origin balance zeroed out")
    if req.oldbalanceDest <= 1.0:
        risk_factors.append("Destination was empty before transfer")
    if req.newbalanceDest <= 1.0 and req.amount > 0:
        risk_factors.append("Destination still empty after transfer")
    if raw["type"] in ("TRANSFER", "CASH_OUT") and drain > 0.8:
        risk_factors.append(f"High-risk transaction type ({raw['type']}) with large drain")
    if req.step % 24 <= 5:
        risk_factors.append("Transaction initiated at night (12am–5am)")
    if req.amount > 100_000:
        risk_factors.append("Large transaction amount (>$100k)")

    return JSONResponse({
        "prediction":        result["prediction"],
        "fraud_probability": result["fraud_probability"],
        "is_fraud":          result["is_fraud"],
        "risk_factors":      risk_factors,
        "risk_level":        "HIGH" if result["fraud_probability"] > 0.7 else "MEDIUM" if result["fraud_probability"] > 0.3 else "LOW",
    })


@app.get("/", response_class=HTMLResponse)
async def index():
    return Path("index.html").read_text()


@app.websocket("/ws/live")
async def live_stream(websocket: WebSocket):
    await websocket.accept()
    log.info("Frontend WebSocket connected")
    try:
        round_num = 1
        while True:
            for idx, tx in enumerate(TRANSACTIONS, 1):
                label = tx["label"]
                raw   = {k: v for k, v in tx.items() if k != "label"}
                result = run_model(raw)
                await websocket.send_json({
                    "index":      idx,
                    "round":      round_num,
                    "label":      label,
                    "raw":        raw,
                    "prediction": result["prediction"],
                    "probability":result["fraud_probability"],
                    "is_fraud":   result["is_fraud"],
                })

                if result["is_fraud"]:
                    try:
                        webhook_payload = build_webhook_payload(idx, round_num, raw, result)
                        async with httpx.AsyncClient() as client:
                            # 1. Store in local backend (with pre-computed insights)
                            await client.post(
                                f"{BACKEND_URL}/alerts/fraud",
                                json={
                                    "transaction_index": idx,
                                    "round":             round_num,
                                    "transaction_type":  raw["type"],
                                    "amount":            raw["amount"],
                                    "old_balance_orig":  raw["oldbalanceOrg"],
                                    "new_balance_orig":  raw["newbalanceOrig"],
                                    "old_balance_dest":  raw["oldbalanceDest"],
                                    "new_balance_dest":  raw["newbalanceDest"],
                                    "fraud_probability": result["fraud_probability"],
                                    "step":              raw.get("step"),
                                    "insights":          webhook_payload["insights"],
                                    "system_message":    webhook_payload["system_message"],
                                },
                                timeout=3.0,
                            )
                            # 2. Fire webhook to Langflow
                            await client.post(
                                "https://demo.appdesign.mlangles.ai/api/v1/webhook/d2d1aec6-6977-45e9-b69f-a27be03d82ca",
                                json=webhook_payload,
                                timeout=5.0,
                            )
                            log.info(f"Webhook fired for fraud tx #{idx} round #{round_num}")

                    except Exception as e:
                        log.warning(f"Failed to post fraud alert: {e}")

                await asyncio.sleep(0.5)

            await websocket.send_json({"type": "round_end", "round": round_num, "total": len(TRANSACTIONS)})
            round_num += 1
            await asyncio.sleep(2.0)

    except WebSocketDisconnect:
        log.info("Frontend WebSocket disconnected")
    except Exception as e:
        log.error(f"WebSocket error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)

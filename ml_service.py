"""
ML Fraud Detection Service — Port 8001
Multi-user support — every transaction is tagged with user_id

Endpoints:
  POST /raw                          → send raw transaction (with user_id)
  GET  /raw/history?user_id=X        → history for a specific user
  GET  /raw/history/{id}             → single record by id
  GET  /raw/stats?user_id=X          → stats for a user (or all users)
  GET  /users                        → list all active users
  POST /predict                      → single prediction (no storage)
  WS   /ws/stream/{user_id}          → live stream per user
  GET  /health                       → health check
"""

import asyncio
import logging
import numpy as np
import joblib
import httpx
from datetime import datetime
from typing import List, Optional
from collections import defaultdict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.preprocessing import LabelEncoder

# ── Setup ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="Fraud Detection ML Service — Multi User", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

BACKEND_URL = "http://localhost:8000"

# ── In-memory store: keyed by user_id ─────────────────────────────────────
user_store: dict[str, list] = defaultdict(list)   # { user_id: [ records ] }
id_counter = 0

# ── Load model ────────────────────────────────────────────────────────────
model = joblib.load("saved_models/fulldata_best_xgboost.pkl")
log.info("XGBoost model loaded.")

# ── Feature engineering ───────────────────────────────────────────────────
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
    return df

def run_model(data: dict) -> dict:
    df    = engineer_features(data)
    prob  = float(model.predict_proba(df)[0][1])
    label = "FRAUD" if prob > 0.5 else "LEGIT"
    return {
        "fraud_probability": round(prob, 4),
        "prediction":        label,
        "is_fraud":          label == "FRAUD",
    }

async def forward_to_backend(payload: dict):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{BACKEND_URL}/fraud-alert", json=payload)
            log.info(f"Forwarded FRAUD alert → user={payload['user_id']} prob={payload['result']['fraud_probability']}")
    except Exception as e:
        log.warning(f"Could not reach backend on 8000: {e}")

def make_record(user_id: str, raw: dict, result: dict, record_id: int) -> dict:
    eng_df = engineer_features(raw)
    return {
        "id":           record_id,
        "user_id":      user_id,
        "received_at":  datetime.now().isoformat(),
        "raw":          raw,
        "engineered":   eng_df.iloc[0].to_dict(),
        "result":       result,
    }

# ── Schema ─────────────────────────────────────────────────────────────────
class Transaction(BaseModel):
    user_id:        str
    step:           int
    type:           str
    amount:         float
    oldbalanceOrg:  float
    newbalanceOrig: float
    oldbalanceDest: float
    newbalanceDest: float

class PredictOnly(BaseModel):
    step:           int
    type:           str
    amount:         float
    oldbalanceOrg:  float
    newbalanceOrig: float
    oldbalanceDest: float
    newbalanceDest: float

# ── POST /raw ──────────────────────────────────────────────────────────────
@app.post("/raw")
async def receive_raw(tx: Transaction):
    global id_counter
    id_counter += 1

    raw    = tx.dict()
    user_id = raw.pop("user_id")
    result = run_model(raw)
    record = make_record(user_id, raw, result, id_counter)

    user_store[user_id].append(record)
    log.info(f"[{id_counter}] user={user_id} {raw['type']} {raw['amount']} → {result['prediction']}")

    if result["is_fraud"]:
        await forward_to_backend({**record, "user_id": user_id})

    return {"id": id_counter, "user_id": user_id, "raw": raw, "result": result}

# ── GET /raw/history ───────────────────────────────────────────────────────
@app.get("/raw/history")
def raw_history(
    user_id:    str,
    limit:      int           = 50,
    prediction: Optional[str] = None,
):
    data = user_store.get(user_id, [])[-limit:]
    if prediction:
        data = [r for r in data if r["result"]["prediction"] == prediction.upper()]
    return {
        "user_id":      user_id,
        "total":        len(user_store.get(user_id, [])),
        "showing":      len(data),
        "transactions": data,
    }

# ── GET /raw/history/{id} ──────────────────────────────────────────────────
@app.get("/raw/history/{record_id}")
def raw_by_id(record_id: int, user_id: str):
    for r in user_store.get(user_id, []):
        if r["id"] == record_id:
            return r
    raise HTTPException(status_code=404, detail=f"Record {record_id} not found for user {user_id}")

# ── GET /raw/stats ─────────────────────────────────────────────────────────
@app.get("/raw/stats")
def raw_stats(user_id: Optional[str] = None):
    if user_id:
        records = user_store.get(user_id, [])
        if not records:
            return {"user_id": user_id, "message": "No data yet"}
        total  = len(records)
        frauds = sum(1 for r in records if r["result"]["is_fraud"])
        return {
            "user_id":        user_id,
            "total_received": total,
            "fraud_count":    frauds,
            "legit_count":    total - frauds,
            "fraud_rate":     round(frauds / total * 100, 2),
            "latest_id":      records[-1]["id"],
            "latest_at":      records[-1]["received_at"],
        }
    else:
        # stats across ALL users
        all_records = [r for recs in user_store.values() for r in recs]
        if not all_records:
            return {"message": "No data yet"}
        total  = len(all_records)
        frauds = sum(1 for r in all_records if r["result"]["is_fraud"])
        return {
            "user_id":        "ALL",
            "total_received": total,
            "fraud_count":    frauds,
            "legit_count":    total - frauds,
            "fraud_rate":     round(frauds / total * 100, 2),
            "active_users":   len(user_store),
        }

# ── GET /users ─────────────────────────────────────────────────────────────
@app.get("/users")
def list_users():
    return {
        "active_users": len(user_store),
        "users": [
            {
                "user_id":        uid,
                "total":          len(recs),
                "fraud_count":    sum(1 for r in recs if r["result"]["is_fraud"]),
                "last_seen":      recs[-1]["received_at"] if recs else None,
            }
            for uid, recs in user_store.items()
        ]
    }

# ── POST /predict (no storage) ─────────────────────────────────────────────
@app.post("/predict")
async def predict(tx: PredictOnly):
    result = run_model(tx.dict())
    if result["is_fraud"]:
        await forward_to_backend({"raw": tx.dict(), "result": result, "user_id": "unknown"})
    return {**result, "transaction": tx.dict()}

# ── GET /health ────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    total = sum(len(v) for v in user_store.values())
    return {
        "status":        "ok",
        "model":         "XGBoost",
        "port":          8001,
        "active_users":  len(user_store),
        "total_records": total,
    }

# ── WebSocket /ws/stream/{user_id} ────────────────────────────────────────
@app.websocket("/ws/stream/{user_id}")
async def websocket_stream(websocket: WebSocket, user_id: str):
    global id_counter
    await websocket.accept()
    log.info(f"WebSocket connected — user={user_id}")
    try:
        while True:
            data = await websocket.receive_json()
            id_counter += 1

            result = run_model(data)
            record = make_record(user_id, data, result, id_counter)
            user_store[user_id].append(record)

            await websocket.send_json({**result, "id": id_counter, "user_id": user_id})

            if result["is_fraud"]:
                await forward_to_backend({**record, "user_id": user_id})

    except WebSocketDisconnect:
        log.info(f"WebSocket disconnected — user={user_id}")
    except Exception as e:
        log.error(f"WebSocket error user={user_id}: {e}")
        await websocket.close()

# ── Run ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ml_service:app", host="0.0.0.0", port=8001, reload=False)

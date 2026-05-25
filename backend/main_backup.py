"""
FraudShield Backend — port 8002
- Receives transactions from bank simulator (port 8000)
- Scores using XGBoost + identity graph features
- Broadcasts results to frontend via WebSocket
"""

import json
import os
import asyncio
from collections import deque
from datetime import datetime
from typing import Set

import numpy as np
import pandas as pd
import xgboost as xgb
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Paths
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH  = os.path.join(BASE, "model", "fraud_xgb.json")
META_PATH   = os.path.join(BASE, "model", "metadata.json")
HIST_PATH   = "/home/hayakreevan/Downloads/ieee-fraud-detection/train_transaction.csv"
IDE_PATH    = "/home/hayakreevan/Downloads/ieee-fraud-detection/train_identity.csv"

app = FastAPI(title="FraudShield API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── State
connected_clients: Set[WebSocket] = set()
recent_transactions: deque = deque(maxlen=200)
stats = {
    "total": 0,
    "fraud_detected": 0,
    "total_amount": 0.0,
    "fraud_amount": 0.0,
    "last_updated": "",
}

# ── Load model + graph lookup tables on startup
model = None
card_frate = {}
device_frate = {}
addr_frate = {}
email_frate = {}
card_total = {}
device_total = {}
card_rsize = {}
device_rsize = {}
addr_total = {}
feature_cols = []

@app.on_event("startup")
async def load_model():
    global model, card_frate, device_frate, addr_frate, email_frate
    global card_total, device_total, card_rsize, device_rsize, addr_total
    global feature_cols

    print("Loading XGBoost model...")
    m = xgb.XGBClassifier()
    m.load_model(MODEL_PATH)
    model = m

    with open(META_PATH) as f:
        meta = json.load(f)
    feature_cols = meta["feature_cols"]
    print(f"Model loaded — AUC {meta['auc_roc']} | features: {len(feature_cols)}")

    print("Building graph lookup tables from history...")
    tx_cols = [
        "TransactionID", "isFraud", "TransactionDT",
        "card1", "addr1", "P_emaildomain",
    ]
    ide_cols = ["TransactionID", "DeviceInfo"]
    tx  = pd.read_csv(HIST_PATH, usecols=tx_cols)
    ide = pd.read_csv(IDE_PATH,  usecols=ide_cols)
    df  = tx.merge(ide, on="TransactionID", how="left")
    df  = df.sort_values("TransactionDT")
    df["DeviceInfo"]    = df["DeviceInfo"].fillna("UNKNOWN").astype(str)
    df["addr1"]         = df["addr1"].fillna("UNKNOWN").astype(str)
    df["P_emaildomain"] = df["P_emaildomain"].fillna("UNKNOWN").astype(str)

    split = int(len(df) * 0.70)
    hist  = df.iloc[:split]

    def hub_stats(col):
        g = hist.groupby(col)["isFraud"].agg(["count","sum"]).reset_index()
        g.columns = [col,"total","fraud"]
        frate = dict(zip(g[col], g["fraud"]/g["total"].clip(lower=1)))
        total = dict(zip(g[col], g["total"]))
        return frate, total

    card_frate,   card_total   = hub_stats("card1")
    addr_frate,   addr_total   = hub_stats("addr1")
    email_frate,  _            = hub_stats("P_emaildomain")
    device_frate, device_total = hub_stats("DeviceInfo")

    # ring size = tx count per hub (reuse total as proxy)
    card_rsize   = card_total.copy()
    device_rsize = device_total.copy()

    print(f"Graph tables ready — {len(card_frate):,} cards, {len(device_frate):,} devices")


# ── Score helper
def score_transaction(tx: dict) -> dict:
    card   = str(tx.get("card1", "UNKNOWN"))
    addr   = str(tx.get("addr1", "UNKNOWN"))
    email  = str(tx.get("P_emaildomain", "UNKNOWN"))
    device = str(tx.get("DeviceInfo", "UNKNOWN"))

    # encode ProductCD, card4, card6, DeviceType as simple hashes
    def cat_encode(val, mapping):
        return mapping.get(str(val), 0)

    product_map = {"W":0,"H":1,"C":2,"S":3,"R":4}
    card4_map   = {"visa":0,"mastercard":1,"american express":2,"discover":3}
    card6_map   = {"credit":0,"debit":1}
    dev_map     = {"desktop":0,"mobile":1}

    row = pd.DataFrame([{
        "TransactionAmt": float(tx.get("TransactionAmt", 0)),
        "ProductCD":      cat_encode(tx.get("ProductCD","W"), product_map),
        "card4":          cat_encode(tx.get("card4","visa"), card4_map),
        "card6":          cat_encode(tx.get("card6","debit"), card6_map),
        "DeviceType":     cat_encode(tx.get("DeviceType","desktop"), dev_map),
        "C1":  float(tx.get("C1",  1)),
        "C2":  float(tx.get("C2",  1)),
        "C5":  float(tx.get("C5",  0)),
        "C6":  float(tx.get("C6",  1)),
        "C13": float(tx.get("C13", 1)),
        "C14": float(tx.get("C14", 1)),
        "D1":  float(tx.get("D1",  0)),
        "D4":  float(tx.get("D4",  0)),
        "D10": float(tx.get("D10", 0)),
        # graph features
        "card_fraud_rate":     card_frate.get(card, 0.0),
        "card_tx_volume":      card_total.get(card, 0),
        "card_ring_size":      card_rsize.get(card, 0),
        "addr_fraud_rate":     addr_frate.get(addr, 0.0),
        "addr_tx_volume":      addr_total.get(addr, 0),
        "device_fraud_rate":   device_frate.get(device, 0.0),
        "device_tx_volume":    device_total.get(device, 0),
        "device_ring_size":    device_rsize.get(device, 0),
        "email_fraud_rate":    email_frate.get(email, 0.0),
        "card_seen_in_hist":   int(card in card_frate),
        "device_seen_in_hist": int(device in device_frate),
    }])

    score = float(model.predict_proba(row)[0][1])

    # top risk factors
    graph_feats = {
        "card_fraud_rate":   card_frate.get(card, 0.0),
        "device_fraud_rate": device_frate.get(device, 0.0),
        "addr_fraud_rate":   addr_frate.get(addr, 0.0),
        "email_fraud_rate":  email_frate.get(email, 0.0),
    }
    risk_factors = [k for k, v in sorted(graph_feats.items(),
                    key=lambda x: x[1], reverse=True) if v > 0.05][:3]

    return {
        "fraud_score":      round(score, 4),
        "synthetic_flag":   score >= 0.3,
        "decision":         "DECLINE" if score >= 0.3 else "APPROVE",
        "risk_factors":     risk_factors,
        "card_fraud_rate":  round(card_frate.get(card, 0.0), 4),
        "device_fraud_rate":round(device_frate.get(device, 0.0), 4),
    }


# ── WebSocket manager
async def broadcast(message: dict):
    dead = set()
    for ws in connected_clients:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    # send last 50 transactions on connect
    await websocket.send_text(json.dumps({
        "type": "history",
        "transactions": list(recent_transactions)[-50:],
        "stats": stats,
    }))
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        connected_clients.discard(websocket)


# ── Transaction ingestion endpoint (called by bank simulator)
class Transaction(BaseModel):
    TransactionID:  int
    TransactionAmt: float
    ProductCD:      str = "W"
    card1:          str = "UNKNOWN"
    card4:          str = "visa"
    card6:          str = "debit"
    addr1:          str = "UNKNOWN"
    P_emaildomain:  str = "UNKNOWN"
    DeviceType:     str = "desktop"
    DeviceInfo:     str = "UNKNOWN"
    C1: float = 1; C2: float = 1; C5: float = 0
    C6: float = 1; C13: float = 1; C14: float = 1
    D1: float = 0; D4: float = 0;  D10: float = 0


@app.post("/ingest")
async def ingest_transaction(tx: Transaction):
    result = score_transaction(tx.dict())

    record = {
        **tx.dict(),
        **result,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

    recent_transactions.append(record)

    # update stats
    stats["total"] += 1
    stats["total_amount"] += tx.TransactionAmt
    stats["last_updated"] = record["timestamp"]
    if result["synthetic_flag"]:
        stats["fraud_detected"] += 1
        stats["fraud_amount"] += tx.TransactionAmt

    await broadcast({"type": "transaction", "data": record, "stats": stats})
    return result


@app.get("/stats")
def get_stats():
    return {**stats, "recent": list(recent_transactions)[-10:]}


@app.get("/transactions")
def get_transactions(limit: int = 100):
    return list(recent_transactions)[-limit:]


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}

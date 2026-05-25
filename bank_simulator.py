"""
Bank Simulator — port 8000
Streams real IEEE-CIS transactions to the backend at port 8002
"""

import asyncio
import json
import random
import httpx
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

TX_PATH  = "/home/hayakreevan/Downloads/ieee-fraud-detection/train_transaction.csv"
IDE_PATH = "/home/hayakreevan/Downloads/ieee-fraud-detection/train_identity.csv"
BACKEND  = "http://localhost:8002/ingest"

app = FastAPI(title="Bank Simulator")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

# Load dataset once
print("Loading dataset...")
tx_cols = [
    "TransactionID","TransactionAmt","ProductCD",
    "card1","card4","card6","addr1","P_emaildomain",
    "C1","C2","C5","C6","C13","C14","D1","D4","D10","isFraud"
]
ide_cols = ["TransactionID","DeviceType","DeviceInfo"]
tx_all = pd.read_csv(TX_PATH, usecols=tx_cols)
ide    = pd.read_csv(IDE_PATH, usecols=ide_cols)
df_all = tx_all.merge(ide, on="TransactionID", how="left").fillna("UNKNOWN")

# Use the SCORE set (last 30%) so graph history covers these cards
split     = int(len(df_all) * 0.70)
score_set = df_all.iloc[split:].copy()

# Build a mixed stream: all legit rows + fraud rows repeated 5x
# so fraud appears ~15% of stream (more visible on dashboard)
legit = score_set[score_set["isFraud"] == 0]
fraud = score_set[score_set["isFraud"] == 1]
df = pd.concat([legit, pd.concat([fraud]*5)]).sample(frac=1, random_state=42).reset_index(drop=True)
print(f"Dataset ready: {len(df):,} rows  |  fraud: {df['isFraud'].mean()*100:.1f}%")

streaming = False
stream_task = None


async def stream_loop(delay: float = 0.5):
    global streaming
    async with httpx.AsyncClient(timeout=10) as client:
        for _, row in df.iterrows():
            if not streaming:
                break
            payload = {
                "TransactionID":  int(row["TransactionID"]),
                "TransactionAmt": float(row["TransactionAmt"]),
                "ProductCD":      str(row["ProductCD"]),
                "card1":          str(row["card1"]),
                "card4":          str(row["card4"]),
                "card6":          str(row["card6"]),
                "addr1":          str(row["addr1"]),
                "P_emaildomain":  str(row["P_emaildomain"]),
                "DeviceType":     str(row["DeviceType"]),
                "DeviceInfo":     str(row["DeviceInfo"]),
                "C1":  float(row["C1"])  if row["C1"]  != "UNKNOWN" else 1.0,
                "C2":  float(row["C2"])  if row["C2"]  != "UNKNOWN" else 1.0,
                "C5":  float(row["C5"])  if row["C5"]  != "UNKNOWN" else 0.0,
                "C6":  float(row["C6"])  if row["C6"]  != "UNKNOWN" else 1.0,
                "C13": float(row["C13"]) if row["C13"] != "UNKNOWN" else 1.0,
                "C14": float(row["C14"]) if row["C14"] != "UNKNOWN" else 1.0,
                "D1":  float(row["D1"])  if row["D1"]  != "UNKNOWN" else 0.0,
                "D4":  float(row["D4"])  if row["D4"]  != "UNKNOWN" else 0.0,
                "D10": float(row["D10"]) if row["D10"] != "UNKNOWN" else 0.0,
            }
            try:
                await client.post(BACKEND, json=payload)
            except Exception as e:
                print(f"  Backend unreachable: {e}")
            await asyncio.sleep(delay)


@app.post("/start")
async def start_stream(delay: float = 0.5):
    global streaming, stream_task
    if streaming:
        return {"status": "already running"}
    streaming = True
    stream_task = asyncio.create_task(stream_loop(delay))
    return {"status": "started", "delay_seconds": delay}


@app.post("/stop")
async def stop_stream():
    global streaming
    streaming = False
    return {"status": "stopped"}


@app.get("/status")
async def status():
    return {"streaming": streaming, "total_rows": len(df)}


@app.get("/health")
async def health():
    return {"status": "ok"}

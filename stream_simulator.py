"""
Live Stream Simulator — 50 fixed transactions looping forever
Mimics a real-time transaction feed sent to ml_service on port 8001
"""

import asyncio
import json
import websockets

USER_ID = "user_001"                              # change this per user
WS_URL  = f"ws://localhost:8001/ws/stream/{USER_ID}"

# ── 50 transactions (45 legit + 5 fraud hidden inside) ────────────────────
TRANSACTIONS = [
    {"label":"LEGIT", "step":10,  "type":"PAYMENT",  "amount":3200.00,    "oldbalanceOrg":55000.0,   "newbalanceOrig":51800.0,   "oldbalanceDest":8000.0,   "newbalanceDest":11200.0},
    {"label":"LEGIT", "step":22,  "type":"PAYMENT",  "amount":1450.50,    "oldbalanceOrg":28000.0,   "newbalanceOrig":26549.50,  "oldbalanceDest":5000.0,   "newbalanceDest":6450.50},
    {"label":"LEGIT", "step":45,  "type":"DEBIT",    "amount":320.00,     "oldbalanceOrg":15000.0,   "newbalanceOrig":14680.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":30,  "type":"CASH_IN",  "amount":85000.00,   "oldbalanceOrg":200000.0,  "newbalanceOrig":115000.0,  "oldbalanceDest":3000.0,   "newbalanceDest":88000.0},
    {"label":"LEGIT", "step":60,  "type":"PAYMENT",  "amount":500.00,     "oldbalanceOrg":12000.0,   "newbalanceOrig":11500.0,   "oldbalanceDest":3000.0,   "newbalanceDest":3500.0},
    {"label":"FRAUD", "step":1,   "type":"TRANSFER", "amount":181.00,     "oldbalanceOrg":181.0,     "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":75,  "type":"PAYMENT",  "amount":22000.00,   "oldbalanceOrg":150000.0,  "newbalanceOrig":128000.0,  "oldbalanceDest":40000.0,  "newbalanceDest":62000.0},
    {"label":"LEGIT", "step":88,  "type":"DEBIT",    "amount":1200.00,    "oldbalanceOrg":45000.0,   "newbalanceOrig":43800.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":31,  "type":"CASH_IN",  "amount":42000.00,   "oldbalanceOrg":80000.0,   "newbalanceOrig":38000.0,   "oldbalanceDest":10000.0,  "newbalanceDest":52000.0},
    {"label":"LEGIT", "step":80,  "type":"TRANSFER", "amount":20000.00,   "oldbalanceOrg":95000.0,   "newbalanceOrig":75000.0,   "oldbalanceDest":50000.0,  "newbalanceDest":70000.0},
    {"label":"LEGIT", "step":120, "type":"DEBIT",    "amount":75.50,      "oldbalanceOrg":8000.0,    "newbalanceOrig":7924.50,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":140, "type":"CASH_OUT", "amount":5000.00,    "oldbalanceOrg":40000.0,   "newbalanceOrig":35000.0,   "oldbalanceDest":12000.0,  "newbalanceDest":17000.0},
    {"label":"LEGIT", "step":100, "type":"CASH_IN",  "amount":15000.00,   "oldbalanceOrg":30000.0,   "newbalanceOrig":15000.0,   "oldbalanceDest":5000.0,   "newbalanceDest":20000.0},
    {"label":"LEGIT", "step":160, "type":"TRANSFER", "amount":50000.00,   "oldbalanceOrg":200000.0,  "newbalanceOrig":150000.0,  "oldbalanceDest":80000.0,  "newbalanceDest":130000.0},
    {"label":"LEGIT", "step":170, "type":"CASH_OUT", "amount":2000.00,    "oldbalanceOrg":18000.0,   "newbalanceOrig":16000.0,   "oldbalanceDest":5000.0,   "newbalanceDest":7000.0},
    {"label":"LEGIT", "step":180, "type":"DEBIT",    "amount":5500.00,    "oldbalanceOrg":70000.0,   "newbalanceOrig":64500.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":200, "type":"CASH_IN",  "amount":120000.00,  "oldbalanceOrg":300000.0,  "newbalanceOrig":180000.0,  "oldbalanceDest":50000.0,  "newbalanceDest":170000.0},
    {"label":"LEGIT", "step":220, "type":"TRANSFER", "amount":8500.00,    "oldbalanceOrg":60000.0,   "newbalanceOrig":51500.0,   "oldbalanceDest":15000.0,  "newbalanceDest":23500.0},
    {"label":"LEGIT", "step":230, "type":"CASH_OUT", "amount":10000.00,   "oldbalanceOrg":80000.0,   "newbalanceOrig":70000.0,   "oldbalanceDest":30000.0,  "newbalanceDest":40000.0},
    {"label":"FRAUD", "step":215, "type":"CASH_OUT", "amount":344464.40,  "oldbalanceOrg":344464.40, "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":250, "type":"CASH_IN",  "amount":9500.00,    "oldbalanceOrg":20000.0,   "newbalanceOrig":10500.0,   "oldbalanceDest":2000.0,   "newbalanceDest":11500.0},
    {"label":"LEGIT", "step":300, "type":"DEBIT",    "amount":250.00,     "oldbalanceOrg":5000.0,    "newbalanceOrig":4750.0,    "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":350, "type":"CASH_OUT", "amount":3500.00,    "oldbalanceOrg":25000.0,   "newbalanceOrig":21500.0,   "oldbalanceDest":8000.0,   "newbalanceDest":11500.0},
    {"label":"LEGIT", "step":400, "type":"TRANSFER", "amount":100000.00,  "oldbalanceOrg":500000.0,  "newbalanceOrig":400000.0,  "oldbalanceDest":200000.0, "newbalanceDest":300000.0},
    {"label":"LEGIT", "step":500, "type":"CASH_OUT", "amount":15000.00,   "oldbalanceOrg":120000.0,  "newbalanceOrig":105000.0,  "oldbalanceDest":45000.0,  "newbalanceDest":60000.0},
    {"label":"LEGIT", "step":110, "type":"PAYMENT",  "amount":6700.00,    "oldbalanceOrg":48000.0,   "newbalanceOrig":41300.0,   "oldbalanceDest":7000.0,   "newbalanceDest":13700.0},
    {"label":"LEGIT", "step":130, "type":"DEBIT",    "amount":890.00,     "oldbalanceOrg":22000.0,   "newbalanceOrig":21110.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":150, "type":"CASH_IN",  "amount":35000.00,   "oldbalanceOrg":75000.0,   "newbalanceOrig":40000.0,   "oldbalanceDest":15000.0,  "newbalanceDest":50000.0},
    {"label":"FRAUD", "step":3,   "type":"TRANSFER", "amount":11996.58,   "oldbalanceOrg":11996.58,  "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":190, "type":"PAYMENT",  "amount":14500.00,   "oldbalanceOrg":95000.0,   "newbalanceOrig":80500.0,   "oldbalanceDest":20000.0,  "newbalanceDest":34500.0},
    {"label":"LEGIT", "step":210, "type":"CASH_OUT", "amount":8000.00,    "oldbalanceOrg":65000.0,   "newbalanceOrig":57000.0,   "oldbalanceDest":20000.0,  "newbalanceDest":28000.0},
    {"label":"LEGIT", "step":240, "type":"DEBIT",    "amount":4200.00,    "oldbalanceOrg":35000.0,   "newbalanceOrig":30800.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":260, "type":"TRANSFER", "amount":30000.00,   "oldbalanceOrg":180000.0,  "newbalanceOrig":150000.0,  "oldbalanceDest":60000.0,  "newbalanceDest":90000.0},
    {"label":"LEGIT", "step":280, "type":"PAYMENT",  "amount":9900.00,    "oldbalanceOrg":72000.0,   "newbalanceOrig":62100.0,   "oldbalanceDest":18000.0,  "newbalanceDest":27900.0},
    {"label":"LEGIT", "step":310, "type":"CASH_IN",  "amount":60000.00,   "oldbalanceOrg":130000.0,  "newbalanceOrig":70000.0,   "oldbalanceDest":25000.0,  "newbalanceDest":85000.0},
    {"label":"LEGIT", "step":330, "type":"DEBIT",    "amount":150.00,     "oldbalanceOrg":9000.0,    "newbalanceOrig":8850.0,    "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"FRAUD", "step":421, "type":"CASH_OUT", "amount":178439.26,  "oldbalanceOrg":178439.26, "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":360, "type":"PAYMENT",  "amount":2800.00,    "oldbalanceOrg":31000.0,   "newbalanceOrig":28200.0,   "oldbalanceDest":6000.0,   "newbalanceDest":8800.0},
    {"label":"LEGIT", "step":380, "type":"TRANSFER", "amount":15000.00,   "oldbalanceOrg":110000.0,  "newbalanceOrig":95000.0,   "oldbalanceDest":40000.0,  "newbalanceDest":55000.0},
    {"label":"LEGIT", "step":420, "type":"CASH_OUT", "amount":12000.00,   "oldbalanceOrg":90000.0,   "newbalanceOrig":78000.0,   "oldbalanceDest":35000.0,  "newbalanceDest":47000.0},
    {"label":"LEGIT", "step":440, "type":"DEBIT",    "amount":680.00,     "oldbalanceOrg":17000.0,   "newbalanceOrig":16320.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":460, "type":"PAYMENT",  "amount":18000.00,   "oldbalanceOrg":130000.0,  "newbalanceOrig":112000.0,  "oldbalanceDest":30000.0,  "newbalanceDest":48000.0},
    {"label":"LEGIT", "step":480, "type":"CASH_IN",  "amount":25000.00,   "oldbalanceOrg":55000.0,   "newbalanceOrig":30000.0,   "oldbalanceDest":10000.0,  "newbalanceDest":35000.0},
    {"label":"LEGIT", "step":520, "type":"TRANSFER", "amount":45000.00,   "oldbalanceOrg":250000.0,  "newbalanceOrig":205000.0,  "oldbalanceDest":100000.0, "newbalanceDest":145000.0},
    {"label":"LEGIT", "step":540, "type":"DEBIT",    "amount":3300.00,    "oldbalanceOrg":42000.0,   "newbalanceOrig":38700.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":560, "type":"CASH_OUT", "amount":7500.00,    "oldbalanceOrg":55000.0,   "newbalanceOrig":47500.0,   "oldbalanceDest":22000.0,  "newbalanceDest":29500.0},
    {"label":"LEGIT", "step":580, "type":"PAYMENT",  "amount":11200.00,   "oldbalanceOrg":88000.0,   "newbalanceOrig":76800.0,   "oldbalanceDest":25000.0,  "newbalanceDest":36200.0},
    {"label":"FRAUD", "step":312, "type":"CASH_OUT", "amount":68912.23,   "oldbalanceOrg":68912.23,  "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    {"label":"LEGIT", "step":620, "type":"CASH_IN",  "amount":50000.00,   "oldbalanceOrg":100000.0,  "newbalanceOrig":50000.0,   "oldbalanceDest":20000.0,  "newbalanceDest":70000.0},
    {"label":"LEGIT", "step":700, "type":"DEBIT",    "amount":920.00,     "oldbalanceOrg":14000.0,   "newbalanceOrig":13080.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
]

async def stream():
    print(f"Connecting to {WS_URL}...")
    print("Streaming 50 transactions in a loop. Press Ctrl+C to stop.\n")
    print(f"{'─'*78}")
    print(f"  {'#':<5} {'Round':<7} {'Actual':<7} {'Type':<10} {'Amount':>12}  {'Prob':>7}  {'Pred':<7} {'✓/✗'}")
    print(f"{'─'*78}")

    async with websockets.connect(WS_URL) as ws:
        round_num = 1
        total = correct = fraud_caught = fraud_missed = false_alarms = 0

        while True:
            for idx, tx in enumerate(TRANSACTIONS, 1):
                label = tx["label"]
                payload = {k: v for k, v in tx.items() if k != "label"}

                await ws.send(json.dumps(payload))
                result = json.loads(await ws.recv())

                prob = result["fraud_probability"]
                pred = result["prediction"]
                match = "✓" if pred == label else "✗"

                total   += 1
                correct += pred == label
                if label == "FRAUD" and pred == "FRAUD": fraud_caught  += 1
                if label == "FRAUD" and pred == "LEGIT": fraud_missed  += 1
                if label == "LEGIT" and pred == "FRAUD": false_alarms  += 1

                fraud_marker = "  ◄ FRAUD DETECTED" if pred == "FRAUD" else ""
                wrong_marker = " ◄ MISSED"          if label == "FRAUD" and pred == "LEGIT" else ""

                print(
                    f"  {idx:<5} R{round_num:<6} {label:<7} {payload['type']:<10} "
                    f"{payload['amount']:>12,.2f}  {prob:>6.1%}  {pred:<7} {match}"
                    f"{fraud_marker}{wrong_marker}"
                )

                await asyncio.sleep(1.0)   # 1 transaction every 1 second

            # ── Round summary ──────────────────────────────────────────────
            acc = correct / total * 100
            print(f"\n{'═'*78}")
            print(f"  Round {round_num} complete  |  "
                  f"Total={total}  Correct={correct}  Accuracy={acc:.1f}%  |  "
                  f"Fraud Caught={fraud_caught}  Missed={fraud_missed}  False Alarms={false_alarms}")
            print(f"{'═'*78}\n")

            round_num += 1
            await asyncio.sleep(1.0)   # 1s pause between rounds

if __name__ == "__main__":
    try:
        asyncio.run(stream())
    except KeyboardInterrupt:
        print("\nStream stopped.")

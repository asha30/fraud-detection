import joblib
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder

model = joblib.load("saved_models/fulldata_best_xgboost.pkl")

def engineer_features(df):
    df = df.copy()
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

# ── 50 transactions: 45 legit + 5 fraud mixed in ──────────────────────────
transactions = [

    # 1
    {"label":"LEGIT", "step":10,  "type":"PAYMENT",  "amount":3200.00,    "oldbalanceOrg":55000.0,   "newbalanceOrig":51800.0,   "oldbalanceDest":8000.0,   "newbalanceDest":11200.0},
    # 2
    {"label":"LEGIT", "step":22,  "type":"PAYMENT",  "amount":1450.50,    "oldbalanceOrg":28000.0,   "newbalanceOrig":26549.50,  "oldbalanceDest":5000.0,   "newbalanceDest":6450.50},
    # 3
    {"label":"LEGIT", "step":45,  "type":"DEBIT",    "amount":320.00,     "oldbalanceOrg":15000.0,   "newbalanceOrig":14680.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 4
    {"label":"LEGIT", "step":30,  "type":"CASH_IN",  "amount":85000.00,   "oldbalanceOrg":200000.0,  "newbalanceOrig":115000.0,  "oldbalanceDest":3000.0,   "newbalanceDest":88000.0},
    # 5
    {"label":"LEGIT", "step":60,  "type":"PAYMENT",  "amount":500.00,     "oldbalanceOrg":12000.0,   "newbalanceOrig":11500.0,   "oldbalanceDest":3000.0,   "newbalanceDest":3500.0},
    # 6  ◄ FRAUD hidden here
    {"label":"FRAUD", "step":1,   "type":"TRANSFER", "amount":181.00,     "oldbalanceOrg":181.0,     "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 7
    {"label":"LEGIT", "step":75,  "type":"PAYMENT",  "amount":22000.00,   "oldbalanceOrg":150000.0,  "newbalanceOrig":128000.0,  "oldbalanceDest":40000.0,  "newbalanceDest":62000.0},
    # 8
    {"label":"LEGIT", "step":88,  "type":"DEBIT",    "amount":1200.00,    "oldbalanceOrg":45000.0,   "newbalanceOrig":43800.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 9
    {"label":"LEGIT", "step":31,  "type":"CASH_IN",  "amount":42000.00,   "oldbalanceOrg":80000.0,   "newbalanceOrig":38000.0,   "oldbalanceDest":10000.0,  "newbalanceDest":52000.0},
    # 10
    {"label":"LEGIT", "step":80,  "type":"TRANSFER", "amount":20000.00,   "oldbalanceOrg":95000.0,   "newbalanceOrig":75000.0,   "oldbalanceDest":50000.0,  "newbalanceDest":70000.0},
    # 11
    {"label":"LEGIT", "step":120, "type":"DEBIT",    "amount":75.50,      "oldbalanceOrg":8000.0,    "newbalanceOrig":7924.50,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 12
    {"label":"LEGIT", "step":140, "type":"CASH_OUT", "amount":5000.00,    "oldbalanceOrg":40000.0,   "newbalanceOrig":35000.0,   "oldbalanceDest":12000.0,  "newbalanceDest":17000.0},
    # 13
    {"label":"LEGIT", "step":100, "type":"CASH_IN",  "amount":15000.00,   "oldbalanceOrg":30000.0,   "newbalanceOrig":15000.0,   "oldbalanceDest":5000.0,   "newbalanceDest":20000.0},
    # 14
    {"label":"LEGIT", "step":160, "type":"TRANSFER", "amount":50000.00,   "oldbalanceOrg":200000.0,  "newbalanceOrig":150000.0,  "oldbalanceDest":80000.0,  "newbalanceDest":130000.0},
    # 15
    {"label":"LEGIT", "step":170, "type":"CASH_OUT", "amount":2000.00,    "oldbalanceOrg":18000.0,   "newbalanceOrig":16000.0,   "oldbalanceDest":5000.0,   "newbalanceDest":7000.0},
    # 16
    {"label":"LEGIT", "step":180, "type":"DEBIT",    "amount":5500.00,    "oldbalanceOrg":70000.0,   "newbalanceOrig":64500.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 17
    {"label":"LEGIT", "step":200, "type":"CASH_IN",  "amount":120000.00,  "oldbalanceOrg":300000.0,  "newbalanceOrig":180000.0,  "oldbalanceDest":50000.0,  "newbalanceDest":170000.0},
    # 18
    {"label":"LEGIT", "step":220, "type":"TRANSFER", "amount":8500.00,    "oldbalanceOrg":60000.0,   "newbalanceOrig":51500.0,   "oldbalanceDest":15000.0,  "newbalanceDest":23500.0},
    # 19
    {"label":"LEGIT", "step":230, "type":"CASH_OUT", "amount":10000.00,   "oldbalanceOrg":80000.0,   "newbalanceOrig":70000.0,   "oldbalanceDest":30000.0,  "newbalanceDest":40000.0},
    # 20  ◄ FRAUD hidden here
    {"label":"FRAUD", "step":215, "type":"CASH_OUT", "amount":344464.40,  "oldbalanceOrg":344464.40, "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 21
    {"label":"LEGIT", "step":250, "type":"CASH_IN",  "amount":9500.00,    "oldbalanceOrg":20000.0,   "newbalanceOrig":10500.0,   "oldbalanceDest":2000.0,   "newbalanceDest":11500.0},
    # 22
    {"label":"LEGIT", "step":300, "type":"DEBIT",    "amount":250.00,     "oldbalanceOrg":5000.0,    "newbalanceOrig":4750.0,    "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 23
    {"label":"LEGIT", "step":350, "type":"CASH_OUT", "amount":3500.00,    "oldbalanceOrg":25000.0,   "newbalanceOrig":21500.0,   "oldbalanceDest":8000.0,   "newbalanceDest":11500.0},
    # 24
    {"label":"LEGIT", "step":400, "type":"TRANSFER", "amount":100000.00,  "oldbalanceOrg":500000.0,  "newbalanceOrig":400000.0,  "oldbalanceDest":200000.0, "newbalanceDest":300000.0},
    # 25
    {"label":"LEGIT", "step":500, "type":"CASH_OUT", "amount":15000.00,   "oldbalanceOrg":120000.0,  "newbalanceOrig":105000.0,  "oldbalanceDest":45000.0,  "newbalanceDest":60000.0},
    # 26
    {"label":"LEGIT", "step":110, "type":"PAYMENT",  "amount":6700.00,    "oldbalanceOrg":48000.0,   "newbalanceOrig":41300.0,   "oldbalanceDest":7000.0,   "newbalanceDest":13700.0},
    # 27
    {"label":"LEGIT", "step":130, "type":"DEBIT",    "amount":890.00,     "oldbalanceOrg":22000.0,   "newbalanceOrig":21110.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 28
    {"label":"LEGIT", "step":150, "type":"CASH_IN",  "amount":35000.00,   "oldbalanceOrg":75000.0,   "newbalanceOrig":40000.0,   "oldbalanceDest":15000.0,  "newbalanceDest":50000.0},
    # 29  ◄ FRAUD hidden here
    {"label":"FRAUD", "step":3,   "type":"TRANSFER", "amount":11996.58,   "oldbalanceOrg":11996.58,  "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 30
    {"label":"LEGIT", "step":190, "type":"PAYMENT",  "amount":14500.00,   "oldbalanceOrg":95000.0,   "newbalanceOrig":80500.0,   "oldbalanceDest":20000.0,  "newbalanceDest":34500.0},
    # 31
    {"label":"LEGIT", "step":210, "type":"CASH_OUT", "amount":8000.00,    "oldbalanceOrg":65000.0,   "newbalanceOrig":57000.0,   "oldbalanceDest":20000.0,  "newbalanceDest":28000.0},
    # 32
    {"label":"LEGIT", "step":240, "type":"DEBIT",    "amount":4200.00,    "oldbalanceOrg":35000.0,   "newbalanceOrig":30800.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 33
    {"label":"LEGIT", "step":260, "type":"TRANSFER", "amount":30000.00,   "oldbalanceOrg":180000.0,  "newbalanceOrig":150000.0,  "oldbalanceDest":60000.0,  "newbalanceDest":90000.0},
    # 34
    {"label":"LEGIT", "step":280, "type":"PAYMENT",  "amount":9900.00,    "oldbalanceOrg":72000.0,   "newbalanceOrig":62100.0,   "oldbalanceDest":18000.0,  "newbalanceDest":27900.0},
    # 35
    {"label":"LEGIT", "step":310, "type":"CASH_IN",  "amount":60000.00,   "oldbalanceOrg":130000.0,  "newbalanceOrig":70000.0,   "oldbalanceDest":25000.0,  "newbalanceDest":85000.0},
    # 36
    {"label":"LEGIT", "step":330, "type":"DEBIT",    "amount":150.00,     "oldbalanceOrg":9000.0,    "newbalanceOrig":8850.0,    "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 37  ◄ FRAUD hidden here
    {"label":"FRAUD", "step":421, "type":"CASH_OUT", "amount":178439.26,  "oldbalanceOrg":178439.26, "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 38
    {"label":"LEGIT", "step":360, "type":"PAYMENT",  "amount":2800.00,    "oldbalanceOrg":31000.0,   "newbalanceOrig":28200.0,   "oldbalanceDest":6000.0,   "newbalanceDest":8800.0},
    # 39
    {"label":"LEGIT", "step":380, "type":"TRANSFER", "amount":15000.00,   "oldbalanceOrg":110000.0,  "newbalanceOrig":95000.0,   "oldbalanceDest":40000.0,  "newbalanceDest":55000.0},
    # 40
    {"label":"LEGIT", "step":420, "type":"CASH_OUT", "amount":12000.00,   "oldbalanceOrg":90000.0,   "newbalanceOrig":78000.0,   "oldbalanceDest":35000.0,  "newbalanceDest":47000.0},
    # 41
    {"label":"LEGIT", "step":440, "type":"DEBIT",    "amount":680.00,     "oldbalanceOrg":17000.0,   "newbalanceOrig":16320.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 42
    {"label":"LEGIT", "step":460, "type":"PAYMENT",  "amount":18000.00,   "oldbalanceOrg":130000.0,  "newbalanceOrig":112000.0,  "oldbalanceDest":30000.0,  "newbalanceDest":48000.0},
    # 43
    {"label":"LEGIT", "step":480, "type":"CASH_IN",  "amount":25000.00,   "oldbalanceOrg":55000.0,   "newbalanceOrig":30000.0,   "oldbalanceDest":10000.0,  "newbalanceDest":35000.0},
    # 44
    {"label":"LEGIT", "step":520, "type":"TRANSFER", "amount":45000.00,   "oldbalanceOrg":250000.0,  "newbalanceOrig":205000.0,  "oldbalanceDest":100000.0, "newbalanceDest":145000.0},
    # 45
    {"label":"LEGIT", "step":540, "type":"DEBIT",    "amount":3300.00,    "oldbalanceOrg":42000.0,   "newbalanceOrig":38700.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 46
    {"label":"LEGIT", "step":560, "type":"CASH_OUT", "amount":7500.00,    "oldbalanceOrg":55000.0,   "newbalanceOrig":47500.0,   "oldbalanceDest":22000.0,  "newbalanceDest":29500.0},
    # 47
    {"label":"LEGIT", "step":580, "type":"PAYMENT",  "amount":11200.00,   "oldbalanceOrg":88000.0,   "newbalanceDest":76800.0,   "oldbalanceDest":25000.0,  "newbalanceDest":36200.0, "newbalanceOrig":76800.0},
    # 48  ◄ FRAUD hidden here
    {"label":"FRAUD", "step":312, "type":"CASH_OUT", "amount":68912.23,   "oldbalanceOrg":68912.23,  "newbalanceOrig":0.0,       "oldbalanceDest":0.0,      "newbalanceDest":0.0},
    # 49
    {"label":"LEGIT", "step":620, "type":"CASH_IN",  "amount":50000.00,   "oldbalanceOrg":100000.0,  "newbalanceOrig":50000.0,   "oldbalanceDest":20000.0,  "newbalanceDest":70000.0},
    # 50
    {"label":"LEGIT", "step":700, "type":"DEBIT",    "amount":920.00,     "oldbalanceOrg":14000.0,   "newbalanceOrig":13080.0,   "oldbalanceDest":0.0,      "newbalanceDest":0.0},
]

# ── Run predictions ────────────────────────────────────────────────────────
labels = [t.pop("label") for t in transactions]
df     = pd.DataFrame(transactions)
feats  = engineer_features(df)
probs  = model.predict_proba(feats)[:, 1]
preds  = ["FRAUD" if p > 0.5 else "LEGIT" for p in probs]

correct = sum(p == l for p, l in zip(preds, labels))
tp      = sum(p == "FRAUD" and l == "FRAUD" for p, l in zip(preds, labels))
tn      = sum(p == "LEGIT" and l == "LEGIT" for p, l in zip(preds, labels))
fp      = sum(p == "FRAUD" and l == "LEGIT" for p, l in zip(preds, labels))
fn      = sum(p == "LEGIT" and l == "FRAUD" for p, l in zip(preds, labels))

# ── Print results ──────────────────────────────────────────────────────────
print(f"\n{'='*72}")
print(f"  FRAUD DETECTION — 50 transactions (45 Legit + 5 Fraud hidden)")
print(f"  Model: XGBoost  |  Trained on: 6,362,620 rows")
print(f"{'='*72}")
print(f"  {'#':<3} {'Actual':<7} {'Type':<10} {'Amount':>12}  {'Prob':>7}  {'Predicted':<8}  {'✓/✗'}")
print(f"  {'-'*68}")

for i, (row, label, prob, pred) in enumerate(zip(df.itertuples(), labels, probs, preds), 1):
    match = "✓" if pred == label else "✗ ◄ WRONG"
    marker = "  ◄ FRAUD" if label == "FRAUD" else ""
    print(f"  {i:<3} {label:<7} {row.type:<10} {row.amount:>12,.2f}  {prob:>6.1%}  {pred:<8}  {match}{marker}")

print(f"\n{'='*72}")
print(f"  Total : 50   Correct: {correct}   Wrong: {50-correct}")
print(f"  TP={tp}  TN={tn}  FP={fp}  FN={fn}")
print(f"  Accuracy  : {correct/50*100:.1f}%")
if (tp+fp) > 0: print(f"  Precision : {tp/(tp+fp)*100:.1f}%")
if (tp+fn) > 0: print(f"  Recall    : {tp/(tp+fn)*100:.1f}%  (fraud cases caught)")
print(f"{'='*72}")

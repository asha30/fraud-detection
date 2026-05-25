"""
UC-03: Synthetic Identity & First-Party Fraud Detection
Graph construction + ML model using IEEE-CIS fraud dataset
No label leakage: graph features computed from history only
"""

import pandas as pd
import numpy as np
import networkx as nx
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    roc_auc_score, average_precision_score,
    confusion_matrix, ConfusionMatrixDisplay,
    roc_curve, precision_recall_curve, classification_report
)
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb
from pyvis.network import Network
import joblib
import json
import os

TX_PATH  = "/home/hayakreevan/Downloads/ieee-fraud-detection/train_transaction.csv"
IDE_PATH = "/home/hayakreevan/Downloads/ieee-fraud-detection/train_identity.csv"
OUT_DIR  = "/home/hayakreevan/Downloads/Use_Case_Fraud_Detection"

# ─────────────────────────────────────────────
# 1. LOAD DATA
# ─────────────────────────────────────────────
print("=" * 60)
print("STEP 1: Loading IEEE-CIS fraud dataset")
print("=" * 60)

tx_cols = [
    "TransactionID", "isFraud", "TransactionDT", "TransactionAmt",
    "ProductCD", "card1", "card4", "card6",
    "addr1", "P_emaildomain", "R_emaildomain",
    "C1", "C2", "C5", "C6", "C13", "C14",
    "D1", "D4", "D10", "D15",
    "M1", "M4", "M6",
]
ide_cols = ["TransactionID", "DeviceType", "DeviceInfo", "id_12", "id_30", "id_31"]

tx  = pd.read_csv(TX_PATH,  usecols=tx_cols)
ide = pd.read_csv(IDE_PATH, usecols=ide_cols)
df  = tx.merge(ide, on="TransactionID", how="left")
df  = df.sort_values("TransactionDT").reset_index(drop=True)

print(f"  Total rows : {len(df):,}  |  Fraud rate : {df['isFraud'].mean()*100:.2f}%")
print(f"  Fraud cases: {df['isFraud'].sum():,}")

# ── Graph node keys (fill nulls with 'UNKNOWN')
for col in ["card1", "addr1", "P_emaildomain", "DeviceInfo", "DeviceType"]:
    df[col] = df[col].fillna("UNKNOWN").astype(str)

# ─────────────────────────────────────────────
# 2. TEMPORAL SPLIT  (sorted by TransactionDT)
#    History: first 70% → build graph
#    Score  : last  30% → evaluate model
# ─────────────────────────────────────────────
split_idx   = int(len(df) * 0.70)
df_history  = df.iloc[:split_idx].copy()
df_score    = df.iloc[split_idx:].copy()

print(f"\n  History : {len(df_history):,} rows  "
      f"(fraud {df_history['isFraud'].mean()*100:.2f}%)")
print(f"  Score   : {len(df_score):,} rows  "
      f"(fraud {df_score['isFraud'].mean()*100:.2f}%)")

# ─────────────────────────────────────────────
# 3. BUILD IDENTITY GRAPH FROM HISTORY
#    Nodes : Transaction, Card, Address, Email, Device
#    Edges : card1→Transaction, addr1→Transaction,
#            email→Transaction, device→Transaction
#    Key signal: card1 and DeviceInfo repeat across transactions
# ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 2: Building Identity Graph from history (70%)")
print("=" * 60)

G = nx.Graph()

# ── Vectorized hub stats (card / addr / email / device)
def compute_hub_stats(df, col, prefix):
    """Returns dict: hub_id → {total_tx, fraud_tx}"""
    stats = df.groupby(col)["isFraud"].agg(["count","sum"]).reset_index()
    stats.columns = [col, "total_tx", "fraud_tx"]
    return {f"{prefix}{row[col]}": {"total_tx": int(row["total_tx"]),
                                     "fraud_tx": int(row["fraud_tx"])}
            for _, row in stats.iterrows()}

print("  Computing hub stats (vectorized)...")
card_stats   = compute_hub_stats(df_history, "card1",        "CARD_")
addr_stats   = compute_hub_stats(df_history, "addr1",        "ADDR_")
email_stats  = compute_hub_stats(df_history, "P_emaildomain","EMAIL_")
device_stats = compute_hub_stats(df_history, "DeviceInfo",   "DEV_")

# ── Add hub nodes
for nid, attrs in card_stats.items():
    G.add_node(nid, node_type="card", **attrs)
for nid, attrs in addr_stats.items():
    G.add_node(nid, node_type="address", **attrs)
for nid, attrs in email_stats.items():
    G.add_node(nid, node_type="email", **attrs)
for nid, attrs in device_stats.items():
    G.add_node(nid, node_type="device", **attrs)

# ── Add transaction nodes + edges (still needs iteration but much less work per row)
print("  Adding transaction nodes and edges...")
for _, row in df_history.iterrows():
    tid = f"TX_{row['TransactionID']}"
    G.add_node(tid, node_type="transaction",
               fraud=int(row["isFraud"]),
               amount=row["TransactionAmt"])
    G.add_edge(tid, f"CARD_{row['card1']}",        edge_type="USES_CARD")
    G.add_edge(tid, f"ADDR_{row['addr1']}",        edge_type="BILLED_TO")
    G.add_edge(tid, f"EMAIL_{row['P_emaildomain']}",edge_type="EMAIL_DOMAIN")
    G.add_edge(tid, f"DEV_{row['DeviceInfo']}",    edge_type="FROM_DEVICE")

n_types = {}
for n, d in G.nodes(data=True):
    t = d.get("node_type", "?")
    n_types[t] = n_types.get(t, 0) + 1
print(f"  Nodes  : {G.number_of_nodes():,}")
print(f"  Edges  : {G.number_of_edges():,}")
for t, c in sorted(n_types.items()):
    print(f"    {t:<15}: {c:,}")

# ── Save graph (NetworkX → GraphML file)
os.makedirs(f"{OUT_DIR}/model", exist_ok=True)
nx.write_graphml(G, f"{OUT_DIR}/model/identity_graph.graphml")
print(f"  Graph saved to   : {OUT_DIR}/model/identity_graph.graphml")

# ─────────────────────────────────────────────
# 4. COMPUTE GRAPH FEATURES (from history only)
#    Applied to SCORE set → no label leakage
# ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 3: Extracting graph features for score set")
print("=" * 60)

def node_fraud_rate(G, node_id):
    """Historical fraud rate for a hub node (card/addr/email/device)."""
    if not G.has_node(node_id):
        return 0.0, 0
    nd = G.nodes[node_id]
    total = nd.get("total_tx", 0)
    if total == 0:
        return 0.0, 0
    return nd.get("fraud_tx", 0) / total, total

def ring_size(G, node_id):
    """How many transactions share this hub node (proxy for ring size)."""
    if not G.has_node(node_id):
        return 0
    return sum(1 for nb in G.neighbors(node_id)
               if G.nodes[nb].get("node_type") == "transaction")

# ── Vectorized: build lookup tables from graph hub nodes
def hub_lookup(stats_dict, prefix):
    frate = {k.replace(prefix,""): v["fraud_tx"]/max(v["total_tx"],1)
             for k,v in stats_dict.items()}
    total = {k.replace(prefix,""): v["total_tx"]
             for k,v in stats_dict.items()}
    rsize = {}
    for nid in stats_dict:
        rsize[nid.replace(prefix,"")] = sum(
            1 for nb in G.neighbors(nid)
            if G.nodes[nb].get("node_type") == "transaction")
    return frate, total, rsize

card_frate,  card_total,  card_rsize  = hub_lookup(card_stats,   "CARD_")
addr_frate,  addr_total,  _           = hub_lookup(addr_stats,   "ADDR_")
dev_frate,   dev_total,   dev_rsize   = hub_lookup(device_stats, "DEV_")
email_frate, _,           _           = hub_lookup(email_stats,  "EMAIL_")

feat_df = df_score[[
    "TransactionAmt","ProductCD","card4","card6","DeviceType","P_emaildomain",
    "C1","C2","C5","C6","C13","C14","D1","D4","D10","isFraud",
    "card1","addr1","DeviceInfo",
]].copy().rename(columns={"isFraud": "fraud_label"})

feat_df["card_fraud_rate"]     = feat_df["card1"].map(card_frate).fillna(0)
feat_df["card_tx_volume"]      = feat_df["card1"].map(card_total).fillna(0)
feat_df["card_ring_size"]      = feat_df["card1"].map(card_rsize).fillna(0)
feat_df["addr_fraud_rate"]     = feat_df["addr1"].map(addr_frate).fillna(0)
feat_df["addr_tx_volume"]      = feat_df["addr1"].map(addr_total).fillna(0)
feat_df["device_fraud_rate"]   = feat_df["DeviceInfo"].map(dev_frate).fillna(0)
feat_df["device_tx_volume"]    = feat_df["DeviceInfo"].map(dev_total).fillna(0)
feat_df["device_ring_size"]    = feat_df["DeviceInfo"].map(dev_rsize).fillna(0)
feat_df["email_fraud_rate"]    = feat_df["P_emaildomain"].map(email_frate).fillna(0)
feat_df["card_seen_in_hist"]   = feat_df["card1"].isin(card_frate).astype(int)
feat_df["device_seen_in_hist"] = feat_df["DeviceInfo"].isin(dev_frate).astype(int)
feat_df = feat_df.drop(columns=["card1","addr1","DeviceInfo"])

# encode categoricals
for col in ["ProductCD", "card4", "card6", "DeviceType", "P_emaildomain"]:
    le = LabelEncoder()
    le.fit(df[col].fillna("UNKNOWN").astype(str))
    feat_df[col] = le.transform(
        feat_df[col].astype(str).map(
            lambda x, le=le: x if x in le.classes_ else le.classes_[0]))

feat_df = feat_df.fillna(0)

print(f"  Feature matrix : {feat_df.shape}")
print(f"  Fraud cases    : {feat_df['fraud_label'].sum():,} "
      f"({feat_df['fraud_label'].mean()*100:.2f}%)")
print(f"\n  Graph feature means by fraud label:")
gf = ["card_fraud_rate", "device_fraud_rate", "addr_fraud_rate",
      "card_ring_size", "device_ring_size"]
print(feat_df[gf + ["fraud_label"]].groupby("fraud_label").mean().round(4).to_string())

# ─────────────────────────────────────────────
# 5. TRAIN MODEL
# ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 4: Training XGBoost Fraud Model")
print("=" * 60)

feature_cols = [
    "TransactionAmt", "ProductCD", "card4", "card6", "DeviceType",
    "C1", "C2", "C5", "C6", "C13", "C14", "D1", "D4", "D10",
    # graph features
    "card_fraud_rate", "card_tx_volume", "card_ring_size",
    "addr_fraud_rate", "addr_tx_volume",
    "device_fraud_rate", "device_tx_volume", "device_ring_size",
    "email_fraud_rate",
    "card_seen_in_hist", "device_seen_in_hist",
]

X = feat_df[feature_cols]
y = feat_df["fraud_label"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y)

scale_pos = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
print(f"  Train size  : {len(X_train):,}  (fraud: {y_train.sum():,})")
print(f"  Test size   : {len(X_test):,}   (fraud: {y_test.sum():,})")
print(f"  scale_pos_weight: {scale_pos:.1f}")

model = xgb.XGBClassifier(
    n_estimators=500,
    max_depth=6,
    learning_rate=0.05,
    scale_pos_weight=scale_pos,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=5,
    gamma=1,
    eval_metric="auc",
    early_stopping_rounds=30,
    random_state=42,
    verbosity=0,
)
model.fit(X_train, y_train,
          eval_set=[(X_test, y_test)],
          verbose=False)

y_pred_proba = model.predict_proba(X_test)[:, 1]
y_pred       = (y_pred_proba >= 0.5).astype(int)

auc    = roc_auc_score(y_test, y_pred_proba)
avg_pr = average_precision_score(y_test, y_pred_proba)

print(f"\n  AUC-ROC           : {auc:.4f}")
print(f"  Avg Precision(PR) : {avg_pr:.4f}")
print(f"\n  Classification Report:\n")
print(classification_report(y_test, y_pred, target_names=["Legit","Fraud"]))

# ── Save model + metadata
os.makedirs(f"{OUT_DIR}/model", exist_ok=True)
model.save_model(f"{OUT_DIR}/model/fraud_xgb.json")         # XGBoost native format
joblib.dump(model, f"{OUT_DIR}/model/fraud_xgb.pkl")        # sklearn-compatible pickle

metadata = {
    "model_version": "xgb-graph-v1.0",
    "auc_roc": round(auc, 4),
    "avg_precision": round(avg_pr, 4),
    "feature_cols": feature_cols,
    "train_rows": len(X_train),
    "train_fraud": int(y_train.sum()),
    "threshold": 0.5,
    "dataset": "ieee-cis-fraud-detection",
    "graph_nodes": G.number_of_nodes(),
    "graph_edges": G.number_of_edges(),
}
with open(f"{OUT_DIR}/model/metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\n  Model saved to   : {OUT_DIR}/model/fraud_xgb.json  (XGBoost native)")
print(f"  Model saved to   : {OUT_DIR}/model/fraud_xgb.pkl   (pickle)")
print(f"  Metadata saved   : {OUT_DIR}/model/metadata.json")

# ─────────────────────────────────────────────
# 6. FEATURE IMPORTANCE
# ─────────────────────────────────────────────
GRAPH_FEATURES = [
    "card_fraud_rate", "card_tx_volume", "card_ring_size",
    "addr_fraud_rate", "addr_tx_volume",
    "device_fraud_rate", "device_tx_volume", "device_ring_size",
    "email_fraud_rate", "card_seen_in_hist", "device_seen_in_hist",
]

importance = pd.DataFrame({
    "feature": feature_cols,
    "importance": model.feature_importances_
}).sort_values("importance", ascending=False)

print("\n" + "=" * 60)
print("STEP 5: Feature Importance (graph=red, KYC/tx=blue)")
print("=" * 60)
print(importance.to_string(index=False))

# ─────────────────────────────────────────────
# 7. VISUALISATIONS
# ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 6: Saving Visualisations")
print("=" * 60)

# ── 7a. Feature importance
fig, ax = plt.subplots(figsize=(11, 8))
colors = ["#e74c3c" if f in GRAPH_FEATURES else "#3498db"
          for f in importance["feature"]]
ax.barh(importance["feature"], importance["importance"], color=colors)
ax.set_xlabel("Importance Score")
ax.set_title("Feature Importance\nGraph features (red) vs Transaction/KYC features (blue)")
ax.invert_yaxis()
ax.legend(handles=[
    mpatches.Patch(color="#e74c3c", label="Graph features (historical)"),
    mpatches.Patch(color="#3498db", label="Transaction / KYC features"),
], loc="lower right")
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/feature_importance.png", dpi=150)
plt.close()
print("  Saved: feature_importance.png")

# ── 7b. Confusion matrix
cm = confusion_matrix(y_test, y_pred)
fig, ax = plt.subplots(figsize=(6, 5))
ConfusionMatrixDisplay(cm, display_labels=["Legit","Fraud"]).plot(
    ax=ax, colorbar=False, cmap="Blues")
ax.set_title(f"Confusion Matrix  (AUC = {auc:.3f})")
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/confusion_matrix.png", dpi=150)
plt.close()
print("  Saved: confusion_matrix.png")

# ── 7c. ROC + PR curves
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
fpr, tpr, _ = roc_curve(y_test, y_pred_proba)
ax1.plot(fpr, tpr, "#e74c3c", lw=2, label=f"AUC = {auc:.4f}")
ax1.plot([0,1],[0,1],"k--",lw=1)
ax1.set(xlabel="False Positive Rate", ylabel="True Positive Rate", title="ROC Curve")
ax1.legend()

prec, rec, _ = precision_recall_curve(y_test, y_pred_proba)
ax2.plot(rec, prec, "#2980b9", lw=2, label=f"Avg Prec = {avg_pr:.4f}")
ax2.axhline(y_test.mean(), color="k", linestyle="--", lw=1,
            label=f"Baseline (fraud rate = {y_test.mean():.3f})")
ax2.set(xlabel="Recall", ylabel="Precision", title="Precision-Recall Curve")
ax2.legend()
plt.suptitle("IEEE-CIS Fraud Detection — Model Performance", fontsize=13, fontweight="bold")
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/roc_pr_curves.png", dpi=150)
plt.close()
print("  Saved: roc_pr_curves.png")

# ── 7d. Score distribution
fig, ax = plt.subplots(figsize=(9, 5))
ax.hist(y_pred_proba[y_test == 0], bins=60, alpha=0.6,
        color="#2ecc71", label="Legit", density=True)
ax.hist(y_pred_proba[y_test == 1], bins=60, alpha=0.8,
        color="#e74c3c", label="Fraud", density=True)
ax.axvline(0.5, color="black", linestyle="--", label="Threshold 0.5")
ax.set(xlabel="Fraud Score", ylabel="Density",
       title="Fraud Score Distribution")
ax.legend()
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/score_distribution.png", dpi=150)
plt.close()
print("  Saved: score_distribution.png")

# ── 7e. Fraud ring graph — cards and devices as hubs
print("  Building fraud ring graph...")

# pick top fraud cards (highest fraud volume in history)
fraud_cards = sorted(
    [n for n, d in G.nodes(data=True)
     if d.get("node_type") == "card" and d.get("fraud_tx", 0) >= 2],
    key=lambda n: G.nodes[n]["fraud_tx"], reverse=True
)[:12]

# pick high-fraud devices
fraud_devices = sorted(
    [n for n, d in G.nodes(data=True)
     if d.get("node_type") == "device" and d.get("fraud_tx", 0) >= 2],
    key=lambda n: G.nodes[n]["fraud_tx"], reverse=True
)[:6]

seed_nodes = set(fraud_cards + fraud_devices)
ego_nodes  = set(seed_nodes)
for s in seed_nodes:
    for nb in G.neighbors(s):
        nt = G.nodes[nb].get("node_type")
        if nt == "transaction":
            ego_nodes.add(nb)
            # also add other hub nodes connected to these transactions
            for nb2 in G.neighbors(nb):
                if G.nodes[nb2].get("node_type") in ("card", "device", "address"):
                    ego_nodes.add(nb2)
ego_nodes = list(ego_nodes)[:200]

sub = G.subgraph(ego_nodes)

color_map   = {"transaction": None, "card": "#3498db", "address": "#f39c12",
               "device": "#9b59b6", "email": "#1abc9c"}
node_colors = []
node_sizes  = []
type_counts = {k: 0 for k in color_map}

for n in sub.nodes():
    nd  = G.nodes[n]
    nt  = nd.get("node_type", "transaction")
    frx = nd.get("fraud", nd.get("fraud_tx", 0))
    if nt == "transaction":
        node_colors.append("#e74c3c" if frx else "#2ecc71")
        node_sizes.append(60)
    else:
        node_colors.append(color_map.get(nt, "#aaaaaa"))
        node_sizes.append(220)
    type_counts[nt] = type_counts.get(nt, 0) + 1

pos = nx.spring_layout(sub, seed=42, k=0.6)
fig, ax = plt.subplots(figsize=(16, 12))
nx.draw_networkx_nodes(sub, pos, node_color=node_colors,
                       node_size=node_sizes, ax=ax, alpha=0.88)
nx.draw_networkx_edges(sub, pos, alpha=0.2, ax=ax, edge_color="#888")
ax.legend(handles=[
    mpatches.Patch(color="#e74c3c", label=f"Fraud Transaction"),
    mpatches.Patch(color="#2ecc71", label=f"Legit Transaction"),
    mpatches.Patch(color="#3498db", label=f"Card (hub)"),
    mpatches.Patch(color="#9b59b6", label=f"Device (hub)"),
    mpatches.Patch(color="#f39c12", label=f"Address (hub)"),
], loc="upper left", fontsize=10)
ax.set_title(
    f"Identity Fraud Ring Graph  —  {sub.number_of_nodes()} nodes, "
    f"{sub.number_of_edges()} edges\n"
    "Hub nodes (cards/devices) shared across fraud + legit transactions reveal rings",
    fontsize=12)
ax.axis("off")
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/fraud_ring_graph.png", dpi=150)
plt.close()
print("  Saved: fraud_ring_graph.png")

# ── 7f. Interactive HTML
print("  Building interactive HTML graph...")
net = Network(height="750px", width="100%", bgcolor="#1a1a2e",
              font_color="white", directed=False)
net.barnes_hut(gravity=-6000, central_gravity=0.3, spring_length=100)

for n in sub.nodes():
    nd = G.nodes[n]
    nt = nd.get("node_type", "transaction")
    if nt == "transaction":
        is_f = nd.get("fraud", 0)
        color = "#e74c3c" if is_f else "#2ecc71"
        title = (f"<b>Transaction {n}</b><br>"
                 f"Amount: {nd.get('amount','?')}<br>"
                 f"<b>Fraud: {bool(is_f)}</b>")
        net.add_node(n, color=color, shape="dot", title=title, size=8)
    elif nt == "card":
        fr = nd.get("fraud_tx", 0) / max(nd.get("total_tx", 1), 1)
        color = "#e74c3c" if fr > 0.3 else "#3498db"
        title = (f"<b>Card {n}</b><br>"
                 f"Total tx: {nd.get('total_tx','?')}<br>"
                 f"Fraud tx: {nd.get('fraud_tx','?')}<br>"
                 f"Fraud rate: {fr:.2%}")
        net.add_node(n, color=color, shape="square", title=title, size=18)
    elif nt == "device":
        fr = nd.get("fraud_tx", 0) / max(nd.get("total_tx", 1), 1)
        title = (f"<b>Device {n}</b><br>"
                 f"Type: {nd.get('device_type','?')}<br>"
                 f"Fraud rate: {fr:.2%}")
        net.add_node(n, color="#9b59b6", shape="triangle", title=title, size=18)
    else:
        fr = nd.get("fraud_tx", 0) / max(nd.get("total_tx", 1), 1)
        title = f"<b>{nt.title()} {n}</b><br>Fraud rate: {fr:.2%}"
        net.add_node(n, color=color_map.get(nt, "#aaa"), shape="diamond",
                     title=title, size=14)

for u, v, ed in sub.edges(data=True):
    net.add_edge(u, v, color="#333333", title=ed.get("edge_type",""))

net.show_buttons(filter_=["physics"])
net.save_graph(f"{OUT_DIR}/fraud_graph_interactive.html")
print("  Saved: fraud_graph_interactive.html  ← open in browser")

# ─────────────────────────────────────────────
# 8. DEMO — score a new transaction
# ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 7: Demo — score a new transaction")
print("=" * 60)

def score_transaction(tx: dict) -> dict:
    """Score a new transaction using KYC + graph features from history."""
    row = pd.DataFrame([{
        "TransactionAmt":    tx.get("amount", 100),
        "ProductCD":         2,   # encoded
        "card4":             2,   # encoded
        "card6":             0,   # encoded
        "DeviceType":        1 if tx.get("device_type") == "mobile" else 0,
        "C1": tx.get("C1", 1), "C2": tx.get("C2", 1),
        "C5": tx.get("C5", 0), "C6": tx.get("C6", 1),
        "C13": tx.get("C13", 1), "C14": tx.get("C14", 1),
        "D1": tx.get("D1", 100), "D4": tx.get("D4", 0), "D10": tx.get("D10", 0),
        # graph features — from live graph query
        "card_fraud_rate":     tx.get("card_fraud_rate", 0.0),
        "card_tx_volume":      tx.get("card_tx_volume", 0),
        "card_ring_size":      tx.get("card_ring_size", 0),
        "addr_fraud_rate":     tx.get("addr_fraud_rate", 0.0),
        "addr_tx_volume":      tx.get("addr_tx_volume", 0),
        "device_fraud_rate":   tx.get("device_fraud_rate", 0.0),
        "device_tx_volume":    tx.get("device_tx_volume", 0),
        "device_ring_size":    tx.get("device_ring_size", 0),
        "email_fraud_rate":    tx.get("email_fraud_rate", 0.0),
        "card_seen_in_hist":   int(tx.get("card_seen_in_hist", False)),
        "device_seen_in_hist": int(tx.get("device_seen_in_hist", False)),
    }])
    score = model.predict_proba(row)[0][1]
    risk  = [f for f in importance.head(8)["feature"]
             if f in GRAPH_FEATURES and row[f].values[0] > 0]
    return {
        "fraud_score":    round(float(score), 4),
        "synthetic_flag": score >= 0.5,
        "decision":       "DECLINE" if score >= 0.5 else "APPROVE",
        "risk_factors":   risk[:3],
    }

fraud_tx = {
    "amount": 350, "device_type": "mobile",
    "C1": 1, "C2": 5, "C5": 1, "C6": 1, "C13": 10, "C14": 1,
    "D1": 0,  # 0 days since last tx — very recent, suspicious
    "card_fraud_rate":   0.85,   # this card's history: 85% fraud
    "card_tx_volume":    12,
    "card_ring_size":    12,
    "device_fraud_rate": 0.70,   # device shared with fraud txns
    "device_tx_volume":  8,
    "device_ring_size":  8,
    "addr_fraud_rate":   0.40,
    "addr_tx_volume":    5,
    "email_fraud_rate":  0.60,
    "card_seen_in_hist":   True,
    "device_seen_in_hist": True,
}

clean_tx = {
    "amount": 80, "device_type": "desktop",
    "C1": 1, "C2": 1, "C5": 0, "C6": 1, "C13": 1, "C14": 1,
    "D1": 200,
    "card_fraud_rate":   0.0,
    "card_tx_volume":    3,
    "card_ring_size":    3,
    "device_fraud_rate": 0.0,
    "device_tx_volume":  2,
    "device_ring_size":  2,
    "addr_fraud_rate":   0.0,
    "addr_tx_volume":    2,
    "email_fraud_rate":  0.0,
    "card_seen_in_hist":   True,
    "device_seen_in_hist": True,
}

r1 = score_transaction(fraud_tx)
r2 = score_transaction(clean_tx)

print(f"\n  [SUSPICIOUS] Card with 85% historical fraud rate, shared device:")
print(f"    Fraud score  : {r1['fraud_score']}")
print(f"    Flag         : {r1['synthetic_flag']}")
print(f"    Decision     : {r1['decision']}")
print(f"    Risk factors : {r1['risk_factors']}")

print(f"\n  [CLEAN] Known-good card, no fraud history, long account age:")
print(f"    Fraud score  : {r2['fraud_score']}")
print(f"    Flag         : {r2['synthetic_flag']}")
print(f"    Decision     : {r2['decision']}")
print(f"    Risk factors : {r2['risk_factors']}")

print("\n" + "=" * 60)
print("DONE — outputs in:")
print(f"  {OUT_DIR}/")
print("  feature_importance.png")
print("  confusion_matrix.png")
print("  roc_pr_curves.png")
print("  score_distribution.png")
print("  fraud_ring_graph.png")
print("  fraud_graph_interactive.html  ← open in browser")
print("=" * 60)

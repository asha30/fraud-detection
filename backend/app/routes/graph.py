"""Graph Intelligence API — serves hub stats from Fraud_database_1."""
from __future__ import annotations
import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Query

router = APIRouter(prefix="/graph", tags=["graph"])

_DB_DSN = "host=localhost port=5434 user=postgres password=postgres dbname=Fraud_database_1"

def _conn():
    return psycopg2.connect(_DB_DSN)

@router.get("/stats")
def graph_stats():
    conn = _conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT node_type, COUNT(*) as count FROM graph_nodes GROUP BY node_type")
    nodes = {r["node_type"]: r["count"] for r in cur.fetchall()}
    cur.execute("SELECT edge_type, COUNT(*) as count FROM graph_edges GROUP BY edge_type")
    edges = {r["edge_type"]: r["count"] for r in cur.fetchall()}
    cur.execute("SELECT COUNT(*) as total, SUM(CASE WHEN prediction='FRAUD' THEN 1 ELSE 0 END) as fraud FROM live_transactions")
    live = dict(cur.fetchone())
    cur.execute("SELECT hub_type, COUNT(*) as hubs, AVG(fraud_rate) as avg_fraud_rate, MAX(fraud_rate) as max_fraud_rate FROM hub_stats GROUP BY hub_type ORDER BY avg_fraud_rate DESC")
    hub_summary = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return {"nodes": nodes, "edges": edges, "live": live, "hub_summary": hub_summary}

@router.get("/hubs")
def get_hubs(
    hub_type: str = Query("all"),
    min_fraud_rate: float = Query(0.0),
    min_tx: int = Query(2),
    limit: int = Query(200),
    sort_by: str = Query("fraud_rate", enum=["fraud_rate", "total_tx", "ring_size"]),
):
    conn = _conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    if hub_type == "all":
        cur.execute(f"""
            SELECT hub_id, hub_type, total_tx, fraud_tx, fraud_rate, ring_size
            FROM hub_stats
            WHERE fraud_rate >= %s AND total_tx >= %s
            ORDER BY {sort_by} DESC
            LIMIT %s
        """, (min_fraud_rate, min_tx, limit))
    else:
        cur.execute(f"""
            SELECT hub_id, hub_type, total_tx, fraud_tx, fraud_rate, ring_size
            FROM hub_stats
            WHERE hub_type = %s AND fraud_rate >= %s AND total_tx >= %s
            ORDER BY {sort_by} DESC
            LIMIT %s
        """, (hub_type, min_fraud_rate, min_tx, limit))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return rows

@router.get("/live-history")
def live_history(limit: int = Query(100)):
    conn = _conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT transaction_idx, round_num, tx_type, amount,
               old_balance_orig, new_balance_orig, old_balance_dest, new_balance_dest,
               fraud_prob, prediction, is_fraud,
               streamed_at::text as streamed_at
        FROM live_transactions ORDER BY id DESC LIMIT %s
    """, (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return rows

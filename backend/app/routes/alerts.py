from __future__ import annotations

import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.schemas.alerts import AlertItem, FraudAlertRequest, FraudAlertResponse
from app.services.alerts_service import AlertsService
from app.main import get_services
from app.database import engine

router = APIRouter(prefix="/alerts", tags=["alerts"])

# In-memory store for live fraud alerts (cleared on Clear)
_fraud_alerts: list[dict] = []


def _init_insights_table():
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS insights (
                id                SERIAL PRIMARY KEY,
                transaction_index INTEGER NOT NULL,
                round             INTEGER NOT NULL,
                fraud_report      TEXT    NOT NULL,
                received_at       TEXT    NOT NULL
            )
        """))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_insights_txn ON insights(transaction_index, round)"
        ))
        conn.commit()

_init_insights_table()


@router.post("/fraud", response_model=FraudAlertResponse)
def report_fraud(req: FraudAlertRequest):
    alert_id = f"ALERT-{uuid.uuid4().hex[:8].upper()}"
    risk_level = "CRITICAL" if req.fraud_probability >= 0.9 else "HIGH" if req.fraud_probability >= 0.8 else "MEDIUM"
    detected_at = datetime.utcnow().isoformat()

    alert = {
        "alert_id":          alert_id,
        "transaction_index": req.transaction_index,
        "round":             req.round,
        "transaction_type":  req.transaction_type,
        "amount":            req.amount,
        "old_balance_orig":  req.old_balance_orig,
        "new_balance_orig":  req.new_balance_orig,
        "old_balance_dest":  req.old_balance_dest,
        "new_balance_dest":  req.new_balance_dest,
        "fraud_probability": req.fraud_probability,
        "risk_level":        risk_level,
        "step":              req.step,
        "detected_at":       detected_at,
    }
    _fraud_alerts.insert(0, alert)

    # Immediately store pre-computed model insights so the UI doesn't wait for Langflow
    if req.insights:
        sm = req.system_message or {}
        pre_report = {
            "transaction_index": req.transaction_index,
            "round":             req.round,
            "source":            "model",   # will be overwritten by AI when Langflow responds
            "fraud_report": {
                "title":              f"Fraudulent {req.transaction_type} transaction detected",
                "risk_level":         risk_level,
                "confidence":         f"{req.fraud_probability * 100:.1f}%",
                "what_happened":      sm.get("what_happened", ""),
                "why_fraud":          sm.get("why_it_is_fraud", ""),
                "signals": [
                    {
                        "name":     ins.get("signal", ""),
                        "severity": ins.get("severity", "MEDIUM"),
                        "detail":   ins.get("description", ins.get("explanation", "")),
                    }
                    for ins in req.insights
                ],
                "recommended_action": sm.get("recommended_action", "Review transaction"),
                "alert_id":           alert_id,
                "detected_at":        detected_at,
            },
        }
        with engine.connect() as conn:
            conn.execute(
                text("INSERT INTO insights (transaction_index, round, fraud_report, received_at) VALUES (:idx, :rnd, :report, :ts)"),
                {"idx": req.transaction_index, "rnd": req.round, "report": json.dumps(pre_report), "ts": detected_at},
            )
            conn.commit()

    return FraudAlertResponse(
        status="received",
        alert_id=alert_id,
        message=f"Fraud alert logged for {req.transaction_type} transaction of ${req.amount:,.2f}",
    )


@router.get("/fraud", response_model=list[dict])
def get_fraud_alerts(limit: int = 50):
    return _fraud_alerts[:limit]


@router.post("/llm-report")
def receive_llm_report(payload: dict):
    """
    Receives the LLM fraud report from Langflow's Python REPL.
    Looks for transaction_index and round either at top level or inside 'transaction'.
    """
    tx_index = payload.get("transaction_index") or (payload.get("transaction") or {}).get("index")
    tx_round = payload.get("round") or (payload.get("transaction") or {}).get("round")
    received_at = datetime.utcnow().isoformat()

    tx_index = int(tx_index) if tx_index is not None else 0
    tx_round = int(tx_round) if tx_round is not None else 0

    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM insights WHERE transaction_index=:idx AND round=:rnd ORDER BY id DESC LIMIT 1"),
            {"idx": tx_index, "rnd": tx_round},
        ).fetchone()
        if existing:
            # Upgrade the pre-computed insight with the AI report
            conn.execute(
                text("UPDATE insights SET fraud_report=:report, received_at=:ts WHERE id=:id"),
                {"report": json.dumps(payload), "ts": received_at, "id": existing[0]},
            )
        else:
            conn.execute(
                text("INSERT INTO insights (transaction_index, round, fraud_report, received_at) VALUES (:idx, :rnd, :report, :ts)"),
                {"idx": tx_index, "rnd": tx_round, "report": json.dumps(payload), "ts": received_at},
            )
        conn.commit()

    return {"status": "received", "transaction_index": tx_index, "round": tx_round}


@router.get("/llm-report")
def get_llm_reports(limit: int = 50):
    """Returns the most recent LLM fraud reports."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT fraud_report, received_at FROM insights ORDER BY id DESC LIMIT :lim"),
            {"lim": limit},
        ).fetchall()
    result = []
    for row in rows:
        try:
            entry = json.loads(row[0])
            entry["received_at"] = row[1]
            result.append(entry)
        except Exception:
            pass
    return result


@router.get("/llm-report/{round}/{transaction_index}")
def get_llm_report_for_tx(round: int, transaction_index: int):
    """Returns the LLM insight for a specific transaction (matched by round + index)."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT fraud_report, received_at FROM insights WHERE round=:rnd AND transaction_index=:idx ORDER BY id DESC LIMIT 1"),
            {"rnd": round, "idx": transaction_index},
        ).fetchone()
    if row is None:
        return None
    try:
        entry = json.loads(row[0])
        entry["received_at"] = row[1]
        return entry
    except Exception:
        return None


@router.delete("/insights")
def clear_insights():
    """Clears all LLM insights from the DB and in-memory fraud alerts (Clear button)."""
    global _fraud_alerts
    _fraud_alerts = []
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM insights"))
        conn.commit()
    return {"status": "cleared"}


@router.get("/live", response_model=list[AlertItem])
def live(limit: int = 25, svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AlertsService(svc.df).live(limit=limit)


@router.get("/history", response_model=list[AlertItem])
def history(limit: int = 100, svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AlertsService(svc.df).history(limit=limit)

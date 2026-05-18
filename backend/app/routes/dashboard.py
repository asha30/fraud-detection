from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas.dashboard import DashboardMetrics, FraudTrendPoint, RecentTransaction
from app.services.dashboard_service import DashboardService
from app.main import get_services

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_EMPTY_METRICS = {
    "fraudRate": 0.0,
    "transactionsMonitored": 0,
    "activeAlerts": 0,
    "amountProtected": 0.0,
}


@router.get("/metrics", response_model=DashboardMetrics)
def get_metrics(svc=Depends(get_services)):
    if svc.df is None:
        return _EMPTY_METRICS
    return DashboardService(svc.df).metrics()


@router.get("/recent-transactions", response_model=list[RecentTransaction])
def recent_transactions(limit: int = 12, svc=Depends(get_services)):
    if svc.df is None:
        return []
    return DashboardService(svc.df).recent_transactions(limit=limit)


@router.get("/fraud-trends", response_model=list[FraudTrendPoint])
def fraud_trends(days: int = 14, svc=Depends(get_services)):
    if svc.df is None:
        return []
    return DashboardService(svc.df).fraud_trends(days=days)

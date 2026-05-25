from __future__ import annotations

from fastapi import APIRouter, Depends

from app.main import get_services
from app.schemas.dashboard import RecentTransaction
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/recent", response_model=list[RecentTransaction])
def recent(limit: int = 12, svc=Depends(get_services)):
    if svc.df is None:
        return []
    return DashboardService(svc.df).recent_transactions(limit=limit)

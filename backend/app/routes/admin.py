from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas.admin import AdminMetrics
from app.services.admin_service import AdminService
from app.main import get_services
from app.routes.auth import require_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

_EMPTY_ADMIN_METRICS = {
    "totalUsers": 0,
    "activeModels": 0,
    "rulesCount": 0,
    "systemHealth": "unknown",
}


@router.get("/metrics", response_model=AdminMetrics)
def metrics(svc=Depends(get_services)):
    if svc.df is None:
        return _EMPTY_ADMIN_METRICS
    return AdminService(svc.df).metrics()


@router.get("/users")
def users(svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AdminService(svc.df).users()


@router.get("/models")
def models(svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AdminService(svc.df).models()


@router.get("/rules")
def rules(svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AdminService(svc.df).rules()

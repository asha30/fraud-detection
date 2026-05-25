from __future__ import annotations

from fastapi import APIRouter, Depends

from app.main import get_services
from app.schemas.analytics import (
    AnalyticsMetrics,
    AnalyticsSummary,
    FraudByTypeDatum,
    FraudTypeCount,
    ModelPerformance,
    MonthlyFraudPoint,
    RiskDistributionBucket,
    ScoreDistributionPoint,
    VolumeHourlyDatum,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])

_EMPTY_SUMMARY = {
    "totalTransactions": 0,
    "fraudRate": 0.0,
    "avgResolutionTimeMinutes": 0.0,
    "falsePositiveRate": 0.0,
}

_EMPTY_METRICS = {
    "totalTransactions": 0,
    "fraudRate": 0.0,
    "avgResolutionTimeMinutes": 0.0,
    "falsePositiveRate": 0.0,
}

_EMPTY_MODEL_PERF = {
    "precision": 0.0,
    "recall": 0.0,
    "f1Score": 0.0,
    "aucRoc": 0.0,
}


@router.get("/summary", response_model=AnalyticsSummary)
def summary(svc=Depends(get_services)):
    if svc.df is None:
        return _EMPTY_SUMMARY
    return AnalyticsService(svc.df).summary()


@router.get("/risk-distribution", response_model=list[RiskDistributionBucket])
def risk_distribution(svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AnalyticsService(svc.df).risk_distribution()


@router.get("/fraud-types", response_model=list[FraudTypeCount])
def fraud_types(svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AnalyticsService(svc.df).fraud_types()


@router.get("/metrics", response_model=AnalyticsMetrics)
def metrics(range: str = "30d", svc=Depends(get_services)):
    if svc.df is None:
        return _EMPTY_METRICS
    return AnalyticsService(svc.df).metrics(range=range)


@router.get("/monthly-fraud", response_model=list[MonthlyFraudPoint])
def monthly_fraud(range: str = "12m", svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AnalyticsService(svc.df).monthly_fraud(range=range)


@router.get("/model-performance", response_model=ModelPerformance)
def model_performance(svc=Depends(get_services)):
    if svc.df is None:
        return _EMPTY_MODEL_PERF
    return AnalyticsService(svc.df).model_performance()


@router.get("/score-distribution", response_model=list[ScoreDistributionPoint])
def score_distribution(range: str = "30d", svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AnalyticsService(svc.df).score_distribution(range=range)


@router.get("/fraud-by-type", response_model=list[FraudByTypeDatum])
def fraud_by_type(svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AnalyticsService(svc.df).fraud_by_type()


@router.get("/volume-hourly", response_model=list[VolumeHourlyDatum])
def volume_hourly(svc=Depends(get_services)):
    if svc.df is None:
        return []
    return AnalyticsService(svc.df).volume_hourly()

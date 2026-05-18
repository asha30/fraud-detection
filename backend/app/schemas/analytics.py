from __future__ import annotations

from pydantic import BaseModel


# Backwards-compatible schema (older endpoint: /analytics/summary)
class AnalyticsSummary(BaseModel):
    totalTransactions: int
    fraudRate: float
    avgResolutionTimeMinutes: float
    falsePositiveRate: float
    avgTransactionAmount: float


class RiskDistributionBucket(BaseModel):
    range: str
    count: int


class FraudTypeCount(BaseModel):
    type: str
    count: int


# Frontend schemas (current React app)
class AnalyticsMetrics(BaseModel):
    totalTransactions: int
    fraudRate: float
    avgResolutionTimeMinutes: float
    falsePositiveRate: float


class MonthlyFraudPoint(BaseModel):
    month: str  # e.g. "2026-05"
    fraudLoss: float
    prevented: float


class ModelPerformance(BaseModel):
    precision: float
    recall: float
    f1Score: float
    aucRoc: float


class ScoreDistributionPoint(BaseModel):
    bucket: str  # e.g. "0-10"
    count: int


class FraudByTypeDatum(BaseModel):
    type: str
    value: int


class VolumeHourlyDatum(BaseModel):
    hour: int  # 0-23
    count: int

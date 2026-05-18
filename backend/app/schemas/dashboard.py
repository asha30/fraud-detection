from __future__ import annotations

from pydantic import BaseModel


class DashboardMetrics(BaseModel):
    fraudRate: float
    transactionsMonitored: int
    activeAlerts: int
    amountProtected: float


class RecentTransaction(BaseModel):
    id: str
    customerId: str
    amount: float
    riskScore: int
    status: str
    time: str


class FraudTrendPoint(BaseModel):
    date: str
    total: int
    fraud: int

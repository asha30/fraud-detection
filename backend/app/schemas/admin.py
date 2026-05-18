from __future__ import annotations

from pydantic import BaseModel


class AdminMetrics(BaseModel):
    totalUsers: int
    activeAnalysts: int
    activeModels: int
    activeRules: int

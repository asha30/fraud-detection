from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


@dataclass(frozen=True)
class DatabaseConfig:
    url: str


_engine: Engine | None = None


def get_engine(db_url: str) -> Engine:
    """Return a singleton SQLAlchemy engine for the given URL."""
    global _engine
    if _engine is None:
        # pool_pre_ping avoids stale connections during dev
        _engine = create_engine(db_url, pool_pre_ping=True)
    return _engine

from __future__ import annotations

import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    api_v1_prefix: str = "/api/v1"

    # Database (dataset source)
    # NOTE: Dataset used to load from CSV (DATASET_PATH). It now loads from PostgreSQL.
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5434/fraud_database",
    )
    dataset_table: str = os.getenv("DATASET_TABLE", "fraud_data")

    # Backward-compat (no longer used by DatasetService)
    dataset_path: str = os.getenv("DATASET_PATH", "app/data/fraud.csv")

    # JWT / Auth
    secret_key: str = os.getenv("SECRET_KEY", "change-me")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176").split(",")
            if o.strip()
        ]
    )


settings = Settings()
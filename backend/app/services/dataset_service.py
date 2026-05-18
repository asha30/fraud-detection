from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd


@dataclass
class DatasetService:
    """Loads the fraud dataset once and provides access helpers.

    The dataset is stored in-memory as a pandas DataFrame.

    Previously this loaded from a CSV file. It now loads from PostgreSQL.
    """

    db_url: str
    table_name: str = "fraud_data"
    df: Optional[pd.DataFrame] = None

    def load(self) -> None:
        # Import here to keep service lightweight and avoid circular imports.
        from app.db.database import get_engine

        engine = get_engine(self.db_url)

        # Load entire dataset table into memory (keeps the ML pipeline unchanged).
        df = pd.read_sql_query(f"SELECT * FROM {self.table_name}", con=engine)

        # Normalize column names a bit (keep original columns, but ensure consistent access)
        df.columns = [c.strip() for c in df.columns]

        self.df = df

    def get_df(self) -> pd.DataFrame:
        if self.df is None:
            raise RuntimeError("Dataset not loaded. Ensure app startup completed.")
        return self.df

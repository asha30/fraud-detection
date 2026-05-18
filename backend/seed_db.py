"""
Seed script — loads enriched_fraud_dataset.csv into the fraud_data table in PostgreSQL.
Run from the backend/ directory:
    python seed_db.py
"""
import os
import sys
import pandas as pd
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5434/fraud_database"
)

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "enriched_fraud_dataset.csv")
TABLE_NAME = "fraud_data"

def main():
    print(f"Connecting to: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)

    # Test connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("Connection OK.")

    print(f"Loading CSV: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    df.columns = [c.strip() for c in df.columns]
    print(f"Rows: {len(df)}  Columns: {list(df.columns)}")

    print(f"Writing to table '{TABLE_NAME}' (replace if exists)...")
    df.to_sql(TABLE_NAME, engine, if_exists="replace", index=False, chunksize=5000)
    print(f"Done. {len(df)} rows loaded into '{TABLE_NAME}'.")

if __name__ == "__main__":
    main()

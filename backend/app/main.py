from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.services.dataset_service import DatasetService


@dataclass
class Services:
    df: object  # pandas DataFrame


_services: Services | None = None


def get_services() -> Services:
    if _services is None:
        raise RuntimeError("Services not initialized")
    return _services


def create_app() -> FastAPI:
    app = FastAPI(title="FraudShield AI API", version="0.1.0")

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"] ,
    )

    @app.get(f"{settings.api_v1_prefix}/health")
    def health():
        return {"status": "ok"}

    @app.on_event("startup")
    def _startup() -> None:
        global _services
        try:
            ds = DatasetService(
                db_url=settings.database_url,
                table_name=settings.dataset_table,
            )
            ds.load()
            _services = Services(df=ds.get_df())
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                f"Dataset load skipped (table may not exist yet): {e}"
            )
            _services = Services(df=None)

    # Routers
    from app.routes.dashboard import router as dashboard_router
    from app.routes.analytics import router as analytics_router
    from app.routes.alerts import router as alerts_router
    from app.routes.admin import router as admin_router
    from app.routes.predict import router as predict_router
    from app.routes.auth import router as auth_router
    from app.routes.transactions import router as transactions_router

    # NOTE: routes define their own full paths; we do NOT add extra '/api/v1' here.
    app.include_router(dashboard_router)
    app.include_router(analytics_router)
    app.include_router(alerts_router)
    app.include_router(admin_router)
    app.include_router(predict_router)
    app.include_router(auth_router)
    app.include_router(transactions_router)

    return app


app = create_app()

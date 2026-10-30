from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app.api.routes import activity, admin, analytics, auth, community, donations, health, ml, verification
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import Donation, DonationClaim, User  # noqa: F401


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    settings.uploads_root.mkdir(parents=True, exist_ok=True)
    migrations = {
        "users": {
            "is_approved": "BOOLEAN NOT NULL DEFAULT 0",
        },
        "donation_claims": {
            "authorized_volunteer_id": "INTEGER REFERENCES users(id)",
            "verification_token_hash": "VARCHAR(64)",
            "token_expires_at": "DATETIME",
            "picked_up_at": "DATETIME",
            "token_used": "BOOLEAN NOT NULL DEFAULT 0",
        },
        "community_needs": {
            "pledged_meals": "INTEGER NOT NULL DEFAULT 0",
        },
    }
    with engine.begin() as connection:
        inspector = inspect(connection)
        for table_name, columns in migrations.items():
            if not inspector.has_table(table_name):
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, definition in columns.items():
                if column_name not in existing_columns:
                    connection.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")
                    )
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_prefix)
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(donations.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
app.include_router(verification.router, prefix=settings.api_prefix)
app.include_router(community.router, prefix=settings.api_prefix)
app.include_router(ml.router, prefix=settings.api_prefix)
app.include_router(analytics.router, prefix=settings.api_prefix)
app.include_router(activity.router, prefix=settings.api_prefix)
app.mount("/uploads", StaticFiles(directory=settings.uploads_root, check_dir=False), name="uploads")

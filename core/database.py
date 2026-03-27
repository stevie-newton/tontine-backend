from threading import Lock

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings
from app.core.migrations import run_startup_migrations

# Create database engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True
)

# Create session
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base class for models
Base = declarative_base()

_MIGRATIONS_READY = settings.AUTO_RUN_MIGRATIONS
_MIGRATIONS_LOCK = Lock()


def ensure_database_schema_ready() -> None:
    global _MIGRATIONS_READY

    if _MIGRATIONS_READY:
        return

    with _MIGRATIONS_LOCK:
        if _MIGRATIONS_READY:
            return
        run_startup_migrations()
        _MIGRATIONS_READY = True


# Dependency for FastAPI routes
def get_db():
    ensure_database_schema_ready()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import settings


def run_startup_migrations() -> None:
    alembic_ini_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini_path))
    alembic_cfg.set_main_option("script_location", str(alembic_ini_path.with_name("alembic")))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    command.upgrade(alembic_cfg, "head")

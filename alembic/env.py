from logging.config import fileConfig
from pathlib import Path
import pkgutil
import sys

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Calculate project root more robustly
# Assuming env.py is in: project_root/app/alembic/env.py
current_file = Path(__file__).resolve()
PROJECT_ROOT = current_file.parents[2]  # Go up 3 levels from env.py
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Optional: Print for debugging
print(f"Project root: {PROJECT_ROOT}")
print(f"Python path includes: {PROJECT_ROOT in map(Path, sys.path)}")

try:
    from app.core.config import settings
    from app.core.database import Base
    import app.models as models_package
except ImportError as e:
    print(f"Import error: {e}")
    print(f"Current sys.path: {sys.path}")
    raise


def import_all_models() -> None:
    """Import all modules under app.models so metadata is fully populated."""
    if not hasattr(models_package, '__path__'):
        print("Warning: models_package has no __path__ attribute")
        return
        
    for _, module_name, is_pkg in pkgutil.iter_modules(models_package.__path__):
        if not is_pkg:  # Only import modules, not subpackages
            __import__(f"app.models.{module_name}")
            print(f"Imported app.models.{module_name}")


# Import all models
import_all_models()

# Set database URL from settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
target_metadata = Base.metadata

print(f"Database URL: {settings.DATABASE_URL}")
print(f"Tables in metadata: {list(target_metadata.tables.keys())}")


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,  # Important for detecting type changes
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            compare_type=True,  # Add this!
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

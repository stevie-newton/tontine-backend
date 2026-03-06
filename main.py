import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# Allow running from either project parent (import app.main) or app root (uvicorn main:app).
PROJECT_PARENT = Path(__file__).resolve().parent.parent
if str(PROJECT_PARENT) not in sys.path:
    sys.path.insert(0, str(PROJECT_PARENT))

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.i18n import get_locale_from_request, translate_detail
from app.routes import admin_stats, auth, contribution, cycles, debt, payments, support, tontine, tontine_cycle, tontine_membership, user_profile
from app.services.reminder_service import send_pre_deadline_sms_reminders

# Import models so Alembic/autogenerate sees the full metadata
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    reminder_task: asyncio.Task | None = None

    async def _auto_reminder_loop():
        interval_seconds = max(60, int(settings.AUTO_REMINDER_INTERVAL_SECONDS))
        while True:
            db = SessionLocal()
            try:
                stats = send_pre_deadline_sms_reminders(db)
                if stats["cycles_checked"] > 0:
                    print(f"Auto reminders: {stats}")
            except Exception as exc:
                print(f"Auto reminder loop failed: {exc}")
            finally:
                db.close()
            await asyncio.sleep(interval_seconds)

    print(f"{settings.APP_NAME} v{app.version} started successfully")
    print(f"Debug mode: {settings.DEBUG}")
    print(f"CORS origins: {settings.CORS_ALLOW_ORIGINS}")
    print(f"Endpoints: {len(app.routes)} routes registered")
    if settings.AUTO_REMINDER_ENABLED:
        reminder_task = asyncio.create_task(_auto_reminder_loop())
        print("Auto reminder loop: enabled")
    else:
        print("Auto reminder loop: disabled")
    print("=" * 50)
    try:
        yield
    finally:
        if reminder_task:
            reminder_task.cancel()
            try:
                await reminder_task
            except asyncio.CancelledError:
                pass


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="Family Tontine Management API",
    version="1.0.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)


@app.exception_handler(HTTPException)
async def localized_http_exception_handler(request: Request, exc: HTTPException):
    locale = get_locale_from_request(request)
    translated_detail = translate_detail(exc.detail, locale)
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={"detail": translated_detail},
    )

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(auth.router)
app.include_router(tontine.router)
app.include_router(tontine_membership.router)
app.include_router(contribution.router)
app.include_router(debt.router)
app.include_router(payments.router)
app.include_router(cycles.router)
app.include_router(tontine_cycle.router)
app.include_router(user_profile.router)
app.include_router(admin_stats.router)
app.include_router(support.router)


# Root endpoint
@app.get("/")
def root():
    return {
        "status": "API is running",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "debug": settings.DEBUG,
    }


# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}

import os
from pathlib import Path
from dotenv import load_dotenv

# Load variables from app/.env regardless of current working directory
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH)


class Settings:
    @staticmethod
    def _as_bool(value: str, default: bool = False) -> bool:
        if value is None:
            return default
        return value.strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _as_csv(value: str) -> list[str]:
        # Normalize comma-separated values (e.g. CORS origins).
        # Browsers send Origin without a trailing slash, so strip it here to avoid
        # accidental mismatches like "https://cercora.vercel.app/" vs "https://cercora.vercel.app".
        parts: list[str] = []
        for raw in value.split(","):
            part = raw.strip()
            if not part:
                continue
            parts.append(part.rstrip("/"))
        return parts

    # App
    APP_NAME: str = "Family Tontine API"
    DEBUG: bool = _as_bool.__func__(os.getenv("DEBUG", "false"), default=False)

    # Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-this-secret")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour
    PASSWORD_RESET_CODE_EXPIRE_MINUTES: int = int(os.getenv("PASSWORD_RESET_CODE_EXPIRE_MINUTES", "10"))
    PASSWORD_RESET_MAX_ATTEMPTS: int = int(os.getenv("PASSWORD_RESET_MAX_ATTEMPTS", "5"))
    REGISTER_OTP_EXPIRE_MINUTES: int = int(os.getenv("REGISTER_OTP_EXPIRE_MINUTES", "5"))
    REGISTER_OTP_MAX_ATTEMPTS: int = int(os.getenv("REGISTER_OTP_MAX_ATTEMPTS", "3"))
    REGISTER_OTP_RESEND_COOLDOWN_SECONDS: int = int(os.getenv("REGISTER_OTP_RESEND_COOLDOWN_SECONDS", "30"))
    REGISTER_OTP_VERIFIED_TTL_MINUTES: int = int(os.getenv("REGISTER_OTP_VERIFIED_TTL_MINUTES", "30"))
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS: int = int(os.getenv("LOGIN_RATE_LIMIT_MAX_ATTEMPTS", "5"))
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = int(os.getenv("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "60"))

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/tontine_db"
    )
    AUTO_RUN_MIGRATIONS: bool = _as_bool.__func__(
        os.getenv("AUTO_RUN_MIGRATIONS", "true"),
        default=True,
    )

    # Monetbil
    MONETBIL_API_KEY: str = os.getenv("MONETBIL_API_KEY", "")
    MONETBIL_SERVICE_KEY: str = os.getenv("MONETBIL_SERVICE_KEY", "")
    MONETBIL_WEBHOOK_SECRET: str = os.getenv("MONETBIL_WEBHOOK_SECRET", "")

    # Flutterwave OAuth (v4)
    FLW_CLIENT_ID: str = os.getenv("FLW_CLIENT_ID", os.getenv("FLW_SECRET_KEY", "")).strip()
    FLW_CLIENT_SECRET: str = os.getenv("FLW_CLIENT_SECRET", os.getenv("FLW_PUBLIC_KEY", "")).strip()
    FLW_ENCRYPTION_KEY: str = os.getenv("FLW_ENCRYPTION_KEY", "").strip()

    # Optional webhook hash (if configured in dashboard)
    FLW_SECRET_HASH: str = os.getenv("FLW_SECRET_HASH", os.getenv("FLW_ENCRYPTION_KEY", "")).strip()

    # Twilio SMS
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM_NUMBER: str = os.getenv("TWILIO_FROM_NUMBER", "")

    # URLs
    BASE_URL: str = os.getenv("BASE_URL", "http://127.0.0.1:8000")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://127.0.0.1:3000")
    CORS_ALLOW_ORIGINS: list[str] = _as_csv.__func__(
        os.getenv("CORS_ALLOW_ORIGINS", FRONTEND_URL)
    )
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM_EMAIL: str = os.getenv("SMTP_FROM_EMAIL", "")
    SUPPORT_EMAIL_TO: str = os.getenv("SUPPORT_EMAIL_TO", "")
    AUTO_REMINDER_ENABLED: bool = _as_bool.__func__(
        os.getenv("AUTO_REMINDER_ENABLED", "false"),
        default=False,
    )
    AUTO_REMINDER_INTERVAL_SECONDS: int = int(os.getenv("AUTO_REMINDER_INTERVAL_SECONDS", "3600"))
    AUTO_REMINDER_LOOKAHEAD_HOURS: int = int(os.getenv("AUTO_REMINDER_LOOKAHEAD_HOURS", "24"))


settings = Settings()

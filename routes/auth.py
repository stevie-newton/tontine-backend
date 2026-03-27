from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta, timezone
import hashlib
import secrets


from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import settings
from app.core.phone import normalize_phone, phone_lookup_candidates
from app.core.rate_limit import clear_failed_attempts, get_client_ip, is_limited, record_failed_attempt

from pydantic import BaseModel, Field
from app.models.user import User
from app.models.registration_otp import RegistrationOTP
from app.schemas.user import (
    UserCreate,
    UserResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
)
from app.core.dependencies import get_current_user
from app.services.sms_service import SMSService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _generate_reset_code() -> str:
    # 6-digit OTP
    return f"{secrets.randbelow(900000) + 100000}"


def _generate_registration_otp_code() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _clear_reset_state(user: User) -> None:
    user.password_reset_code_hash = None
    user.password_reset_expires_at = None
    user.password_reset_attempts = 0
    user.password_reset_requested_at = None


class RegistrationOTPRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)


class RegistrationOTPVerifyRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    code: str = Field(..., min_length=4, max_length=10)


def _issue_registration_otp(
    db: Session,
    *,
    normalized_phone: str,
    enforce_cooldown: bool,
) -> str:
    code = _generate_registration_otp_code()
    now = datetime.now(timezone.utc)
    otp = db.query(RegistrationOTP).filter(RegistrationOTP.phone == normalized_phone).first()
    if enforce_cooldown and otp and otp.last_sent_at:
        last_sent_at = otp.last_sent_at if otp.last_sent_at.tzinfo else otp.last_sent_at.replace(tzinfo=timezone.utc)
        next_allowed = last_sent_at + timedelta(seconds=settings.REGISTER_OTP_RESEND_COOLDOWN_SECONDS)
        if now < next_allowed:
            remaining = int((next_allowed - now).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {remaining} seconds before requesting a new OTP",
            )

    if not otp:
        otp = RegistrationOTP(phone=normalized_phone, code_hash="", expires_at=now)

    otp.code_hash = _hash_code(code)
    otp.expires_at = now + timedelta(minutes=settings.REGISTER_OTP_EXPIRE_MINUTES)
    otp.attempts = 0
    otp.is_verified = False
    otp.verified_at = None
    otp.last_sent_at = now
    db.add(otp)
    db.commit()
    return code


def _send_registration_otp_sms(phone: str, code: str) -> None:
    sms_sent = False
    if SMSService.is_configured():
        try:
            SMSService.send_sms(
                phone,
                f"Your registration verification code is {code}. It expires in {settings.REGISTER_OTP_EXPIRE_MINUTES} minutes.",
            )
            sms_sent = True
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Unable to send OTP: {exc}")

    if settings.DEBUG and not sms_sent:
        return


def _resolve_delivery_phone(*phones: str | None) -> str:
    normalized_candidates = [normalize_phone(phone or "") for phone in phones]
    for phone in normalized_candidates:
        if phone.startswith("+"):
            return phone

    for phone in phones:
        value = (phone or "").strip()
        if value:
            return value

    return ""


def _send_password_reset_sms(requested_phone: str, stored_phone: str, code: str) -> str | None:
    destination_phone = _resolve_delivery_phone(requested_phone, stored_phone)
    if not destination_phone:
        raise HTTPException(status_code=400, detail="A valid phone number is required")

    message = (
        f"Your password reset code is {code}. "
        f"It expires in {settings.PASSWORD_RESET_CODE_EXPIRE_MINUTES} minutes."
    )

    if SMSService.is_configured():
        try:
            SMSService.send_sms(destination_phone, message)
            return None
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to send reset code SMS. Check the Twilio sender setup and, "
                    "if you are using a Twilio trial account, make sure the destination number is verified. "
                    f"SMS error: {exc}"
                ),
            )

    if settings.DEBUG:
        return f"Reset code generated (debug): {code}"

    raise HTTPException(
        status_code=500,
        detail="Password reset SMS is not configured on the server",
    )


@router.post("/resend-otp", response_model=MessageResponse)
def resend_registration_otp(payload: RegistrationOTPRequest, db: Session = Depends(get_db)):
    normalized_phone = normalize_phone(payload.phone)
    user = db.query(User).filter(User.phone == normalized_phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_phone_verified:
        return {"message": "Phone already verified"}

    code = _issue_registration_otp(
        db,
        normalized_phone=normalized_phone,
        enforce_cooldown=True,
    )
    _send_registration_otp_sms(normalized_phone, code)
    if settings.DEBUG and not SMSService.is_configured():
        return {"message": f"OTP generated (debug): {code}"}
    return {"message": "OTP sent to your phone."}


@router.post("/verify-phone", response_model=MessageResponse)
def verify_phone(payload: RegistrationOTPVerifyRequest, db: Session = Depends(get_db)):
    normalized_phone = normalize_phone(payload.phone)
    user = db.query(User).filter(User.phone == normalized_phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_phone_verified:
        return {"message": "Phone already verified"}

    otp = db.query(RegistrationOTP).filter(RegistrationOTP.phone == normalized_phone).first()
    if not otp:
        raise HTTPException(status_code=400, detail="OTP not requested for this phone")

    now = datetime.now(timezone.utc)
    expires_at = otp.expires_at if otp.expires_at.tzinfo else otp.expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        db.delete(otp)
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired. Request a new one")

    if otp.attempts >= settings.REGISTER_OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Too many invalid OTP attempts. Request a new one")

    provided_hash = _hash_code(payload.code.strip())
    if not secrets.compare_digest(provided_hash, otp.code_hash):
        otp.attempts += 1
        db.add(otp)
        db.commit()
        if otp.attempts >= settings.REGISTER_OTP_MAX_ATTEMPTS:
            raise HTTPException(status_code=400, detail="Too many invalid OTP attempts. Request a new one")
        raise HTTPException(status_code=400, detail="Invalid OTP")

    otp.is_verified = True
    otp.verified_at = now
    otp.attempts = 0
    user.is_phone_verified = True
    db.add(otp)
    db.add(user)
    db.commit()
    return {"message": "Phone verified. You can now complete registration."}


# -------------------------
# Register
# -------------------------
@router.post("/register", response_model=UserResponse, operation_id="auth_register")
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    normalized_phone = normalize_phone(user_data.phone)
    candidates = phone_lookup_candidates(user_data.phone)

    # Check if phone already exists
    existing_user = db.query(User).filter(User.phone.in_(candidates)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number already registered",
        )

    # Create user
    new_user = User(
        name=user_data.name,
        phone=normalized_phone,
        is_phone_verified=False,
       hashed_password=hash_password(user_data.password),
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    code = _issue_registration_otp(
        db,
        normalized_phone=normalized_phone,
        enforce_cooldown=False,
    )
    _send_registration_otp_sms(normalized_phone, code)

    return new_user


# -------------------------
# Login
# -------------------------
@router.post("/login", operation_id="auth_login")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    if is_limited(
        client_ip,
        max_attempts=settings.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
        window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again shortly.",
        )

    # OAuth2 uses "username", we treat it as phone
    candidates = phone_lookup_candidates(form_data.username)
    user = db.query(User).filter(User.phone.in_(candidates)).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        record_failed_attempt(
            client_ip,
            window_seconds=settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clear_failed_attempts(client_ip)
    if not user.is_phone_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Phone number is not verified",
        )
    

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.from_orm(user)
        }
    

# -------------------------
# Get Current User
# -------------------------
@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)  # You'll need to import this
):
    """
    Get current authenticated user information.
    """
    return current_user


@router.post("/forgot-password", response_model=MessageResponse, operation_id="auth_forgot_password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    candidates = phone_lookup_candidates(payload.phone)
    user = db.query(User).filter(User.phone.in_(candidates)).first()

    # Generic response prevents user enumeration.
    generic_message = "If this phone number exists, a reset code was sent."
    if not user:
        return {"message": generic_message}

    code = _generate_reset_code()
    now = datetime.now(timezone.utc)
    user.password_reset_code_hash = _hash_code(code)
    user.password_reset_expires_at = now + timedelta(minutes=settings.PASSWORD_RESET_CODE_EXPIRE_MINUTES)
    user.password_reset_attempts = 0
    user.password_reset_requested_at = now
    db.add(user)
    db.commit()

    debug_message = _send_password_reset_sms(payload.phone, user.phone, code)
    if debug_message:
        return {"message": debug_message}

    return {"message": generic_message}


@router.post("/reset-password", response_model=MessageResponse, operation_id="auth_reset_password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    candidates = phone_lookup_candidates(payload.phone)
    user = db.query(User).filter(User.phone.in_(candidates)).first()

    if not user or not user.password_reset_code_hash or not user.password_reset_expires_at:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    now = datetime.now(timezone.utc)
    expires_at = user.password_reset_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if user.password_reset_attempts >= settings.PASSWORD_RESET_MAX_ATTEMPTS or now > expires_at:
        _clear_reset_state(user)
        db.add(user)
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    provided_hash = _hash_code(payload.code.strip())
    if not secrets.compare_digest(provided_hash, user.password_reset_code_hash):
        user.password_reset_attempts += 1
        if user.password_reset_attempts >= settings.PASSWORD_RESET_MAX_ATTEMPTS:
            _clear_reset_state(user)
        db.add(user)
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")

    user.hashed_password = hash_password(payload.new_password)
    _clear_reset_state(user)
    db.add(user)
    db.commit()

    return {"message": "Password reset successful. You can now sign in."}

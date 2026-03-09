from datetime import datetime, timedelta
import hashlib
from typing import Optional

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    pre_hash = hashlib.sha256(password.encode('utf-8')).digest()
    return pwd_context.hash(pre_hash)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pre_hash = hashlib.sha256(plain_password.encode('utf-8')).digest()
    return pwd_context.verify(pre_hash, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()

    expire = datetime.utcnow() + (
        expires_delta
        if expires_delta
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )

    return encoded_jwt
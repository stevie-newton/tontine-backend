from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime


# Used when creating a user (registration)
class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=8, max_length=20)
    password: str = Field(..., min_length=4)


# Used when returning user data (response)
class UserResponse(BaseModel):
    id: int
    name: str
    phone: str
    preferred_language: str = "en"
    is_phone_verified: bool = True
    is_global_admin: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Used for login
class UserLogin(BaseModel):
    phone: str
    password: str

# Used for login with OAuth2 (compatible with OAuth2PasswordRequestForm)
class UserLoginOAuth(BaseModel):
    username: str  # Can be phone or email
    password: str



# Token response for login
class Token(BaseModel):
    access_token: str
    token_type: str
    # user: Optional[UserResponse] = None  # Include user info in token response
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)


class ResetPasswordRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    code: str = Field(..., min_length=4, max_length=10)
    new_password: str = Field(..., min_length=4)


class MessageResponse(BaseModel):
    message: str

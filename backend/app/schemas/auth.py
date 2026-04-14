from pydantic import BaseModel, EmailStr, Field

from app.models.enums import Role, VerificationStatus


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    phone_number: str | None = Field(default=None, alias="phoneNumber")

    model_config = {"populate_by_name": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    userId: int | None = None
    email: str | None = None
    role: Role | None = None
    firstName: str | None = None
    lastName: str | None = None
    isVerified: bool | None = None
    verificationStatus: VerificationStatus | None = None
    message: str

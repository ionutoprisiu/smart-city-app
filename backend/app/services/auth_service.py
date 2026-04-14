from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import Role, VerificationStatus
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest


def register(db: Session, req: RegisterRequest) -> AuthResponse:
    if db.execute(select(User).where(User.email == req.email)).scalar_one_or_none():
        return AuthResponse(message="Email already exists")

    phone = req.phone_number
    if phone:
        existing = db.execute(select(User).where(User.phone_number == phone)).scalar_one_or_none()
        if existing:
            return AuthResponse(message="Phone number already exists")

    first = (req.first_name or "").strip()
    last = (req.last_name or "").strip()
    full_name = (first + " " + last).strip() or " "

    user = User(
        email=req.email,
        password=req.password,
        first_name=first or " ",
        last_name=last or " ",
        name=full_name,
        phone_number=phone,
        role=Role.USER.value,
        is_verified=False,
        is_approved=False,
        created_at=datetime.now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        userId=user.id,
        email=user.email,
        role=Role(user.role),
        firstName=user.first_name,
        lastName=user.last_name,
        isVerified=user.is_verified,
        verificationStatus=VerificationStatus(user.verification_status),
        message="Registration successful",
    )


def login(db: Session, req: LoginRequest) -> AuthResponse:
    user = db.execute(select(User).where(User.email == req.email)).scalar_one_or_none()
    if user is None or user.password != req.password:
        return AuthResponse(message="Invalid email or password")

    user.last_login = datetime.now()
    db.commit()

    return AuthResponse(
        userId=user.id,
        email=user.email,
        role=Role(user.role),
        firstName=user.first_name,
        lastName=user.last_name,
        isVerified=user.is_verified,
        verificationStatus=VerificationStatus(user.verification_status),
        message="Login successful",
    )

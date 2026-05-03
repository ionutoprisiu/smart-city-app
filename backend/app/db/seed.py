"""Optional seed users for local / empty databases (controlled via settings)."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.models.enums import Role
from app.models.user import User


def seed_demo_user_if_enabled(db: Session) -> None:
    if not settings.seed_demo_user:
        return
    email = settings.demo_user_email.strip()
    if not email:
        return
    if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
        return

    first = settings.demo_user_first_name.strip() or "Demo"
    last = settings.demo_user_last_name.strip() or "User"
    now = datetime.now()
    user = User(
        email=email,
        password=hash_password(settings.demo_user_password),
        first_name=first,
        last_name=last,
        name=f"{first} {last}".strip() or " ",
        phone_number=None,
        role=Role.USER.value,
        is_verified=False,
        is_approved=False,
        created_at=now,
    )
    db.add(user)
    db.commit()


def seed_admin_user_if_enabled(db: Session) -> None:
    if not settings.seed_admin_user:
        return
    email = settings.admin_user_email.strip()
    if not email:
        return
    if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
        return

    first = settings.admin_user_first_name.strip() or "Admin"
    last = settings.admin_user_last_name.strip() or "User"
    now = datetime.now()
    user = User(
        email=email,
        password=hash_password(settings.admin_user_password),
        first_name=first,
        last_name=last,
        name=f"{first} {last}".strip() or " ",
        phone_number=None,
        role=Role.ADMIN.value,
        is_verified=True,
        is_approved=True,
        created_at=now,
    )
    db.add(user)
    db.commit()

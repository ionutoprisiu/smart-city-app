from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.common.utc import utc_now
from app.core.config import settings
from app.core.security import hash_password
from app.models.enums import AttractionCategory, Role
from app.models.tourist_attraction import TouristAttraction
from app.models.user import User

_CORE_ATTRACTIONS: list[dict] = [
    {"name": "Biserica Sfântul Mihail", "lat": 46.7693, "lon": 23.5897, "cat": AttractionCategory.CHURCH, "visit": 30},
    {"name": "Statuia lui Matei Corvin", "lat": 46.7695, "lon": 23.5894, "cat": AttractionCategory.MONUMENT, "visit": 15},
    {"name": "Muzeul Național de Artă Cluj-Napoca (Palatul Bánffy)", "lat": 46.7702, "lon": 23.5905, "cat": AttractionCategory.MUSEUM, "visit": 90},
    {"name": "Grădina Botanică Alexandru Borza", "lat": 46.7626, "lon": 23.5878, "cat": AttractionCategory.PARK, "visit": 90},
    {"name": "Parcul Central Simion Bărnuțiu", "lat": 46.7706, "lon": 23.5790, "cat": AttractionCategory.PARK, "visit": 45},
    {"name": "Parcul Cetățuia", "lat": 46.7754, "lon": 23.5860, "cat": AttractionCategory.PARK, "visit": 45},
    {"name": "Teatrul Național Lucian Blaga", "lat": 46.7723, "lon": 23.5969, "cat": AttractionCategory.THEATER, "visit": 120},
    {"name": "Bastionul Croitorilor", "lat": 46.7686, "lon": 23.5953, "cat": AttractionCategory.FORTRESS, "visit": 30},
    {"name": "Muzeul Farmaciei", "lat": 46.7697, "lon": 23.5887, "cat": AttractionCategory.MUSEUM, "visit": 45},
    {"name": "Universitatea Babeș-Bolyai", "lat": 46.7657, "lon": 23.5910, "cat": AttractionCategory.MONUMENT, "visit": 30},
    {"name": "Piața Avram Iancu", "lat": 46.7710, "lon": 23.5972, "cat": AttractionCategory.SQUARE, "visit": 20},
    {"name": "Catedrala Ortodoxă Adormirea Maicii Domnului", "lat": 46.7707, "lon": 23.5965, "cat": AttractionCategory.CHURCH, "visit": 30},
    {"name": "Piața Muzeului", "lat": 46.7711, "lon": 23.5889, "cat": AttractionCategory.SQUARE, "visit": 20},
    {"name": "Biserica Reformată din Centru", "lat": 46.7685, "lon": 23.5928, "cat": AttractionCategory.CHURCH, "visit": 30},
    {"name": "Muzeul Etnografic al Transilvaniei", "lat": 46.7708, "lon": 23.5829, "cat": AttractionCategory.MUSEUM, "visit": 90},
    {"name": "Piața Unirii", "lat": 46.7693, "lon": 23.5901, "cat": AttractionCategory.SQUARE, "visit": 20},
]


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


def seed_core_attractions_if_empty(db: Session) -> None:
    count = db.execute(select(func.count()).select_from(TouristAttraction)).scalar_one()
    if count and int(count) > 0:
        return

    now = utc_now()
    items = [
        TouristAttraction(
            name=entry["name"],
            description="",
            latitude=entry["lat"],
            longitude=entry["lon"],
            city="Cluj-Napoca",
            category=entry["cat"].value,
            estimated_visit_time=entry["visit"],
            importance_score=10.0,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        for entry in _CORE_ATTRACTIONS
    ]
    db.add_all(items)
    db.commit()

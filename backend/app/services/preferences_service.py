from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import AttractionCategory
from app.models.user_preferences import UserPreferences

# Categories the onboarding questionnaire lets users pick from (ordered for display).
SELECTABLE_CATEGORIES: list[str] = [
    AttractionCategory.MUSEUM.value,
    AttractionCategory.MONUMENT.value,
    AttractionCategory.CHURCH.value,
    AttractionCategory.PARK.value,
    AttractionCategory.THEATER.value,
    AttractionCategory.SQUARE.value,
    AttractionCategory.FORTRESS.value,
    AttractionCategory.LIBRARY.value,
    AttractionCategory.RESTAURANT.value,
    AttractionCategory.CAFE.value,
    AttractionCategory.SHOP.value,
]

_VALID = set(SELECTABLE_CATEGORIES)


def normalize_categories(raw: list[str] | None) -> list[str]:
    """Uppercase, validate against the enum, drop duplicates, preserve order."""
    out: list[str] = []
    for item in raw or []:
        value = str(item).strip().upper()
        if value in _VALID and value not in out:
            out.append(value)
    return out


def get_ordered_categories(db: Session, user_id: int | None) -> list[str]:
    if user_id is None:
        return []
    row = db.get(UserPreferences, user_id)
    if row is None or not row.categories:
        return []
    return [c for c in row.categories.split(",") if c]


def get_preferences(db: Session, user_id: int) -> dict[str, Any]:
    row = db.get(UserPreferences, user_id)
    if row is None:
        return {"completed": False, "categories": []}
    return {
        "completed": bool(row.completed),
        "categories": [c for c in row.categories.split(",") if c],
    }


def save_preferences(db: Session, user_id: int, categories: list[str]) -> dict[str, Any]:
    normalized = normalize_categories(categories)
    row = db.get(UserPreferences, user_id)
    if row is None:
        row = UserPreferences(user_id=user_id, categories=",".join(normalized), completed=True)
        db.add(row)
    else:
        row.categories = ",".join(normalized)
        row.completed = True
    db.commit()
    db.refresh(row)
    return {"completed": bool(row.completed), "categories": normalized}

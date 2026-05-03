"""Declarative ORM base class (subclass per table in ``app.models``)."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Metadata anchor for all application models."""

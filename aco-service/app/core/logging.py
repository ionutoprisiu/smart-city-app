"""Centralized logging configuration."""

from __future__ import annotations

import logging

DEFAULT_FORMAT = "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s"


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logging once for the whole service."""
    logging.basicConfig(level=level, format=DEFAULT_FORMAT, force=True)

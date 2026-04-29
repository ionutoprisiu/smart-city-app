"""Security primitives (password hashing, token helpers).

Placeholder for upcoming hardening: replace plaintext password handling
with `bcrypt` / `passlib` and add JWT helpers here.
"""

from __future__ import annotations


def hash_password(password: str) -> str:
    """Return a hashed representation of `password`.

    TODO: replace with bcrypt/passlib when password hashing is enabled.
    """
    return password


def verify_password(plain_password: str, stored_password: str) -> bool:
    """Return True if `plain_password` matches `stored_password`.

    TODO: replace with constant-time bcrypt verification.
    """
    return plain_password == stored_password

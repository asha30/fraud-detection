from __future__ import annotations

"""JWT helpers.

- create_access_token(): issues a signed JWT with expiration
- verify_token(): validates token signature + expiry

These utilities are used by the auth dependency (get_current_user).
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt


def create_access_token(*, data: dict[str, Any], secret_key: str, algorithm: str, expires_minutes: int) -> str:
    to_encode = dict(data)
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)


def verify_token(*, token: str, secret_key: str, algorithm: str) -> dict[str, Any]:
    # Raises JWTError on invalid / expired tokens.
    return jwt.decode(token, secret_key, algorithms=[algorithm])

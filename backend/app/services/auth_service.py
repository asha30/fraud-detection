from __future__ import annotations

from typing import Any
import bcrypt


class AuthService:
    def __init__(self) -> None:

        self.users: dict[str, dict[str, Any]] = {
            "admin@fraudshield.ai": {
                "id": "1",
                "name": "Admin User",
                "email": "admin@fraudshield.ai",
                "role": "admin",
                "hashed_password": self.hash_password("admin123"),
                "is_active": True,
            },
            "analyst@fraudshield.ai": {
                "id": "2",
                "name": "Fraud Analyst",
                "email": "analyst@fraudshield.ai",
                "role": "analyst",
                "hashed_password": self.hash_password("analyst123"),
                "is_active": True,
            },
        }

    def hash_password(self, password: str) -> bytes:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    def verify_password(self, plain_password: str, hashed_password: bytes) -> bool:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password,
        )

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        return self.users.get(email.lower())

    def authenticate_user(self, email: str, password: str) -> dict[str, Any] | None:

        user = self.get_user_by_email(email)

        if not user:
            return None

        if not self.verify_password(password, user["hashed_password"]):
            return None

        return user

    def to_public_user(self, user: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "is_active": user.get("is_active", True),
        }
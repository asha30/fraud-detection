from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config.settings import settings
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.services.auth_service import AuthService
from app.utils.jwt_utils import create_access_token, verify_token

router = APIRouter(tags=["auth"])

security = HTTPBearer(auto_error=False)

# Single in-memory auth service instance for now
_auth_service = AuthService()


def get_auth_service() -> AuthService:
    return _auth_service


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    auth: AuthService = Depends(get_auth_service),
) -> dict[str, Any]:
    """Read Authorization: Bearer <token>, validate, and return user.

    Raises:
      - 401 for missing/invalid/expired token
    """
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = creds.credentials
    try:
        payload = verify_token(token=token, secret_key=settings.secret_key, algorithm=settings.algorithm)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = auth.get_user_by_email(str(email))
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Guard for admin-only routes.

    Raises:
      - 403 if user is authenticated but not admin
    """
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return user


@router.post(f"{settings.api_v1_prefix}/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, auth: AuthService = Depends(get_auth_service)) -> TokenResponse:
    """Authenticate user and return a JWT access token.

    Flow:
      1) Verify email+password against our local user store (bcrypt hash)
      2) Issue JWT with exp (ACCESS_TOKEN_EXPIRE_MINUTES)

    Frontend should store the token and send it as:
      Authorization: Bearer <token>
    """

    user = auth.authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        data={"user_id": user["id"], "email": user["email"], "role": user["role"]},
        secret_key=settings.secret_key,
        algorithm=settings.algorithm,
        expires_minutes=settings.access_token_expire_minutes,
    )
    return TokenResponse(access_token=token, token_type="bearer")


@router.get(f"{settings.api_v1_prefix}/auth/me", response_model=UserOut)
def me(user: dict[str, Any] = Depends(get_current_user), auth: AuthService = Depends(get_auth_service)) -> UserOut:
    """Return the authenticated user.

    Protected endpoint:
    - Requires Authorization Bearer token
    - Returns 401 if token is missing/invalid/expired
    """

    return UserOut(**auth.to_public_user(user))

import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

logger = logging.getLogger(__name__)
password_hasher = PasswordHash.recommended()
_development_secret = secrets.token_urlsafe(48)


def get_signing_key() -> str:
    if settings.jwt_secret_key:
        if len(settings.jwt_secret_key) < 32:
            raise RuntimeError("JWT_SECRET_KEY must contain at least 32 characters.")
        return settings.jwt_secret_key

    if settings.app_env.lower() == "production":
        raise RuntimeError("JWT_SECRET_KEY must be configured in production.")

    logger.warning("JWT_SECRET_KEY is unset; using a temporary key for this development process.")
    return _development_secret


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, get_signing_key(), algorithm="HS256")

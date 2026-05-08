import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from motor.motor_asyncio import AsyncIOMotorDatabase


JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TTL_MINUTES = 60 * 24  # 1 day


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def _extract_bearer(request: Request) -> Optional[str]:
    h = request.headers.get("Authorization", "")
    if h.lower().startswith("bearer "):
        return h[7:].strip()
    return None


def public_user(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "email": doc.get("email"),
        "name": doc.get("name"),
        "role": doc.get("role", "agent"),
        "created_at": doc.get("created_at"),
    }


class AuthDep:
    """FastAPI dependency for auth. Resolves current user from Bearer token."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_current_user(self, request: Request) -> dict:
        token = _extract_bearer(request)
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        try:
            payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") != "access":
                raise HTTPException(status_code=401, detail="Invalid token type")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await self.db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    async def require_manager(self, request: Request) -> dict:
        user = await self.get_current_user(request)
        if user.get("role") != "manager":
            raise HTTPException(status_code=403, detail="Manager role required")
        return user


async def seed_manager(db: AsyncIOMotorDatabase):
    email = os.environ.get("SEED_MANAGER_EMAIL", "manager@clarityqa.dev").strip().lower()
    password = os.environ.get("SEED_MANAGER_PASSWORD", "manager123")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing is None:
        import uuid as _uuid
        doc = {
            "id": str(_uuid.uuid4()),
            "email": email,
            "name": "Manager",
            "role": "manager",
            "password_hash": hash_password(password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
    else:
        # Keep hash in sync with .env value (idempotent for dev)
        if not verify_password(password, existing.get("password_hash", "")):
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {"password_hash": hash_password(password), "role": "manager"}},
            )

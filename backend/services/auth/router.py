"""Login prototype: email + password + role dari tabel `user` milik tim, token acak tersimpan di DB."""
import secrets
import time

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, func, select

from database import get_db
from models import User
from services.ai_matching.db_models import ClientProfile

TOKEN_TTL_SECONDS = 8 * 3600
INVALID = "Invalid email, password, or role."


class AuthToken(SQLModel, table=True):
    __tablename__ = "auth_token"

    token: str = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    expires_at: float  # detik sejak epoch (time.time())


class LoginRequest(BaseModel):
    role: str
    email: str
    password: str


router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


def public_user(user: User, session: Session) -> dict:
    data = {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
    if user.role == "client":  # nama usaha untuk header dashboard client
        profile = session.get(ClientProfile, user.id)
        data["company"] = profile.company if profile else ""
    return data


@router.post("/login")
def login(req: LoginRequest, session: Session = Depends(get_db)) -> dict:
    user = session.exec(select(User).where(func.lower(User.email) == req.email.strip().lower())).first()
    if user is None or user.role != req.role or not secrets.compare_digest(
        (user.password or "").encode(), req.password.encode()
    ):
        raise HTTPException(status_code=401, detail=INVALID)
    token = secrets.token_urlsafe(32)
    session.add(AuthToken(token=token, user_id=user.id, expires_at=time.time() + TOKEN_TTL_SECONDS))
    session.commit()
    return {"data": {"user": public_user(user, session), "access_token": token, "expires_in": TOKEN_TTL_SECONDS}}


def _bearer(authorization: str) -> str:
    scheme, _, token = authorization.partition(" ")
    return token.strip() if scheme.lower() == "bearer" else ""


def current_user(authorization: str = Header(default=""), session: Session = Depends(get_db)) -> User:
    """Dependency: user dari header `Authorization: Bearer <token>`, atau 401."""
    row = session.get(AuthToken, _bearer(authorization) or "-")
    user = session.get(User, row.user_id) if row and row.expires_at > time.time() else None
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    return user


@router.get("/me")
def me(user: User = Depends(current_user), session: Session = Depends(get_db)) -> dict:
    return {"data": public_user(user, session)}


@router.post("/logout", status_code=204)
def logout(authorization: str = Header(default=""), session: Session = Depends(get_db)) -> None:
    row = session.get(AuthToken, _bearer(authorization) or "-")
    if row:
        session.delete(row)
        session.commit()

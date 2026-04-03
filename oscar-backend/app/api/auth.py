from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.schemas.auth import (
    SignUpBody,
    LoginBody,
    TokenResponse,
    RefreshBody,
    UserResponse,
    PasswordUpdateBody,
    ForgotPasswordBody,
    ResetPasswordBody,
    MessageResponse,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    generate_reset_token,
)
from app.core.email import send_email
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: User) -> TokenResponse:
    access = create_access_token(
        sub=user.id,
        role=user.role.value,
        tenant_id=user.tenant_id,
    )
    refresh = create_refresh_token(sub=user.id)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        token_type="bearer",
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/signup", response_model=TokenResponse)
async def signup(
    body: SignUpBody,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Check email unique
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    email = body.email.lower()

    if body.role == "admin":
        if body.tenant_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Admin must not send tenant_id",
            )
        if not body.business_name or not body.business_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="business_name is required when role is admin",
            )
        tenant = Tenant(name=body.business_name.strip(), timezone="UTC")
        db.add(tenant)
        await db.flush()
        user = User(
            email=email,
            hashed_password=hash_password(body.password),
            role=UserRole.ADMIN,
            full_name=body.full_name,
            tenant_id=tenant.id,
        )
    else:
        if body.tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must provide tenant_id",
            )
        # Verify tenant exists
        result = await db.execute(select(Tenant).where(Tenant.id == body.tenant_id))
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant_id",
            )
        user = User(
            email=email,
            hashed_password=hash_password(body.password),
            role=UserRole.USER,
            full_name=body.full_name,
            tenant_id=body.tenant_id,
        )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginBody,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive",
        )
    # Admin/User with a tenant: block if tenant is deactivated
    if user.tenant_id and user.role in (UserRole.ADMIN, UserRole.USER):
        result_tenant = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
        tenant = result_tenant.scalar_one_or_none()
        if tenant and not tenant.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Business is currently deactivated, contact admins.",
            )
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshBody,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    payload = decode_refresh_token(body.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    # Admin/User with a tenant: block if tenant is deactivated
    if user.tenant_id and user.role in (UserRole.ADMIN, UserRole.USER):
        result_tenant = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
        tenant = result_tenant.scalar_one_or_none()
        if tenant and not tenant.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Business is currently deactivated, contact admins.",
            )
    return _token_response(user)


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    twilio_phone_number = None
    tenant_name = None
    default_service_id = None
    if current_user.tenant_id:
        result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant:
            twilio_phone_number = tenant.twilio_phone_number
            tenant_name = tenant.name
            default_service_id = tenant.default_service_id
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        tenant_id=current_user.tenant_id,
        is_active=current_user.is_active,
        twilio_phone_number=twilio_phone_number,
        tenant_name=tenant_name,
        default_service_id=default_service_id,
    )


@router.put("/password", response_model=MessageResponse)
async def update_password(
    body: PasswordUpdateBody,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.hashed_password = hash_password(body.new_password)
    db.add(current_user)
    await db.commit()
    return MessageResponse(message="Password updated successfully")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordBody,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    # Always return same message to avoid email enumeration
    if user is None:
        return MessageResponse(message="If that email exists, we sent a reset link.")
    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.password_reset_token_expire_minutes
    )
    db.add(user)
    await db.commit()
    reset_url = f"{settings.frontend_reset_password_url.rstrip('/')}{token}"
    subject = "Reset your password"
    body_plain = f"Use this link to reset your password (valid for {settings.password_reset_token_expire_minutes} minutes):\n{reset_url}"
    body_html = f"<p>Use this link to reset your password (valid for {settings.password_reset_token_expire_minutes} minutes):</p><p><a href=\"{reset_url}\">{reset_url}</a></p>"
    try:
        send_email(user.email, subject, body_plain, body_html)
    except Exception:
        # Clear token if email failed so user can try again
        user.reset_token = None
        user.reset_token_expires_at = None
        db.add(user)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to send email. Please try again later.",
        )
    return MessageResponse(message="If that email exists, we sent a reset link.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordBody,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(User).where(
            User.reset_token == body.token,
            User.reset_token_expires_at.isnot(None),
            User.reset_token_expires_at > datetime.now(timezone.utc),
        )
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    user.hashed_password = hash_password(body.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.add(user)
    await db.commit()
    return MessageResponse(message="Password has been reset. You can log in with your new password.")

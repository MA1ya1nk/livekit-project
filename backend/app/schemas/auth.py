from pydantic import BaseModel, EmailStr, Field, model_validator


class SignUpBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str | None = None
    role: str = Field(..., pattern="^(admin|user)$")
    # For role=user, required: which tenant they belong to
    tenant_id: int | None = None
    # For role=admin: required business name (creates tenant with this name)
    business_name: str | None = None

    @model_validator(mode="after")
    def admin_must_have_business_name(self):
        if self.role == "admin" and (not self.business_name or not self.business_name.strip()):
            raise ValueError("business_name is required when role is admin")
        return self


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expires


class RefreshBody(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str | None
    role: str
    tenant_id: int | None
    is_active: bool
    twilio_phone_number: str | None = None
    tenant_name: str | None = None
    default_service_id: int | None = None

    class Config:
        from_attributes = True


class PasswordUpdateBody(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class MessageResponse(BaseModel):
    message: str

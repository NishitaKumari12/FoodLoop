from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class FoodType(str, Enum):
    vegetarian = "vegetarian"
    non_vegetarian = "non_vegetarian"


class DonationStatus(str, Enum):
    available = "available"
    claimed = "claimed"
    completed = "completed"
    expired = "expired"


class DonationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=4000)
    quantity_meals: int = Field(gt=0, le=100000)
    food_type: FoodType
    prepared_at: datetime
    storage_instructions: str = Field(min_length=2, max_length=500)
    packaging: str = Field(min_length=2, max_length=300)
    pickup_deadline: datetime
    pickup_address: str = Field(min_length=5, max_length=300)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    image_url: str | None = Field(default=None, max_length=500)
    cooked_safely: bool
    kept_at_safe_temperature: bool
    sealed_packaging: bool
    allergens_disclosed: bool

    @field_validator("name", "description", "storage_instructions", "packaging", "pickup_address", mode="before")
    @classmethod
    def trim_text(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("prepared_at", "pickup_deadline")
    @classmethod
    def require_timezone_and_normalize(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Date and time must include a timezone.")
        return value.astimezone(timezone.utc)

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith("/uploads/"):
            raise ValueError("Image must be uploaded through FoodLoop.")
        return value

    @model_validator(mode="after")
    def validate_safety_and_times(self):
        safety_items = (
            self.cooked_safely,
            self.kept_at_safe_temperature,
            self.sealed_packaging,
            self.allergens_disclosed,
        )
        if not all(safety_items):
            raise ValueError("Every food-safety checklist item must be confirmed before publishing.")
        now = datetime.now(timezone.utc)
        if self.prepared_at > now:
            raise ValueError("Preparation time cannot be in the future.")
        if self.pickup_deadline <= now:
            raise ValueError("Pickup deadline must be in the future.")
        if self.pickup_deadline <= self.prepared_at:
            raise ValueError("Pickup deadline must be after the preparation time.")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Provide both latitude and longitude, or leave both empty.")
        return self


class DonationResponse(BaseModel):
    id: int
    donor_id: int
    donor_name: str
    claimed_by_ngo_id: int | None
    claimed_by_ngo_name: str | None
    name: str
    description: str
    quantity_meals: int
    food_type: FoodType
    prepared_at: datetime
    storage_instructions: str
    packaging: str
    pickup_deadline: datetime
    pickup_address: str | None
    latitude: float | None
    longitude: float | None
    image_url: str | None
    status: DonationStatus
    created_at: datetime
    updated_at: datetime
    claim_status: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("prepared_at", "pickup_deadline", "created_at", "updated_at", mode="after")
    @classmethod
    def serialize_utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class DonationImageResponse(BaseModel):
    image_url: str


class NGOApprovalResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_approved: bool

    model_config = ConfigDict(from_attributes=True)

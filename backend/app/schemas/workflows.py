from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VerificationGenerateResponse(BaseModel):
    donation_id: int
    qr_code_data_url: str
    token: str
    expires_at: datetime


class AuthorizePickupRequest(BaseModel):
    volunteer_id: int


class VolunteerOption(BaseModel):
    id: int
    full_name: str


class VerificationConfirmRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class VerificationConfirmResponse(BaseModel):
    donation_id: int
    status: str
    picked_up_at: datetime
    certificate_number: str


class NeedStatus(str, Enum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"
    fulfilled = "fulfilled"


class CommunityNeedCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=3000)
    requested_meals: int = Field(gt=0, le=100000)
    adults: int = Field(ge=0, le=100000)
    children: int = Field(ge=0, le=100000)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    photo_url: str | None = Field(default=None, max_length=500)

    @field_validator("photo_url")
    @classmethod
    def local_photo_only(cls, value: str | None) -> str | None:
        if value is not None and not value.startswith("/uploads/community-"):
            raise ValueError("Community photos must be uploaded through FoodLoop.")
        return value


class CommunityNeedResponse(BaseModel):
    id: int
    title: str
    description: str
    requested_meals: int
    adults: int
    children: int
    latitude: float
    longitude: float
    photo_url: str | None
    status: NeedStatus
    pledged_meals: int = 0
    reporter_name: str
    created_at: datetime
    verified_at: datetime | None


class AdminUserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    is_approved: bool

    model_config = ConfigDict(from_attributes=True)


class AdminUserStatusRequest(BaseModel):
    is_active: bool


class RatingCreate(BaseModel):
    score: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class RatingResponse(BaseModel):
    id: int
    donation_id: int
    reviewer_id: int
    reviewee_id: int
    score: int
    comment: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MealPledgeCreate(BaseModel):
    meals: int = Field(gt=0, le=100000)


class MealPledgeResponse(BaseModel):
    id: int
    need_id: int
    meals: int
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MealPledgeDetail(MealPledgeResponse):
    donor_name: str


class DistributionRequest(BaseModel):
    status: str = Field(pattern="^(distributed)$")


class SurplusPredictionRequest(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    attendance: int = Field(ge=0, le=100000)
    special_event: bool
    historical_surplus: int = Field(ge=0, le=100000)
    menu_category: str = Field(min_length=2, max_length=40)


class SurplusPredictionResponse(BaseModel):
    predicted_meals: int
    model: str
    training_data: str


class PredictionHistoryItem(BaseModel):
    id: int
    day_of_week: int
    attendance: int
    special_event: bool
    historical_surplus: int
    menu_category: str
    predicted_meals: int
    model_label: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaderboardEntry(BaseModel):
    donor_id: int
    donor_name: str
    meals_saved: int
    badge: str


class ImpactOverview(BaseModel):
    meals_saved: int
    food_waste_prevented_kg: float
    co2_avoided_kg: float
    people_fed: int
    completed_donations: int
    ngos_onboarded: int
    community_needs_fulfilled: int
    active_donations: int

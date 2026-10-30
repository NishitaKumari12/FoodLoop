from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.user import User


class Donation(Base):
    __tablename__ = "donations"
    __table_args__ = (
        CheckConstraint("quantity_meals > 0", name="positive_meal_quantity"),
        CheckConstraint("food_type IN ('vegetarian', 'non_vegetarian')", name="valid_food_type"),
        CheckConstraint(
            "status IN ('available', 'claimed', 'completed', 'expired')",
            name="valid_donation_status",
        ),
        CheckConstraint(
            "cooked_safely = 1 AND kept_at_safe_temperature = 1 "
            "AND sealed_packaging = 1 AND allergens_disclosed = 1",
            name="complete_food_safety_checklist",
        ),
        Index("ix_donations_status_deadline", "status", "pickup_deadline"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    claimed_by_ngo_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity_meals: Mapped[int] = mapped_column(Integer, nullable=False)
    food_type: Mapped[str] = mapped_column(String(24), nullable=False)
    prepared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    storage_instructions: Mapped[str] = mapped_column(String(500), nullable=False)
    packaging: Mapped[str] = mapped_column(String(300), nullable=False)
    pickup_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    pickup_address: Mapped[str] = mapped_column(String(300), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cooked_safely: Mapped[bool] = mapped_column(Boolean, nullable=False)
    kept_at_safe_temperature: Mapped[bool] = mapped_column(Boolean, nullable=False)
    sealed_packaging: Mapped[bool] = mapped_column(Boolean, nullable=False)
    allergens_disclosed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="available", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    claim: Mapped["DonationClaim | None"] = relationship(
        back_populates="donation",
        cascade="all, delete-orphan",
        uselist=False,
    )
    donor: Mapped[User] = relationship(foreign_keys=[donor_id])
    claimed_ngo: Mapped[User | None] = relationship(foreign_keys=[claimed_by_ngo_id])


class DonationClaim(Base):
    __tablename__ = "donation_claims"
    __table_args__ = (
        UniqueConstraint("donation_id", name="one_claim_per_donation"),
        CheckConstraint("status IN ('active', 'completed')", name="valid_claim_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    donation_id: Mapped[int] = mapped_column(
        ForeignKey("donations.id", ondelete="CASCADE"), nullable=False
    )
    ngo_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    authorized_volunteer_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    claimed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    verification_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    token_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    donation: Mapped[Donation] = relationship(back_populates="claim")


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    donation_id: Mapped[int] = mapped_column(
        ForeignKey("donations.id", ondelete="RESTRICT"), unique=True, nullable=False
    )
    certificate_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

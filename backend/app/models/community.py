from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CommunityNeed(Base):
    __tablename__ = "community_needs"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'verified', 'rejected', 'fulfilled')", name="valid_need_status"),
        CheckConstraint("adults >= 0 AND children >= 0", name="nonnegative_headcount"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    verified_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    requested_meals: Mapped[int] = mapped_column(Integer, nullable=False)
    pledged_meals: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    adults: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    children: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MealPledge(Base):
    __tablename__ = "meal_pledges"
    __table_args__ = (CheckConstraint("meals > 0", name="positive_pledge_meals"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    need_id: Mapped[int] = mapped_column(ForeignKey("community_needs.id", ondelete="RESTRICT"), index=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    meals: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pledged", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    distributed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SurplusPrediction(Base):
    __tablename__ = "surplus_predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    attendance: Mapped[int] = mapped_column(Integer, nullable=False)
    special_event: Mapped[bool] = mapped_column(nullable=False)
    historical_surplus: Mapped[int] = mapped_column(Integer, nullable=False)
    menu_category: Mapped[str] = mapped_column(String(40), nullable=False)
    predicted_meals: Mapped[int] = mapped_column(Integer, nullable=False)
    model_label: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

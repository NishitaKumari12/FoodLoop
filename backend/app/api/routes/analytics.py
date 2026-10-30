from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from app.api.dependencies import DatabaseSession, get_current_user
from app.models.community import CommunityNeed
from app.models.donation import Donation, DonationClaim
from app.models.user import User
from app.schemas.workflows import ImpactOverview, LeaderboardEntry

router = APIRouter(tags=["impact and leaderboard"])


@router.get("/analytics/overview", response_model=ImpactOverview)
def impact_overview(
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> ImpactOverview:
    completed_query = select(func.coalesce(func.sum(Donation.quantity_meals), 0), func.count(Donation.id)).where(
        Donation.status == "completed"
    )
    if current_user.role == "donor":
        completed_query = completed_query.where(Donation.donor_id == current_user.id)
    elif current_user.role == "ngo":
        completed_query = completed_query.where(Donation.claimed_by_ngo_id == current_user.id)
    meals_saved, completed_count = database.execute(completed_query).one()

    active_query = select(func.count(Donation.id)).where(Donation.status.in_(("available", "claimed")))
    if current_user.role == "donor":
        active_query = active_query.where(Donation.donor_id == current_user.id)
    elif current_user.role == "ngo":
        active_query = active_query.where(Donation.claimed_by_ngo_id == current_user.id)
    active_count = database.scalar(active_query) or 0
    fulfilled = database.scalar(select(func.count(CommunityNeed.id)).where(CommunityNeed.status == "fulfilled")) or 0
    approved_ngos = database.scalar(
        select(func.count(User.id)).where(User.role == "ngo", User.is_approved.is_(True))
    ) or 0
    kilograms = float(meals_saved) * 0.4
    return ImpactOverview(
        meals_saved=int(meals_saved),
        food_waste_prevented_kg=round(kilograms, 1),
        co2_avoided_kg=round(kilograms * 2.5, 1),
        people_fed=int(meals_saved),
        completed_donations=int(completed_count),
        ngos_onboarded=approved_ngos,
        community_needs_fulfilled=fulfilled,
        active_donations=active_count,
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
    period: Literal["weekly", "monthly", "yearly"] = Query(default="weekly"),
) -> list[LeaderboardEntry]:
    now = datetime.now(timezone.utc)
    period_start = {
        "weekly": now - timedelta(days=7),
        "monthly": now - timedelta(days=30),
        "yearly": now - timedelta(days=365),
    }[period].replace(tzinfo=None)
    rows = database.execute(
        select(
            User.id,
            User.full_name,
            func.sum(Donation.quantity_meals).label("meals"),
        )
        .join(Donation, Donation.donor_id == User.id)
        .join(DonationClaim, DonationClaim.donation_id == Donation.id)
        .where(
            Donation.status == "completed",
            DonationClaim.status == "completed",
            DonationClaim.picked_up_at >= period_start,
        )
        .group_by(User.id, User.full_name)
        .order_by(func.sum(Donation.quantity_meals).desc())
        .limit(20)
    ).all()
    entries = []
    for donor_id, donor_name, meals in rows:
        meals = int(meals)
        badge = "Platinum" if meals >= 2000 else "Gold" if meals >= 500 else "Silver" if meals >= 100 else "Bronze"
        entries.append(LeaderboardEntry(donor_id=donor_id, donor_name=donor_name, meals_saved=meals, badge=badge))
    return entries

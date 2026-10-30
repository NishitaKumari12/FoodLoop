from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import DatabaseSession, get_current_user
from app.models.activity import Notification, Rating
from app.models.donation import Donation
from app.models.user import User
from app.schemas.workflows import NotificationResponse, RatingCreate, RatingResponse

router = APIRouter(tags=["notifications and ratings"])


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[Notification]:
    return list(
        database.scalars(
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(Notification.created_at.desc())
            .limit(100)
        ).all()
    )


@router.put("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> Notification:
    notification = database.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    notification.is_read = True
    database.commit()
    database.refresh(notification)
    return notification


@router.post(
    "/donations/{donation_id}/ratings",
    response_model=RatingResponse,
    status_code=status.HTTP_201_CREATED,
)
def rate_completed_donation(
    donation_id: int,
    payload: RatingCreate,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> Rating:
    donation = database.get(Donation, donation_id)
    if donation is None or donation.status != "completed" or donation.claimed_by_ngo_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Completed donation not found.")
    if current_user.id == donation.donor_id:
        reviewee_id = donation.claimed_by_ngo_id
    elif current_user.id == donation.claimed_by_ngo_id:
        reviewee_id = donation.donor_id
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the donor and claiming NGO can rate a handoff.")
    rating = Rating(
        donation_id=donation.id,
        reviewer_id=current_user.id,
        reviewee_id=reviewee_id,
        score=payload.score,
        comment=payload.comment.strip() if payload.comment else None,
    )
    database.add(rating)
    try:
        database.commit()
    except IntegrityError as error:
        database.rollback()
        if "one_rating_per_reviewer" in str(error) or "UNIQUE constraint failed" in str(error):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already rated this handoff.") from None
        raise
    database.refresh(rating)
    return rating

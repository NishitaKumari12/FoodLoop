import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import DatabaseSession, get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.donation import Donation, DonationClaim
from app.models.activity import Notification
from app.models.user import User
from app.schemas.donation import (
    DonationCreate,
    DonationImageResponse,
    DonationResponse,
    DonationStatus,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/donations", tags=["donations"])

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": (".jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/png": (".png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/webp": (".webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
}


def require_role(user: User, *roles: str) -> None:
    if user.role not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This action is only available to: {', '.join(roles)}.",
        )


def utc_now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def expire_past_due_donations(database: Session) -> None:
    result = database.execute(
        update(Donation)
        .where(
            Donation.status == "available",
            Donation.pickup_deadline <= utc_now_naive(),
        )
        .values(status="expired", updated_at=utc_now_naive())
    )
    if result.rowcount:
        database.commit()


def donation_response(donation: Donation, viewer: User) -> DonationResponse:
    donor = donation.donor
    claimed_ngo = donation.claimed_ngo
    can_view_address = (
        viewer.role == "admin"
        or donation.donor_id == viewer.id
        or (
            viewer.role == "ngo"
            and viewer.is_approved
            and donation.status == "available"
        )
        or donation.claimed_by_ngo_id == viewer.id
    )
    can_view_precise_location = can_view_address or (
        viewer.role == "ngo" and viewer.is_approved and donation.status == "available"
    )
    return DonationResponse(
        id=donation.id,
        donor_id=donation.donor_id,
        donor_name=donor.full_name,
        claimed_by_ngo_id=donation.claimed_by_ngo_id,
        claimed_by_ngo_name=claimed_ngo.full_name if claimed_ngo else None,
        name=donation.name,
        description=donation.description,
        quantity_meals=donation.quantity_meals,
        food_type=donation.food_type,
        prepared_at=donation.prepared_at,
        storage_instructions=donation.storage_instructions,
        packaging=donation.packaging,
        pickup_deadline=donation.pickup_deadline,
        pickup_address=donation.pickup_address if can_view_address else None,
        latitude=(
            donation.latitude
            if can_view_precise_location
            else round(donation.latitude, 2) if donation.latitude is not None else None
        ),
        longitude=(
            donation.longitude
            if can_view_precise_location
            else round(donation.longitude, 2) if donation.longitude is not None else None
        ),
        image_url=donation.image_url,
        status=donation.status,
        created_at=donation.created_at,
        updated_at=donation.updated_at,
        claim_status=donation.claim.status if donation.claim else None,
    )


def load_donation(database: Session, donation_id: int) -> Donation:
    donation = database.scalar(
        select(Donation)
        .options(
            selectinload(Donation.claim),
            selectinload(Donation.donor),
            selectinload(Donation.claimed_ngo),
        )
        .where(Donation.id == donation_id)
    )
    if donation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found.")
    return donation


@router.post("/images", response_model=DonationImageResponse, status_code=status.HTTP_201_CREATED)
async def upload_donation_image(
    current_user: Annotated[User, Depends(get_current_user)],
    image: Annotated[UploadFile, File()],
) -> DonationImageResponse:
    require_role(current_user, "donor")
    file_type = ALLOWED_IMAGE_TYPES.get(image.content_type or "")
    if file_type is None:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a JPEG, PNG, or WebP image.")

    content = await image.read(settings.max_upload_size_bytes + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded image is empty.")
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image must be 5 MB or smaller.")
    extension, signature_check = file_type
    if not signature_check(content):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="The image content does not match its file type.")

    filename = f"{uuid.uuid4().hex}{extension}"
    destination = settings.uploads_root / filename
    try:
        settings.uploads_root.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    except OSError:
        logger.exception("Could not save an uploaded donation image.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="The image could not be saved.") from None
    finally:
        await image.close()

    return DonationImageResponse(image_url=f"/uploads/{filename}")


@router.post("", response_model=DonationResponse, status_code=status.HTTP_201_CREATED)
def create_donation(
    payload: DonationCreate,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> DonationResponse:
    require_role(current_user, "donor")
    donation = Donation(
        donor_id=current_user.id,
        name=payload.name,
        description=payload.description,
        quantity_meals=payload.quantity_meals,
        food_type=payload.food_type.value,
        prepared_at=payload.prepared_at.replace(tzinfo=None),
        storage_instructions=payload.storage_instructions,
        packaging=payload.packaging,
        pickup_deadline=payload.pickup_deadline.replace(tzinfo=None),
        pickup_address=payload.pickup_address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        image_url=payload.image_url,
        cooked_safely=payload.cooked_safely,
        kept_at_safe_temperature=payload.kept_at_safe_temperature,
        sealed_packaging=payload.sealed_packaging,
        allergens_disclosed=payload.allergens_disclosed,
    )
    database.add(donation)
    database.commit()
    return donation_response(load_donation(database, donation.id), current_user)


@router.get("", response_model=list[DonationResponse])
def list_donations(
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
    requested_status: Annotated[DonationStatus | None, Query(alias="status")] = None,
    food_type: Annotated[str | None, Query(pattern="^(vegetarian|non_vegetarian)$")] = None,
) -> list[DonationResponse]:
    expire_past_due_donations(database)
    query = select(Donation).options(
        selectinload(Donation.claim),
        selectinload(Donation.donor),
        selectinload(Donation.claimed_ngo),
    )

    if current_user.role == "donor":
        query = query.where(Donation.donor_id == current_user.id)
    elif current_user.role == "admin":
        pass
    elif current_user.role == "ngo":
        query = query.where(
            or_(
                Donation.status == "available",
                Donation.claimed_by_ngo_id == current_user.id,
            )
        )
    else:
        query = query.where(Donation.status == "available")

    if requested_status is not None:
        query = query.where(Donation.status == requested_status.value)
    if food_type is not None:
        query = query.where(Donation.food_type == food_type)

    donations = database.scalars(query.order_by(Donation.pickup_deadline.asc())).all()
    return [donation_response(donation, current_user) for donation in donations]


@router.get("/{donation_id}", response_model=DonationResponse)
def read_donation(
    donation_id: int,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> DonationResponse:
    expire_past_due_donations(database)
    donation = load_donation(database, donation_id)
    if current_user.role == "donor" and donation.donor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found.")
    if (
        donation.status != "available"
        and donation.donor_id != current_user.id
        and donation.claimed_by_ngo_id != current_user.id
        and current_user.role != "admin"
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found.")
    return donation_response(donation, current_user)


@router.put("/{donation_id}", response_model=DonationResponse)
def update_donation(
    donation_id: int,
    payload: DonationCreate,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> DonationResponse:
    require_role(current_user, "donor")
    donation = load_donation(database, donation_id)
    if donation.donor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found.")
    if donation.status != "available":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only available donations can be edited.")

    for field in (
        "name",
        "description",
        "quantity_meals",
        "storage_instructions",
        "packaging",
        "pickup_address",
        "latitude",
        "longitude",
        "image_url",
        "cooked_safely",
        "kept_at_safe_temperature",
        "sealed_packaging",
        "allergens_disclosed",
    ):
        setattr(donation, field, getattr(payload, field))
    donation.food_type = payload.food_type.value
    donation.prepared_at = payload.prepared_at.replace(tzinfo=None)
    donation.pickup_deadline = payload.pickup_deadline.replace(tzinfo=None)
    donation.updated_at = utc_now_naive()
    database.commit()
    return donation_response(load_donation(database, donation.id), current_user)


@router.delete("/{donation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_donation(
    donation_id: int,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    require_role(current_user, "donor")
    donation = database.get(Donation, donation_id)
    if donation is None or donation.donor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found.")
    if donation.status != "available":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only available donations can be removed.")
    database.delete(donation)
    database.commit()


@router.post("/{donation_id}/claim", response_model=DonationResponse)
def claim_donation(
    donation_id: int,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> DonationResponse:
    require_role(current_user, "ngo")
    if not current_user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your NGO account must be approved before claiming donations.",
        )

    now = utc_now_naive()
    result = database.execute(
        update(Donation)
        .where(
            Donation.id == donation_id,
            Donation.status == "available",
            Donation.pickup_deadline > now,
        )
        .values(
            status="claimed",
            claimed_by_ngo_id=current_user.id,
            updated_at=now,
        )
    )
    if result.rowcount != 1:
        database.rollback()
        donation = database.get(Donation, donation_id)
        if donation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found.")
        if donation.pickup_deadline <= now and donation.status == "available":
            donation.status = "expired"
            database.commit()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This donation has expired.")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This donation is no longer available to claim.",
        )

    database.add(DonationClaim(donation_id=donation_id, ngo_id=current_user.id))
    donation = database.get(Donation, donation_id)
    if donation is not None:
        database.add(
            Notification(
                user_id=donation.donor_id,
                title="Your food has been claimed",
                message=f"{current_user.full_name} claimed your donation: {donation.name}.",
            )
        )
    try:
        database.commit()
    except IntegrityError:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another NGO has already claimed this donation.",
        ) from None
    return donation_response(load_donation(database, donation_id), current_user)

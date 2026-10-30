import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select, update

from app.api.dependencies import DatabaseSession, get_current_user
from app.api.routes.donations import ALLOWED_IMAGE_TYPES, require_role, utc_now_naive
from app.core.config import settings
from app.models.community import CommunityNeed, MealPledge
from app.models.user import User
from app.schemas.workflows import (
    CommunityNeedCreate,
    CommunityNeedResponse,
    DistributionRequest,
    MealPledgeCreate,
    MealPledgeDetail,
    MealPledgeResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/community", tags=["community needs"])


def build_response(database, need: CommunityNeed, *, private: bool = False) -> CommunityNeedResponse:
    reporter = database.get(User, need.reporter_id)
    return CommunityNeedResponse(
        id=need.id,
        title=need.title,
        description=need.description,
        requested_meals=need.requested_meals,
        adults=need.adults,
        children=need.children,
        latitude=need.latitude if private else round(need.latitude, 2),
        longitude=need.longitude if private else round(need.longitude, 2),
        photo_url=need.photo_url,
        status=need.status,
        pledged_meals=need.pledged_meals,
        reporter_name=reporter.full_name if private and reporter else "Verified community partner",
        created_at=need.created_at,
        verified_at=need.verified_at,
    )


@router.post("/images", status_code=status.HTTP_201_CREATED)
async def upload_community_photo(
    current_user: Annotated[User, Depends(get_current_user)],
    image: Annotated[UploadFile, File()],
) -> dict[str, str]:
    if current_user.role == "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin accounts cannot submit community photos.")
    file_type = ALLOWED_IMAGE_TYPES.get(image.content_type or "")
    if file_type is None:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Upload a JPEG, PNG, or WebP image.")
    content = await image.read(settings.max_upload_size_bytes + 1)
    await image.close()
    if not content or len(content) > settings.max_upload_size_bytes or not file_type[1](content):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image is empty, too large, or invalid.")
    filename = f"community-{uuid.uuid4().hex}{file_type[0]}"
    try:
        settings.uploads_root.mkdir(parents=True, exist_ok=True)
        (settings.uploads_root / filename).write_bytes(content)
    except OSError:
        logger.exception("Could not save a community report image.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="The image could not be saved.") from None
    return {"photo_url": f"/uploads/{filename}"}


@router.post("/reports", response_model=CommunityNeedResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: CommunityNeedCreate,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> CommunityNeedResponse:
    need = CommunityNeed(
        reporter_id=current_user.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        requested_meals=payload.requested_meals,
        adults=payload.adults,
        children=payload.children,
        latitude=payload.latitude,
        longitude=payload.longitude,
        photo_url=payload.photo_url,
    )
    database.add(need)
    database.commit()
    database.refresh(need)
    return build_response(database, need)


@router.get("/verified", response_model=list[CommunityNeedResponse])
def list_verified_reports(
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> list[CommunityNeedResponse]:
    query = select(CommunityNeed).where(CommunityNeed.status.in_(("verified", "fulfilled")))
    if current_user.role == "ngo" and current_user.is_approved:
        query = select(CommunityNeed)
    elif current_user.role != "donor" and current_user.role != "ngo":
        query = query.where(CommunityNeed.reporter_id == current_user.id)
    return [build_response(database, need, private=current_user.role == "ngo" and current_user.is_approved) for need in database.scalars(query.order_by(CommunityNeed.created_at.desc())).all()]


@router.get("/reports/mine", response_model=list[CommunityNeedResponse])
def list_my_reports(
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> list[CommunityNeedResponse]:
    needs = database.scalars(
        select(CommunityNeed).where(CommunityNeed.reporter_id == current_user.id).order_by(CommunityNeed.created_at.desc())
    ).all()
    return [build_response(database, need, private=True) for need in needs]


@router.put("/reports/{need_id}/verify", response_model=CommunityNeedResponse)
def verify_report(
    need_id: int,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> CommunityNeedResponse:
    require_role(current_user, "ngo")
    if not current_user.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approved NGOs can verify community needs.")
    need = database.get(CommunityNeed, need_id)
    if need is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community report not found.")
    if need.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pending reports can be verified.")
    need.status = "verified"
    need.verified_by_id = current_user.id
    need.verified_at = utc_now_naive()
    database.commit()
    database.refresh(need)
    return build_response(database, need, private=True)


@router.post("/reports/{need_id}/pledge", response_model=MealPledgeResponse, status_code=status.HTTP_201_CREATED)
def pledge_meals(
    need_id: int,
    payload: MealPledgeCreate,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> MealPledge:
    require_role(current_user, "donor")
    result = database.execute(
        update(CommunityNeed)
        .where(
            CommunityNeed.id == need_id,
            CommunityNeed.status == "verified",
            CommunityNeed.pledged_meals + payload.meals <= CommunityNeed.requested_meals,
        )
        .values(pledged_meals=CommunityNeed.pledged_meals + payload.meals)
    )
    if result.rowcount != 1:
        database.rollback()
        need = database.get(CommunityNeed, need_id)
        if need is None or need.status not in ("verified", "fulfilled"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verified community need not found.")
        if need.verified_by_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the NGO verifying this report can manage its pledges.")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This pledge exceeds the remaining meal requirement.")
    pledge = MealPledge(need_id=need_id, donor_id=current_user.id, meals=payload.meals)
    database.add(pledge)
    database.commit()
    database.refresh(pledge)
    return pledge


@router.get("/reports/{need_id}/pledges", response_model=list[MealPledgeDetail])
def list_need_pledges(
    need_id: int,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> list[MealPledgeDetail]:
    require_role(current_user, "ngo")
    if not current_user.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approved NGOs can coordinate meal distribution.")
    need = database.get(CommunityNeed, need_id)
    if need is None or need.status not in ("verified", "fulfilled"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verified community need not found.")
    pledges = database.scalars(
        select(MealPledge).where(MealPledge.need_id == need_id).order_by(MealPledge.created_at.asc())
    ).all()
    return [
        MealPledgeDetail(
            id=pledge.id,
            need_id=pledge.need_id,
            meals=pledge.meals,
            status=pledge.status,
            created_at=pledge.created_at,
            donor_name=(database.get(User, pledge.donor_id).full_name if database.get(User, pledge.donor_id) else "Food donor"),
        )
        for pledge in pledges
    ]


@router.put("/pledges/{pledge_id}/distribution", response_model=MealPledgeResponse)
def confirm_distribution(
    pledge_id: int,
    payload: DistributionRequest,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> MealPledge:
    require_role(current_user, "ngo")
    if not current_user.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approved NGOs can confirm distribution.")
    pledge = database.get(MealPledge, pledge_id)
    if pledge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meal pledge not found.")
    if pledge.status == "distributed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This pledge is already marked distributed.")
    need = database.get(CommunityNeed, pledge.need_id)
    if need is None or need.verified_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the NGO verifying this report can confirm its distribution.")
    pledge.status = payload.status
    pledge.distributed_at = utc_now_naive()
    pending_count = database.scalar(
        select(func.count(MealPledge.id)).where(
            MealPledge.need_id == pledge.need_id,
            MealPledge.status != "distributed",
        )
    )
    if need and pending_count == 0 and need.pledged_meals >= need.requested_meals:
        need.status = "fulfilled"
    database.commit()
    database.refresh(pledge)
    return pledge

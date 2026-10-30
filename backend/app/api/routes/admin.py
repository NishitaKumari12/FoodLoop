from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.api.dependencies import DatabaseSession, get_current_user
from app.models.user import User
from app.models.community import CommunityNeed
from app.schemas.donation import NGOApprovalResponse
from app.schemas.workflows import AdminUserResponse, AdminUserStatusRequest, CommunityNeedResponse

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required.")


@router.get("/ngos", response_model=list[NGOApprovalResponse])
def list_ngo_applications(
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
    pending_only: bool = True,
) -> list[User]:
    require_admin(current_user)
    query = select(User).where(User.role == "ngo")
    if pending_only:
        query = query.where(User.is_approved.is_(False), User.is_active.is_(True))
    return list(database.scalars(query.order_by(User.created_at.asc())).all())


@router.put("/ngos/{ngo_id}/approve", response_model=NGOApprovalResponse)
def approve_ngo(
    ngo_id: int,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    require_admin(current_user)
    ngo = database.get(User, ngo_id)
    if ngo is None or ngo.role != "ngo":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NGO account not found.")
    ngo.is_approved = True
    database.commit()
    database.refresh(ngo)
    return ngo


@router.put("/ngos/{ngo_id}/reject", response_model=NGOApprovalResponse)
def reject_ngo(
    ngo_id: int,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    require_admin(current_user)
    ngo = database.get(User, ngo_id)
    if ngo is None or ngo.role != "ngo":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="NGO account not found.")
    ngo.is_approved = False
    ngo.is_active = False
    database.commit()
    database.refresh(ngo)
    return ngo


@router.get("/users", response_model=list[AdminUserResponse])
def list_users(
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=100, ge=1, le=500),
) -> list[User]:
    require_admin(current_user)
    return list(database.scalars(select(User).order_by(User.created_at.desc()).limit(limit)).all())


@router.put("/users/{user_id}/status", response_model=AdminUserResponse)
def set_user_status(
    user_id: int,
    payload: AdminUserStatusRequest,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    require_admin(current_user)
    user = database.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.id == current_user.id and not payload.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You cannot deactivate your own account.")
    user.is_active = payload.is_active
    database.commit()
    database.refresh(user)
    return user


@router.get("/community/reports", response_model=list[CommunityNeedResponse])
def list_community_reports(
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
    pending_only: bool = True,
) -> list[CommunityNeedResponse]:
    require_admin(current_user)
    query = select(CommunityNeed)
    if pending_only:
        query = query.where(CommunityNeed.status == "pending")
    reports = database.scalars(query.order_by(CommunityNeed.created_at.desc()).limit(200)).all()
    results = []
    for report in reports:
        reporter = database.get(User, report.reporter_id)
        results.append(
            CommunityNeedResponse(
                id=report.id,
                title=report.title,
                description=report.description,
                requested_meals=report.requested_meals,
                adults=report.adults,
                children=report.children,
                latitude=report.latitude,
                longitude=report.longitude,
                photo_url=report.photo_url,
                status=report.status,
                pledged_meals=report.pledged_meals,
                reporter_name=reporter.full_name if reporter else "Community partner",
                created_at=report.created_at,
                verified_at=report.verified_at,
            )
        )
    return results


@router.put("/community/reports/{report_id}/reject")
def reject_community_report(
    report_id: int,
    database: DatabaseSession,
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict[str, int | str]:
    require_admin(current_user)
    report = database.get(CommunityNeed, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community report not found.")
    if report.status != "pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pending reports can be rejected.")
    report.status = "rejected"
    database.commit()
    return {"id": report.id, "status": report.status}

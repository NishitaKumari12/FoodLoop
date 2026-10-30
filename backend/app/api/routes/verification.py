import base64
import hashlib
import io
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.api.dependencies import DatabaseSession, get_current_user
from app.api.routes.donations import require_role, utc_now_naive
from app.models.donation import Certificate, Donation, DonationClaim
from app.models.activity import Notification
from app.models.user import User
from app.schemas.workflows import (
    AuthorizePickupRequest,
    VerificationConfirmRequest,
    VerificationConfirmResponse,
    VerificationGenerateResponse,
    VolunteerOption,
)

router = APIRouter(prefix="/verification", tags=["pickup verification"])


@router.get("/volunteers", response_model=list[VolunteerOption])
def list_active_volunteers(
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> list[User]:
    require_role(current_user, "ngo")
    if not current_user.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only approved NGOs can coordinate pickups.")
    return list(
        database.scalars(
            select(User)
            .where(User.role == "volunteer", User.is_active.is_(True))
            .order_by(User.full_name.asc())
        ).all()
    )


@router.post("/generate/{donation_id}", response_model=VerificationGenerateResponse)
def generate_pickup_qr(
    donation_id: int,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> VerificationGenerateResponse:
    require_role(current_user, "ngo")
    donation = database.scalar(
        select(Donation)
        .options(selectinload(Donation.claim))
        .where(Donation.id == donation_id)
    )
    if donation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Donation not found.")
    claim = donation.claim
    if claim is None or claim.ngo_id != current_user.id or claim.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the claiming NGO can generate the pickup QR.")
    now = datetime.now(timezone.utc)
    deadline = donation.pickup_deadline.replace(tzinfo=timezone.utc) if donation.pickup_deadline.tzinfo is None else donation.pickup_deadline
    if deadline <= now:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The pickup deadline has passed.")
    if claim.token_used:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This pickup has already been verified.")

    token = secrets.token_urlsafe(32)
    expires_at = min(deadline, now.replace(microsecond=0) + timedelta(minutes=30))
    claim.verification_token_hash = hashlib.sha256(token.encode()).hexdigest()
    claim.token_expires_at = expires_at.replace(tzinfo=None)
    database.commit()

    qr_image = qrcode.make(token)
    buffer = io.BytesIO()
    qr_image.save(buffer, format="PNG")
    qr_data = base64.b64encode(buffer.getvalue()).decode("ascii")
    return VerificationGenerateResponse(
        donation_id=donation_id,
        qr_code_data_url=f"data:image/png;base64,{qr_data}",
        token=token,
        expires_at=expires_at,
    )


@router.put("/authorize/{donation_id}")
def authorize_volunteer(
    donation_id: int,
    payload: AuthorizePickupRequest,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> dict[str, int | str]:
    require_role(current_user, "ngo")
    claim = database.scalar(
        select(DonationClaim).where(
            DonationClaim.donation_id == donation_id,
            DonationClaim.ngo_id == current_user.id,
            DonationClaim.status == "active",
        )
    )
    if claim is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active claim not found.")
    volunteer = database.get(User, payload.volunteer_id)
    if volunteer is None or volunteer.role != "volunteer" or not volunteer.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active volunteer account not found.")
    claim.authorized_volunteer_id = volunteer.id
    database.commit()
    return {"donation_id": donation_id, "authorized_volunteer_id": volunteer.id, "status": "authorized"}


@router.post("/confirm", response_model=VerificationConfirmResponse)
def confirm_pickup(
    payload: VerificationConfirmRequest,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> VerificationConfirmResponse:
    require_role(current_user, "ngo", "volunteer")
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    claim = database.scalar(
        select(DonationClaim)
        .where(DonationClaim.verification_token_hash == token_hash)
    )
    if claim is None or (
        claim.ngo_id != current_user.id
        and claim.authorized_volunteer_id != current_user.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup token is invalid.")
    now = utc_now_naive()
    expiry = claim.token_expires_at
    if claim.token_used or claim.status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pickup token has already been used.")
    if expiry is None or expiry <= now:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Pickup token has expired. Generate a new QR.")

    claim_update = database.execute(
        update(DonationClaim)
        .where(
            DonationClaim.id == claim.id,
            DonationClaim.status == "active",
            DonationClaim.token_used.is_(False),
            DonationClaim.token_expires_at > now,
            DonationClaim.verification_token_hash == token_hash,
        )
        .values(token_used=True, picked_up_at=now, status="completed")
    )
    if claim_update.rowcount != 1:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pickup token has already been used.")
    donation = database.scalar(
        select(Donation).where(Donation.id == claim.donation_id, Donation.status == "claimed")
    )
    if donation is None:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Donation is not in a claimable state.")
    donation.status = "completed"
    donation.updated_at = now
    certificate = database.scalar(select(Certificate).where(Certificate.donation_id == donation.id))
    if certificate is None:
        certificate = Certificate(
            donation_id=donation.id,
            certificate_number=f"FL-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:8].upper()}",
        )
        database.add(certificate)
    database.add(
        Notification(
            user_id=donation.donor_id,
            title="Pickup verified",
            message=f"The pickup for {donation.name} has been confirmed. Your donation certificate is ready.",
        )
    )
    database.commit()
    database.refresh(certificate)
    return VerificationConfirmResponse(
        donation_id=donation.id,
        status=donation.status,
        picked_up_at=datetime.now(timezone.utc),
        certificate_number=certificate.certificate_number,
    )


@router.get("/certificates/{donation_id}")
def download_certificate(
    donation_id: int,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    donation = database.scalar(
        select(Donation)
        .options(selectinload(Donation.donor), selectinload(Donation.claimed_ngo), selectinload(Donation.claim))
        .where(Donation.id == donation_id)
    )
    if donation is None or donation.status != "completed" or donation.claim is None or donation.claim.picked_up_at is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verified donation certificate not found.")
    if current_user.id not in (donation.donor_id, donation.claimed_by_ngo_id) and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not authorized to download this certificate.")

    certificate = database.scalar(select(Certificate).where(Certificate.donation_id == donation_id))
    if certificate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate record not found.")
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    pdf.setFillColorRGB(0.09, 0.30, 0.22)
    pdf.rect(0, height - 145, width, 145, fill=1, stroke=0)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("Helvetica-Bold", 26)
    pdf.drawString(55, height - 75, "FoodLoop")
    pdf.setFont("Helvetica", 13)
    pdf.drawString(55, height - 102, "Verified Food Donation Certificate")
    pdf.setFillColorRGB(0.09, 0.30, 0.22)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(55, height - 205, "Thank you for making good food go further.")
    pdf.setFillColorRGB(0.2, 0.24, 0.22)
    pdf.setFont("Helvetica", 12)
    details = [
        f"Certificate: {certificate.certificate_number}",
        f"Donation: {donation.name}",
        f"Meals redistributed: {donation.quantity_meals}",
        f"Donor: {donation.donor.full_name}",
        f"Community partner: {donation.claimed_ngo.full_name if donation.claimed_ngo else 'FoodLoop NGO'}",
        f"Verified pickup: {donation.claim.picked_up_at:%Y-%m-%d %H:%M} UTC",
        f"Estimated food waste prevented: {donation.quantity_meals * 0.4:.1f} kg (demo estimate)",
    ]
    y = height - 255
    for line in details:
        pdf.drawString(58, y, line)
        y -= 30
    pdf.setFillColorRGB(0.45, 0.49, 0.46)
    pdf.setFont("Helvetica-Oblique", 9)
    pdf.drawString(58, 65, "Generated by FoodLoop after a one-time verified pickup confirmation.")
    pdf.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{certificate.certificate_number}.pdf"'},
    )

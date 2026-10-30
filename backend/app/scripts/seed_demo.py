from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.community import CommunityNeed
from app.models.donation import Donation
from app.models.user import User

DEMO_PASSWORD = "FoodLoopDemo2026!"
DEMO_USERS = (
    ("Demo Donor", "donor@foodloop.demo", "donor", False),
    ("Hope Community Kitchen", "ngo@foodloop.demo", "ngo", True),
    ("City Food Volunteers", "volunteer@foodloop.demo", "volunteer", False),
    ("FoodLoop Administrator", "admin@foodloop.demo", "admin", True),
)


def main() -> None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with SessionLocal() as database:
        users: dict[str, User] = {}
        for name, email, role, approved in DEMO_USERS:
            user = database.scalar(select(User).where(User.email == email))
            if user is None:
                user = User(
                    full_name=name,
                    email=email,
                    hashed_password=hash_password(DEMO_PASSWORD),
                    role=role,
                    is_approved=approved,
                )
                database.add(user)
                database.flush()
            elif approved and role == "ngo":
                user.is_approved = True
            users[role] = user
        database.flush()
        donor = users["donor"]

        sample_donations = (
            {
                "name": "Vegetable pulao meal boxes",
                "description": "Fresh vegetable pulao with seasonal vegetables. Contains rice and mixed spices; packed in sealed food-safe meal boxes.",
                "quantity_meals": 32,
                "food_type": "vegetarian",
                "prepared_at": now - timedelta(minutes=20),
                "storage_instructions": "Keep warm and distribute promptly.",
                "packaging": "Sealed single-serving food-safe boxes.",
                "pickup_deadline": now + timedelta(hours=2),
                "pickup_address": "Demo Kitchen, 12 Green Street, Bengaluru",
                "latitude": 12.9716,
                "longitude": 77.5946,
            },
            {
                "name": "Fresh bakery bread and rolls",
                "description": "Assorted fresh bread rolls and whole-wheat loaves from today's service. Packed separately; contains wheat/gluten.",
                "quantity_meals": 18,
                "food_type": "vegetarian",
                "prepared_at": now - timedelta(minutes=35),
                "storage_instructions": "Keep dry in the sealed bags.",
                "packaging": "Sealed paper food bags inside a clean crate.",
                "pickup_deadline": now + timedelta(hours=3),
                "pickup_address": "Demo Cafe, 4 Market Road, Bengaluru",
                "latitude": 12.9762,
                "longitude": 77.6013,
            },
        )
        for values in sample_donations:
            exists = database.scalar(
                select(Donation).where(
                    Donation.donor_id == donor.id,
                    Donation.name == values["name"],
                )
            )
            if exists is None:
                database.add(
                    Donation(
                        donor_id=donor.id,
                        cooked_safely=True,
                        kept_at_safe_temperature=True,
                        sealed_packaging=True,
                        allergens_disclosed=True,
                        **values,
                    )
                )

        verified_need = database.scalar(
            select(CommunityNeed).where(CommunityNeed.title == "Demo neighborhood meal support")
        )
        if verified_need is None:
            database.add(
                CommunityNeed(
                    reporter_id=users["volunteer"].id,
                    verified_by_id=users["ngo"].id,
                    title="Demo neighborhood meal support",
                    description="A demo community request for prepared vegetarian meals. This report uses synthetic sample data.",
                    requested_meals=40,
                    adults=24,
                    children=16,
                    latitude=12.9688,
                    longitude=77.5895,
                    status="verified",
                    verified_at=now,
                )
            )
        pending_need = database.scalar(
            select(CommunityNeed).where(CommunityNeed.title == "Demo report awaiting NGO review")
        )
        if pending_need is None:
            database.add(
                CommunityNeed(
                    reporter_id=users["volunteer"].id,
                    title="Demo report awaiting NGO review",
                    description="Synthetic sample report. An NGO must review this before donors can see it.",
                    requested_meals=20,
                    adults=12,
                    children=8,
                    latitude=12.9790,
                    longitude=77.6080,
                    status="pending",
                )
            )
        database.commit()

    print("FoodLoop demo data is ready (safe to run again).")
    print(f"Demo login password: {DEMO_PASSWORD}")
    for _, email, role, _ in DEMO_USERS:
        print(f"{role}: {email}")


if __name__ == "__main__":
    main()

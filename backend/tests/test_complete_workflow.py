from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User


@pytest.fixture
def client(tmp_path):
    database_path = tmp_path / "test-foodloop.db"
    test_engine = create_engine(
        f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=test_engine)
    test_sessions = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)

    def override_get_db():
        database = test_sessions()
        try:
            yield database
        finally:
            database.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, test_sessions
    app.dependency_overrides.clear()
    test_engine.dispose()


def register(client: TestClient, label: str, role: str) -> tuple[dict, str]:
    email = f"{label}-{datetime.now(timezone.utc).timestamp()}@example.org"
    response = client.post(
        "/api/auth/register",
        json={
            "full_name": label.title(),
            "email": email,
            "password": "FoodLoopTest2026!",
            "role": role,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["user"], response.json()["access_token"]


def test_donation_qr_community_ml_and_impact_workflows(client):
    api, sessions = client
    donor, donor_token = register(api, "donor", "donor")
    ngo, ngo_token = register(api, "ngo", "ngo")
    volunteer, volunteer_token = register(api, "volunteer", "volunteer")
    headers = lambda token: {"Authorization": f"Bearer {token}"}

    with sessions() as database:
        admin = User(
            full_name="Test Administrator",
            email="admin-test@example.org",
            hashed_password=hash_password("FoodLoopTest2026!"),
            role="admin",
            is_approved=True,
        )
        database.add(admin)
        database.commit()
        admin_id = admin.id
    admin_login = api.post(
        "/api/auth/login",
        json={"email": "admin-test@example.org", "password": "FoodLoopTest2026!"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = headers(admin_token)

    donation_payload = {
        "name": "Fresh demo meal trays",
        "description": "Vegetable rice trays with disclosed ingredients and sealed packaging.",
        "quantity_meals": 25,
        "food_type": "vegetarian",
        "prepared_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
        "storage_instructions": "Keep warm and distribute promptly.",
        "packaging": "Sealed food-safe trays.",
        "pickup_deadline": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "pickup_address": "12 Test Street, Bengaluru",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "cooked_safely": True,
        "kept_at_safe_temperature": True,
        "sealed_packaging": True,
        "allergens_disclosed": True,
    }
    bad_checklist = {**donation_payload, "cooked_safely": False}
    assert api.post("/api/donations", json=bad_checklist, headers=headers(donor_token)).status_code == 422
    created = api.post("/api/donations", json=donation_payload, headers=headers(donor_token))
    assert created.status_code == 201, created.text
    donation = created.json()
    donation_id = donation["id"]
    assert donation["status"] == "available"

    assert api.post(f"/api/donations/{donation_id}/claim", headers=headers(ngo_token)).status_code == 403
    assert api.put(f"/api/admin/ngos/{ngo['id']}/approve", headers=admin_headers).status_code == 200
    claimed_response = api.post(f"/api/donations/{donation_id}/claim", headers=headers(ngo_token))
    assert claimed_response.status_code == 200, claimed_response.text
    assert claimed_response.json()["status"] == "claimed"

    available_payload = {**donation_payload, "name": "Second available demo meal trays"}
    available = api.post("/api/donations", json=available_payload, headers=headers(donor_token))
    assert available.status_code == 201, available.text
    volunteer_list = api.get("/api/donations", headers=headers(volunteer_token)).json()
    volunteer_donation = next(item for item in volunteer_list if item["id"] == available.json()["id"])
    assert volunteer_donation["pickup_address"] is None
    assert volunteer_donation["latitude"] == round(donation_payload["latitude"], 2)

    qr_response = api.post(f"/api/verification/generate/{donation_id}", headers=headers(ngo_token))
    assert qr_response.status_code == 200, qr_response.text
    token = qr_response.json()["token"]
    assert qr_response.json()["qr_code_data_url"].startswith("data:image/png;base64,")
    assert api.put(
        f"/api/verification/authorize/{donation_id}",
        json={"volunteer_id": volunteer["id"]},
        headers=headers(ngo_token),
    ).status_code == 200
    confirmation = api.post(
        "/api/verification/confirm",
        json={"token": token},
        headers=headers(volunteer_token),
    )
    assert confirmation.status_code == 200, confirmation.text
    assert confirmation.json()["status"] == "completed"
    assert api.post(
        "/api/verification/confirm",
        json={"token": token},
        headers=headers(volunteer_token),
    ).status_code == 409
    certificate = api.get(
        f"/api/verification/certificates/{donation_id}",
        headers=headers(donor_token),
    )
    assert certificate.status_code == 200
    assert certificate.headers["content-type"] == "application/pdf"
    assert certificate.content.startswith(b"%PDF")

    report_response = api.post(
        "/api/community/reports",
        json={
            "title": "Verified workflow test need",
            "description": "A test need report with no personal identifying details.",
            "requested_meals": 10,
            "adults": 6,
            "children": 4,
            "latitude": 12.9688,
            "longitude": 77.5895,
        },
        headers=headers(volunteer_token),
    )
    assert report_response.status_code == 201, report_response.text
    need_id = report_response.json()["id"]
    assert all(item["id"] != need_id for item in api.get("/api/community/verified", headers=headers(donor_token)).json())
    verified = api.put(f"/api/community/reports/{need_id}/verify", headers=headers(ngo_token))
    assert verified.status_code == 200, verified.text
    pledge = api.post(
        f"/api/community/reports/{need_id}/pledge",
        json={"meals": 10},
        headers=headers(donor_token),
    )
    assert pledge.status_code == 201, pledge.text
    assert api.put(
        f"/api/community/pledges/{pledge.json()['id']}/distribution",
        json={"status": "distributed"},
        headers=headers(ngo_token),
    ).status_code == 200

    prediction = api.post(
        "/api/ml/predict",
        json={
            "day_of_week": 2,
            "attendance": 250,
            "special_event": False,
            "historical_surplus": 20,
            "menu_category": "rice",
        },
        headers=headers(donor_token),
    )
    assert prediction.status_code == 200, prediction.text
    assert prediction.json()["predicted_meals"] >= 0
    assert "synthetic" in prediction.json()["training_data"].lower()
    assert len(api.get("/api/ml/history", headers=headers(donor_token)).json()) == 1
    impact = api.get("/api/analytics/overview", headers=admin_headers)
    assert impact.status_code == 200, impact.text
    assert impact.json()["meals_saved"] >= 25
    assert api.get("/api/leaderboard?period=weekly", headers=admin_headers).status_code == 200

    with sessions() as database:
        database.query(User).filter(User.id.in_([donor["id"], ngo["id"], volunteer["id"], admin_id])).delete(synchronize_session=False)
        database.commit()

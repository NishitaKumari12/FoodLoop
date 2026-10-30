import random
from functools import lru_cache

from fastapi import APIRouter, Depends
from sklearn.ensemble import RandomForestRegressor
from sqlalchemy import select

from app.api.dependencies import DatabaseSession, get_current_user
from app.models.community import SurplusPrediction
from app.models.user import User
from app.schemas.workflows import (
    PredictionHistoryItem,
    SurplusPredictionRequest,
    SurplusPredictionResponse,
)

router = APIRouter(prefix="/ml", tags=["surplus prediction"])
MODEL_LABEL = "Random Forest · synthetic demo training data"
MENU_CATEGORIES = ("rice", "bread", "curry", "snacks", "mixed", "other")


@lru_cache(maxsize=1)
def train_demo_model() -> RandomForestRegressor:
    generator = random.Random(2025)
    features: list[list[float]] = []
    targets: list[float] = []
    for _ in range(500):
        day = generator.randint(0, 6)
        attendance = generator.randint(20, 1200)
        event = generator.randint(0, 1)
        historical = generator.randint(0, 300)
        category = generator.randrange(len(MENU_CATEGORIES))
        category_factor = [1.0, 0.75, 1.15, 0.65, 1.2, 0.9][category]
        surplus = (
            attendance * generator.uniform(0.06, 0.16) * category_factor
            + historical * 0.35
            + event * generator.uniform(8, 55)
            + (8 if day in (4, 5) else 0)
            + generator.gauss(0, 12)
        )
        features.append([day, attendance, event, historical, category])
        targets.append(max(0, surplus))
    model = RandomForestRegressor(n_estimators=80, min_samples_leaf=2, random_state=42, n_jobs=1)
    model.fit(features, targets)
    return model


@router.post("/predict", response_model=SurplusPredictionResponse)
def predict_surplus(
    payload: SurplusPredictionRequest,
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> SurplusPredictionResponse:
    normalized_category = payload.menu_category.strip().lower()
    category_index = MENU_CATEGORIES.index(normalized_category) if normalized_category in MENU_CATEGORIES else MENU_CATEGORIES.index("other")
    values = [[
        payload.day_of_week,
        payload.attendance,
        int(payload.special_event),
        payload.historical_surplus,
        category_index,
    ]]
    predicted = max(0, round(float(train_demo_model().predict(values)[0])))
    prediction = SurplusPrediction(
        donor_id=current_user.id,
        day_of_week=payload.day_of_week,
        attendance=payload.attendance,
        special_event=payload.special_event,
        historical_surplus=payload.historical_surplus,
        menu_category=normalized_category,
        predicted_meals=predicted,
        model_label=MODEL_LABEL,
    )
    database.add(prediction)
    database.commit()
    return SurplusPredictionResponse(
        predicted_meals=predicted,
        model=MODEL_LABEL,
        training_data="Synthetic, deterministically generated demo data; not real FoodLoop history.",
    )


@router.get("/history", response_model=list[PredictionHistoryItem])
def prediction_history(
    database: DatabaseSession,
    current_user: User = Depends(get_current_user),
) -> list[SurplusPrediction]:
    return list(
        database.scalars(
            select(SurplusPrediction)
            .where(SurplusPrediction.donor_id == current_user.id)
            .order_by(SurplusPrediction.created_at.desc())
            .limit(100)
        ).all()
    )

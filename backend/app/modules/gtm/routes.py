from fastapi import APIRouter, HTTPException

from app.modules.comply.landed_cost import HSCodeError
from app.modules.gtm import model_recommender, waterfall
from app.schemas import (
    ModelRecommendRequest, ModelRecommendResponse, PriceWaterfallRequest, PriceWaterfallResponse,
)

router = APIRouter(prefix="/gtm", tags=["gtm"])


@router.post("/price-waterfall", response_model=PriceWaterfallResponse)
def price_waterfall(req: PriceWaterfallRequest):
    try:
        return waterfall.build(req)
    except HSCodeError as e:
        raise HTTPException(e.status, str(e))


@router.post("/recommend-model", response_model=ModelRecommendResponse)
def recommend_model(req: ModelRecommendRequest):
    return model_recommender.recommend(req)

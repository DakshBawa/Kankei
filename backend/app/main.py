import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import session
from app.modules.comply.routes import router as comply_router
from app.modules.culture.routes import router as culture_router
from app.modules.gtm.routes import router as gtm_router
from app.modules.match.routes import router as match_router
from app.modules.research.routes import router as research_router

app = FastAPI(title="Kankei API", version="0.2.0")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (research_router, match_router, comply_router, gtm_router, culture_router, session.router):
    app.include_router(r)


@app.get("/health")
def health():
    from app.modules.comply import landed_cost
    from app.modules.match.data import load_partners
    from app.modules.research.scoring import load_states

    states = load_states()
    return {
        "status": "ok",
        "data": {
            "states": len(states),
            "states_last_verified": sorted(states["last_verified"].unique().tolist()),
            "partners": len(load_partners()),
            "hs_codes": len(landed_cost.load_duties()),
        },
    }

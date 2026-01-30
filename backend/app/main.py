from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, import_models
from app.api.routes import caregivers, pay_periods


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import models and create tables on startup
    import_models()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Caregiver hours and expense tracking API",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)


# Register routers
app.include_router(caregivers.router)
app.include_router(pay_periods.router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}

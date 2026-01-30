from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    PROJECT_NAME: str = "Caregiver Tracker"
    DATABASE_URL: str = "sqlite:///./data/caregiver.db"
    DATA_DIR: Path = Path("./data")

    class Config:
        env_file = ".env"


settings = Settings()

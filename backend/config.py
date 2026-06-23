from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str
    skillsfuture_data_dir: str = "data/skillsfuture"
    log_dir: str = "logs"
    jwt_secret: str = "change-me-in-production"
    jwt_expire_hours: int = 24

    class Config:
        env_file = Path(__file__).parent / ".env"

settings = Settings()

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str
    skillsfuture_data_dir: str = "data/skillsfuture"
    log_dir: str = "logs"

    class Config:
        env_file = ".env"

settings = Settings()

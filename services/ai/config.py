from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    AZURE_OPENAI_ENDPOINT: str = "https://lifelonglearningwallet-resource.openai.azure.com"
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-4o-mini"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "firebase-service-account.json"
    AI_SERVICE_PORT: int = 8000

    class Config:
        env_file = ".env"


settings = Settings()

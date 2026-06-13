from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    AZURE_OPENAI_ENDPOINT: str = "https://lifelonglearningwallet-resource.openai.azure.com"
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = "gpt-4o-mini"
    FIREBASE_SERVICE_ACCOUNT_PATH: str = "firebase-service-account.json"
    AI_SERVICE_PORT: int = 8000
    # CSV of allowed CORS origins. Add the deployed web domain in prod, e.g.
    # ALLOWED_ORIGINS=https://talentbank.vercel.app
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8081"

    class Config:
        env_file = ".env"


settings = Settings()

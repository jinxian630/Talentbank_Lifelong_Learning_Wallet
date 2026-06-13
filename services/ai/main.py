import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from store.firestore_loader import load_events
from store.vector_store import build_store
from routers import chat, recommendations, index
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Building FAISS index from Firestore…")
    events = load_events()
    count = build_store(events)
    logger.info(f"Startup complete — {count} events indexed")
    yield


app = FastAPI(title="TalentBank AI Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8081"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(recommendations.router)
app.include_router(index.router)


@app.get("/health")
async def health():
    from store.vector_store import store_size
    return {"status": "ok", "indexed_events": store_size()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.AI_SERVICE_PORT, reload=True)

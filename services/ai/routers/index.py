from fastapi import APIRouter
from store.firestore_loader import load_events
from store.vector_store import build_store, store_size

router = APIRouter()


@router.post("/index/refresh")
async def refresh_index():
    events = load_events()
    indexed = build_store(events)
    return {"indexed": indexed, "store_size": store_size()}


@router.get("/index/status")
async def index_status():
    return {"store_size": store_size()}

from __future__ import annotations
import datetime
import logging
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

_events: list[dict] = []


def build_store(events: list[dict]) -> int:
    global _events
    _events = [e for e in events if e.get("title")]
    logger.info(f"Keyword store built with {len(_events)} events")
    return len(_events)


def store_size() -> int:
    return len(_events)


def search(query: str, k: int = 5) -> list[Document]:
    if not _events or not query.strip():
        return []

    tokens = set(query.lower().split())
    now = datetime.datetime.utcnow()
    scored: list[tuple[int, dict]] = []

    for e in _events:
        end = e.get("endAt")
        if end and hasattr(end, "timestamp"):
            try:
                if end.timestamp() < now.timestamp():
                    continue
            except Exception:
                pass

        haystack = (
            f"{e.get('title', '')} {e.get('description', '')} {e.get('type', '')}"
        ).lower()
        score = sum(1 for t in tokens if t in haystack)
        scored.append((score, e))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        Document(
            page_content=f"{e.get('title', '')} {e.get('description', '')}",
            metadata={
                "id":          e.get("id", ""),
                "title":       e.get("title", ""),
                "type":        e.get("type", ""),
                "emoji":       e.get("emoji", "🎯"),
                "description": e.get("description", "")[:300],
            },
        )
        for _, e in scored[:k]
    ]

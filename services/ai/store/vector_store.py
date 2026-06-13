from __future__ import annotations
import logging
from typing import Optional
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.documents import Document

logger = logging.getLogger(__name__)

_store: Optional[FAISS] = None
_embeddings: Optional[HuggingFaceEmbeddings] = None


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


def build_store(events: list[dict]) -> int:
    global _store
    if not events:
        logger.warning("No events to index — FAISS store not built")
        return 0

    docs = [
        Document(
            page_content=(
                f"{e.get('title', '')} {e.get('description', '')} {e.get('type', '')}"
            ).strip(),
            metadata={
                "id": e.get("id", ""),
                "title": e.get("title", ""),
                "type": e.get("type", ""),
                "emoji": e.get("emoji", "🎯"),
                "description": e.get("description", "")[:300],
            },
        )
        for e in events
        if e.get("title")
    ]

    _store = FAISS.from_documents(docs, get_embeddings())
    logger.info(f"FAISS index built with {len(docs)} events")
    return len(docs)


def search(query: str, k: int = 5) -> list[Document]:
    if _store is None:
        return []
    return _store.similarity_search(query, k=k)


def store_size() -> int:
    if _store is None:
        return 0
    return _store.index.ntotal

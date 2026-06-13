from __future__ import annotations
import logging
import firebase_admin
from firebase_admin import credentials, firestore
from config import settings

logger = logging.getLogger(__name__)
_db = None


def _get_db():
    global _db
    if _db is None:
        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred)
        _db = firestore.client()
    return _db


def load_events() -> list[dict]:
    try:
        docs = _get_db().collection("events").stream()
        return [{"id": d.id, **d.to_dict()} for d in docs]
    except Exception as e:
        logger.error(f"load_events failed: {e}")
        return []


def load_user(uid: str) -> dict:
    try:
        doc = _get_db().collection("users").document(uid).get()
        return {"uid": uid, **doc.to_dict()} if doc.exists else {}
    except Exception as e:
        logger.error(f"load_user({uid}) failed: {e}")
        return {}


def load_attended_event_ids(uid: str) -> list[str]:
    try:
        docs = _get_db().collection("checkins").where("uid", "==", uid).stream()
        return [d.to_dict().get("eventId", "") for d in docs]
    except Exception as e:
        logger.error(f"load_attended_event_ids({uid}) failed: {e}")
        return []

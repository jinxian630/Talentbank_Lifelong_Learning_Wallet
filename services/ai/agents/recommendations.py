"""Skill Gap Recommender — Pipeline: retrieve_candidates → filter_attended → generate_recommendations."""
from __future__ import annotations
import json
import logging
from typing import TypedDict
import httpx
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from store.vector_store import search
from config import settings

logger = logging.getLogger(__name__)


class RecState(TypedDict):
    uid: str
    user_name: str
    user_interests: list[str]
    user_skills: list[str]
    attended_ids: list[str]
    candidate_events: list[dict]
    recommendations: list[dict]


def _make_llm() -> ChatOpenAI:
    return ChatOpenAI(
        base_url=f"{settings.AZURE_OPENAI_ENDPOINT}/openai/v1",
        api_key=settings.AZURE_OPENAI_API_KEY,
        model=settings.AZURE_OPENAI_DEPLOYMENT,
        temperature=0.4,
        http_client=httpx.Client(
            headers={"api-key": settings.AZURE_OPENAI_API_KEY},
            timeout=30.0,
        ),
    )


def retrieve_candidates_node(state: RecState) -> RecState:
    query = " ".join(state["user_interests"] + state["user_skills"]).strip()
    if not query:
        query = "learning skills development workshop"

    docs = search(query, k=10)
    candidates = [
        {
            "id": d.metadata["id"],
            "title": d.metadata["title"],
            "type": d.metadata["type"],
            "emoji": d.metadata.get("emoji", "🎯"),
            "description": d.metadata.get("description", ""),
        }
        for d in docs
    ]
    return {**state, "candidate_events": candidates}


def filter_attended_node(state: RecState) -> RecState:
    attended = set(state["attended_ids"])
    filtered = [e for e in state["candidate_events"] if e["id"] not in attended]
    return {**state, "candidate_events": filtered}


def generate_recommendations_node(state: RecState) -> RecState:
    candidates = state["candidate_events"]
    if not candidates:
        return {**state, "recommendations": []}

    llm = _make_llm()
    events_list = "\n".join(
        f"{i + 1}. [{e['type']}] {e['title']}: {e['description']}"
        for i, e in enumerate(candidates[:8])
    )

    prompt = f"""Student profile:
Name: {state['user_name']}
Interests: {', '.join(state['user_interests']) or 'None listed'}
Skills: {', '.join(state['user_skills']) or 'None listed'}

Available events (not yet attended):
{events_list}

Select the top 3 events that best match this student's interests and skill gaps.
Respond ONLY with a JSON array, no markdown fences:
[
  {{"id": "event_id", "title": "...", "emoji": "...", "type": "...", "reason": "one sentence tailored to this student", "matchScore": 0.0}},
  ...
]"""

    result = llm.invoke([HumanMessage(content=prompt)])

    try:
        raw = result.content.replace("```json", "").replace("```", "").strip()
        recs = json.loads(raw)
        # Backfill emoji/type from candidate map if LLM omits them
        id_map = {e["id"]: e for e in candidates}
        for r in recs:
            src = id_map.get(r.get("id"), {})
            r.setdefault("emoji", src.get("emoji", "🎯"))
            r.setdefault("type", src.get("type", ""))
    except Exception as e:
        logger.warning(f"Failed to parse recommendations JSON: {e}")
        recs = []

    return {**state, "recommendations": recs[:3]}


def _build_graph() -> object:
    wf = StateGraph(RecState)
    wf.add_node("retrieve_candidates", retrieve_candidates_node)
    wf.add_node("filter_attended", filter_attended_node)
    wf.add_node("generate_recommendations", generate_recommendations_node)
    wf.set_entry_point("retrieve_candidates")
    wf.add_edge("retrieve_candidates", "filter_attended")
    wf.add_edge("filter_attended", "generate_recommendations")
    wf.add_edge("generate_recommendations", END)
    return wf.compile()


recommendations_graph = _build_graph()

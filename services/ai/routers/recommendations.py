from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.recommendations import recommendations_graph
from store.firestore_loader import load_user, load_attended_event_ids

router = APIRouter()


class RecRequest(BaseModel):
    uid: str


class Recommendation(BaseModel):
    id: str
    title: str
    emoji: str
    type: str
    reason: str
    matchScore: float


class RecResponse(BaseModel):
    recommendations: list[Recommendation]


@router.post("/recommendations", response_model=RecResponse)
async def get_recommendations(req: RecRequest):
    try:
        profile = load_user(req.uid)
        attended = load_attended_event_ids(req.uid)

        result = recommendations_graph.invoke(
            {
                "uid": req.uid,
                "user_name": profile.get("name", "Student"),
                "user_interests": profile.get("interests", []),
                "user_skills": profile.get("skills", []),
                "attended_ids": attended,
                "candidate_events": [],
                "recommendations": [],
            }
        )
        recs = [
            Recommendation(
                id=r.get("id", ""),
                title=r.get("title", ""),
                emoji=r.get("emoji", "🎯"),
                type=r.get("type", ""),
                reason=r.get("reason", ""),
                matchScore=float(r.get("matchScore", 0.0)),
            )
            for r in result["recommendations"]
        ]
        return RecResponse(recommendations=recs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

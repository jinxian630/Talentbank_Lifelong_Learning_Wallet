from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from agents.chatbot import chat_graph

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    user_name: str = "Student"
    user_interests: list[str] = []


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        result = chat_graph.invoke(
            {
                "query": req.message,
                "user_name": req.user_name,
                "user_interests": req.user_interests,
                "retrieved_context": "",
                "response": "",
            }
        )
        return ChatResponse(reply=result["response"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

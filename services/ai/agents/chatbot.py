"""RAG Chatbot agent — Pipeline: retrieve_node → generate_node."""
from __future__ import annotations
from typing import TypedDict
import httpx
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from store.vector_store import search
from config import settings


class ChatState(TypedDict):
    query: str
    user_name: str
    user_interests: list[str]
    retrieved_context: str
    response: str


def _make_llm(temperature: float = 0.7) -> ChatOpenAI:
    return ChatOpenAI(
        base_url=f"{settings.AZURE_OPENAI_ENDPOINT}/openai/v1",
        api_key=settings.AZURE_OPENAI_API_KEY,
        model=settings.AZURE_OPENAI_DEPLOYMENT,
        temperature=temperature,
        http_client=httpx.Client(
            headers={"api-key": settings.AZURE_OPENAI_API_KEY},
            timeout=30.0,
        ),
    )


def retrieve_node(state: ChatState) -> ChatState:
    docs = search(state["query"], k=5)
    if docs:
        lines = [
            f"- {d.metadata['title']} [{d.metadata['type']}]: {d.metadata['description']}"
            for d in docs
        ]
        context = "\n".join(lines)
    else:
        context = "No events currently indexed."
    return {**state, "retrieved_context": context}


def generate_node(state: ChatState) -> ChatState:
    llm = _make_llm(0.7)
    system_prompt = f"""You are a helpful learning advisor for TalentBank, a student skill development platform.
You help students discover events and grow their skills.

Student: {state['user_name']}
Interests: {', '.join(state['user_interests']) or 'Not specified'}

Relevant events retrieved from the platform:
{state['retrieved_context']}

Be concise and practical. Recommend specific events when they match the student's question."""

    response = llm.invoke(
        [SystemMessage(content=system_prompt), HumanMessage(content=state["query"])]
    )
    return {**state, "response": response.content}


def _build_graph() -> object:
    wf = StateGraph(ChatState)
    wf.add_node("retrieve", retrieve_node)
    wf.add_node("generate", generate_node)
    wf.set_entry_point("retrieve")
    wf.add_edge("retrieve", "generate")
    wf.add_edge("generate", END)
    return wf.compile()


chat_graph = _build_graph()

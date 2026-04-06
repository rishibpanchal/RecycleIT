"""
routes/chat.py
================
Unified NLP conversational querying endpoint.
Accepts natural language questions and routes them through the unified chatbot,
which intelligently decides whether to use database queries, graph analysis, 
or insight generation based on the query intent.

Endpoints:
  POST /api/chat/ask     → answer a free-text question
  GET  /api/chat/health  → check if the unified chatbot is reachable
"""

import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Ensure backend root is in sys.path so unified_chatbot can be imported
sys.path.insert(0, str(Path(__file__).parent.parent))

router = APIRouter(prefix="/api/chat", tags=["chat"])

# ── Lazy singleton: only init when first request comes in ─────────────────────
_chatbot = None

def _get_chatbot():
    global _chatbot
    if _chatbot is None:
        try:
            from unified_chatbot import TraceabilityChatbot
            ROOT_DIR = Path(__file__).parent.parent.parent
            _chatbot = TraceabilityChatbot(
                db_path=str(ROOT_DIR / "traceability.db"),
                json_path=str(ROOT_DIR / "traceability_report.json"),
            )
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=f"Could not initialise unified chatbot: {e}"
            )
    return _chatbot


# ── Request / Response models ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=3, example="What was the total input quantity in Scenario 1?")
    scenario: int = Field(default=1, ge=1, le=6, description="Traceability scenario to answer against")


class ChatResponse(BaseModel):
    question: str
    route: str           # "ANALYZE_BATCH" | "SUMMARIZE_JOURNEY" | "DATABASE" | "UNIFIED"
    answer: str
    scenario: int


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=ChatResponse)
def ask_question(body: ChatRequest):
    """
    Submit a natural language question.
    The unified chatbot automatically decides the best routing strategy:
    - ANALYZE_BATCH: For batch/process analysis and anomaly detection
    - SUMMARIZE_JOURNEY: For narrative journey summaries
    - DATABASE: For specific data queries and lineage traces
    
    Returns a structured response with the routing decision and answer.
    """
    chatbot = _get_chatbot()

    try:
        # Use the unified chatbot which intelligently routes the query
        answer = chatbot.chat(body.question)
        
        # Determine the route based on the chatbot's last decision
        # The unified chatbot internally decides, we map it to friendly names
        route = getattr(chatbot, '_last_route', 'UNIFIED')
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot error: {e}")

    return ChatResponse(
        question=body.question,
        route=route,
        answer=answer,
        scenario=body.scenario,
    )


@router.get("/health")
def chat_health():
    """Returns whether the unified chatbot is ready."""
    try:
        chatbot = _get_chatbot()
        return {"status": "ready", "model": "gemini-flash-latest", "type": "unified_chatbot"}
    except HTTPException as e:
        return {"status": "unavailable", "detail": e.detail}

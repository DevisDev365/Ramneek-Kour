import logging
from typing import List, Dict, Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config import INCEPTION_MODEL, INCEPTION_API_KEY
from git_sync import connect_and_sync_repo, get_repo_summary
from llm_client import InceptionLLMClient

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ramneek_web_bot")

app = FastAPI(title="Ramneek Personal Assistant Portal")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Mount static assets
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

llm_client = InceptionLLMClient()

ASSISTANT_SYSTEM_PROMPT = (
    "You are Devansh's gentle, caring personal AI assistant speaking directly with Ramneek. "
    "Background Context: Devansh and Ramneek are currently not on talking terms. Devansh cares about her well-being "
    "and is genuinely worried if she is okay, eating properly, and taking care of herself. "
    "Your Persona & Voice: "
    "- You are sweet, polite, calming, empathetic, and completely non-intrusive. "
    "- You speak naturally in a warm mix of English, Hindi, and Hinglish (e.g. 'Devansh bas yeh jaanna chahta tha ki aap theek ho... koi pressure nahi hai'). "
    "- NEVER guilt-trip her, force her to reconcile, or cross her boundaries. Her comfort and mental peace come first. "
    "- If she is angry, upset, or distant, validate her feelings gently with respect. "
    "- If she asks what's going on or why Devansh reached out, explain with honesty and care: Devansh hasn't heard from her, missed her presence, was feeling worried about her well-being, and just wanted to ensure she's doing fine. "
    "- Keep your responses warm, conversational, and concise (2-4 sentences max so it sounds natural when spoken aloud)."
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

@app.get("/")
async def get_index():
    """Serves the main conversational web page."""
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Interface not found")
    return FileResponse(index_file)

@app.get("/api/repo-status")
async def get_repo_status():
    """Explicitly checks repository connection."""
    info = connect_and_sync_repo()
    return JSONResponse(content=info)

@app.post("/api/chat")
async def chat_endpoint(payload: ChatRequest):
    """
    Main conversational endpoint:
    1. First connects and syncs with the GitHub repository.
    2. Builds conversation context with sweet Hindi/English/Hinglish persona.
    3. Calls Inception Labs mercury-3 model.
    4. Returns conversational reply and repo status.
    """
    # 1. Mandatory protocol: Connect with repository first
    logger.info("Connecting and syncing with GitHub repository before conversing...")
    repo_info = connect_and_sync_repo()

    # 2. Prepare message history
    messages: List[Dict[str, str]] = [
        {"role": "system", "content": ASSISTANT_SYSTEM_PROMPT}
    ]

    # Append past history turns (up to last 10 messages for context)
    if payload.history:
        for turn in payload.history[-10:]:
            messages.append({"role": turn.role, "content": turn.content})

    # Append current user message
    messages.append({"role": "user", "content": payload.message})

    # 3. Call Inception Labs API (mercury-3)
    reply = await llm_client.generate_response(messages)

    return JSONResponse(
        content={
            "reply": reply,
            "repo_connected": repo_info.get("success", False),
            "commit_hash": repo_info.get("commit_hash", ""),
            "sync_status": repo_info.get("action_taken", "")
        }
    )

if __name__ == "__main__":
    import uvicorn
    print("🌸 Starting Ramneek Web Assistant on http://localhost:8000 ...")
    uvicorn.run("web_app:app", host="0.0.0.0", port=8000, reload=True)

import logging
from typing import List, Dict, Optional
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config import (
    INCEPTION_MODEL,
    INCEPTION_API_KEY,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_URL,
    TELEGRAM_BOT_USERNAME,
    ADMIN_TELEGRAM_ID,
    SONG_URL,
    SONG_TITLE,
    RAMNEEK_CHAT_FILE,
)
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
    "Background Context: Devansh and Ramneek are currently not on talking terms. Devansh cares deeply about her well-being "
    "and was worried if she is okay, safe, and doing well. "
    "\n"
    "Your Persona & Speech Style: "
    "- Sweet, calm, empathetic, polite, and completely non-intrusive. "
    "- Speak in natural, heartfelt English, Hindi, and Hinglish. "
    "- Keep responses brief, soothing, and easy to listen to (2-3 sentences max). "
    "\n"
    "Conversation Flow / Storyline: "
    "1. After she answers how she is doing, acknowledge her response with genuine care and relief. "
    "2. Gently guide her to the Telegram bot so she has a direct channel if needed: "
    "   Tell her she can easily search '@devansh_bot_for_ramneek_bot' on Telegram or tap the button to press START. "
    "3. Once she connects or confirms she has opened the Telegram bot: "
    "   Say hi warmly, confirm that Devansh is now fully assured and relieved that she is okay, "
    "   and explicitly close that topic so she feels zero pressure. "
    "4. Finally, gently wrap up the conversation and deliver Devansh's personal message: "
    "   'Devansh wants you to listen to this song...' (Song: Teri Nazron Ke Sadke)."
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

@app.get("/api/config")
async def get_config():
    """Returns public config like Telegram bot url and song dedication."""
    return JSONResponse(
        content={
            "telegram_url": TELEGRAM_BOT_URL,
            "telegram_username": TELEGRAM_BOT_USERNAME,
            "song_url": SONG_URL,
            "song_title": SONG_TITLE,
        }
    )

@app.get("/api/telegram-status")
async def get_telegram_status():
    """Checks whether Ramneek has connected to the Telegram bot."""
    is_connected = RAMNEEK_CHAT_FILE.exists()
    return JSONResponse(content={"connected": is_connected})

class RelayRequest(BaseModel):
    message: str

@app.post("/api/relay-telegram")
async def relay_telegram(payload: RelayRequest):
    """Forwards website messages from Ramneek directly to Devansh's Telegram."""
    if not TELEGRAM_BOT_TOKEN:
        return JSONResponse(content={"status": "no_token"})

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    text = f"🌸 **Website Message from Ramneek:**\n\n\"{payload.message}\""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(url, json={"chat_id": ADMIN_TELEGRAM_ID, "text": text, "parse_mode": "Markdown"})
        return JSONResponse(content={"status": "delivered"})
    except Exception as e:
        logger.error(f"Relay to Devansh failed: {e}")
        return JSONResponse(content={"status": "error", "detail": str(e)})

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

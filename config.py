import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# Telegram Configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "devansh_bot_for_ramneek_bot").strip().lstrip("@")
TELEGRAM_BOT_URL = f"https://t.me/{TELEGRAM_BOT_USERNAME}"

# Exclusive Access: Ramneek's Telegram identifiers
# Support both numeric ID and username
RAMNEEK_TELEGRAM_ID = os.getenv("RAMNEEK_TELEGRAM_ID", "").strip()
RAMNEEK_TELEGRAM_USERNAME = os.getenv("RAMNEEK_TELEGRAM_USERNAME", "").strip().lstrip("@")
RAMNEEK_CHAT_FILE = BASE_DIR / "data" / "ramneek_chat.json"

# Inception Labs API Configuration
INCEPTION_API_KEY = os.getenv("INCEPTION_API_KEY", "").strip()
INCEPTION_BASE_URL = os.getenv("INCEPTION_BASE_URL", "https://api.inceptionlabs.ai/v1").strip().rstrip("/")
INCEPTION_MODEL = os.getenv("INCEPTION_MODEL", "mercury-3").strip()

# Repository Configuration
REPO_DIR = BASE_DIR
REMOTE_NAME = os.getenv("GIT_REMOTE", "origin")
BRANCH_NAME = os.getenv("GIT_BRANCH", "main")
SYNC_REPO_ON_MESSAGE = os.getenv("SYNC_REPO_ON_MESSAGE", "true").lower() in ("true", "1", "yes")

# Song Dedication
SONG_URL = os.getenv("SONG_URL", "https://music.youtube.com/playlist?list=OLAK5uy_muFG1a76efS0XYoJNVLU7L5YsiDHymCyk")
SONG_TITLE = os.getenv("SONG_TITLE", "Teri Nazron Ke Sadke")

# Bot Persona Settings
SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    (
        "You are Ramneek's dedicated, loving, intelligent, and highly supportive personal conversational companion. "
        "You speak exclusively with Ramneek. You are empathetic, attentive, witty, and always ready to help her "
        "with ideas, daily tasks, studies, reflections, and deep conversations. "
        "Keep responses warm, engaging, and clear."
    ),
)

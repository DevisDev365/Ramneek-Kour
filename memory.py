import json
from pathlib import Path
from typing import List, Dict
import logging
from config import BASE_DIR, SYSTEM_PROMPT

logger = logging.getLogger(__name__)

DATA_DIR = BASE_DIR / "data"
HISTORY_FILE = DATA_DIR / "conversation_history.json"

class ConversationMemory:
    def __init__(self, max_turns: int = 15):
        self.max_turns = max_turns
        self.history: List[Dict[str, str]] = []
        self._load_history()

    def _ensure_dir(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)

    def _load_history(self):
        try:
            if HISTORY_FILE.exists():
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    self.history = json.load(f)
        except Exception as e:
            logger.warning(f"Could not load conversation history: {e}")
            self.history = []

    def _save_history(self):
        try:
            self._ensure_dir()
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(self.history, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save conversation history: {e}")

    def add_user_message(self, content: str):
        self.history.append({"role": "user", "content": content})
        self._trim_and_save()

    def add_assistant_message(self, content: str):
        self.history.append({"role": "assistant", "content": content})
        self._trim_and_save()

    def _trim_and_save(self):
        # Keep the most recent 2 * max_turns messages
        max_messages = self.max_turns * 2
        if len(self.history) > max_messages:
            self.history = self.history[-max_messages:]
        self._save_history()

    def get_context_messages(self) -> List[Dict[str, str]]:
        """Returns messages prepared for the LLM API, including the system prompt."""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(self.history)
        return messages

    def clear(self):
        self.history = []
        self._save_history()

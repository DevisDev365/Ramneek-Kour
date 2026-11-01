import sys
import json
import asyncio
import logging
from telegram import Bot
from telegram.constants import ParseMode

from config import TELEGRAM_BOT_TOKEN, RAMNEEK_TELEGRAM_ID, RAMNEEK_CHAT_FILE
from git_sync import connect_and_sync_repo

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("nudge")

async def send_nudge(message_text: str):
    """Sends a message / gentle nudge to Ramneek on Telegram."""
    if not TELEGRAM_BOT_TOKEN:
        print("❌ Error: TELEGRAM_BOT_TOKEN is missing in .env")
        return

    # 1. Connect with GitHub repo first
    print("🔄 Connecting to repository before sending message...")
    repo_status = connect_and_sync_repo()
    if repo_status["success"]:
        print(f"✅ Repository connected: {repo_status.get('commit_hash')}")
    else:
        print(f"⚠️ Repo connection warning: {repo_status.get('status_detail')}")

    # 2. Determine target chat_id
    target_chat_id = None
    if RAMNEEK_CHAT_FILE.exists():
        try:
            with open(RAMNEEK_CHAT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                target_chat_id = data.get("chat_id")
        except Exception as e:
            logger.warning(f"Could not read {RAMNEEK_CHAT_FILE}: {e}")

    if not target_chat_id and RAMNEEK_TELEGRAM_ID:
        target_chat_id = RAMNEEK_TELEGRAM_ID

    if not target_chat_id:
        print("\n❌ Could not find Ramneek's Telegram chat ID yet.")
        print("👉 How to fix:")
        print("1. Ramneek must open the bot once: https://t.me/devansh_bot_for_ramneek_bot")
        print("2. She presses 'START'.")
        print("3. The bot will automatically record her chat ID, or you can add RAMNEEK_TELEGRAM_ID to .env.\n")
        return

    # 3. Send message via Bot
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    try:
        print(f"📨 Delivering message to Ramneek (chat_id={target_chat_id})...")
        sent_msg = await bot.send_message(
            chat_id=target_chat_id,
            text=message_text,
            parse_mode=ParseMode.MARKDOWN
        )
        print(f"🎉 Message successfully delivered! (Message ID: {sent_msg.message_id})")
    except Exception as e:
        print(f"❌ Failed to send message: {e}")

def main():
    if len(sys.argv) < 2:
        print("\nUsage:")
        print("  python nudge.py \"Your message here\"\n")
        print("Example:")
        print("  python nudge.py \"Hey Ramneek, just wanted to check if you had lunch today 🌸\"\n")
        return

    message = " ".join(sys.argv[1:])
    asyncio.run(send_nudge(message))

if __name__ == "__main__":
    main()

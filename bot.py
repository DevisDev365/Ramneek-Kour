import logging
import asyncio
import json
from telegram import Update
from telegram.constants import ChatAction, ParseMode
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from config import (
    TELEGRAM_BOT_TOKEN,
    RAMNEEK_TELEGRAM_ID,
    RAMNEEK_TELEGRAM_USERNAME,
    RAMNEEK_CHAT_FILE,
    ADMIN_TELEGRAM_ID,
    ADMIN_TELEGRAM_USERNAME,
    ADMIN_CHAT_FILE,
    SYNC_REPO_ON_MESSAGE,
    INCEPTION_MODEL,
    SONG_URL,
    SONG_TITLE,
)
from git_sync import connect_and_sync_repo, get_repo_summary
from llm_client import InceptionLLMClient
from memory import ConversationMemory

# Configure logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

memory = ConversationMemory(max_turns=15)
llm_client = InceptionLLMClient()

def get_saved_chat_id(filepath) -> int:
    """Reads a saved chat_id from json file if available."""
    try:
        if filepath.exists():
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("chat_id")
    except Exception as e:
        logger.warning(f"Error reading {filepath}: {e}")
    return None

def is_admin(user) -> bool:
    """Checks if the user is Devansh (Admin)."""
    if not user:
        return False

    saved_admin_id = get_saved_chat_id(ADMIN_CHAT_FILE)
    if saved_admin_id and user.id == saved_admin_id:
        return True

    if ADMIN_TELEGRAM_ID and str(user.id) == ADMIN_TELEGRAM_ID:
        return True

    if ADMIN_TELEGRAM_USERNAME and user.username:
        if user.username.lower() == ADMIN_TELEGRAM_USERNAME.lower():
            return True

    # If Devansh's username contains 'devansh', recognize him
    if user.username and "devansh" in user.username.lower():
        return True

    return False

def is_ramneek(user) -> bool:
    """Checks if user is Ramneek."""
    if not user:
        return False
    if is_admin(user):
        return False
    return True

async def notify_admin(context: ContextTypes.DEFAULT_TYPE, message: str):
    """Sends a notification to Devansh (Admin) on Telegram."""
    admin_id = get_saved_chat_id(ADMIN_CHAT_FILE) or (int(ADMIN_TELEGRAM_ID) if ADMIN_TELEGRAM_ID.isdigit() else None)
    if not admin_id:
        logger.warning("No admin_id available to send notification.")
        return

    try:
        await context.bot.send_message(
            chat_id=admin_id,
            text=message,
            parse_mode=ParseMode.MARKDOWN
        )
    except Exception as e:
        logger.error(f"Failed to notify admin: {e}")

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles the /start command."""
    user = update.effective_user
    chat_id = update.effective_chat.id

    # 1. ADMIN FLOW (Devansh)
    if is_admin(user):
        # Save Devansh's chat details
        try:
            ADMIN_CHAT_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(ADMIN_CHAT_FILE, "w", encoding="utf-8") as f:
                json.dump({"chat_id": chat_id, "username": user.username, "name": user.full_name}, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed saving admin chat: {e}")

        ramneek_id = get_saved_chat_id(RAMNEEK_CHAT_FILE)
        status_line = f"✅ Connected (`{ramneek_id}`)" if ramneek_id else "⚠️ Not connected yet"

        msg = (
            f"👑 **Hello Devansh (Admin)**\n\n"
            f"I am your assistant bot for Ramneek.\n\n"
            f"• **Ramneek's Telegram Status**: {status_line}\n"
            f"• **Repository**: `https://github.com/DevisDev365/Ramneek-Kour.git`\n\n"
            f"**How to tell me to check on her:**\n"
            f"• Just message me: `check on ramneek`\n"
            f"• Or use command: `/check`\n"
            f"• Send custom message: `/say <your message>`\n"
            f"• Check status: `/status`"
        )
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
        return

    # 2. RAMNEEK FLOW
    # Save Ramneek's chat details
    try:
        RAMNEEK_CHAT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(RAMNEEK_CHAT_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "chat_id": chat_id,
                "user_id": user.id,
                "username": user.username,
                "first_name": user.first_name,
            }, f, indent=2)
        logger.info(f"Registered Ramneek: chat_id={chat_id}")
    except Exception as e:
        logger.warning(f"Failed saving Ramneek's chat details: {e}")

    # Notify Devansh immediately!
    await notify_admin(
        context,
        f"🎉 **Ramneek just opened and connected to the Telegram bot!**\nUser: @{user.username or user.first_name}"
    )

    # Connect with repo
    connect_and_sync_repo()

    # Welcome message asking if she's okay
    welcome_msg = (
        f"🌸 **Hi Ramneek, I'm Devansh's assistant.**\n\n"
        f"As you guys are not on talking terms right now... he was genuinely worried if you're okay.\n\n"
        f"Please tell me, are you doing okay?"
    )
    await update.message.reply_text(welcome_msg)

async def check_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command: Tells the bot to go check on Ramneek."""
    user = update.effective_user
    if not is_admin(user):
        await update.message.reply_text("🔒 Access Restricted.")
        return

    ramneek_chat_id = get_saved_chat_id(RAMNEEK_CHAT_FILE) or (int(RAMNEEK_TELEGRAM_ID) if RAMNEEK_TELEGRAM_ID.isdigit() else None)

    if not ramneek_chat_id:
        await update.message.reply_text(
            "⚠️ **Ramneek hasn't opened the bot yet.**\n\n"
            "Telegram rules require that she taps the link once and clicks **START**:\n"
            "👉 `https://t.me/devansh_bot_for_ramneek_bot`\n\n"
            "Or have her open the website: `https://ramneek.devanshkhanna.online`\n"
            "Once she taps START, I will immediately have her chat ID and can check in on her!"
        )
        return

    # Connect with repo first
    connect_and_sync_repo()

    check_message = (
        "🌸 **Hi Ramneek, I'm Devansh's assistant.**\n\n"
        "As you guys are not on talking terms right now... he was genuinely worried if you're okay.\n\n"
        "Please tell me, are you doing okay?"
    )

    try:
        await context.bot.send_message(
            chat_id=ramneek_chat_id,
            text=check_message
        )
        await update.message.reply_text(
            f"✅ **Check-in sent to Ramneek!**\n\n"
            f"I asked her if she is doing okay. I will notify you the moment she replies! 🌸"
        )
    except Exception as e:
        await update.message.reply_text(f"❌ Could not deliver message to Ramneek: {e}")

async def say_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command: Send custom message to Ramneek."""
    if not is_admin(update.effective_user):
        return

    ramneek_chat_id = get_saved_chat_id(RAMNEEK_CHAT_FILE)
    if not ramneek_chat_id:
        await update.message.reply_text("⚠️ Ramneek hasn't connected yet.")
        return

    text = " ".join(context.args)
    if not text:
        await update.message.reply_text("Usage: `/say Your message here`", parse_mode=ParseMode.MARKDOWN)
        return

    connect_and_sync_repo()
    try:
        await context.bot.send_message(chat_id=ramneek_chat_id, text=text)
        await update.message.reply_text("✅ Message delivered to Ramneek.")
    except Exception as e:
        await update.message.reply_text(f"❌ Failed: {e}")

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Displays status of the bot, repo, and connections."""
    repo_info = connect_and_sync_repo()
    ramneek_id = get_saved_chat_id(RAMNEEK_CHAT_FILE)

    status_msg = (
        f"⚙️ **System Status**\n\n"
        f"• **Repository**: `https://github.com/DevisDev365/Ramneek-Kour.git`\n"
        f"• **Repo Sync**: {'✅ Connected' if repo_info['success'] else '❌ Disconnected'}\n"
        f"• **Ramneek Connected**: {'✅ Yes (`' + str(ramneek_id) + '`)' if ramneek_id else '❌ Not yet'}\n"
        f"• **AI Model**: `{INCEPTION_MODEL}`\n"
    )
    await update.message.reply_text(status_msg, parse_mode=ParseMode.MARKDOWN)

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles text messages from both Admin (Devansh) and Ramneek."""
    user = update.effective_user
    user_text = update.message.text
    if not user_text:
        return

    # 1. ADMIN HANDLING (Devansh speaking to bot)
    if is_admin(user):
        lower_text = user_text.lower().strip()
        if "check on ramneek" in lower_text or "check" in lower_text or "nudge" in lower_text:
            await check_command(update, context)
            return

        if "status" in lower_text:
            await status_command(update, context)
            return

        await update.message.reply_text(
            "👑 Devansh, to check on Ramneek, simply type:\n"
            "👉 `check on ramneek`\n"
            "or use `/check`"
        )
        return

    # 2. RAMNEEK HANDLING
    # Mandatory repo sync first
    connect_and_sync_repo()

    # Notify Devansh with her exact reply!
    await notify_admin(
        context,
        f"📬 **Devansh, Ramneek just replied:**\n\n"
        f"> \"{user_text}\""
    )

    # Deliver graceful topic closure and the song dedication to Ramneek
    reply_to_ramneek = (
        f"🌸 **Devansh ko tasalli ho gayi ki aap safe aur theek ho.**\n\n"
        f"Ab main is baare mein aage kuch nahi poochungi, that topic ends here.\n\n"
        f"Devansh wants you to listen to this song...\n"
        f"🎵 **[{SONG_TITLE}]({SONG_URL})**\n\n"
        f"Take good care of yourself 🤍"
    )

    await update.message.reply_text(reply_to_ramneek, parse_mode=ParseMode.MARKDOWN)

def main():
    if not TELEGRAM_BOT_TOKEN:
        print("\n❌ Error: TELEGRAM_BOT_TOKEN is not set.")
        return

    print("🚀 Initializing Ramneek Bot with Admin Support...")
    repo_status = connect_and_sync_repo()
    print(f"📦 Repository: {'CONNECTED' if repo_status['success'] else 'FAILED'}")

    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()

    # Handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("admin", start_command))
    app.add_handler(CommandHandler("check", check_command))
    app.add_handler(CommandHandler("nudge", check_command))
    app.add_handler(CommandHandler("say", say_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("✅ Bot is online and listening! Press Ctrl+C to stop.")
    app.run_polling()

if __name__ == "__main__":
    main()

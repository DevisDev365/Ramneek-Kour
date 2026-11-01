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
    SYNC_REPO_ON_MESSAGE,
    INCEPTION_MODEL,
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

# Initialize memory and LLM client
memory = ConversationMemory(max_turns=15)
llm_client = InceptionLLMClient()

def is_authorized(update: Update) -> bool:
    """
    Checks if the incoming message is from Ramneek.
    If no ID or username is configured in .env, allows and logs the sender's details
    so they can be configured.
    """
    user = update.effective_user
    if not user:
        return False

    # If both filters are empty, allow and log ID for easy configuration
    if not RAMNEEK_TELEGRAM_ID and not RAMNEEK_TELEGRAM_USERNAME:
        logger.warning(
            f"No RAMNEEK_TELEGRAM_ID or RAMNEEK_TELEGRAM_USERNAME configured! "
            f"Sender: id={user.id}, username=@{user.username}, name={user.full_name}. "
            f"Add this ID to .env to lock access."
        )
        return True

    # Check ID match
    if RAMNEEK_TELEGRAM_ID and str(user.id) == RAMNEEK_TELEGRAM_ID:
        return True

    # Check username match
    if RAMNEEK_TELEGRAM_USERNAME and user.username:
        if user.username.lower() == RAMNEEK_TELEGRAM_USERNAME.lower():
            return True

    logger.warning(
        f"Unauthorized access attempt by id={user.id}, username=@{user.username}, name={user.full_name}"
    )
    return False

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles the /start command."""
    if not is_authorized(update):
        await update.message.reply_text(
            "🔒 Access Restricted: This bot is private and exclusively configured for Ramneek."
        )
        return

    # Connect with repo first
    repo_info = connect_and_sync_repo()
    status_text = "Connected" if repo_info["success"] else "Connection issue"

    # Save Ramneek's chat details for future notifications / nudges
    try:
        RAMNEEK_CHAT_FILE.parent.mkdir(parents=True, exist_ok=True)
        chat_data = {
            "chat_id": update.effective_chat.id,
            "user_id": update.effective_user.id,
            "username": update.effective_user.username,
            "first_name": update.effective_user.first_name,
        }
        with open(RAMNEEK_CHAT_FILE, "w", encoding="utf-8") as f:
            json.dump(chat_data, f, indent=2)
        logger.info(f"Saved Ramneek's chat details: chat_id={update.effective_chat.id}")
    except Exception as e:
        logger.warning(f"Could not save chat details: {e}")

    welcome_msg = (
        f"🌸 **Hello Ramneek!** Welcome to your private conversational bot.\n\n"
        f"📁 **Repository Status**: {status_text} (`{repo_info.get('commit_hash', 'unknown')}`)\n"
        f"🧠 **Model**: `{INCEPTION_MODEL}`\n\n"
        f"Whenever you talk to me, I first connect and sync with your repository so our state is always up to date!\n\n"
        f"**Available Commands:**\n"
        f"• `/repo` - Check & sync with the GitHub repository\n"
        f"• `/status` - Check bot and API status\n"
        f"• `/clear` - Reset current conversation memory\n"
        f"• `/help` - Show help message\n\n"
        f"How are you doing today?"
    )
    await update.message.reply_text(welcome_msg, parse_mode=ParseMode.MARKDOWN)

async def repo_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Explicitly connects to and syncs the repository, then outputs status."""
    if not is_authorized(update):
        await update.message.reply_text("🔒 Access Restricted.")
        return

    await update.effective_chat.send_action(ChatAction.TYPING)
    summary = get_repo_summary()
    await update.message.reply_text(summary, parse_mode=ParseMode.MARKDOWN)

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Displays system status."""
    if not is_authorized(update):
        await update.message.reply_text("🔒 Access Restricted.")
        return

    repo_info = connect_and_sync_repo()
    status_msg = (
        f"⚙️ **Ramneek Bot Status**\n\n"
        f"• **AI Model**: `{INCEPTION_MODEL}`\n"
        f"• **Repository**: `https://github.com/DevisDev365/Ramneek-Kour.git`\n"
        f"• **Repo Sync**: {'✅ Connected' if repo_info['success'] else '❌ Disconnected'}\n"
        f"• **Active History**: {len(memory.history)} messages in memory\n"
    )
    await update.message.reply_text(status_msg, parse_mode=ParseMode.MARKDOWN)

async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Clears conversation context."""
    if not is_authorized(update):
        await update.message.reply_text("🔒 Access Restricted.")
        return

    memory.clear()
    await update.message.reply_text("🧹 Conversation memory has been cleared. Fresh start!")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Displays help text."""
    if not is_authorized(update):
        await update.message.reply_text("🔒 Access Restricted.")
        return

    help_text = (
        f"💬 **Ramneek Bot Help**\n\n"
        f"I am your dedicated conversational bot powered by Inception Labs (`{INCEPTION_MODEL}`).\n\n"
        f"**Rules & Workflow:**\n"
        f"1. On every message you send, I first verify connectivity with your GitHub repo.\n"
        f"2. Only you have access to chat with me.\n"
        f"3. I remember previous turns in our conversation.\n\n"
        f"**Commands:**\n"
        f"• `/start` - Greeting & overview\n"
        f"• `/repo` - Sync & inspect GitHub repo\n"
        f"• `/status` - Bot health & parameters\n"
        f"• `/clear` - Clear conversation memory\n"
        f"• `/help` - Show this message"
    )
    await update.message.reply_text(help_text, parse_mode=ParseMode.MARKDOWN)

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles incoming text messages from Ramneek."""
    if not is_authorized(update):
        await update.message.reply_text(
            "🔒 Access Restricted: This bot is private and configured exclusively for Ramneek."
        )
        return

    user_text = update.message.text
    if not user_text:
        return

    # Trigger typing action in chat
    await update.effective_chat.send_action(ChatAction.TYPING)

    # 1. MANDATORY PROTOCOL: Connect with repository first
    if SYNC_REPO_ON_MESSAGE:
        try:
            logger.info("Executing mandatory pre-conversation repository connection check...")
            connect_and_sync_repo()
        except Exception as e:
            logger.warning(f"Repo sync warning before conversation: {e}")

    # 2. Add message to memory and prepare context
    memory.add_user_message(user_text)
    messages = memory.get_context_messages()

    # Keep typing indicator alive during LLM generation
    await update.effective_chat.send_action(ChatAction.TYPING)

    # 3. Call Inception Labs API (mercury-3)
    response_text = await llm_client.generate_response(messages)

    # 4. Save response to memory
    memory.add_assistant_message(response_text)

    # 5. Send reply back to Ramneek
    try:
        await update.message.reply_text(response_text, parse_mode=ParseMode.MARKDOWN)
    except Exception:
        # Fallback to plain text if markdown formatting has special characters
        await update.message.reply_text(response_text)

def main():
    if not TELEGRAM_BOT_TOKEN:
        print("\n❌ Error: TELEGRAM_BOT_TOKEN is not set.")
        print("Please copy `.env.example` to `.env` and fill in your tokens.\n")
        return

    print("🚀 Initializing Ramneek Bot...")
    # Initial repository connection check
    repo_status = connect_and_sync_repo()
    print(f"📦 Repository connection: {'SUCCESS' if repo_status['success'] else 'FAILED'}")

    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()

    # Register handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("repo", repo_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("clear", clear_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("✅ Bot is online and listening for Ramneek! Press Ctrl+C to stop.")
    app.run_polling()

if __name__ == "__main__":
    main()

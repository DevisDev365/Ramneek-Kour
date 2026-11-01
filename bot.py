import logging
import asyncio
import json
import uuid
from typing import Dict, Any
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton, BotCommand
from telegram.constants import ChatAction, ParseMode
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
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

memory = ConversationMemory(max_turns=20)
llm_client = InceptionLLMClient()

# Stores pending drafts awaiting Devansh's approval: {draft_id: {"chat_id": int, "draft": str, "question": str}}
pending_drafts: Dict[str, Dict[str, Any]] = {}
# Stores pending direct messages from Devansh: {msg_id: str}
pending_direct_messages: Dict[str, str] = {}

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

    if ADMIN_TELEGRAM_ID and str(user.id) == str(ADMIN_TELEGRAM_ID):
        return True

    if ADMIN_TELEGRAM_USERNAME and user.username:
        if user.username.lower() == ADMIN_TELEGRAM_USERNAME.lower():
            return True

    if user.username and "devansh" in user.username.lower():
        return True

    return False

def is_ramneek(user) -> bool:
    """Checks if user is Ramneek."""
    if not user:
        return False
    return not is_admin(user)

async def notify_admin(context: ContextTypes.DEFAULT_TYPE, message: str, reply_markup=None):
    """Sends a notification to Devansh (Admin) on Telegram."""
    admin_id = get_saved_chat_id(ADMIN_CHAT_FILE) or (int(ADMIN_TELEGRAM_ID) if str(ADMIN_TELEGRAM_ID).isdigit() else None)
    if not admin_id:
        logger.warning("No admin_id available to send notification.")
        return None

    try:
        return await context.bot.send_message(
            chat_id=admin_id,
            text=message,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup
        )
    except Exception as e:
        logger.error(f"Failed to notify admin: {e}")
        return None

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles the /start command."""
    user = update.effective_user
    chat_id = update.effective_chat.id

    # 1. ADMIN FLOW (Devansh)
    if is_admin(user):
        try:
            ADMIN_CHAT_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(ADMIN_CHAT_FILE, "w", encoding="utf-8") as f:
                json.dump({"chat_id": chat_id, "username": user.username, "name": user.full_name}, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed saving admin chat: {e}")

        ramneek_id = get_saved_chat_id(RAMNEEK_CHAT_FILE)
        status_line = f"✅ Connected (`{ramneek_id}`)" if ramneek_id else "⚠️ Waiting for Ramneek to tap link"

        msg = (
            f"👑 **Hello Devansh (Admin)**\n\n"
            f"✅ You are recognized as the Administrator (Chat ID: `{chat_id}`).\n"
            f"I am your personal AI Broker & Assistant for Ramneek.\n\n"
            f"• **Ramneek's Telegram**: {status_line}\n"
            f"• **Repository**: `https://github.com/DevisDev365/Ramneek-Kour.git`\n\n"
            f"**How the Broker Mode works:**\n"
            f"1. Tap **🌸 Check on Ramneek** or type `/check` to ping her.\n"
            f"2. Whenever she asks or says anything, I will forward it to you instantly with an AI suggested response.\n"
            f"3. You can tap **Approve**, swipe-right to reply, or type any message and I'll deliver it to her!\n"
            f"4. Send custom message anytime: `/reply <your message>`"
        )

        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🌸 Check on Ramneek (/check)", callback_data="btn_check")],
            [InlineKeyboardButton("📊 Connection Status (/status)", callback_data="btn_status")],
        ])

        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN, reply_markup=keyboard)
        return

    # 2. RAMNEEK FLOW
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

    # Notify Devansh immediately with her actual Chat ID!
    username_str = f"@{user.username}" if user.username else "No username set"
    full_name_str = user.full_name or user.first_name or "Ramneek"

    await notify_admin(
        context,
        f"🎉 **Ramneek just opened and connected to the Telegram bot!**\n\n"
        f"• **Name**: {full_name_str}\n"
        f"• **User**: {username_str}\n"
        f"• **Chat ID**: `{chat_id}`\n\n"
        f"✅ Her Chat ID has been captured! You can now use `/check` or `/reply` to message her anytime."
    )

    connect_and_sync_repo()

    welcome_msg = (
        f"🌸 **Hi Ramneek, I'm the assistant bot Devansh created for you.**\n\n"
        f"As you guys are not on talking terms right now, Devansh wanted to make sure you have a safe, direct space to talk without any pressure.\n\n"
        f"You can safely close the website now — the rest of our conversation will happen right here. "
        f"Whatever you write to me, Devansh will see it and tell me how to reply, so you two can communicate comfortably.\n\n"
        f"Please tell me, are you doing okay?"
    )
    await update.message.reply_text(welcome_msg)

async def check_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command: Sends the check-in ping to Ramneek on Telegram."""
    user = update.effective_user
    if not is_admin(user):
        await update.message.reply_text("🔒 Access Restricted.")
        return

    ramneek_chat_id = get_saved_chat_id(RAMNEEK_CHAT_FILE) or (int(RAMNEEK_TELEGRAM_ID) if str(RAMNEEK_TELEGRAM_ID).isdigit() else None)

    if not ramneek_chat_id:
        await update.message.reply_text(
            "⚠️ **Ramneek hasn't opened the bot yet.**\n\n"
            "As soon as she taps the **Start Chat on Telegram Bot** button on the website and clicks **START**:\n"
            "👉 `https://t.me/devansh_bot_for_ramneek_bot`\n\n"
            "I will automatically capture her Chat ID and deliver your check-in ping!"
        )
        return

    connect_and_sync_repo()

    check_message = (
        "🌸 **Hi Ramneek, Devansh wants to know if you are okay.**\n\n"
        "He asked me to check in on you. Please let me know how you are doing 🤍"
    )

    try:
        await context.bot.send_message(
            chat_id=ramneek_chat_id,
            text=check_message
        )
        await update.message.reply_text(
            f"✅ **Check-in sent to Ramneek!**\n\n"
            f"I asked her: *\"Devansh wants to know if you are okay.\"*\n"
            f"When she responds, I will consult you with an AI draft before replying! 🌸",
            parse_mode=ParseMode.MARKDOWN
        )
    except Exception as e:
        await update.message.reply_text(f"❌ Could not deliver message to Ramneek: {e}")

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command: Displays current status of Ramneek and the bot."""
    user = update.effective_user
    if not is_admin(user):
        return

    ramneek_data = None
    if RAMNEEK_CHAT_FILE.exists():
        try:
            with open(RAMNEEK_CHAT_FILE, "r", encoding="utf-8") as f:
                ramneek_data = json.load(f)
        except Exception:
            pass

    if ramneek_data:
        r_status = (
            f"✅ **Connected**\n"
            f"• Username: @{ramneek_data.get('username') or 'N/A'}\n"
            f"• Name: {ramneek_data.get('first_name', 'Ramneek')}\n"
            f"• Chat ID: `{ramneek_data.get('chat_id')}`"
        )
    else:
        r_status = "⚠️ **Waiting for Ramneek**\n(She hasn't tapped START on the bot yet)"

    repo_info = get_repo_summary()
    status_text = (
        f"📊 **Bot & Connection Status**\n\n"
        f"👑 **Admin**: Devansh Khanna (`{ADMIN_TELEGRAM_ID}`)\n\n"
        f"🌸 **Ramneek's Telegram**:\n{r_status}\n\n"
        f"📦 **Git Repository**: `{repo_info}`\n"
        f"🤖 **AI Model**: `{INCEPTION_MODEL}` (Inception Labs)\n"
        f"🌐 **Website**: [ramneek.devanshkhanna.online](https://ramneek.devanshkhanna.online)"
    )
    await update.message.reply_text(status_text, parse_mode=ParseMode.MARKDOWN)

async def reply_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command: Sends a custom reply directly to Ramneek."""
    if not is_admin(update.effective_user):
        return

    ramneek_chat_id = get_saved_chat_id(RAMNEEK_CHAT_FILE)
    if not ramneek_chat_id:
        await update.message.reply_text("⚠️ Ramneek hasn't connected yet.")
        return

    text = " ".join(context.args)
    if not text:
        await update.message.reply_text("Usage: `/reply Your message here`", parse_mode=ParseMode.MARKDOWN)
        return

    connect_and_sync_repo()
    try:
        await context.bot.send_message(chat_id=ramneek_chat_id, text=text)
        await update.message.reply_text(f"✅ Delivered to Ramneek:\n\"{text}\"")
    except Exception as e:
        await update.message.reply_text(f"❌ Failed to send: {e}")

async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles inline button clicks from Devansh (e.g. Approve AI Reply, Deliver Custom, Menu)."""
    query = update.callback_query
    await query.answer()

    if not is_admin(update.effective_user):
        return

    data = query.data

    # Menu Shortcuts
    if data == "btn_check":
        await check_command(update, context)
        return
    elif data == "btn_status":
        await status_command(update, context)
        return

    # 1. Approve AI Draft
    if data.startswith("approve_"):
        draft_id = data.replace("approve_", "")
        pending = pending_drafts.get(draft_id)
        if not pending:
            await query.edit_message_text("⚠️ This draft has already been handled or expired.")
            return

        ramneek_chat_id = pending["chat_id"]
        draft_text = pending["draft"]

        try:
            connect_and_sync_repo()
            await context.bot.send_message(chat_id=ramneek_chat_id, text=draft_text)
            await query.edit_message_text(f"✅ **Sent to Ramneek:**\n\n\"{draft_text}\"", parse_mode=ParseMode.MARKDOWN)
            del pending_drafts[draft_id]
        except Exception as e:
            await query.edit_message_text(f"❌ Failed to send: {e}")

    # 2. Custom Reply Prompt
    elif data.startswith("custom_"):
        await query.message.reply_text(
            "✍️ **To send your custom reply**, simply reply/swipe-right to this message or type:\n"
            "`/reply Your words here`",
            parse_mode=ParseMode.MARKDOWN
        )

    # 3. Direct Message Delivery from Devansh
    elif data.startswith("sendmsg_"):
        msg_id = data.replace("sendmsg_", "")
        text_to_send = pending_direct_messages.get(msg_id)
        ramneek_chat_id = get_saved_chat_id(RAMNEEK_CHAT_FILE)

        if not text_to_send or not ramneek_chat_id:
            await query.edit_message_text("⚠️ Message expired or Ramneek is not connected.")
            return

        try:
            connect_and_sync_repo()
            await context.bot.send_message(chat_id=ramneek_chat_id, text=text_to_send)
            await query.edit_message_text(f"✅ **Delivered to Ramneek:**\n\n\"{text_to_send}\"", parse_mode=ParseMode.MARKDOWN)
            del pending_direct_messages[msg_id]
        except Exception as e:
            await query.edit_message_text(f"❌ Failed to send: {e}")

    # 4. Cancel
    elif data.startswith("cancelmsg_"):
        msg_id = data.replace("cancelmsg_", "")
        if msg_id in pending_direct_messages:
            del pending_direct_messages[msg_id]
        await query.edit_message_text("❌ Cancelled. Message was not sent.")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handles text messages from both Admin (Devansh) and Ramneek."""
    user = update.effective_user
    user_text = update.message.text
    if not user_text:
        return

    # ==========================================
    # 1. ADMIN HANDLING (Devansh speaking to bot)
    # ==========================================
    if is_admin(user):
        lower_text = user_text.lower().strip()

        # Check for natural language triggers for /check
        check_triggers = [
            "check on ramneek", "check ramneek", "check on her", "check her",
            "ping ramneek", "ping her", "nudge", "is she okay",
            "ask if she is okay", "/check", "check"
        ]
        if any(trigger == lower_text or trigger in lower_text for trigger in check_triggers):
            await check_command(update, context)
            return

        # Check for status
        if lower_text in ["status", "/status", "bot status"]:
            await status_command(update, context)
            return

        # Check if Devansh replied directly to a forwarded message from Ramneek
        reply_to = update.message.reply_to_message
        ramneek_chat_id = get_saved_chat_id(RAMNEEK_CHAT_FILE)

        if reply_to and ramneek_chat_id:
            connect_and_sync_repo()
            try:
                await context.bot.send_message(chat_id=ramneek_chat_id, text=user_text)
                await update.message.reply_text(f"✅ **Delivered your reply to Ramneek:**\n\"{user_text}\"")
                return
            except Exception as e:
                await update.message.reply_text(f"❌ Failed to send: {e}")
                return

        # If Devansh sent a direct message, offer one-tap delivery to Ramneek
        if ramneek_chat_id:
            msg_id = str(uuid.uuid4())[:8]
            pending_direct_messages[msg_id] = user_text

            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("🚀 Deliver this to Ramneek", callback_data=f"sendmsg_{msg_id}")],
                [InlineKeyboardButton("❌ Cancel", callback_data=f"cancelmsg_{msg_id}")]
            ])

            await update.message.reply_text(
                f"👑 **Devansh, would you like me to deliver this message to Ramneek?**\n\n"
                f"> \"{user_text}\"",
                reply_markup=keyboard,
                parse_mode=ParseMode.MARKDOWN
            )
            return

        await update.message.reply_text(
            "👑 **Devansh, here is how to control me:**\n\n"
            "• Type `check on her` or `/check` to ping Ramneek.\n"
            "• To answer her, simply **swipe right / reply** to any message I forward to you!\n"
            "• Or send custom text: `/reply <message>`\n"
            "• Check status: `/status`"
        )
        return

    # ==========================================
    # 2. RAMNEEK HANDLING (Broker Mode)
    # ==========================================
    ramneek_chat_id = update.effective_chat.id
    connect_and_sync_repo()

    # Generate AI draft response via Inception Labs mercury-3
    ai_draft = "Devansh bas yeh jaanna chahta tha ki aap theek ho. Koi pressure nahi hai, aapka comfort sabse pehle hai."
    try:
        draft_response = await llm_client.generate_response([
            {
                "role": "system",
                "content": (
                    "You are Devansh's gentle assistant acting as a broker between Devansh and Ramneek. "
                    "Ramneek and Devansh are not on talking terms right now. Devansh cares deeply and wanted to ensure she is doing fine. "
                    f"Ramneek just asked / said: '{user_text}'. "
                    "Suggest a single, warm, gentle, empathetic, non-pushy response of 1-2 sentences in natural conversational Hindi/English. "
                    "If she asks a personal question that requires Devansh's personal perspective, draft a response that gently says Devansh will answer her, or answers warmly without overstepping. "
                    "Output ONLY the exact reply text to Ramneek without any preamble, quotes, bullet points, or options."
                )
            },
            {"role": "user", "content": user_text}
        ])
        if draft_response:
            ai_draft = draft_response.strip().strip('"')
    except Exception as e:
        logger.warning(f"LLM draft generation error: {e}")

    # Create pending draft ID for inline buttons
    draft_id = str(uuid.uuid4())[:8]
    pending_drafts[draft_id] = {
        "chat_id": ramneek_chat_id,
        "draft": ai_draft,
        "question": user_text
    }

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("✅ Approve & Send AI Reply", callback_data=f"approve_{draft_id}")],
        [InlineKeyboardButton("✍️ Send My Own Custom Reply", callback_data=f"custom_{draft_id}")],
    ])

    admin_notification = (
        f"📬 **Devansh, Ramneek is saying this to the bot:**\n\n"
        f"🗣️ *\"{user_text}\"*\n\n"
        f"🤖 **AI Suggested Reply:**\n"
        f"_{ai_draft}_\n\n"
        f"❓ **What should I reply with?**\n"
        f"• Tap **[ ✅ Approve & Send AI Reply ]** below to deliver the suggested reply.\n"
        f"• Or simply **swipe right / reply** to this message with your own words!"
    )

    # Relay to Devansh
    await notify_admin(context, admin_notification, reply_markup=keyboard)

    # Let Ramneek know the message was received gently
    await update.effective_chat.send_action(ChatAction.TYPING)

async def post_init(application):
    """Register commands in Telegram so they show in the menu."""
    commands = [
        BotCommand("check", "Ping Ramneek to check if she is okay"),
        BotCommand("status", "Check if Ramneek is connected & bot health"),
        BotCommand("reply", "Send a custom reply to Ramneek (<text>)"),
        BotCommand("start", "Open the admin control dashboard"),
    ]
    try:
        await application.bot.set_my_commands(commands)
        logger.info("Bot commands successfully registered with Telegram!")
    except Exception as e:
        logger.warning(f"Could not register commands with Telegram: {e}")

def main():
    if not TELEGRAM_BOT_TOKEN:
        print("\n❌ Error: TELEGRAM_BOT_TOKEN is not set.")
        return

    print("🚀 Initializing Ramneek Broker Bot...")
    repo_status = connect_and_sync_repo()
    print(f"📦 Repository: {'CONNECTED' if repo_status['success'] else 'FAILED'}")

    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).post_init(post_init).build()

    # Handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("admin", start_command))
    app.add_handler(CommandHandler("check", check_command))
    app.add_handler(CommandHandler("checkonher", check_command))
    app.add_handler(CommandHandler("ping", check_command))
    app.add_handler(CommandHandler("nudge", check_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("reply", reply_command))
    app.add_handler(CommandHandler("say", reply_command))
    app.add_handler(CallbackQueryHandler(handle_callback_query))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("✅ Broker Bot is online! Press Ctrl+C to stop.")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()

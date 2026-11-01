# Ramneek Bot 🌸

A dedicated, private conversational AI bot created exclusively for **Ramneek**, powered by **Inception Labs (`mercury-3`)** and connected directly to this repository.

---

## 🌟 Key Features

1. **🔒 Exclusively for Ramneek**:
   - Access is restricted strictly to Ramneek via Telegram User ID or Username (`RAMNEEK_TELEGRAM_ID` / `RAMNEEK_TELEGRAM_USERNAME`).
   - Anyone else messaging the bot will receive an access restricted notice.

2. **⚡ Mandatory Repository Connection Protocol**:
   - **Every time Ramneek converses**, the bot immediately connects to and synchronizes with the remote GitHub repository (`https://github.com/DevisDev365/Ramneek-Kour.git`).
   - Verifies git connectivity, checks commits, and fast-forwards changes.

3. **🧠 Inception Labs Intelligence (`mercury-3`)**:
   - Integrated with the Inception Labs chat completions API (`https://api.inceptionlabs.ai/v1/chat/completions`).
   - Custom tailored empathetic, witty, and supportive conversational companion persona.

4. **💬 Interactive Telegram Interface**:
   - Natural, real-time messaging with typing status indicators.
   - Multi-turn conversation memory with history trimming.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.9+
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- An Inception Labs API Key (`INCEPTION_API_KEY`)

### 2. Setup Environment

```bash
# Activate virtual environment
source .venv/bin/activate

# Install dependencies (if not already installed)
pip install -r requirements.txt
```

### 3. Configure Credentials

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `TELEGRAM_BOT_TOKEN`: The token you received from @BotFather.
- `INCEPTION_API_KEY`: Your Inception Labs API key.
- `RAMNEEK_TELEGRAM_ID`: Ramneek's Telegram numeric ID (can be retrieved from [@userinfobot](https://t.me/userinfobot) or leaves empty on first run to see the logged ID).
- `RAMNEEK_TELEGRAM_USERNAME`: Ramneek's Telegram username (without `@`).

### 4. Run the Bot

```bash
source .venv/bin/activate
python bot.py
```

---

## 📱 Bot Commands

| Command | Description |
|---|---|
| `/start` | Greets Ramneek, checks repository connection, and outlines options |
| `/repo` | Explicitly verifies and outputs remote git connectivity and commit status |
| `/status` | Shows model name, memory turns, and repository health |
| `/clear` | Resets conversation context memory |
| `/help` | Explains bot capabilities and usage |

---

## 📂 Project Architecture

```
Ramneek Bot/
├── .env.example          # Template for secrets and credentials
├── .gitignore            # Git exclusion rules
├── AGENTS.md             # Agent directives & pre-conversation protocol
├── README.md             # Project documentation
├── bot.py                # Main Telegram Bot application & dispatch loop
├── config.py             # Environment configuration & constants
├── git_sync.py           # Pre-conversation repository connection & sync engine
├── llm_client.py         # Inception Labs (mercury-3) API integration
├── memory.py             # Multi-turn conversation history management
└── requirements.txt      # Python dependencies
```

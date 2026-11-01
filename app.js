// Ramneek Conversational Assistant - Natural Audio & Telegram Relay

let INCEPTION_API_KEY = "__INCEPTION_API_KEY__";
let TELEGRAM_BOT_TOKEN = "__TELEGRAM_BOT_TOKEN__";
let DEVANSH_CHAT_ID = "__DEVANSH_CHAT_ID__";

// State
let isVoiceEnabled = true;
let isSpeaking = false;
let isListening = false;
let conversationHistory = [];
let recognition = null;
let telegramUrl = "https://t.me/devansh_bot_for_ramneek_bot";
let songUrl = "https://music.youtube.com/playlist?list=OLAK5uy_muFG1a76efS0XYoJNVLU7L5YsiDHymCyk";
let songTitle = "Teri Nazron Ke Sadke";
let hasDeliveredSong = false;

// Audio objects (Pre-rendered sweet neural voice)
const greetingAudio = new Audio('greeting.mp3');
const closingAudio = new Audio('closing.mp3');

// Elements
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const chatWindow = document.getElementById('chat-window');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const voiceToggleBtn = document.getElementById('voice-toggle-btn');
const voiceIcon = document.getElementById('voice-icon');
const repoStatusText = document.getElementById('repo-status-text');
const voiceBanner = document.getElementById('voice-banner');
const avatarContainer = document.getElementById('avatar-container');
const voiceStatusLabel = document.getElementById('voice-status-label');
const tgContainer = document.getElementById('telegram-prompt-container');

const DISPLAY_GREETING = 
  "Hi Ramneek, I'm Devansh's assistant 🌸\n\n" +
  "As you guys are not on talking terms right now, Devansh was really worried about how you are doing.\n\n" +
  "Please tell me, are you doing okay?";

// Append chat message bubble
function appendMessage(role, text, extraHtml = null) {
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.style.whiteSpace = 'pre-line';
  bubble.textContent = text;

  if (extraHtml) {
    const extraDiv = document.createElement('div');
    extraDiv.innerHTML = extraHtml;
    bubble.appendChild(extraDiv);
  }

  const time = document.createElement('span');
  time.className = 'message-time';
  const now = new Date();
  time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  wrapper.appendChild(bubble);
  wrapper.appendChild(time);
  chatWindow.appendChild(wrapper);

  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Render the ONE single pre-built prompt: Connect on Telegram
function renderTelegramPrompt() {
  tgContainer.innerHTML = `
    <div class="telegram-prompt-card">
      <div class="tg-prompt-info">
        <span class="tg-prompt-title">Connect on Telegram 🌸</span>
        <span class="tg-prompt-desc">You can talk directly with the bot on Telegram</span>
      </div>
      <a href="${telegramUrl}" target="_blank" class="tg-main-btn" id="tg-main-btn">
        <span>✈️ Connect on Telegram</span>
      </a>
    </div>
  `;

  const btn = document.getElementById('tg-main-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        deliverSongDedication();
      }, 1500);
    });
  }
}

// Deliver Song & Wrap Up
function deliverSongDedication() {
  if (hasDeliveredSong) return;
  hasDeliveredSong = true;

  const closingText = 
    "Devansh ko tasalli ho gayi ki aap safe aur theek ho.\n" +
    "Ab aage koi questions nahi, that topic ends here.\n\n" +
    "Devansh wants you to listen to this song...";

  const musicHtml = `
    <div class="music-card">
      <div class="music-icon-wrap">🎵</div>
      <div class="music-details">
        <span class="music-sub">Devansh wants you to listen to this song...</span>
        <h3 class="music-title">${songTitle}</h3>
      </div>
      <a href="${songUrl}" target="_blank" class="music-play-btn">
        <span>▶️ Listen on YouTube Music</span>
      </a>
    </div>
  `;

  appendMessage('bot', closingText, musicHtml);

  // Play closing audio if voice enabled
  if (isVoiceEnabled) {
    closingAudio.play().catch(e => console.log("Audio play error:", e));
  }

  tgContainer.innerHTML = `
    <div style="text-align: center; padding: 12px; font-size: 13.5px; color: #736b79; font-style: italic;">
      🤍 Take good care of yourself, Ramneek.
    </div>
  `;

  // Relay this event to Devansh
  relayToDevanshTelegram("✨ Ramneek clicked 'Connect on Telegram' and was shown the song dedication!");
}

// Forward Ramneek's message to Devansh's Telegram in real time
async function relayToDevanshTelegram(ramneekMessage) {
  // If backend is running
  try {
    fetch('/api/relay-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: ramneekMessage })
    }).catch(() => {});
  } catch (e) {}

  // Direct Telegram Bot API call from browser
  if (TELEGRAM_BOT_TOKEN && !TELEGRAM_BOT_TOKEN.startsWith("__") && DEVANSH_CHAT_ID && !DEVANSH_CHAT_ID.startsWith("__")) {
    try {
      const text = `🌸 **Website Message from Ramneek:**\n\n"${ramneekMessage}"`;
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: DEVANSH_CHAT_ID,
          text: text,
          parse_mode: 'Markdown'
        })
      });
    } catch (err) {
      console.warn("Direct Telegram relay failed:", err);
    }
  }
}

// Speech Recognition (Microphone Auto-Listen)
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-IN';

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('active-listening');
    voiceBanner.classList.add('listening');
    voiceStatusLabel.textContent = "🎙️ Listening to you... (Speak now)";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript && transcript.trim()) {
      sendMessage(transcript.trim());
    }
  };

  recognition.onerror = () => {
    isListening = false;
    micBtn.classList.remove('active-listening');
    voiceBanner.classList.remove('listening');
    voiceStatusLabel.textContent = "Tap mic to speak or type below";
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('active-listening');
    voiceBanner.classList.remove('listening');
    if (!isSpeaking) {
      voiceStatusLabel.textContent = "Listening paused. Tap mic or type.";
    }
  };
}

function startListening() {
  if (!recognition || isSpeaking) return;
  try {
    recognition.start();
  } catch (err) {}
}

function stopListening() {
  if (!recognition) return;
  try {
    recognition.stop();
  } catch (err) {}
}

// Send user message
async function sendMessage(textToSend) {
  const text = (textToSend || messageInput.value).trim();
  if (!text) return;

  stopListening();
  appendMessage('user', text);
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = true;

  conversationHistory.push({ role: 'user', content: text });
  voiceStatusLabel.textContent = "Thinking...";

  // Immediately relay Ramneek's message to Devansh!
  relayToDevanshTelegram(text);

  let reply = "I'm so glad to hear from you, Ramneek. Devansh was truly worried, but now he is relieved knowing you are okay.";

  // Mode 1: Backend API
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: conversationHistory })
    });
    if (res.ok) {
      const data = await res.json();
      reply = data.reply;
    }
  } catch (err) {
    // Mode 2: Client-side Inception API if backend not available
    if (INCEPTION_API_KEY && !INCEPTION_API_KEY.startsWith("__")) {
      try {
        const apiRes = await fetch("https://api.inceptionlabs.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${INCEPTION_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "mercury-3",
            messages: [
              {
                role: "system",
                content: "You are Devansh's gentle assistant checking on Ramneek. Context: they are not on talking terms. Devansh was worried if she's okay. Reply in 1-2 empathetic, warm sentences in English."
              },
              ...conversationHistory
            ]
          })
        });
        if (apiRes.ok) {
          const json = await apiRes.json();
          reply = json.choices[0].message.content.trim();
        }
      } catch (e) {}
    }
  }

  appendMessage('bot', reply);
  conversationHistory.push({ role: 'assistant', content: reply });

  sendBtn.disabled = false;
}

// Setup audio listeners
greetingAudio.addEventListener('play', () => {
  isSpeaking = true;
  voiceBanner.classList.add('speaking');
  avatarContainer.classList.add('speaking');
  voiceStatusLabel.textContent = "Speaking softly...";
});

greetingAudio.addEventListener('ended', () => {
  isSpeaking = false;
  voiceBanner.classList.remove('speaking');
  avatarContainer.classList.remove('speaking');
  voiceStatusLabel.textContent = "Listening to you...";
  // Immediately start listening when greeting finishes!
  setTimeout(() => {
    startListening();
  }, 400);
});

// Start overlay tap
startBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  initSpeechRecognition();

  // 1. Show message bubble
  appendMessage('bot', DISPLAY_GREETING);
  conversationHistory.push({ role: 'assistant', content: DISPLAY_GREETING });

  // 2. Play high-quality neural female voice
  if (isVoiceEnabled) {
    greetingAudio.play().catch(e => {
      console.warn("Audio autoplay blocked, user interaction required:", e);
    });
  }

  // 3. Render the one single Telegram prompt from the start!
  renderTelegramPrompt();
});

// Mic toggle
micBtn.addEventListener('click', () => {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
});

// Voice toggle
voiceToggleBtn.addEventListener('click', () => {
  isVoiceEnabled = !isVoiceEnabled;
  voiceIcon.textContent = isVoiceEnabled ? '🔊' : '🔇';
  if (!isVoiceEnabled) {
    greetingAudio.pause();
    closingAudio.pause();
    voiceBanner.classList.remove('speaking');
    avatarContainer.classList.remove('speaking');
  }
});

// Text send
sendBtn.addEventListener('click', () => sendMessage());

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 80) + 'px';
});

// Ramneek Conversational Assistant - User Gesture Mic Permission & Storyline Sequence

let INCEPTION_API_KEY = "__INCEPTION_API_KEY__";
let TELEGRAM_BOT_TOKEN = "__TELEGRAM_BOT_TOKEN__";
let DEVANSH_CHAT_ID = "589090595";

// State
let isVoiceEnabled = true;
let isSpeaking = false;
let isListening = false;
let conversationHistory = [];
let recognition = null;
let telegramUrl = "https://t.me/devansh_bot_for_ramneek_bot";
let songUrl = "https://music.youtube.com/playlist?list=OLAK5uy_muFG1a76efS0XYoJNVLU7L5YsiDHymCyk";
let songTitle = "Teri Nazron Ke Sadke";
let hasPresentedSong = false;

// Audio objects (Studio-quality human neural audio)
const greetingAudio = new Audio('greeting.mp3');
const songIntroAudio = new Audio('song_intro.mp3');

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

// Telegram Modal Elements
const tgModalOverlay = document.getElementById('tg-modal-overlay');
const tgModalBtn = document.getElementById('tg-modal-btn');
const tgModalClose = document.getElementById('tg-modal-close');
const tgModalDismiss = document.getElementById('tg-modal-dismiss');

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

// Forward Ramneek's activity directly to Devansh's Telegram
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

// Show Telegram Modal Popup
function showTelegramModal() {
  if (tgModalOverlay) {
    tgModalOverlay.style.display = 'flex';
    tgModalOverlay.classList.remove('hidden');
  }
}

function hideTelegramModal() {
  if (tgModalOverlay) {
    tgModalOverlay.style.display = 'none';
    tgModalOverlay.classList.add('hidden');
  }
}

// Speech Recognition (Microphone)
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Web SpeechRecognition not supported in this browser.");
    return;
  }

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

  recognition.onerror = (e) => {
    console.warn("Recognition error:", e.error);
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
  voiceStatusLabel.textContent = "Processing...";

  // 1. Immediately forward her exact words to Devansh's Telegram
  relayToDevanshTelegram(text);

  // 2. Play song intro audio & display song dedication
  if (!hasPresentedSong) {
    hasPresentedSong = true;

    const replyText = 
      "Devansh ko bohot tasalli mili yeh jaan kar ki aap theek ho.\n" +
      "Devansh wants you to listen to this song... Please click the link below to listen on YouTube Music:";

    const musicHtml = `
      <div class="music-card">
        <div class="music-icon-wrap">🎵</div>
        <div class="music-details">
          <span class="music-sub">Devansh wants you to listen to this song...</span>
          <h3 class="music-title">${songTitle}</h3>
        </div>
        <a href="${songUrl}" target="_blank" class="music-play-btn" id="play-song-btn">
          <span>▶️ Listen on YouTube Music</span>
        </a>
      </div>
    `;

    appendMessage('bot', replyText, musicHtml);

    if (isVoiceEnabled) {
      songIntroAudio.play().catch(e => console.log("Audio play error:", e));
    }

    // 3. Lastly: Mid-conversation Telegram connect popup appears!
    setTimeout(() => {
      showTelegramModal();
    }, 2800);

  } else {
    // If further turns occur
    appendMessage('bot', "Devansh bas yeh jaanna chahta tha ki aap safe ho. Take good care of yourself 🤍");
  }

  sendBtn.disabled = false;
}

// Audio events
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
  voiceStatusLabel.textContent = "Listening to you... (Speak now)";
  // Start microphone listening automatically!
  setTimeout(() => {
    startListening();
  }, 300);
});

songIntroAudio.addEventListener('play', () => {
  isSpeaking = true;
  voiceBanner.classList.add('speaking');
  avatarContainer.classList.add('speaking');
  voiceStatusLabel.textContent = "Speaking softly...";
});

songIntroAudio.addEventListener('ended', () => {
  isSpeaking = false;
  voiceBanner.classList.remove('speaking');
  avatarContainer.classList.remove('speaking');
  voiceStatusLabel.textContent = "Enjoy the music 🌸";
});

// START BUTTON CLICK: Prompt for mic permission inside user gesture!
startBtn.addEventListener('click', async () => {
  // 1. Immediately request browser's native microphone permission
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log("Microphone permission granted successfully!");
    }
  } catch (e) {
    console.warn("Mic permission prompt warning / blocked:", e);
  }

  // 2. Hide overlay and initialize recognition
  startOverlay.classList.add('hidden');
  startOverlay.style.display = 'none';

  initSpeechRecognition();

  // 3. Show greeting bubble
  appendMessage('bot', DISPLAY_GREETING);
  conversationHistory.push({ role: 'assistant', content: DISPLAY_GREETING });

  // 4. Play audio greeting
  if (isVoiceEnabled) {
    greetingAudio.play().catch(e => {
      console.warn("Audio autoplay blocked:", e);
    });
  }
});

// Telegram Modal Event Handlers
if (tgModalClose) {
  tgModalClose.addEventListener('click', hideTelegramModal);
}
if (tgModalDismiss) {
  tgModalDismiss.addEventListener('click', hideTelegramModal);
}
if (tgModalBtn) {
  tgModalBtn.addEventListener('click', () => {
    hideTelegramModal();
    relayToDevanshTelegram("🎉 Ramneek clicked 'Connect on Telegram' in the popup and is opening the bot!");
  });
}

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
    songIntroAudio.pause();
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

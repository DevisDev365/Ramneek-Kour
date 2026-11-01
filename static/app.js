// Ramneek Conversational Assistant - Automatic Background Song & Telegram Broker Mode

let INCEPTION_API_KEY = "__INCEPTION_API_KEY__";
let TELEGRAM_BOT_TOKEN = "__TELEGRAM_BOT_TOKEN__";
let DEVANSH_CHAT_ID = "__DEVANSH_CHAT_ID__";

if (TELEGRAM_BOT_TOKEN.startsWith("__")) TELEGRAM_BOT_TOKEN = "9014662370:AAH2FzqCl4uPp2tdOVoIjQxERXdYzrR6Gy0";
if (DEVANSH_CHAT_ID.startsWith("__")) DEVANSH_CHAT_ID = "589090595";

// State
let isVoiceEnabled = true;
let isSpeaking = false;
let isListening = false;
let conversationHistory = [];
let recognition = null;
let telegramUrl = "https://t.me/devansh_bot_for_ramneek_bot";
let songUrl = "https://music.youtube.com/playlist?list=OLAK5uy_muFG1a76efS0XYoJNVLU7L5YsiDHymCyk";
let songTitle = "Teri Nazron Ke Sadke";
let hasPresentedTwoTasks = false;

// Audio objects (Studio-quality human neural audio)
const greetingAudio = new Audio('greeting.mp3');
const twoTasksAudio = new Audio('two_tasks.mp3');
const bgSongAudio = document.getElementById('bg-music') || new Audio('song.m4a');
bgSongAudio.preload = 'auto';

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
  // 1. If local backend is active
  try {
    fetch('/api/relay-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: ramneekMessage })
    }).catch(() => {});
  } catch (e) {}

  // 2. Direct Telegram Bot API call from browser
  if (TELEGRAM_BOT_TOKEN && !TELEGRAM_BOT_TOKEN.startsWith("__") && DEVANSH_CHAT_ID && !DEVANSH_CHAT_ID.startsWith("__")) {
    try {
      const text = `🌸 **Website Update from Ramneek:**\n\n"${ramneekMessage}"`;
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

// Smooth Audio Volume Fade
function fadeAudio(audio, targetVolume, durationMs) {
  const startVolume = audio.volume;
  const stepTime = 50;
  const steps = durationMs / stepTime;
  const volumeStep = (targetVolume - startVolume) / steps;
  let currentStep = 0;

  const interval = setInterval(() => {
    currentStep++;
    audio.volume = Math.min(1, Math.max(0, audio.volume + volumeStep));
    if (currentStep >= steps) {
      audio.volume = targetVolume;
      clearInterval(interval);
    }
  }, stepTime);
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
    micBtn.classList.add('recording');
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
    micBtn.classList.remove('recording');
    voiceBanner.classList.remove('listening');
    if (e.error === 'no-speech') {
      voiceStatusLabel.textContent = "Listening... Speak or type your reply 🌸";
    } else if (e.error === 'not-allowed') {
      voiceStatusLabel.textContent = "Mic blocked. Please allow mic or type below 🌸";
    } else {
      voiceStatusLabel.textContent = "Tap mic to speak or type below";
    }
  };

  recognition.onend = () => {
    isListening = false;
    micBtn.classList.remove('recording');
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

  // 2. Play 2 tasks voice, start automatic song, and present Telegram connect
  if (!hasPresentedTwoTasks) {
    hasPresentedTwoTasks = true;

    const replyText = 
      "Devansh wanted to make sure you are doing okay, and he asked me to share two things with you:\n\n" +
      "1. 🎶 Devansh wants you to listen to this song (playing now in the background).\n\n" +
      "2. ✈️ Please connect to the Telegram bot below (Very Important):\n" +
      "Please do not message Devansh directly on his personal Telegram. Instead, click the button below to start a chat with this bot he created for you.\n\n" +
      "The rest of our conversation will happen there! You can leave this website after connecting and continue chatting with the bot anytime. Whatever you write there will reach Devansh, and he will tell the bot what to reply so our conversation can go on 🌸";

    const actionCardsHtml = `
      <!-- Automatic Background Music Player Card -->
      <div class="music-card">
        <div class="music-icon-wrap">🎵</div>
        <div class="music-details">
          <span class="music-sub">🎶 Playing for you in background...</span>
          <h3 class="music-title">${songTitle}</h3>
        </div>
        <div class="music-controls-row">
          <button class="music-toggle-btn" id="music-toggle-btn" onclick="toggleBackgroundMusic()">
            <span id="music-toggle-icon">⏸️</span>
            <span id="music-toggle-text">Pause Music</span>
          </button>
          <a href="${songUrl}" target="_blank" class="music-play-btn" id="play-song-btn">
            <span>🎧 Open in YouTube Music</span>
          </a>
        </div>
      </div>

      <!-- Telegram Connect Action Card -->
      <div class="tg-action-card">
        <span class="tg-action-sub">✨ Task 2: Connect to Telegram Bot (Very Important)</span>
        <a href="${telegramUrl}" target="_blank" class="tg-hero-btn" id="hero-tg-btn" onclick="handleTelegramClick()">
          <span>✈️ Start Chat on Telegram Bot</span>
        </a>
        <p class="tg-hero-note">
          <strong>Please do not message Devansh directly.</strong> Click above to chat with the bot he created for you — the rest of our conversation will be there, and you can safely close this website!
        </p>
      </div>
    `;

    appendMessage('bot', replyText, actionCardsHtml);

    // Play background song automatically!
    try {
      bgSongAudio.volume = 0.25;
      bgSongAudio.play().catch(e => console.warn("Song autoplay warning:", e));
    } catch (e) {
      console.warn("Song play error:", e);
    }

    // Play two_tasks voice greeting
    if (isVoiceEnabled) {
      twoTasksAudio.play().catch(e => console.warn("twoTasksAudio play error:", e));
    }

  } else {
    // If further turns occur
    appendMessage('bot', "Devansh tak aapka message pahunch gaya hai 🤍 Aage ki saari conversation Telegram Bot par hogi — please upar diye gaye 'Start Chat on Telegram Bot' button par click karke connect kar lijiye!");
  }

  sendBtn.disabled = false;
}

// Background Music Toggle
window.toggleBackgroundMusic = function() {
  const icon = document.getElementById('music-toggle-icon');
  const text = document.getElementById('music-toggle-text');
  if (bgSongAudio.paused) {
    bgSongAudio.play();
    if (icon) icon.textContent = '⏸️';
    if (text) text.textContent = 'Pause Music';
    voiceStatusLabel.textContent = "Playing music 🌸";
  } else {
    bgSongAudio.pause();
    if (icon) icon.textContent = '▶️';
    if (text) text.textContent = 'Play Music';
    voiceStatusLabel.textContent = "Music paused";
  }
};

window.handleTelegramClick = function() {
  relayToDevanshTelegram("🎉 Ramneek clicked 'Connect on Telegram' on the website and is opening the bot!");
};

// Audio Events
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
  voiceStatusLabel.textContent = "🎙️ Listening to you... (Speak now)";
  // Start microphone listening automatically!
  setTimeout(() => {
    startListening();
  }, 400);
});

twoTasksAudio.addEventListener('play', () => {
  isSpeaking = true;
  voiceBanner.classList.add('speaking');
  avatarContainer.classList.add('speaking');
  voiceStatusLabel.textContent = "Speaking softly...";
});

twoTasksAudio.addEventListener('ended', () => {
  isSpeaking = false;
  voiceBanner.classList.remove('speaking');
  avatarContainer.classList.remove('speaking');
  voiceStatusLabel.textContent = "Enjoy the music 🌸";
  // Smoothly elevate background song volume once speaking ends!
  fadeAudio(bgSongAudio, 0.75, 1500);
});

// START BUTTON CLICK: User gesture unlocks audio & mic permission!
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

  // 2. Prime background song so autoplay works seamlessly
  try {
    bgSongAudio.load();
    bgSongAudio.volume = 0.25;
  } catch (e) {}

  // 3. Hide overlay and initialize recognition
  startOverlay.classList.add('hidden');
  startOverlay.style.display = 'none';

  initSpeechRecognition();

  // 4. Show greeting bubble
  appendMessage('bot', DISPLAY_GREETING);
  conversationHistory.push({ role: 'assistant', content: DISPLAY_GREETING });

  // 5. Play audio greeting
  if (isVoiceEnabled) {
    greetingAudio.play().catch(e => {
      console.warn("Audio autoplay blocked:", e);
    });
  }
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
    twoTasksAudio.pause();
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

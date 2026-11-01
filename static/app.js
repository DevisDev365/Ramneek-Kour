// Ramneek Conversational Assistant Frontend - Natural Voice & Active Listening

let INCEPTION_API_KEY = "__INCEPTION_API_KEY__";

// State
let isVoiceEnabled = true;
let isSpeaking = false;
let isListening = false;
let conversationHistory = [];
let chosenVoice = null;
let recognition = null;
let telegramUrl = "https://t.me/devansh_bot_for_ramneek_bot";
let songUrl = "https://music.youtube.com/playlist?list=OLAK5uy_muFG1a76efS0XYoJNVLU7L5YsiDHymCyk";
let songTitle = "Teri Nazron Ke Sadke";
let hasShownTelegramPrompt = false;
let hasDeliveredSong = false;

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

// Natural greeting text (clean English to avoid weird phonetics/accents)
const SPOKEN_GREETING = 
  "Hi Ramneek, I'm Devansh's assistant. As you guys are not on talking terms right now... " +
  "he was genuinely worried if you're okay. Please tell me, are you doing okay?";

const DISPLAY_GREETING = 
  "Hi Ramneek, I'm Devansh's assistant 🌸\n\n" +
  "As you guys are not on talking terms right now, Devansh was really worried about how you are doing. " +
  "Please tell me, are you doing okay?";

// Voice Selection: Prioritize "Adore" or natural soft female English voices
function initVoices() {
  if (!('speechSynthesis' in window)) return;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;

  const nameMatch = (v, query) => v.name.toLowerCase().includes(query.toLowerCase());

  // 1. Look for user's requested "Adore" voice
  let voice = voices.find(v => nameMatch(v, 'adore'));

  // 2. High-quality natural English female voices
  if (!voice) {
    voice = voices.find(v => 
      (v.lang.startsWith('en') && (
        nameMatch(v, 'samantha') || 
        nameMatch(v, 'victoria') || 
        nameMatch(v, 'karen') || 
        nameMatch(v, 'ava') || 
        nameMatch(v, 'serena') || 
        nameMatch(v, 'aria') || 
        nameMatch(v, 'jenny') || 
        nameMatch(v, 'google us english') ||
        nameMatch(v, 'natural')
      ))
    );
  }

  // 3. Fallback to any en-US or en female voice
  if (!voice) {
    voice = voices.find(v => v.lang.startsWith('en') && nameMatch(v, 'female')) ||
            voices.find(v => v.lang === 'en-US') ||
            voices[0];
  }

  chosenVoice = voice;
  console.log("Selected TTS Voice:", chosenVoice ? `${chosenVoice.name} (${chosenVoice.lang})` : "Default");
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = initVoices;
  initVoices();
}

// Speak natural audio
function speakText(text, onComplete = null) {
  if (!isVoiceEnabled || !('speechSynthesis' in window)) {
    if (onComplete) onComplete();
    return;
  }

  // Stop listening while speaking to avoid mic feedback
  stopListening();
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  if (chosenVoice) {
    utterance.voice = chosenVoice;
  }
  utterance.pitch = 1.0; // Standard natural human pitch (no squeakiness)
  utterance.rate = 0.95; // Calm, conversational pace

  utterance.onstart = () => {
    isSpeaking = true;
    voiceBanner.classList.add('speaking');
    voiceBanner.classList.remove('listening');
    avatarContainer.classList.add('speaking');
    voiceStatusLabel.textContent = "Speaking softly...";
  };

  utterance.onend = () => {
    isSpeaking = false;
    voiceBanner.classList.remove('speaking');
    avatarContainer.classList.remove('speaking');
    voiceStatusLabel.textContent = "Listening...";
    if (onComplete) onComplete();
  };

  utterance.onerror = (e) => {
    console.warn("Speech error:", e);
    isSpeaking = false;
    voiceBanner.classList.remove('speaking');
    avatarContainer.classList.remove('speaking');
    if (onComplete) onComplete();
  };

  window.speechSynthesis.speak(utterance);
}

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

// Single prompt: Connect on Telegram
function renderTelegramPrompt() {
  if (hasShownTelegramPrompt) return;
  hasShownTelegramPrompt = true;

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

  const closingText = "Devansh ko tasalli ho gayi ki aap safe ho. Ab aage koi questions nahi... Devansh wants you to listen to this song.";
  const spokenClosing = "Devansh is relieved knowing that you are safe. Devansh wants you to listen to this song.";

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
  speakText(spokenClosing);

  tgContainer.innerHTML = `
    <div style="text-align: center; padding: 10px; font-size: 13px; color: #736b79; font-style: italic;">
      🤍 Take good care of yourself, Ramneek.
    </div>
  `;
}

// Speech Recognition (Microphone Auto-Listen)
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech recognition not supported in this browser.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-IN'; // Recognizes conversational English and Indian accents

  recognition.onstart = () => {
    isListening = true;
    micBtn.classList.add('active-listening');
    voiceBanner.classList.add('listening');
    voiceStatusLabel.textContent = "🎙️ Listening to you... (Speak now)";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("Captured speech:", transcript);
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
  } catch (err) {
    // Already started or busy
  }
}

function stopListening() {
  if (!recognition) return;
  try {
    recognition.stop();
  } catch (err) {}
}

// Send message to AI
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

  // Immediately display the one single Telegram prompt!
  renderTelegramPrompt();

  let reply = "I am so glad to know that you are safe and okay. Devansh was truly worried about you.";

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
                content: "You are Devansh's gentle assistant checking on Ramneek. Context: they are not on talking terms. Devansh was worried if she's okay. Reply in 1-2 empathetic, warm, natural sentences in English."
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

  // Speak AI reply aloud, and when finished speaking, start listening again if she wants to say more
  speakText(reply, () => {
    if (!hasDeliveredSong) {
      setTimeout(() => {
        startListening();
      }, 500);
    }
  });

  sendBtn.disabled = false;
}

// Start overlay tap
startBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  initVoices();
  initSpeechRecognition();

  setTimeout(() => {
    appendMessage('bot', DISPLAY_GREETING);
    conversationHistory.push({ role: 'assistant', content: DISPLAY_GREETING });

    // Speak initial message, then IMMEDIATELY start listening to Ramneek!
    speakText(SPOKEN_GREETING, () => {
      console.log("Greeting finished speaking, now actively listening to Ramneek...");
      setTimeout(() => {
        startListening();
      }, 300);
    });
  }, 400);
});

// Mic button toggle
micBtn.addEventListener('click', () => {
  if (isSpeaking) {
    window.speechSynthesis.cancel();
  }
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
});

// Voice mute toggle
voiceToggleBtn.addEventListener('click', () => {
  isVoiceEnabled = !isVoiceEnabled;
  voiceIcon.textContent = isVoiceEnabled ? '🔊' : '🔇';
  if (!isVoiceEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    voiceBanner.classList.remove('speaking');
    avatarContainer.classList.remove('speaking');
  }
});

// Text input submit
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

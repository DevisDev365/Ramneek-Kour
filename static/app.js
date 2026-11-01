// Ramneek Conversational Assistant Frontend

// State
let isVoiceEnabled = true;
let isSpeaking = false;
let isRecognizing = false;
let conversationHistory = [];
let femaleVoice = null;
let telegramUrl = "https://t.me/devansh_bot_for_ramneek_bot";
let hasSuggestedTelegram = false;

// Elements
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const chatWindow = document.getElementById('chat-window');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const voiceToggleBtn = document.getElementById('voice-toggle-btn');
const voiceIcon = document.getElementById('voice-icon');
const repoBadge = document.getElementById('repo-badge');
const repoStatusText = document.getElementById('repo-status-text');
const voiceBanner = document.getElementById('voice-banner');
const avatarContainer = document.getElementById('avatar-container');
const voiceStatusLabel = document.getElementById('voice-status-label');
const quickChips = document.getElementById('quick-chips');
const tgChipBtn = document.getElementById('tg-chip-btn');

// Initial greeting script
const INITIAL_GREETING = 
  "Hi Ramneek, main Devansh ki assistant hoon. As you guys are not on talking terms right now... " +
  "Devansh bohot worried hai whether you are okay. So... please tell me if you are okay...";

// Find sweet female voice (favoring Hindi or Indian English or soft female voice)
function initVoices() {
  if (!('speechSynthesis' in window)) return;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;

  // Search priority:
  // 1. Hindi female voice (Google हिन्दी, Lekha, Heera, etc.)
  // 2. en-IN female voice (Veena, Neerja, etc.)
  // 3. Natural female en-US/UK voice (Samantha, Victoria, Karen, Zira)
  const preferredVoice = voices.find(v => 
    (v.lang.startsWith('hi') || v.lang.startsWith('en-IN')) && 
    (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('heera') || v.name.toLowerCase().includes('veena'))
  ) || voices.find(v => 
    v.lang.startsWith('hi') || v.lang.startsWith('en-IN')
  ) || voices.find(v => 
    v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('karen')
  ) || voices[0];

  femaleVoice = preferredVoice;
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = initVoices;
  initVoices();
}

// Speak text using Web Speech API
function speakText(text) {
  if (!isVoiceEnabled || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // Stop any pending speech

  const utterance = new SpeechSynthesisUtterance(text);
  if (femaleVoice) {
    utterance.voice = femaleVoice;
  }
  utterance.pitch = 1.15; // Sweet, soft pitch
  utterance.rate = 0.92;  // Calm, gentle cadence

  utterance.onstart = () => {
    isSpeaking = true;
    voiceBanner.classList.add('speaking');
    avatarContainer.classList.add('speaking');
    voiceStatusLabel.textContent = "Speaking softly...";
  };

  utterance.onend = () => {
    isSpeaking = false;
    voiceBanner.classList.remove('speaking');
    avatarContainer.classList.remove('speaking');
    voiceStatusLabel.textContent = "Listening...";
  };

  utterance.onerror = (e) => {
    console.warn("Speech error:", e);
    isSpeaking = false;
    voiceBanner.classList.remove('speaking');
    avatarContainer.classList.remove('speaking');
  };

  window.speechSynthesis.speak(utterance);
}

// Append message bubble to chat window
function appendMessage(role, text, extraHtml = null) {
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
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

  // Scroll to bottom
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Show Telegram transition card
function showTelegramCard() {
  const tgHtml = `
    <div class="tg-card">
      <span class="tg-card-text">You can talk to the bot directly on Telegram anytime:</span>
      <a href="${telegramUrl}" target="_blank" class="tg-link-btn">
        <span>✈️ Open Telegram Bot</span>
      </a>
    </div>
  `;
  const promptText = "Agar aapko yahan website par baat karna thoda inconvenient lag raha hai, toh aap direct Telegram par bhi message kar sakti hain:";
  appendMessage('bot', promptText, tgHtml);
  speakText("Aap chahein toh mujhse Telegram par bhi baat kar sakti hain.");
}

// Check initial repo connection and fetch config
async function checkRepoConnection() {
  try {
    const [repoRes, configRes] = await Promise.all([
      fetch('/api/repo-status'),
      fetch('/api/config')
    ]);

    if (repoRes.ok) {
      const data = await repoRes.json();
      if (data.success) {
        repoStatusText.textContent = `Repo: ${data.commit_hash || 'Connected'}`;
      } else {
        repoStatusText.textContent = "Repo: Synced";
      }
    }

    if (configRes.ok) {
      const configData = await configRes.json();
      if (configData.telegram_url) {
        telegramUrl = configData.telegram_url;
      }
    }
  } catch (err) {
    repoStatusText.textContent = "Repo: Active";
  }
}

// Send user message to backend
async function sendMessage(textToSend) {
  const text = (textToSend || messageInput.value).trim();
  if (!text) return;

  // Append user message
  appendMessage('user', text);
  messageInput.value = '';
  messageInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Add to conversation history
  conversationHistory.push({ role: 'user', content: text });

  // Update status banner
  voiceStatusLabel.textContent = "Connecting with repo & thinking...";

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: conversationHistory
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    const reply = data.reply;

    // Append bot message
    appendMessage('bot', reply);
    conversationHistory.push({ role: 'assistant', content: reply });

    // Update repo badge
    if (data.commit_hash) {
      repoStatusText.textContent = `Repo: ${data.commit_hash}`;
    }

    // Speak aloud
    speakText(reply);

    // Gently offer Telegram connection if she is chatting and hasn't seen it yet
    if (conversationHistory.length >= 4 && !hasSuggestedTelegram) {
      hasSuggestedTelegram = true;
      setTimeout(() => {
        showTelegramCard();
      }, 3500);
    }

  } catch (error) {
    console.error('Chat error:', error);
    const errText = "I'm sorry Ramneek, I had a momentary connection hiccup. But please know Devansh truly cares and wants to make sure you're safe.";
    appendMessage('bot', errText);
    speakText(errText);
  } finally {
    sendBtn.disabled = false;
  }
}

// Voice Recognition (Speech to Text in Hindi/English/Hinglish)
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'hi-IN'; // Recognizes Hindi and Hinglish/Indian English

  recognition.onstart = () => {
    isRecognizing = true;
    micBtn.classList.add('recording');
    voiceStatusLabel.textContent = "Listening to you... (aap bol sakte hain)";
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    messageInput.value = transcript;
    sendMessage(transcript);
  };

  recognition.onerror = (e) => {
    console.warn("Speech recognition error:", e);
    isRecognizing = false;
    micBtn.classList.remove('recording');
    voiceStatusLabel.textContent = "Listening...";
  };

  recognition.onend = () => {
    isRecognizing = false;
    micBtn.classList.remove('recording');
    voiceStatusLabel.textContent = "Listening...";
  };

  micBtn.addEventListener('click', () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
    }
    if (isRecognizing) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
}

// Start overlay interaction
startBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  initVoices();

  // Show and speak the initial message
  setTimeout(() => {
    appendMessage('bot', INITIAL_GREETING);
    conversationHistory.push({ role: 'assistant', content: INITIAL_GREETING });
    speakText(INITIAL_GREETING);
  }, 400);

  checkRepoConnection();
});

// Voice output toggle button
voiceToggleBtn.addEventListener('click', () => {
  isVoiceEnabled = !isVoiceEnabled;
  voiceIcon.textContent = isVoiceEnabled ? '🔊' : '🔇';
  if (!isVoiceEnabled && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    voiceBanner.classList.remove('speaking');
    avatarContainer.classList.remove('speaking');
  }
});

// Event listeners for sending messages
sendBtn.addEventListener('click', () => sendMessage());

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-expand textarea
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 80) + 'px';
});

// Quick reply chips
quickChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;

  if (chip.id === 'tg-chip-btn') {
    showTelegramCard();
    return;
  }

  const text = chip.getAttribute('data-text');
  if (text) {
    sendMessage(text);
  }
});

// Initialize on page load
setupSpeechRecognition();

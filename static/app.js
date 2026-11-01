// Ramneek Conversational Assistant Frontend - Storyline Implementation

// State
let isVoiceEnabled = true;
let isSpeaking = false;
let isRecognizing = false;
let conversationHistory = [];
let femaleVoice = null;
let telegramUrl = "https://t.me/devansh_bot_for_ramneek_bot";
let telegramUsername = "devansh_bot_for_ramneek_bot";
let songUrl = "https://music.youtube.com/playlist?list=OLAK5uy_muFG1a76efS0XYoJNVLU7L5YsiDHymCyk";
let songTitle = "Teri Nazron Ke Sadke";
let storyStage = 0; // 0: Start, 1: Well-being answered -> Guide to TG, 2: TG connected -> Deliver Song & End

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

// Initial greeting script
const INITIAL_GREETING = 
  "Hi Ramneek, main Devansh ki assistant hoon. As you guys are not on talking terms right now... " +
  "Devansh bohot worried hai whether you are okay. So... please tell me if you are okay...";

// Find sweet female voice (favoring Hindi or Indian English or soft female voice)
function initVoices() {
  if (!('speechSynthesis' in window)) return;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;

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
function speakText(text, onComplete = null) {
  if (!isVoiceEnabled || !('speechSynthesis' in window)) {
    if (onComplete) onComplete();
    return;
  }

  window.speechSynthesis.cancel();

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
      if (configData.telegram_url) telegramUrl = configData.telegram_url;
      if (configData.telegram_username) telegramUsername = configData.telegram_username;
      if (configData.song_url) songUrl = configData.song_url;
      if (configData.song_title) songTitle = configData.song_title;
    }
  } catch (err) {
    repoStatusText.textContent = "Repo: Active";
  }
}

// Guide Ramneek to search or open the Telegram Bot
function showTelegramGuidance() {
  storyStage = 1;
  const guideHtml = `
    <div class="tg-guide-card">
      <div class="tg-guide-header">
        <span>✈️ Connect on Telegram</span>
      </div>
      <ol class="tg-steps">
        <li>Open Telegram and search for <strong>@${telegramUsername}</strong></li>
        <li>Or tap the button below to open directly:</li>
      </ol>
      <div class="tg-actions">
        <a href="${telegramUrl}" target="_blank" class="tg-link-btn" id="tg-open-link">
          <span>✈️ Open @${telegramUsername}</span>
        </a>
        <button class="tg-confirm-btn" id="tg-confirm-btn">
          I'm Connected on Telegram ✅
        </button>
      </div>
    </div>
  `;

  const guideText = 
    "Aap Telegram par @" + telegramUsername + " search kar sakti hain, ya phir neeche button par tap karke 'START' kar sakti hain. Jab aap connect ho jayein, bas confirm kar dijiyega:";
  
  appendMessage('bot', guideText, guideHtml);
  speakText("Aap Telegram par @" + telegramUsername + " search kar sakti hain, ya neeche button se direct open kar sakti hain.");

  // Attach confirm listener
  setTimeout(() => {
    const confirmBtn = document.getElementById('tg-confirm-btn');
    const openLink = document.getElementById('tg-open-link');

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        completeStoryline();
      });
    }

    if (openLink) {
      openLink.addEventListener('click', () => {
        // When she clicks the link, give her a moment and trigger completion
        setTimeout(() => {
          completeStoryline();
        }, 3000);
      });
    }
  }, 100);
}

// Complete storyline: Say hi, end the topic, cut conversation, and present the song dedication
function completeStoryline() {
  if (storyStage === 2) return;
  storyStage = 2;

  const closingText = 
    "Hi Ramneek! Devansh ko tasalli ho gayi ki aap safe aur theek ho. Ab main is baare mein aage kuch nahi poochungi, that topic ends here.";
  
  const songMessage = "Devansh wants you to listen to this song...";

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

  appendMessage('bot', closingText);

  // Speak closing text first, then present the song
  speakText(closingText, () => {
    setTimeout(() => {
      appendMessage('bot', songMessage, musicHtml);
      speakText("Devansh chahta tha ki aap bas yeh song suno.");
    }, 600);
  });

  // Update footer and chips to gentle closure
  quickChips.innerHTML = `
    <div style="padding: 6px 12px; font-size: 13px; color: #736b79; font-style: italic;">
      🤍 Take good care of yourself, Ramneek.
    </div>
  `;
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
    speakText(reply, () => {
      // If we are at stage 0 (user answered well-being), transition to Telegram guidance
      if (storyStage === 0) {
        setTimeout(() => {
          showTelegramGuidance();
        }, 1200);
      }
    });

  } catch (error) {
    console.error('Chat error:', error);
    const errText = "I'm glad to hear from you Ramneek. Devansh just wanted to be sure you are safe and doing well.";
    appendMessage('bot', errText);
    speakText(errText, () => {
      if (storyStage === 0) {
        setTimeout(() => {
          showTelegramGuidance();
        }, 1000);
      }
    });
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
  recognition.lang = 'hi-IN';

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
    showTelegramGuidance();
    return;
  }

  const text = chip.getAttribute('data-text');
  if (text) {
    sendMessage(text);
  }
});

// Initialize on page load
setupSpeechRecognition();

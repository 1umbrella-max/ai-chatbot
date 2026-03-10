// State Machine modes
const CHAT_STATES = {
    INIT: 'INIT',
    SELECT_SETTING: 'SELECT_SETTING',
    SELECT_METHOD: 'SELECT_METHOD',
    ROLEPLAY_VOICE: 'ROLEPLAY_VOICE',
    ROLEPLAY_TEXT: 'ROLEPLAY_TEXT'
};

let currentState = CHAT_STATES.INIT;

// DOM Elements
const startBtn = document.getElementById('start-tutor-btn');
const modal = document.getElementById('ai-tutor-modal');
const closeModal = document.getElementById('close-modal-btn');
const chatContainer = document.getElementById('chat-container');
const inputArea = document.getElementById('input-area');
const notImplementedMsg = document.getElementById('not-implemented-msg');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');

// Mode Buttons
const modeCoachBtn = document.getElementById('mode-coach');
const modeHelperBtn = document.getElementById('mode-helper');
const modeRoleplayBtn = document.getElementById('mode-roleplay');

// Removed API key elements since API key UI was deleted
// Speech Recognition Setup
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (window.SpeechRecognition) {
    recognition = new window.SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
}

// Conversation context
let roleplaySetting = '';

// Helper: Format Time
function getCurrentTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}

// Helper: Add Bot Message
function addBotMessage(text, options = null, correction = null, saveHistory = true) {
    if (saveHistory) {
        // chatHistory.push({ role: 'assistant', content: text });
    }

    // Show typing indicator
    const typingHTML = `
        <div class="message bot typing-msg" id="typing-indicator">
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="typing-indicator">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>
    `;
    chatContainer.insertAdjacentHTML('beforeend', typingHTML);
    scrollToBottom();

    setTimeout(() => {
        // Remove typing indicator
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();

        let extraHTML = '';

        if (correction) {
            extraHTML += `
                <div class="grammar-correction">
                    <div class="original">Instead of: ${correction.original}</div>
                    <div class="corrected">Say: ${correction.fixed}</div>
                </div>
            `;
        }

        if (options) {
            extraHTML += `
                <div class="options-container">
                    ${options.map(opt => `<button class="option-btn" onclick="handleOptionClick('${opt}')">${opt}</button>`).join('')}
                </div>
            `;
        }

        const msgHTML = `
            <div class="message bot">
                <div class="avatar"><i class="fa-solid fa-robot"></i></div>
                <div class="msg-content">
                    <div class="bubble">
                        ${text}
                        ${extraHTML}
                    </div>
                    <div class="msg-time">${getCurrentTime()}</div>
                </div>
            </div>
        `;
        chatContainer.insertAdjacentHTML('beforeend', msgHTML);
        scrollToBottom();
    }, 1000); // 1 second Artificial delay
}

// Helper: Add User Message
function addUserMessage(text, saveHistory = true) {
    if (saveHistory) {
        // chatHistory.push({ role: 'user', content: text });
    }

    const msgHTML = `
        <div class="message user">
            <div class="avatar"><i class="fa-regular fa-user"></i></div>
            <div class="msg-content">
                <div class="bubble">${text}</div>
                <div class="msg-time">${getCurrentTime()}</div>
            </div>
        </div>
    `;
    chatContainer.insertAdjacentHTML('beforeend', msgHTML);
    scrollToBottom();
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Events
startBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    if (currentState === CHAT_STATES.INIT) {
        startConversationFlow();
    }
});

closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

chatInput.addEventListener('input', () => {
    if (chatInput.value.trim().length > 0) {
        sendBtn.classList.add('active');
        sendBtn.disabled = false;
    } else {
        sendBtn.classList.remove('active');
        sendBtn.disabled = true;
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
        handleUserInput();
    }
});

sendBtn.addEventListener('click', () => {
    if (!sendBtn.disabled) handleUserInput();
});

// API Key Saving logic removed

// Mode Toggle Events
function switchMode(selectedId) {
    [modeCoachBtn, modeHelperBtn, modeRoleplayBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(selectedId).classList.add('active');

    if (selectedId === 'mode-roleplay') {
        chatContainer.classList.remove('hidden');
        inputArea.classList.remove('hidden');
        notImplementedMsg.classList.add('hidden');
        
        // Restart chat if returning to it and not initialized
        if (chatContainer.innerHTML.trim() === '') {
            startConversationFlow();
        }
    } else {
        // Coaching or Helper view
        chatContainer.classList.add('hidden');
        inputArea.classList.add('hidden');
        notImplementedMsg.classList.remove('hidden');
    }
}

modeCoachBtn.addEventListener('click', () => switchMode('mode-coach'));
modeHelperBtn.addEventListener('click', () => switchMode('mode-helper'));
modeRoleplayBtn.addEventListener('click', () => switchMode('mode-roleplay'));


// Speech Recognition Events
if (recognition) {
    micBtn.addEventListener('click', () => {
        if (micBtn.classList.contains('active')) {
            recognition.stop();
        } else {
            micBtn.classList.add('active');
            chatInput.placeholder = "Listening...";
            recognition.start();
        }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;
        sendBtn.disabled = false;
        sendBtn.classList.add('active');
        handleUserInput();
    };

    recognition.onend = () => {
        micBtn.classList.remove('active');
        chatInput.placeholder = "Say something in English...";
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        micBtn.classList.remove('active');
        chatInput.placeholder = "Error recognizing voice. Try again.";
    };
}


// Conversation Flow State Machine
function startConversationFlow() {
    chatContainer.innerHTML = ''; // Clear chat
    chatHistory = []; // Reset history
    currentState = CHAT_STATES.SELECT_SETTING;
    
    addBotMessage("안녕하세요! 여러분의 학습 친구 AI 튜터입니다.<br><br>우리 영어로 대화해 볼까요? 지금 우리는 어디에 있을까요?", [
        "PC방",
        "노래방",
        "놀이터",
        "도서관",
        "병원",
        "대학교",
        "집 안"
    ], null, false); // Don't save to history yet
}

const ROLEPLAY_PLACES = {
    "PC방": "PC Cafe",
    "노래방": "Karaoke",
    "놀이터": "Playground",
    "도서관": "Library",
    "병원": "Hospital",
    "대학교": "University",
    "집 안": "Home"
};

window.handleOptionClick = function(choice) {
    addUserMessage(choice, false);
    
    if (currentState === CHAT_STATES.SELECT_SETTING) {
        roleplaySetting = choice;
        currentState = CHAT_STATES.SELECT_METHOD;
        addBotMessage(`좋아요! <b>${roleplaySetting}</b>에서 롤플레잉을 진행해 볼게요.<br>대화할 때 음성과 타자 중 어떤 방식을 사용하시겠어요?`, [
            "Voice (음성)",
            "Text (타자)"
        ], null, false);
    } else if (currentState === CHAT_STATES.SELECT_METHOD) {
        const englishSetting = ROLEPLAY_PLACES[roleplaySetting] || roleplaySetting;
        
        if (choice.includes("Voice")) {
            currentState = CHAT_STATES.ROLEPLAY_VOICE;
            chatInput.disabled = false;
            micBtn.classList.remove('hidden');
            chatInput.placeholder = "Click the mic or type in English...";
            const startMsg = `Let's talk with your Voice! Here we are at the ${englishSetting}. What do you want to say first?`;
            addBotMessage(startMsg, null, null, true);
        } else {
            currentState = CHAT_STATES.ROLEPLAY_TEXT;
            chatInput.disabled = false;
            micBtn.classList.add('hidden'); // Hide mic for text mode
            chatInput.placeholder = "Type your sentence in English...";
            const startMsg = `Great, we will use Text. We are currently at the ${englishSetting}. What do you want to do here?`;
            addBotMessage(startMsg, null, null, true);
        }
    }
};

async function handleUserInput() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    addUserMessage(text, true); // save to history
    chatInput.value = '';
    sendBtn.classList.remove('active');
    sendBtn.disabled = true;

    if (currentState === CHAT_STATES.ROLEPLAY_TEXT || currentState === CHAT_STATES.ROLEPLAY_VOICE) {
        const englishSetting = ROLEPLAY_PLACES[roleplaySetting] || roleplaySetting;

        // Mock logic for English role-play & Grammar correction
        let correction = null;
        let response = "";

        // Common mock scenarios
        const userTextLower = text.toLowerCase();
        
        if (userTextLower.includes("im name is") || userTextLower.includes("my name are")) {
            correction = {
                original: text.replace(/im name is/i, "<span class='text-red'>im name is</span>").replace(/my name are/i, "<span class='text-red'>my name are</span>"),
                fixed: "Hi, <span class='text-green'>my name is</span> " + text.split("is ")[1] + "."
            };
            response = "Nice to meet you! I am your AI friend. What are we doing here at the " + englishSetting + "?";
        } else if (userTextLower.includes("i go to school by bus everyday")) {
             // Example grammatically correct just to show flow
             response = "That's a great way to commute! Does it take long?";
        } else if (userTextLower.includes("i wants") || userTextLower.includes("he want")) {
            const wrongPart = userTextLower.includes("i wants") ? "I wants" : "he want";
            const rightPart = userTextLower.includes("i wants") ? "I want" : "he wants";
            correction = {
                original: text.replace(new RegExp(wrongPart, "i"), `<span class='text-red'>${wrongPart}</span>`),
                fixed: text.replace(new RegExp(wrongPart, "i"), `<span class='text-green'>${rightPart}</span>`)
            };
            response = "I understand. What else do you want to share?";
        } else {
             // Generic mock response
             response = "That's very interesting! Can you tell me more about it in English?";
             // Just randomly giving a fake correction if they say "good"
             if (userTextLower === "good") {
                 correction = {
                     original: "<span class='text-red'>good</span>",
                     fixed: "I am feeling <span class='text-green'>good</span> today."
                 };
             }
        }

        addBotMessage(response, null, correction, true);
    }
}

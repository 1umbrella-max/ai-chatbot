// State Machine modes
const CHAT_STATES = {
    INIT: 'INIT',
    SELECT_SETTING: 'SELECT_SETTING',
    SELECT_METHOD: 'SELECT_METHOD',
    ROLEPLAY_VOICE: 'ROLEPLAY_VOICE',
    ROLEPLAY_TEXT: 'ROLEPLAY_TEXT'
};

let currentState = CHAT_STATES.INIT;
let idleTimer = null;
let sessionCloseTimer = null; // 20-minute auto-close timer
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_CLOSE_MS = 20 * 60 * 1000; // 20 minutes

// Request Notification Permission on load
document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
});

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

// Chat Menu Elements
const chatMenuBtn = document.getElementById('chat-menu-btn');
const chatAttachMenu = document.getElementById('chat-attach-menu');
const photoUpload = document.getElementById('photo-upload');

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
function addBotMessage(text, options = null, correction = null, pronunciation = null, saveHistory = true) {
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
                    <span class="grammar-correction-title">💡 Grammar Check</span>
                    <div class="original">Instead of <del>${correction.wrongWord}</del>, Say: <b>${correction.rightWord}</b>.</div>
                    <div class="corrected">(${correction.fullSentence})</div>
                    ${correction.reason ? `<div class="grammar-reason"><b>이유:</b> ${correction.reason}</div>` : ''}
                </div>
            `;
        }
        
        if (pronunciation) {
            extraHTML += `
                <div class="pronunciation-correction">
                    <span class="pronunciation-correction-title">🔊 Pronunciation Check</span>
                    <div class="original">You sounded like: <del>${pronunciation.wrongSound}</del></div>
                    <div class="corrected">
                        Try saying: <b>${pronunciation.rightSound}</b>
                        ${pronunciation.audioFile ? `<button class="play-audio-btn" onclick="playAudio('${pronunciation.audioFile}')"><i class="fa-solid fa-volume-high"></i></button>` : ''}
                    </div>
                    ${pronunciation.examples ? `
                    <div class="pronunciation-examples">
                        <b>Examples:</b>
                        <ul>
                            ${pronunciation.examples.map(ex => `<li>${ex}</li>`).join('')}
                        </ul>
                    </div>` : ''}
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

// Global Audio Player
let currentAudio = null;
window.playAudio = function(audioSrc) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    currentAudio = new Audio(audioSrc);
    currentAudio.play().catch(e => console.error("Audio play failed:", e));
};

// Helper: Handle Idle Timeout & Auto Close
function resetTimers() {
    if (idleTimer) clearTimeout(idleTimer);
    if (sessionCloseTimer) clearTimeout(sessionCloseTimer);

    // Only set timer if we are actively in a roleplay session
    if (currentState === CHAT_STATES.ROLEPLAY_TEXT || currentState === CHAT_STATES.ROLEPLAY_VOICE) {
        
        // 5-minute notification
        idleTimer = setTimeout(() => {
            const warningMsg = "What are you doing? Please reply.";
            addBotMessage(warningMsg, null, null, null, true);

            // Trigger Browser Push Notification
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("AI Tutor Message", {
                    body: warningMsg,
                    icon: "https://cdn-icons-png.flaticon.com/512/4712/4712010.png"
                });
            } else if ("Notification" in window && Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        new Notification("AI Tutor Message", {
                            body: warningMsg,
                            icon: "https://cdn-icons-png.flaticon.com/512/4712/4712010.png"
                        });
                    }
                });
            }
        }, IDLE_TIMEOUT_MS);

        // 20-minute auto close
        sessionCloseTimer = setTimeout(() => {
            endSession();
        }, AUTO_CLOSE_MS);
    }
}

// Helper: End Session and Show Summary
function endSession() {
    if (idleTimer) clearTimeout(idleTimer);
    if (sessionCloseTimer) clearTimeout(sessionCloseTimer);
    
    // Hide chat modal
    modal.classList.add('hidden');
    
    // Show Summary Modal
    const summaryModal = document.getElementById('summary-modal');
    const summaryCard = document.getElementById('summary-card');
    const mistakesList = document.getElementById('summary-mistakes-list');
    const vocabList = document.getElementById('summary-vocab-list');
    
    // Mock Data
    const mockMistakes = [
        "Confusing 'a' and 'the' (관사 오용)",
        "Missing plural 's' (복수형 누락)",
        "Tense mismatch (시제 불일치)"
    ];
    const mockVocab = [
        "Can I get a...",
        "I'm on my way to..."
    ];
    
    mistakesList.innerHTML = mockMistakes.map(m => `<li>${m}</li>`).join('');
    vocabList.innerHTML = mockVocab.map(v => `<li>${v}</li>`).join('');
    
    summaryModal.classList.remove('hidden');
    // Animate in
    setTimeout(() => {
        summaryCard.classList.remove('scale-95', 'opacity-0');
        summaryCard.classList.add('scale-100', 'opacity-100');
    }, 10);
    
    // Optional: Add event listener to restart button
    document.getElementById('restart-btn').onclick = () => {
        window.location.reload();
    };
}

// Events
startBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    if (currentState === CHAT_STATES.INIT) {
        startConversationFlow();
    }
});

closeModal.addEventListener('click', () => {
    if (currentState === CHAT_STATES.ROLEPLAY_TEXT || currentState === CHAT_STATES.ROLEPLAY_VOICE) {
        endSession();
    } else {
        modal.classList.add('hidden');
    }
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

// Chat Menu Toggle
chatMenuBtn.addEventListener('click', () => {
    chatAttachMenu.classList.toggle('hidden');
});

// Hide menu when clicking outside
document.addEventListener('click', (e) => {
    if (!chatMenuBtn.contains(e.target) && !chatAttachMenu.contains(e.target)) {
        chatAttachMenu.classList.add('hidden');
    }
});

// Handle Photo Upload
photoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Just acknowledging the photo selection in UI for now
        chatAttachMenu.classList.add('hidden');
        addUserMessage(`[사진 첨부됨: ${file.name}]`, true);
        
        setTimeout(() => {
             addBotMessage("Great picture! What is this showing?", null, null, null, true);
        }, 1000);
        
        // Reset file input
        e.target.value = '';
    }
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
    ], null, null, false); // Don't save to history yet
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
        ], null, null, false);
    } else if (currentState === CHAT_STATES.SELECT_METHOD) {
        const englishSetting = ROLEPLAY_PLACES[roleplaySetting] || roleplaySetting;
        
        if (choice.includes("Voice")) {
            currentState = CHAT_STATES.ROLEPLAY_VOICE;
            chatInput.disabled = false;
            micBtn.classList.remove('hidden');
            chatInput.placeholder = "Click the mic or type in English...";
            const startMsg = `Let's talk with your Voice! Here we are at the ${englishSetting}. What do you want to say first?`;
            addBotMessage(startMsg, null, null, null, true);
        } else {
            currentState = CHAT_STATES.ROLEPLAY_TEXT;
            chatInput.disabled = false;
            micBtn.classList.add('hidden'); // Hide mic for text mode
            chatInput.placeholder = "Type your sentence in English...";
            const startMsg = `Great, we will use Text. We are currently at the ${englishSetting}. What do you want to do here?`;
            addBotMessage(startMsg, null, null, null, true);
            resetTimers(); // Start timer when session officially begins
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

        // Mock logic for English role-play & Grammar/Pronunciation correction
        let correction = null;
        let pronunciation = null;
        let response = "";

        // Common mock scenarios
        const userTextLower = text.toLowerCase();
        
        if (userTextLower.includes("im name is") || userTextLower.includes("my name are") || userTextLower.includes("i am go")) {
            const wrongW = userTextLower.includes("i am go") ? "am go" : "im name is";
            const rightW = userTextLower.includes("i am go") ? "go" : "my name is";
            const fullS = userTextLower.includes("i am go") ? "I go to school." : "Hi, my name is Apple.";
            const reason = userTextLower.includes("i am go") 
                ? "일반동사(go)와 be동사(am)는 같이 쓸 수 없습니다." 
                : "소유격(my) 뒤에 명사(name)가 와야 올바른 표현입니다.";
            
            correction = {
                wrongWord: wrongW,
                rightWord: rightW,
                fullSentence: fullS,
                reason: reason
            };
            response = "Nice to meet you! Tell me more about what we should do.";
        } else if (userTextLower.includes("i go to school by bus everyday")) {
             // Example grammatically correct just to show flow
             response = "That's a great way to commute! Does it take long?";
        } else if (userTextLower.includes("i wants") || userTextLower.includes("he want")) {
            const wrongPart = userTextLower.includes("i wants") ? "I wants" : "he want";
            const rightPart = userTextLower.includes("i wants") ? "I want" : "he wants";
            correction = {
                wrongWord: wrongPart,
                rightWord: rightPart,
                fullSentence: text.replace(new RegExp(wrongPart, "i"), rightPart),
                reason: userTextLower.includes("i wants") 
                    ? "1인칭 주어(I) 뒤에는 동사원형이 와야 합니다." 
                    : "3인칭 단수 주어(He) 뒤에는 동사에 's'가 붙어야 합니다."
            };
            response = "I understand. What else do you want to share?";
        } else {
             // Generic mock response
             response = "That's very interesting! Can you tell me more about it in English?";
             // Just randomly giving a fake correction if they say "good"
             if (userTextLower === "good") {
                 correction = {
                     original: "<span class='text-red'>good</span>",
                     fixed: "I am feeling <span class='text-green'>good</span> today.",
                     reason: null
                 };
             }
        }
        
        // --- ADD PRONUNCIATION MOCK IF VOICE MODE ---
        if (currentState === CHAT_STATES.ROLEPLAY_VOICE) {
            if (userTextLower.includes("copy") || userTextLower.includes("coffee")) {
                pronunciation = {
                    wrongSound: "copy (코피)",
                    rightSound: "coffee (커-피)",
                    audioFile: "서초동.m4a", // Mock audio file provided by user
                    examples: [
                        "I would like a cup of <b>coffee</b>.",
                        "This <b>coffee</b> is too hot."
                    ]
                };
                if (!response) response = "Do you want some coffee?";
            } else if (userTextLower.includes("pija") || userTextLower.includes("pizza")) {
                 pronunciation = {
                    wrongSound: "pija (피자)",
                    rightSound: "pizza (핕-자)",
                    audioFile: "서초동.m4a",
                    examples: [
                        "Let's order some <b>pizza</b> tonight.",
                        "My favorite food is <b>pizza</b>."
                    ]
                };
                if (!response) response = "Pizza sounds great!";
            } else {
                 // Generic fallback mock pronunciation for testing voice UI if neither word is used
                 if (Math.random() > 0.5) {
                     pronunciation = {
                         wrongSound: "very (베리)",
                         rightSound: "very (붸-리)",
                         audioFile: null,
                         examples: ["Thank you <b>very</b> much."]
                     };
                 }
            }
        }

        addBotMessage(response, null, correction, pronunciation, true);
        resetTimers(); // Reset timer after user interaction and bot response
        
        // If the user says "bye", "quit", or "대화종료", trigger manual endSession
        if (userTextLower === "bye" || userTextLower === "quit" || userTextLower === "대화종료" || userTextLower === "종료") {
            setTimeout(() => {
                endSession();
            }, 2000);
        }
    }
}

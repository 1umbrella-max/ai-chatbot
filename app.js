// State Machine modes
const CHAT_STATES = {
    INIT: 'INIT',
    SELECT_CATEGORY: 'SELECT_CATEGORY',
    SELECT_METHOD: 'SELECT_METHOD',
    CHAT_ACTIVE: 'CHAT_ACTIVE'
};

let currentState = CHAT_STATES.INIT;
let currentCategory = null;
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
const sectionTriggerBtn = document.getElementById('ai-roleplay-section-trigger');
const floatingBtn = document.getElementById('floating-chatbot-btn');
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

// Helper: Add Bot Message
function addBotMessage(text, options = null, correction = null, pronunciation = null, saveHistory = true, translation = null) {
    if (saveHistory) {
        // chatHistory.push({ role: 'assistant', content: text });
    }

    // Artificial delay for realism
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
                            ${pronunciation.examples.map(ex => `
                                <li>
                                    <span>${ex.text}</span>
                                    ${ex.audioFile ? `<button class="play-audio-btn" onclick="playAudio('${ex.audioFile}', this)"><i class="fa-solid fa-volume-high"></i></button>` : ''}
                                </li>
                            `).join('')}
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
                        <div class="text-content">${text}</div>
                        ${translation ? `
                        <div class="translation-block">
                            <button class="translate-toggle-btn" onclick="toggleTranslation(this)">
                                <i class="fa-solid fa-language"></i> 해석하기
                            </button>
                            <div class="translation-text hidden">${translation}</div>
                        </div>
                        ` : ''}
                        <button class="msg-audio-btn" onclick="playAudio('서초동.m4a', this)" title="Listen to message"><i class="fa-solid fa-volume-high"></i></button>
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
window.playAudio = function(audioSrc, btnElement) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        // Remove playing class from all buttons
        document.querySelectorAll('.playing-audio').forEach(btn => btn.classList.remove('playing-audio'));
    }
    
    if (btnElement) {
        btnElement.classList.add('playing-audio');
    }

    currentAudio = new Audio(audioSrc);
    currentAudio.play().catch(e => console.error("Audio play failed:", e));
    
    currentAudio.onended = () => {
        if (btnElement) {
            btnElement.classList.remove('playing-audio');
        }
    };
};

window.toggleTranslation = function(btn) {
    const transDiv = btn.nextElementSibling;
    if (transDiv.classList.contains('hidden')) {
        transDiv.classList.remove('hidden');
        btn.innerHTML = '<i class="fa-solid fa-language"></i> 원문 보기';
        btn.classList.add('active');
    } else {
        transDiv.classList.add('hidden');
        btn.innerHTML = '<i class="fa-solid fa-language"></i> 해석하기';
        btn.classList.remove('active');
    }
};

// Helper: Handle Idle Timeout & Auto Close
function resetTimers() {
    if (idleTimer) clearTimeout(idleTimer);
    if (sessionCloseTimer) clearTimeout(sessionCloseTimer);

    // Only set timer if we are actively in a roleplay session
    if (currentState === CHAT_STATES.CHAT_ACTIVE) {
        
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
function openChatModal() {
    modal.classList.remove('hidden');
    if (currentState === CHAT_STATES.INIT) {
        startConversationFlow();
    }
}

if (sectionTriggerBtn) sectionTriggerBtn.addEventListener('click', openChatModal);
if (floatingBtn) floatingBtn.addEventListener('click', openChatModal);

closeModal.addEventListener('click', () => {
    if (currentState === CHAT_STATES.CHAT_ACTIVE) {
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
    currentState = CHAT_STATES.SELECT_CATEGORY;
    currentCategory = null;
    
    // Enable inputs by default so user can just start chatting without picking a menu
    chatInput.disabled = false;
    chatInput.placeholder = "메뉴를 선택하거나 편하게 질문해주세요!";
    micBtn.classList.remove('hidden');
    
    addBotMessage("안녕하세요! 여러분의 학습 친구 AI 튜터입니다.<br><br>오늘은 어떤 방식으로 영어를 연습해 볼까요?", [
        "오늘의 일기쓰기",
        "고민상담",
        "밸런스게임",
        "스몰톡",
        "롤플레잉"
    ], null, null, false);
}

const ROLEPLAY_PLACES = [
    { ko: "PC방", en: "PC room", prompt: "We are at a PC room, what game will you play?" },
    { ko: "도서관", en: "library", prompt: "We are at the library, what book are you going to read?" },
    { ko: "노래방", en: "karaoke", prompt: "We are at karaoke! What song do you like?" },
    { ko: "카페 가는 길", en: "heading to a cafe", prompt: "We are heading to a cafe. What does it look like?" },
    { ko: "집", en: "home", prompt: "You came over to my house! What should we do?" },
    { ko: "백화점", en: "department store", prompt: "We are at a department store, what do you want to buy?" }
];

window.handleOptionClick = function(choice) {
    addUserMessage(choice, false);
    
    if (currentState === CHAT_STATES.SELECT_CATEGORY) {
        currentCategory = choice;
        currentState = CHAT_STATES.SELECT_METHOD;
        
        let confirmMsg = `좋아요! <b>${currentCategory}</b> 테마로 대화를 시작할게요.<br>대화할 때 음성과 타자 중 어떤 방식을 사용하시겠어요?`;
        setTimeout(() => {
            addBotMessage(confirmMsg, [
                "Voice (음성)",
                "Text (타자)"
            ], null, null, false);
        }, 500);
        
    } else if (currentState === CHAT_STATES.SELECT_METHOD) {
        currentState = CHAT_STATES.CHAT_ACTIVE;
        
        // Enable inputs for active chat
        chatInput.disabled = false;
        
        if (choice.includes("Voice")) {
            micBtn.classList.remove('hidden');
            chatInput.placeholder = "Click the mic or type in English...";
        } else {
            micBtn.classList.add('hidden');
            chatInput.placeholder = "Type your sentence in English...";
        }
        
        let initialBotPrompt = "";
        let initialTrans = "";
        
        switch (currentCategory) {
            case "오늘의 일기쓰기":
                initialBotPrompt = "What was your day like today? Tell me everything. It's okay if you make mistakes, I will gently correct them.";
                initialTrans = "오늘 너의 하루는 어땠어? 틀려도 괜찮아 오늘의 하루를 들려줘. 틀린 게 있다면 내가 고쳐줄게.";
                break;
            case "고민상담":
                initialBotPrompt = "Tell me everything on your mind. Everything is kept secret so feel free to speak. But remember the rule, you have to speak in English!";
                initialTrans = "너의 모든 것을 말해줘. 저장되지 않아서 편하게 말해도 돼. 하지만 영어로 말해야 한다는 규칙이 있어!";
                break;
            case "밸런스게임":
                initialBotPrompt = "Balance Game Time! Which one do you prefer: Brushing teeth with mint choco OR Eating toothpaste?";
                initialTrans = "밸런스 게임 시간이에요! 둘 중 무엇을 선호하시나요: 양치질 할 때 민초맛 치약 쓰기 vs 양치를 치약 먹기로 대신하기?";
                break;
            case "스몰톡":
                initialBotPrompt = "Hello! What kind of drinks do you like? Energy drinks are really trendy these days!";
                initialTrans = "안녕하세요! 어떤 종류의 음료를 좋아하시나요? 요즘은 에너지 드링크가 아주 유행이더라구요!";
                break;
            case "롤플레잉":
                const randomPlace = ROLEPLAY_PLACES[Math.floor(Math.random() * ROLEPLAY_PLACES.length)];
                initialBotPrompt = randomPlace.prompt;
                initialTrans = `우리는 지금 ${randomPlace.ko}에 있어요. 여기서 무엇을 할까요?`;
                break;
        }
        
        setTimeout(() => {
            addBotMessage(initialBotPrompt, null, null, null, true, initialTrans);
            resetTimers(); // Start session timers
        }, 500);
    }
};

async function handleUserInput() {
    const text = chatInput.value.trim();
    if (!text) return;
    
    addUserMessage(text, true); // save to history
    chatInput.value = '';
    sendBtn.classList.remove('active');
    sendBtn.disabled = true;

    const userTextLower = text.toLowerCase();
    
    // If user starts typing without selecting a category, move state to active
    if (currentState === CHAT_STATES.SELECT_CATEGORY || currentState === CHAT_STATES.INIT) {
        currentState = CHAT_STATES.CHAT_ACTIVE;
        currentCategory = "자유대화";
    }

    if (currentState === CHAT_STATES.CHAT_ACTIVE) {
        let correction = null;
        let pronunciation = null; // Leaving pronunciation stub for future voice features
        let response = "";
        let botTranslation = "";

        // User requested global mock logic for "i am go school"
        if (userTextLower.includes("i am go school") || userTextLower.includes("i am go to school")) {
            correction = {
                wrongWord: text,
                rightWord: "I go to school.",
                fullSentence: "I go to school.",
                reason: "'go'는 동사이고 'am'도 be동사입니다. 일반동사와 be동사는 같이 쓸 수 없습니다. 장소 앞에는 전치사 'to'가 필요합니다."
            };
            response = "That's great! Have a good day at school!";
            botTranslation = "잘됐네요! 학교에서 좋은 하루 보내세요!";
        } else {
            // Category-specific mock responses

        // Category-specific mock responses
        switch(currentCategory) {
            case "오늘의 일기쓰기":
                if (userTextLower.includes("sed") || userTextLower.includes("sad") || userTextLower.includes("late")) {
                    correction = {
                        wrongWord: text,
                        rightWord: "I'm so bummed out... I feel terrible. The other day, I was late for school. It really upset me when my friend called me 'the late guy', but I swear I'll never be late for class again!",
                        fullSentence: "원어민스럽게 자연스러운 표현으로 교정해 보았어요.",
                        reason: "단순히 'sad' 나 'late'를 나열하기보다, 'bummed out' (매우 실망한), 'upset me' (날 속상하게 했다) 같은 감정 표현과 'I swear' (맹세코 ~하다) 같은 생생한 원어민 어휘를 쓰면 훨씬 자연스럽습니다."
                    };
                    response = "You had a tough day! What did you do after that happened?";
                    botTranslation = "힘든 하루를 보냈군요! 그 일이 있고 나서 무엇을 했나요?";
                } else {
                    response = "I see. How did that make you feel?";
                    botTranslation = "그렇군요. 그래서 기분이 어땠나요?";
                }
                break;
                
            case "고민상담":
                response = "I can completely understand why you feel that way. It's totally valid. What makes you worry about it the most?";
                botTranslation = "당신이 왜 그렇게 느끼는지 완전히 이해해요. 충분히 그럴 수 있어요. 무엇이 당신을 가장 걱정하게 만드나요?";
                break;
                
            case "밸런스게임":
                response = "Oh, really? Why did you choose that? Tell me the reason in detail!";
                botTranslation = "오, 정말요? 왜 그걸 선택했나요? 이유를 자세히 말해주세요!";
                break;
                
            case "스몰톡":
                response = "That's very interesting! I agree with you. What do you think is the best part about it?";
                botTranslation = "아주 흥미롭네요! 저도 동의합니다. 그것의 가장 좋은 점이 무엇이라고 생각하시나요?";
                break;
                
            case "롤플레잉":
                if (userTextLower.includes("play") || userTextLower.includes("game")) {
                    response = "Sounds fun! I haven't played that one before. Can you teach me how to play?";
                    botTranslation = "재미있겠네요! 저는 그거 한 번도 안 해봤는데 룰 좀 가르쳐 주실래요?";
                } else if (userTextLower.includes("buy") || userTextLower.includes("shop")) {
                    response = "Great choice. Should we look for a discount or just buy it right away?";
                    botTranslation = "훌륭한 선택이네요. 우리 할인을 찾아볼까요, 아니면 당장 살까요?";
                } else {
                    response = "Wow! Let's do that. What should we do next?";
                    botTranslation = "와! 그렇게 해봐요. 그럼 우리 다음엔 뭘 할까요?";
                }
                break;
        } // End of switch
        } // End of else block for mock check

        addBotMessage(response, null, correction, pronunciation, true, botTranslation);
        resetTimers(); // Reset timer after user interaction and bot response
        
        // If the user says "bye", "quit", or "대화종료", trigger manual endSession
        if (userTextLower === "bye" || userTextLower === "quit" || userTextLower === "대화종료" || userTextLower === "종료") {
            setTimeout(() => {
                endSession();
            }, 2000);
        }
    }
}

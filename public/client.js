// File: client.js (FINAL VERSION WITH WORKING SOUNDS AND ALL FEATURES)
const socket = io();

// --- Mainīgie ---
let myPlayerName = '';
let isHost = false;
let currentRoomCode = '';
let currentWordToSpell = '';
let clientTimerInterval = null;
let speechVoice = null;

// JAUNUMS: Jaunas, stabilas skaņu failu URL adreses
const turnNotificationSound = 'https://zvukipro.com/uploads/posts/2023-04/1681400269_telegram-notification.mp3';
const playerNotificationSound = 'https://zvukipro.com/uploads/posts/2022-09/1662659350_wow-mouse-click.mp3';

// --- DOM Elementi ---
const appBody = document.getElementById('app-body');
const lobbyDiv = document.getElementById('lobby');
const gameAreaDiv = document.getElementById('gameArea');
const playerNameInput = document.getElementById('playerNameInput');
const roomCodeInput = document.getElementById('roomCodeInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const createRoomBtn = document.getElementById('createRoomBtn');
const playerSidebar = document.getElementById('player-sidebar');
const mainContent = document.getElementById('main-content');
const playerList = document.getElementById('playerList');
const startGameBtn = document.getElementById('startGameBtn');
const nextTurnBtn = document.getElementById('nextTurnBtn');
const hostActionsTitle = document.getElementById('host-actions-title');
const notificationContainer = document.getElementById('notification-container');
const gameSelectionDiv = document.getElementById('gameSelection');
const gameBoardsDiv = document.getElementById('gameBoards');
const allGameBoards = document.querySelectorAll('.game-board');
const turnIndicator = document.getElementById('turnIndicator');
const activePlayerNameSpan = document.getElementById('activePlayerName');
const roomTitle = document.getElementById('roomTitle');
const neverQuestionText = document.getElementById('neverQuestionText');
const latviaQuestionText = document.getElementById('latviaQuestionText');
const latviaOptions = document.getElementById('latviaOptions');
const taskText = document.getElementById('taskText');
const spellingTimer = document.getElementById('spellingTimer');
const sayWordBtn = document.getElementById('sayWordBtn');
const spellingInput = document.getElementById('spellingInput');
const submitSpellingBtn = document.getElementById('submitSpellingBtn');
const spellingResult = document.getElementById('spellingResult');
const liveTypingDisplay = document.getElementById('liveTypingDisplay');

// --- Funkcijas ---
function playSound(url) {
    const audio = new Audio(url);
    audio.volume = 0.4;
    audio.play().catch(error => {
        console.log("Audio atskaņošana neizdevās.", error);
    });
}

function loadAndSetVoice() {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return;
    speechVoice = voices.find(v => v.name === 'Google US English') || voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) || voices.find(v => v.lang === 'en-US');
    console.log('Izvēlētā balss:', speechVoice?.name || 'Noklusējuma');
}
loadAndSetVoice();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadAndSetVoice;
}

function addNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = message;
    notificationContainer.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => { notification.remove(); }, 500);
    }, 5000);
}

function hideAllBoardsAndReset() {
    allGameBoards.forEach(board => {
        board.style.display = 'none';
        board.classList.remove('animate-in');
    });
    nextTurnBtn.style.display = 'none';
    if(spellingResult) spellingResult.innerHTML = '';
    if(spellingInput) spellingInput.value = '';
    if(liveTypingDisplay) liveTypingDisplay.textContent = '';
    // Taimera loģika ir noņemta
}

function connectToRoom() {
    const playerName = playerNameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!playerName || !roomCode) {
        return alert('Lūdzu, ievadi vārdu un istabas kodu!');
    }
    myPlayerName = playerName;
    currentRoomCode = roomCode;
    socket.emit('joinRoom', { roomCode, playerName });
}

// --- Notikumu Klausītāji ---
joinRoomBtn.addEventListener('click', connectToRoom);
createRoomBtn.addEventListener('click', () => {
    roomCodeInput.value = Math.random().toString(36).substring(2, 8).toUpperCase();
    connectToRoom();
});
startGameBtn.addEventListener('click', () => { if (isHost) socket.emit('startGame', { roomCode: currentRoomCode }); });
nextTurnBtn.addEventListener('click', () => { if (isHost) socket.emit('nextTurn', { roomCode: currentRoomCode }); });

sayWordBtn.addEventListener('click', () => {
    if (currentWordToSpell) {
        const utterance = new SpeechSynthesisUtterance(currentWordToSpell);
        utterance.lang = 'en-US';
        if (speechVoice) {
            utterance.voice = speechVoice;
        }
        speechSynthesis.speak(utterance);
    }
});

spellingInput.addEventListener('input', (e) => {
    socket.emit('playerTyping', { roomCode: currentRoomCode, text: e.target.value });
});

submitSpellingBtn.addEventListener('click', () => {
    console.log('1. Poga "Iesniegt" tika nospiesta! Sūtu datus serverim.');
    socket.emit('submitSpelling', { roomCode: currentRoomCode, submission: spellingInput.value });
    spellingInput.disabled = true;
    submitSpellingBtn.disabled = true;
});


// --- Servera Notikumu Apstrāde ---
socket.on('joinError', (message) => alert(message));
socket.on('assignHost', (isHostStatus) => { isHost = isHostStatus; });

socket.on('updateLobby', ({ players, scores, hostName, gameStarted }) => {
    isHost = (myPlayerName === hostName);
    playerList.innerHTML = '';
    players.forEach(name => {
        const li = document.createElement('li');
        let content = `<span class="player-name">${name}</span> <span class="score-counter">[${scores[name] || 0}]</span>`;
        if (name === hostName) {
            content += ' <i class="fas fa-crown host-icon"></i>';
        }
        li.innerHTML = content;
        playerList.appendChild(li);
    });
    if (lobbyDiv.style.display !== 'none') {
        lobbyDiv.style.display = 'none';
        gameAreaDiv.style.display = 'block';
        playerSidebar.classList.add('visible');
        mainContent.classList.add('sidebar-active');
    }
    roomTitle.textContent = `Istaba: ${currentRoomCode}`;
    if (gameStarted) {
        gameSelectionDiv.style.display = 'none';
        gameBoardsDiv.style.display = 'block';
    } else {
        gameSelectionDiv.style.display = 'block';
        gameBoardsDiv.style.display = 'none';
        if (isHost) {
            startGameBtn.style.display = 'block';
            hostActionsTitle.textContent = "Tu esi spēles vadītājs! Sāc spēli.";
        } else {
            startGameBtn.style.display = 'none';
            hostActionsTitle.textContent = "Gaidām, kad spēles vadītājs sāks spēli...";
        }
    }
});

socket.on('newTurn', ({ turnData, activePlayerName }) => {
    gameSelectionDiv.style.display = 'none';
    gameBoardsDiv.style.display = 'block';
    turnIndicator.style.display = 'block';
    hideAllBoardsAndReset();
    activePlayerNameSpan.textContent = activePlayerName;
    document.body.className = `theme-${turnData.type}`;
    const isMyTurn = myPlayerName === activePlayerName;
    if (isMyTurn) { playSound(turnNotificationSound); }
    if (isHost && (turnData.type === 'never' || turnData.type === 'task')) { nextTurnBtn.style.display = 'block'; }
    let boardToShow;
    switch (turnData.type) {
        case 'never':
            boardToShow = document.getElementById('neverGame');
            neverQuestionText.textContent = turnData.data.question;
            break;
        case 'latvia':
            boardToShow = document.getElementById('latviaGame');
            latviaQuestionText.textContent = turnData.data.question;
            latviaOptions.innerHTML = '';
            turnData.data.options.forEach(option => {
                const button = document.createElement('button');
                button.textContent = option;
                button.className = 'option-btn';
                button.disabled = !isMyTurn;
                button.onclick = () => { if(isMyTurn) socket.emit('submitLatviaAnswer', { roomCode: currentRoomCode, answer: option }); };
                latviaOptions.appendChild(button);
            });
            break;
        case 'task':
            boardToShow = document.getElementById('taskGame');
            taskText.textContent = turnData.data.text;
            break;
        case 'spelling':
            boardToShow = document.getElementById('spellingGame');
            currentWordToSpell = turnData.data.word;
            sayWordBtn.disabled = false;
            spellingInput.disabled = !isMyTurn;
            submitSpellingBtn.disabled = !isMyTurn;
            spellingInput.placeholder = isMyTurn ? "Tava kārta rakstīt..." : `Gaidi... ${activePlayerName} raksta...`;
            break;
    }
    if (boardToShow) {
        boardToShow.style.display = 'block';
        boardToShow.classList.add('animate-in');
        boardToShow.addEventListener('animationend', () => { boardToShow.classList.remove('animate-in'); }, { once: true });
    }
});

socket.on('spellingResult', ({ submission, isCorrect, correctWord }) => {
    console.log('2. Saņemts rezultāts no servera!', { submission, isCorrect, correctWord });
    liveTypingDisplay.textContent = '';
    spellingResult.innerHTML = `Iesniegts: "<b>${submission}</b>" - ${isCorrect ? '<span class="correct">PAREIZI!</span>' : `<span class="incorrect">NEPAREIZI!</span><br>Pareizais vārds: <b>${correctWord}</b>`}`;
    if (isHost) nextTurnBtn.style.display = 'block';
});

socket.on('latviaResult', ({ chosenAnswer, correctAnswer }) => {
    document.querySelectorAll('#latviaOptions .option-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === correctAnswer) btn.classList.add('correct');
        else if (btn.textContent === chosenAnswer) btn.classList.add('incorrect');
    });
    if (isHost) nextTurnBtn.style.display = 'block';
});

socket.on('typingUpdate', ({ text }) => {
    if (myPlayerName !== activePlayerNameSpan.textContent) {
        liveTypingDisplay.textContent = text;
    }
});

socket.on('newNotification', (message) => {
    addNotification(message);
    if (message.includes('pievienojās') || message.includes('pameta')) {
        playSound(playerNotificationSound);
    }
});

socket.on('updateScores', (scores) => {
    document.querySelectorAll('#playerList li').forEach(li => {
        const nameElement = li.querySelector('.player-name');
        if(nameElement){
            const name = nameElement.textContent;
            const scoreSpan = li.querySelector('.score-counter');
            if (scoreSpan) {
                scoreSpan.textContent = `[${scores[name] || 0}]`;
            }
        }
    });
});
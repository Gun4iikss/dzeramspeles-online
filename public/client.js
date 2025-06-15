// File: client.js
const socket = io();

let currentRoomCode = '';
let myPlayerName = '';
let currentWordToSpell = '';

// --- DOM Elements ---
const appBody = document.getElementById('app-body');
const lobbyDiv = document.getElementById('lobby');
const gameAreaDiv = document.getElementById('gameArea');
const gameSelectionDiv = document.getElementById('gameSelection');
const gameBoardsDiv = document.getElementById('gameBoards');
const allGameBoards = document.querySelectorAll('.game-board');
const turnIndicator = document.getElementById('turnIndicator');
const activePlayerNameSpan = document.getElementById('activePlayerName');
const createRoomBtn = document.getElementById('createRoomBtn'), joinRoomBtn = document.getElementById('joinRoomBtn');
const playerNameInput = document.getElementById('playerNameInput'), roomCodeInput = document.getElementById('roomCodeInput');
const roomTitle = document.getElementById('roomTitle'), playerList = document.getElementById('playerList');
const startChaosBtn = document.getElementById('startChaosBtn'), nextTurnBtn = document.getElementById('nextTurnBtn');
const neverQuestionText = document.getElementById('neverQuestionText');
const latviaQuestionText = document.getElementById('latviaQuestionText'), latviaOptions = document.getElementById('latviaOptions');
const taskText = document.getElementById('taskText');
const sayWordBtn = document.getElementById('sayWordBtn'), spellingInput = document.getElementById('spellingInput'), submitSpellingBtn = document.getElementById('submitSpellingBtn'), spellingResult = document.getElementById('spellingResult');

// --- Functions ---
function connectToRoom() {
    const playerName = playerNameInput.value.trim();
    if (!playerName) return alert('Lūdzu, ievadi vārdu!');
    myPlayerName = playerName;
    
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (!roomCode) return alert('Lūdzu, ievadi istabas kodu!');
    
    currentRoomCode = roomCode;
    socket.emit('joinRoom', { roomCode, playerName });

    lobbyDiv.style.display = 'none';
    gameAreaDiv.style.display = 'block';
    roomTitle.textContent = `Istaba: ${roomCode}`;
}

function hideAllBoardsAndReset() {
    allGameBoards.forEach(board => board.style.display = 'none');
    nextTurnBtn.style.display = 'none'; // Hide next button on new turn
    spellingResult.textContent = ''; // Clear spelling result
}

// --- Event Listeners ---
createRoomBtn.addEventListener('click', () => { roomCodeInput.value = Math.random().toString(36).substring(2, 8).toUpperCase(); connectToRoom(); });
joinRoomBtn.addEventListener('click', connectToRoom);
startChaosBtn.addEventListener('click', () => socket.emit('startChaosGame', { roomCode: currentRoomCode }));
nextTurnBtn.addEventListener('click', () => socket.emit('nextTurn', { roomCode: currentRoomCode }));
sayWordBtn.addEventListener('click', () => {
    if (currentWordToSpell) {
        const utterance = new SpeechSynthesisUtterance(currentWordToSpell);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }
});
submitSpellingBtn.addEventListener('click', () => {
    const answer = spellingInput.value.trim().toLowerCase();
    if (answer === currentWordToSpell.toLowerCase()) {
        spellingResult.textContent = 'PAREIZI!';
        spellingResult.className = 'result-message correct';
    } else {
        spellingResult.textContent = `NEPAREIZI! Pareizā atbilde: ${currentWordToSpell}`;
        spellingResult.className = 'result-message incorrect';
    }
    spellingInput.disabled = true;
    submitSpellingBtn.disabled = true;
    nextTurnBtn.style.display = 'block'; // Show next button
});

// --- Main Socket.IO Event Handlers ---
socket.on('updatePlayerList', (players) => {
    playerList.innerHTML = '';
    players.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        playerList.appendChild(li);
    });
});

socket.on('newTurn', ({ turnData, activePlayerName }) => {
    gameSelectionDiv.style.display = 'none';
    gameBoardsDiv.style.display = 'block';
    turnIndicator.style.display = 'block';
    hideAllBoardsAndReset();

    activePlayerNameSpan.textContent = activePlayerName;
    appBody.className = `theme-${turnData.type}`;

    const isMyTurn = myPlayerName === activePlayerName;

    // For games without specific turns, always show next button
    if (turnData.type === 'never' || turnData.type === 'task') {
        nextTurnBtn.style.display = 'block';
    }

    switch (turnData.type) {
        case 'never':
            document.getElementById('neverGame').style.display = 'block';
            neverQuestionText.textContent = turnData.data.question;
            break;
        case 'latvia':
            document.getElementById('latviaGame').style.display = 'block';
            latviaQuestionText.textContent = turnData.data.question;
            latviaOptions.innerHTML = '';
            turnData.data.options.forEach(option => {
                const button = document.createElement('button');
                button.textContent = option;
                button.className = 'option-btn';
                button.onclick = () => {
                    document.querySelectorAll('#latviaOptions .option-btn').forEach(btn => btn.disabled = true);
                    if (option === turnData.data.answer) {
                        button.classList.add('correct');
                    } else {
                        button.classList.add('incorrect');
                    }
                    nextTurnBtn.style.display = 'block';
                };
                latviaOptions.appendChild(button);
            });
            break;
        case 'task':
            document.getElementById('taskGame').style.display = 'block';
            taskText.textContent = turnData.data.text;
            break;
        case 'spelling':
            document.getElementById('spellingGame').style.display = 'block';
            currentWordToSpell = turnData.data.word;
            spellingInput.value = '';
            spellingInput.disabled = !isMyTurn;
            submitSpellingBtn.disabled = !isMyTurn;
            spellingInput.placeholder = isMyTurn ? "Tava kārta rakstīt..." : "Gaidi savu kārtu...";
            break;
    }
});
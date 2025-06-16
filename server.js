// File: server.js (FINAL, FULLY WORKING VERSION WITH ALL LOGIC)
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 3000;

// Ielasām datus no atsevišķiem failiem.
const neverHaveIEverQuestions = require('./data/neverHaveIEver.js');
const latviaTriviaQuestions = require('./data/latviaTrivia.js');
const izaicinajumiUnUzdevumi = require('./data/izaicinajumi.js');
const spellingBeeWords = require('./data/spellingBee.js');

function createMasterGameArray() {
    const masterArray = [];
    if (neverHaveIEverQuestions) masterArray.push(...neverHaveIEverQuestions.map(q => ({ type: 'never', data: { question: q } })));
    if (latviaTriviaQuestions) masterArray.push(...latviaTriviaQuestions.map(q => ({ type: 'latvia', data: q })));
    if (izaicinajumiUnUzdevumi) masterArray.push(...izaicinajumiUnUzdevumi.map(task => ({ type: 'task', data: { text: task } })));
    if (spellingBeeWords) {
        const allWords = [...(spellingBeeWords.easy || []), ...(spellingBeeWords.medium || []), ...(spellingBeeWords.hard || [])];
        allWords.forEach(word => masterArray.push({ type: 'spelling', data: { word: word } }));
    }
    return masterArray;
}
const masterGameArray = createMasterGameArray();
const rooms = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        if (!roomCode || !playerName) return;
        socket.join(roomCode);
        let isHost = false;
        if (!rooms[roomCode]) {
            isHost = true;
            rooms[roomCode] = { 
                players: [], hostId: socket.id, gameStarted: false,
                currentPlayerIndex: 0, currentTurnData: null, scores: {}
            };
        }
        const room = rooms[roomCode];
        if (room.players.some(p => p.name === playerName)) {
            socket.emit('joinError', 'Spēlētājs ar šādu vārdu jau ir šajā istabā.');
            socket.leave(roomCode);
            return;
        }
        const playerInfo = { id: socket.id, name: playerName };
        room.players.push(playerInfo);
        room.scores[playerName] = 0;
        const hostPlayer = room.players.find(p => p.id === room.hostId);
        io.to(roomCode).emit('updateLobby', {
            players: room.players.map(p => p.name), scores: room.scores,
            hostName: hostPlayer ? hostPlayer.name : null, gameStarted: room.gameStarted
        });
        io.to(roomCode).emit('newNotification', `${playerName} pievienojās istabai ${roomCode}!`);
        socket.emit('assignHost', isHost);
    });

    const isHostAction = (roomCode, socketId) => rooms[roomCode] && rooms[roomCode].hostId === socketId;

    socket.on('startGame', ({ roomCode }) => {
        if (isHostAction(roomCode, socket.id) && rooms[roomCode] && !rooms[roomCode].gameStarted) {
            const room = rooms[roomCode];
            room.gameStarted = true;
            room.currentPlayerIndex = 0;
            const activePlayer = room.players[0];
            const turnData = masterGameArray[Math.floor(Math.random() * masterGameArray.length)];
            room.currentTurnData = turnData;
            if (activePlayer) io.to(roomCode).emit('newTurn', { turnData, activePlayerName: activePlayer.name });
        }
    });

    socket.on('nextTurn', ({ roomCode }) => {
        if (isHostAction(roomCode, socket.id)) {
            const room = rooms[roomCode];
            if (!room.players || room.players.length === 0) return;
            room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
            const activePlayer = room.players[room.currentPlayerIndex];
            const turnData = masterGameArray[Math.floor(Math.random() * masterGameArray.length)];
            room.currentTurnData = turnData;
            if (activePlayer) io.to(roomCode).emit('newTurn', { turnData, activePlayerName: activePlayer.name });
        }
    });
    
    socket.on('playerTyping', ({ roomCode, text }) => {
        socket.to(roomCode).emit('typingUpdate', { text });
    });

    socket.on('submitSpelling', ({ roomCode, submission }) => {
        const room = rooms[roomCode];
        const activePlayerName = room.players[room.currentPlayerIndex]?.name;
        if (room && room.currentTurnData?.type === 'spelling' && activePlayerName) {
            const correctWord = room.currentTurnData.data.word;
            const isCorrect = submission.trim().toLowerCase() === correctWord.toLowerCase();
            if (!isCorrect) {
                if(room.scores[activePlayerName] !== undefined) room.scores[activePlayerName]++;
            }
            io.to(roomCode).emit('spellingResult', { submission, isCorrect, correctWord });
            io.to(roomCode).emit('updateScores', room.scores);
        }
    });

    socket.on('submitLatviaAnswer', ({ roomCode, answer }) => {
        const room = rooms[roomCode];
        const activePlayerName = room.players[room.currentPlayerIndex]?.name;
        if (room && room.currentTurnData?.type === 'latvia' && activePlayerName) {
            const correctAnswer = room.currentTurnData.data.answer;
            if (answer !== correctAnswer) {
                if(room.scores[activePlayerName] !== undefined) room.scores[activePlayerName]++;
            }
            io.to(roomCode).emit('latviaResult', { chosenAnswer: answer, correctAnswer });
            io.to(roomCode).emit('updateScores', room.scores);
        }
    });
    
    socket.on('disconnecting', () => {
        const roomCode = Array.from(socket.rooms).find(room => room !== socket.id && rooms[room]);
        if (roomCode) {
            const room = rooms[roomCode];
            const playerLeaving = room.players.find(p => p.id === socket.id);
            if (!playerLeaving) return;
            room.players = room.players.filter(p => p.id !== socket.id);
            delete room.scores[playerLeaving.name];
            io.to(roomCode).emit('newNotification', `${playerLeaving.name} pameta spēli.`);
            if (room.players.length > 0) {
                if (socket.id === room.hostId) {
                    room.hostId = room.players[0].id;
                    const newHostName = room.players[0].name;
                    io.to(roomCode).emit('newNotification', `${newHostName} tagad ir jaunais spēles vadītājs!`);
                    io.to(room.hostId).emit('assignHost', true);
                }
                const hostPlayer = room.players.find(p => p.id === room.hostId);
                io.to(roomCode).emit('updateLobby', { 
                    players: room.players.map(p => p.name), 
                    scores: room.scores, 
                    hostName: hostPlayer ? hostPlayer.name : 'N/A',
                    gameStarted: room.gameStarted
                });
            } else {
                delete rooms[roomCode];
            }
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Serveris ir palaists! Atver http://localhost:${PORT}`));
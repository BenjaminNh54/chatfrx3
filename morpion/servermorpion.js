// server.js
// Tic Tac Toe multijoueur simple avec chat
// Dépendances : express et ws
// Installation :
//   npm init -y
//   npm install express ws
// Lancement :
//   node server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir les fichiers du dossier 'public'
app.use(express.static('public'));

// ===== Gestion des connexions =====
let nextId = 1;
const clients = new Map(); // id -> { ws, name }
const games = new Map();   // gameId -> { players: [idX, idO], board, turn }

function broadcastUserList() {
  const list = Array.from(clients.entries()).map(([id, info]) => ({ id, name: info.name }));
  const msg = JSON.stringify({ type: 'users', users: list });
  for (const [, info] of clients) {
    if (info.ws.readyState === WebSocket.OPEN) info.ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  const id = String(nextId++);
  clients.set(id, { ws, name: 'Anonyme' });

  ws.send(JSON.stringify({ type: 'welcome', id }));
  broadcastUserList();

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    // ===== Gestion pseudo =====
    if (data.type === 'set-name') {
      const c = clients.get(id);
      if (c) c.name = String(data.name || 'Anonyme');
      broadcastUserList();
    }

    // ===== Invitation =====
    if (data.type === 'invite') {
      const target = clients.get(data.target);
      if (target && target.ws.readyState === WebSocket.OPEN) {
        target.ws.send(JSON.stringify({ type: 'invite', from: id, fromName: clients.get(id).name }));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Utilisateur non disponible' }));
      }
    }

    if (data.type === 'invite-response') {
      const from = clients.get(data.from);
      if (from && from.ws.readyState === WebSocket.OPEN) {
        if (data.accept) {
          const gameId = 'g' + Date.now() + Math.floor(Math.random() * 1000);
          const playerX = data.from;
          const playerO = id;
          games.set(gameId, { players: [playerX, playerO], board: Array(9).fill(null), turn: playerX });

          from.ws.send(JSON.stringify({
            type: 'invite-accepted',
            gameId, role: 'X',
            opponentName: clients.get(id).name,
            opponentId: id
          }));

          ws.send(JSON.stringify({
            type: 'invite-accepted',
            gameId, role: 'O',
            opponentName: clients.get(playerX).name,
            opponentId: playerX
          }));
        } else {
          from.ws.send(JSON.stringify({ type: 'invite-declined', from: id }));
        }
      }
    }

    // ===== Coup =====
    if (data.type === 'move') {
      const game = games.get(data.gameId);
      if (!game) return;
      if (game.turn !== id) return;
      const idx = Number(data.index);
      if (isNaN(idx) || idx < 0 || idx > 8) return;
      if (game.board[idx] !== null) return;

      const role = (game.players[0] === id) ? 'X' : 'O';
      game.board[idx] = role;
      game.turn = (game.players[0] === game.turn) ? game.players[1] : game.players[0];

      for (const pid of game.players) {
        const c = clients.get(pid);
        if (c && c.ws.readyState === WebSocket.OPEN) {
          c.ws.send(JSON.stringify({ type: 'update', gameId: data.gameId, board: game.board, turn: game.turn }));
        }
      }

      const winner = checkWinner(game.board);
      if (winner || game.board.every(c => c !== null)) {
        for (const pid of game.players) {
          const c = clients.get(pid);
          if (c && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'game-over', gameId: data.gameId, board: game.board, winner }));
          }
        }
        games.delete(data.gameId);
      }
    }

    // ===== Chat privé par partie =====
    if (data.type === 'chat') {
      const game = games.get(data.gameId);
      if (!game) return;
      for (const pid of game.players) {
        const c = clients.get(pid);
        if (c && c.ws.readyState === WebSocket.OPEN) {
          c.ws.send(JSON.stringify({
            type: 'chat',
            gameId: data.gameId,
            fromId: id,
            fromName: clients.get(id).name,
            message: data.message
          }));
        }
      }
    }

    // ===== Quitter la partie =====
    if (data.type === 'leave-game') {
      const game = games.get(data.gameId);
      if (game) {
        for (const pid of game.players) {
          const c = clients.get(pid);
          if (c && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'game-ended', gameId: data.gameId }));
          }
        }
        games.delete(data.gameId);
      }
    }
  });

  // ===== Déconnexion =====
  ws.on('close', () => {
    clients.delete(id);
    for (const [gid, game] of games.entries()) {
      if (game.players.includes(id)) {
        for (const pid of game.players) {
          const c = clients.get(pid);
          if (c && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ type: 'game-ended', gameId: gid, reason: 'player-disconnected' }));
          }
        }
        games.delete(gid);
      }
    }
    broadcastUserList();
  });
});

// ===== Vérifie le gagnant =====
function checkWinner(b) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (const [a, b1, c] of lines) {
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('✅ Serveur lancé sur le port', PORT));

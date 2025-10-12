let ws;
let myId = null;
let currentGame = null;
let myRole = null; // 'X' ou 'O'

function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);

  ws.onopen = () => console.log('✅ Connecté au serveur WebSocket');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'welcome') {
      myId = data.id;
    }

    if (data.type === 'users') {
      renderUsers(data.users);
    }

    if (data.type === 'invite') {
      // Si on est déjà en partie, auto-refuser l'invitation
      if (currentGame) {
        ws.send(JSON.stringify({ type: 'invite-response', from: data.from, accept: false }));
      } else {
        const accepter = confirm(`${data.fromName} vous invite à jouer. Accepter ?`);
        ws.send(JSON.stringify({ type: 'invite-response', from: data.from, accept: accepter }));
      }
    }

    if (data.type === 'invite-accepted') {
      currentGame = data.gameId;
      myRole = data.role;
      document.getElementById('status').innerText =
        `En jeu contre ${data.opponentName} — Vous êtes ${myRole}`;
      setBoardEnabled(myRole === 'X'); // X commence
      clearChat();
      // afficher le chat pour la partie en cours
      toggleChat(true);
    }

    if (data.type === 'update') {
      if (data.gameId !== currentGame) return;
      renderBoard(data.board);
      const canPlay = (data.turn === myId);
      document.getElementById('status').innerText =
        canPlay ? "Votre tour de jouer" : "Tour de l'adversaire";
      setBoardEnabled(canPlay);
    }

    if (data.type === 'game-over') {
      if (data.gameId !== currentGame) return;
      renderBoard(data.board);
      alert(data.winner ? `Partie terminée ! Gagnant : ${data.winner}` : 'Match nul');
      currentGame = null;
      myRole = null;
      window.location.href = window.location.href;
      document.getElementById('status').innerText = 'Pas de partie';
      setBoardEnabled(false);
      // masquer le chat quand la partie est terminée
      toggleChat(false);
    }

    if (data.type === 'invite-declined') {
      alert('Invitation refusée');
    }

    if (data.type === 'game-ended') {
      alert('Partie terminée : ' + (data.reason || 'fin du jeu'));
      currentGame = null;
      myRole = null;
      document.getElementById('status').innerText = 'Pas de partie';
      setBoardEnabled(false);
      // masquer le chat si la partie se termine
      toggleChat(false);
    }

    // ==== Chat ====
    if (data.type === 'chat') {
      if (data.gameId !== currentGame) return; // messages uniquement pour cette partie
      const box = document.getElementById('chatBox');
      const div = document.createElement('div');
      div.textContent = `${data.fromName}: ${data.message}`;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }
  };

  ws.onclose = () => {
    console.log('❌ Déconnecté du serveur WebSocket');
  };
}

// Affiche la liste des joueurs en ligne
function renderUsers(users) {
  const container = document.getElementById('users');
  container.innerHTML = '';
  // Si on est déjà en partie, ne pas afficher la liste pour éviter d'inviter/être invité
  if (currentGame) return;
  users.forEach(u => {
    if (u.id === myId) return;
    const div = document.createElement('div');
    div.textContent = u.name + ' ';
    const btn = document.createElement('button');
    btn.textContent = 'Inviter';
    btn.onclick = () => {
      if (currentGame) { alert('Impossible d\'inviter : vous êtes en partie'); return; }
      ws.send(JSON.stringify({ type: 'invite', target: u.id }));
    };
    div.appendChild(btn);
    container.appendChild(div);
  });
}

// Crée la grille une seule fois
function createBoardHTML() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.onclick = () => onCellClick(i);
    board.appendChild(cell);
  }
}

// Met à jour l’affichage sans recréer les cellules
function renderBoard(board) {
  const cells = document.querySelectorAll('.cell');
  board.forEach((val, i) => {
    cells[i].textContent = val || '';
  });
}

// Clic sur une case
function onCellClick(index) {
  if (!currentGame) return alert('Pas en partie');
  ws.send(JSON.stringify({ type: 'move', gameId: currentGame, index }));
}

// Active ou désactive la grille
function setBoardEnabled(enabled) {
  const board = document.getElementById('board');
  if (enabled) board.classList.remove('disabled');
  else board.classList.add('disabled');
}

// ==== Chat ====
function clearChat() {
  document.getElementById('chatBox').innerHTML = '';
}

// Affiche ou masque le chat (cache les éléments liés pour ne pas les supprimer)
function toggleChat(visible) {
  const chatBox = document.getElementById('chatBox');
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  if (!chatBox || !chatInput || !chatSend) return;
  const display = visible ? '' : 'none';
  const container = chatBox.parentElement || chatBox;
  container.style.display = display;
  chatInput.style.display = display;
  chatSend.style.display = display;
}

// Envoi d’un message chat
function setupChat() {
  document.getElementById('chatSend').onclick = sendMessage;
  document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

function sendMessage() {
  const msg = document.getElementById('chatInput').value.trim();
  if (!msg || !currentGame) return;
  ws.send(JSON.stringify({ type: 'chat', gameId: currentGame, message: msg }));
  document.getElementById('chatInput').value = '';
}

// Initialisation au chargement de la page
window.addEventListener('load', () => {
  connect();
  createBoardHTML(); // une seule fois
  setBoardEnabled(false);
  setupChat();
  // masquer le chat par défaut (visible seulement quand une partie est lancée)
  toggleChat(false);

  document.getElementById('setName').onclick = () => {
    const name = document.getElementById('nameInput').value || 'Anonyme';
    ws.send(JSON.stringify({ type: 'set-name', name }));
    //nous allons prevenire l'utilisateur que son pseudo a bien ete validé en lui faisant une boite de dialogue puis nous retirons le champs de pseudo et le bouton valider
    alert(`Votre pseudo est défini : ${name}`);
    document.getElementById('nameInput').style.display = 'none';
    document.getElementById('setName').style.display = 'none';
  };
});

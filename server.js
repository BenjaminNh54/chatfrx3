// server.js
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ===== CONFIG SUPABASE =====
const supabaseUrl = 'https://osqzuptinfbahmfncjgl.supabase.co';
const supabaseKey = 'sb_secret_b4tZZmSvmT-vze7BvvNzhQ_zJFULUxt'; // ta clé
const supabase = createClient(supabaseUrl, supabaseKey);
// ===========================

// Créer un serveur HTTP basique avec gestion POST /user
const server = http.createServer(async (req, res) => {
  // Ajout des headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === 'POST' && req.url === '/user') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const { name, password } = JSON.parse(body);
        if (!name || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nom et mot de passe requis.' }));
          return;
        }
        const { data, error } = await supabase
          .from('users')
          .insert([{ name, password }])
          .select();
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ user: data[0] }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Requête invalide.' }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/login') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const { name, password } = JSON.parse(body);
        if (!name || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Nom et mot de passe requis.' }));
          return;
        }
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('name', name);
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        } else if (data.length > 0 && data[0].password === password) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, user: data[0] }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Nom ou mot de passe incorrect.' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Requête invalide.' }));
      }
    });
  } else if (req.method === 'POST' && req.url === '/group') {
    // Créer un groupe
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { name, admin_id } = JSON.parse(body);
        if (!name || !admin_id) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Nom et admin_id requis.' }));
          return;
        }
        const { data, error } = await supabase
          .from('groups')
          .insert([{ name, admin_id }])
          .select();
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        } else {
          const { data2, error } = await supabase
            .from('group_members')
            .insert([{ group_id: data[0].id, user_id: admin_id }])
            .select();
          if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
          } else {
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ group: data[0] }));
          }
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Requête invalide.' }));
      }
    });
  } else if (req.method === 'GET' && req.url.startsWith('/groups/admin/')) {
    // Groupes dont je suis admin
    const userId = req.url.split('/').pop();
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .eq('admin_id', userId);
    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    }
  } else if (req.method === 'GET' && req.url.startsWith('/groups/member/')) {
    // Groupes dont je fais partie (mais pas admin)
    const userId = req.url.split('/').pop();
    const { data, error } = await supabase
      .from('group_members')
      .select('group_id, groups(id, name, admin_id)')
      .eq('user_id', userId);

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    } else {
      // Exclure les groupes où je suis admin
      const filtered = data.filter(g => g.groups.admin_id !== parseInt(userId));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(filtered.map(g => ({
        id: g.group_id,
        name: g.groups.name
      }))));
    }
  } else if (req.method === 'POST' && req.url.match(/^\/group\/[0-9]+\/add-user$/)) {
    // Ajouter un utilisateur à un groupe
    const groupId = req.url.split('/')[2];
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { userId } = JSON.parse(body);
        if (!userId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Utilisateur requis.' }));
          return;
        }
        const { data, error } = await supabase
          .from('group_members')
          .insert([{ group_id: groupId, user_id: userId }])
          .select();
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ member: data[0] }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Requête invalide.' }));
      }
    });
  } else if (req.method === 'GET' && req.url.match(/^\/group\/[0-9]+\/request$/)) {
    // Demande d'accès à un groupe
    const groupId = req.url.split('/')[2];
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { data, error } = await supabase
          .from('group_requests')
          .select(`
            id,
            group_id,
            user_id,
            groups (id, name),
            users (id, name)
          `).eq('group_id', groupId);
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ requests: data }));
        }
      } catch (err) {
        console.error(err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Requête invalide.' }));
      }
    });
  } else if (req.method === 'POST' && req.url.match(/^\/group\/request$/)) {
    // Demande d'accès à un groupe
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { groupName, userId } = JSON.parse(body);
        if (!groupName || !userId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'groupName et userId requis.' }));
          return;
        }
        //Recherche le groupe par son nom
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('id')
          .eq('name', groupName)
          .single();

        if (groupError || !groupData) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Groupe non trouvé.' }));
          return;
        }

        const groupId = groupData.id;

        // Ici, on pourrait insérer dans une table "group_requests" ou envoyer une notification
        // Pour l'exemple, on insère dans group_requests
        const { data, error } = await supabase
          .from('group_requests')
          .insert([{ group_id: groupId, user_id: userId }])
          .select();
        if (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ request: data[0] }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Requête invalide.' }));
      }
    });
  } else if (req.method === 'DELETE' && req.url.match(/^\/group\/request$/)) {
    console.log('DELETE group/request');

    // suppression de demande d'accès à un groupe
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { requestId } = JSON.parse(body);
        if (!requestId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'requestId requis.' }));
          return;
        }

        // Supprime la demande
        const { error: deleteError } = await supabase
          .from('group_requests')
          .delete()
          .eq('id', requestId);

        if (deleteError) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: deleteError.message }));
        } else {
          res.writeHead(204);
          res.end();
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Requête invalide.' }));
      }

    });
  } else if (req.method === 'GET' && req.url.match(/^\/group\/[0-9]+\/messages$/)) {
    // Récupérer les messages d'un groupe
    const groupId = req.url.split('/')[2];
    const { data, error } = await supabase
      .from('message2_with_pseudo')
      .select('id, id_user, text:message, date:created_at, pseudo')
      .eq('id_group', groupId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erreur récupération messages:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // Ajout: servir une page HTML pour le client Web (route / ou /index.html) 
  else if (req.method === 'GET' && (req.url === '/' || req.url === '/login' || req.url === '/login.html')) {
    const filePath = path.join(__dirname, 'login.html');
    fs.stat(filePath, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('login.html introuvable');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
    });
  }
    else if (req.method === 'GET' && (req.url === '/' || req.url === '/login' || req.url === '/login.js')) {
    const filePath = path.join(__dirname, 'login.js');
    fs.stat(filePath, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('login.js introuvable');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
    });
  }
  else if (req.method === 'GET' && (req.url === '/group' || req.url === '/group.html')) {
    const filePath = path.join(__dirname, 'group.html');
    fs.stat(filePath, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('group.html introuvable');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
    });
  }else if (req.method === 'GET' && (req.url === '/group' || req.url === '/group.js')) {
    const filePath = path.join(__dirname, 'group.js');
    fs.stat(filePath, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('group.js introuvable');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
    });
  }  else if (req.method === 'GET' && (req.url === '/create-user' || req.url === '/create-user.html')) {
    const filePath = path.join(__dirname, 'create-user.html');
    fs.stat(filePath, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('create-user.html introuvable');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
    });
  } else if (req.method === 'GET' && (req.url === '/create-user' || req.url === '/create-user.js')) {
    const filePath = path.join(__dirname, 'create-user.js');
    fs.stat(filePath, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('create-user.js introuvable');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
    });
  } else if (req.method === 'GET' && (req.url === '/chat' || req.url === '/chat.html')) {
    const filePath = path.join(__dirname, 'chat.html');
    fs.stat(filePath, (err) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('chat.html introuvable');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
    });
  } else {
    res.writeHead(200);
    res.end("Serveur de chat en ligne via Render + Supabase");

  }
});


// Créer le serveur WebSocket
const wss = new WebSocket.Server({ server });

// Fonction pour récupérer tous les messages depuis Supabase
async function getAllMessages() {
  try {
    const { data, error } = await supabase
      .from('message2')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erreur récupération messages:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Erreur fetch messages (catch):', err);
    return [];
  }
}

// Gestion des connexions WebSocket
wss.on('connection', async (ws) => {
  console.log('Nouvelle connexion WebSocket');

  // Envoyer l'historique au nouvel utilisateur
  const messages = await getAllMessages();
  messages.forEach(msg => {
    ws.send(JSON.stringify({ pseudo: msg.user, text: msg.message, date: msg.created_at }));
  });

  // Réception d'un nouveau message
  ws.on('message', async (message) => {
    try {
      const msgObj = JSON.parse(message.toString());

      // Déterminer le pseudo : priorité à msgObj.pseudo, sinon msgObj.userId -> lookup, sinon null
      let pseudo = (msgObj.pseudo !== undefined && msgObj.pseudo !== null)
        ? String(msgObj.pseudo).trim()
        : null;

      if ((!pseudo || pseudo === '') && msgObj.userId) {
        const { data: userData, error: userErr } = await supabase
          .from('users')
          .select('name')
          .eq('id', msgObj.userId)
          .single();
        if (!userErr && userData && userData.name) pseudo = String(userData.name);
        else pseudo = `user:${msgObj.userId}`; // fallback lisible
      }

      const text = msgObj.text ? String(msgObj.text).trim() : null;
      if (!pseudo || !text) {
        console.error('Message ignoré: pseudo ou texte manquant', msgObj);
        return;
      }

      // Construire l'objet à insérer (ajoute group_id si fourni)
      const row = { id_user: pseudo, message: text };
      if (msgObj.group_id !== undefined && msgObj.group_id !== null) {
        const gid = Number(msgObj.group_id);
        if (!Number.isNaN(gid)) row.id_group = gid;
      }

      // Sauvegarder dans Supabase et récupérer created_at
      const { data, error } = await supabase
        .from('message2')
        .insert([row])
        .select();

      if (error) {
        console.error('Erreur insertion message2:', error);
        return;
      }
      if (!data || data.length === 0) {
        console.error('Aucun message retourné après insertion');
        return;
      }

      const savedMsg = data[0];

      // rechercher le nom du user si possible
      if (savedMsg.id_user) {
        const { data: userData, error: userErr } = await supabase
          .from('users')
          .select('name')
          .eq('id', savedMsg.id_user)
          .single();
        if (!userErr && userData && userData.name) {
          savedMsg.user = userData.name;
        }
      }

      // Diffuser à tous les clients
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            pseudo: savedMsg.user,
            text: savedMsg.message,
            date: savedMsg.created_at,
            group_id: savedMsg.id_group || null
          }));
        }
      });

    } catch (err) {
      console.error('Erreur traitement message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Client déconnecté');
  });
});

// Render fournit le port via process.env.PORT
const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
  console.log(`Serveur WebSocket lancé sur le port ${PORT}`);
});

// ===== ANTI-SLEEP (Keep-Alive) =====
const RENDER_URL = "https://chatfrx3.onrender.com/login.html"; // <-- remplace par ton URL publique Render

setInterval(() => {
  https.get(RENDER_URL, (res) => {
    console.log("Ping anti-sleep:", res.statusCode);
  }).on("error", (err) => {
    console.error("Erreur ping anti-sleep:", err.message);
  });
}, 5 * 60 * 1000); // toutes les 5 minutes

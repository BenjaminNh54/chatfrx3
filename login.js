// login.js
// Ce script gère la connexion utilisateur avec Supabase

// URL du serveur local ou Render
const SERVER_URL = 'http://localhost:8080';
//const SERVER_URL = 'https://chat-i4wn.onrender.com';

const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const password = document.getElementById('password').value;

    // Vérification utilisateur via le serveur Node.js
    const response = await fetch(`${SERVER_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, password })
    });
    const result = await response.json();
    if (response.ok && result.success && result.user) {
        alert('Connexion réussie !');
        localStorage.setItem('userId', result.user.id);
        // Rediriger vers la page de création de groupes
        window.location.href = 'group.html';
        // Rediriger ou stocker l'état de connexion ici
    } else {
        alert('Nom ou mot de passe incorrect.');
    }
});

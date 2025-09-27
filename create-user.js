// create-user.js
// Ce script gère la création d'utilisateur avec Supabase

// URL du serveur local ou Render
const SERVER_URL = 'https://chatfrx3.onrender.com';
//const SERVER_URL = 'https://chat-i4wn.onrender.com';

const createUserForm = document.getElementById('createUserForm');
createUserForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const password = document.getElementById('password').value;

    // Création utilisateur via le serveur Node.js
    const response = await fetch(`${SERVER_URL}/user`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, password })
    });
    if (response.ok) {
        alert('Compte créé avec succès !');
        window.location.href = 'login.html';
    } else {
        const error = await response.json();
        alert('Erreur lors de la création du compte : ' + (error.error || '')); 
    }
});

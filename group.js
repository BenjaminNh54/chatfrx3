// group.js
// Gestion des groupes : création, édition, connexion, demande d'accès
//Il faut rafrechire la page discretement toutes les 3sec on va faire ça avec copilot notre IA preferer qui nous propose des codes toutes les 3 sec mais je ne veux pas que visuellement le client voit que ça ce recharge.
// Rafraîchir discrètement toutes les 2 minutes
setInterval(() => {
    fetchAdminGroups();
    fetchMyGroups();
}, 120000);
cc
const SERVER_URL = 'https://chatfrx3.onrender.com';

// Création d'un groupe
const createGroupForm = document.getElementById('createGroupForm');
createGroupForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const userId = localStorage.getItem('userId');

    const groupName = document.getElementById('groupName').value;
    // Appel serveur pour créer le groupe
    const response = await fetch(`${SERVER_URL}/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName, admin_id: userId })
    });
    if (response.ok) {
        alert('Groupe créé !');
        location.reload();
    } else {
        alert('Erreur création groupe');
    }
});

// Récupérer les groupes dont je suis admin
async function fetchAdminGroups() {
    // Remplacer par l'ID utilisateur connecté
    const userId = localStorage.getItem('userId');
    const res = await fetch(`${SERVER_URL}/groups/admin/${userId}`);
    const groups = await res.json();
    const adminGroups = document.getElementById('adminGroups');
    adminGroups.innerHTML = '';
    groups.forEach(group => {
        const li = document.createElement('li');
        li.textContent = group.name;
        li.onclick = () => editGroup(group);
        adminGroups.appendChild(li);
    });
}

// Editer un groupe (ajouter utilisateurs)
async function editGroup(group) {
    document.getElementById('editGroupSection').style.display = 'block';
    document.getElementById('editGroupName').textContent = group.name;
    /*document.getElementById('addUserForm').onsubmit = async function(e) {
        e.preventDefault();
        const userToAdd = document.getElementById('userToAdd').value;
        const response = await fetch(`${SERVER_URL}/group/${group.id}/add-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: userToAdd })
        });
        if (response.ok) {
            alert('Utilisateur ajouté !');
            //rafraîchir la liste des utilisateurs du groupe   
        } else {
            alert('Erreur ajout utilisateur');
        }
    };*/

    //Demandes pour rejoindre un groupe
    // Récupérer les demandes d'adhésion au groupe
    async function fetchGroupRequests(groupId) {
        const res = await fetch(`${SERVER_URL}/group/${groupId}/request`);
        const groups = await res.json();
        return groups
    }
    
    fetchGroupRequests(group.id).then(response=>{
        groupRequests = response.requests;
        console.log('groupRequests', groupRequests);
        
        renderRequests();
    });
}

var groupRequests=[];
const reqContainer = document.getElementById('requestsContainer');

function renderRequests() {
    reqContainer.innerHTML = ''; // vide le container
    groupRequests.forEach((req, index) => {
        const div = document.createElement('div');
        div.className = 'request';
        div.innerHTML = `
            <strong>${req.users.name}</strong> souhaite rejoindre <em>${req.groups.name}</em>
            <button onclick="acceptRequest(${index})">Accepter</button>
            <button onclick="rejectRequest(${index})">Rejeter</button>
        `;
        reqContainer.appendChild(div);
    });
}

async function acceptRequest(index) {
    const req = groupRequests[index];
    // requête POST vers ton serveur pour ajouter user_id au groupe group_id
    console.log(`Accepter: user ${req.user_id} dans le groupe ${req.group_id}`);

    const response = await fetch(`${SERVER_URL}/group/${req.group_id}/add-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: req.user_id })
    });
    if (response.ok) {
        alert('Utilisateur ajouté !');
        document.getElementById('requestGroupName').value = '';

        const response = await fetch(`${SERVER_URL}/group/request`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId: req.id })
        });

        groupRequests.splice(index, 1); // retire la demande
        renderRequests();
    } else {
        alert('Erreur demande');
    }


}

async function rejectRequest(index) {
    const req = groupRequests[index];
    // Ici tu pourrais notifier le serveur pour supprimer/refuser la demande
    console.log(`Rejeter: user ${req.user_id} pour le groupe ${req.group_id} / reqId : ${req.id}`);

    // Notifier le serveur pour supprimer la demande
    try {
       const response = await fetch(`${SERVER_URL}/group/request`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId: req.id })
        }); 
    
        if (response.ok) {
            alert('Demande rejetée !');
            groupRequests.splice(index, 1); // retire la demande
            renderRequests();   
        } else {
            alert('Erreur rejet demande');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression de la demande:', error);
    }
    



}

document.getElementById('requestGroupForm').onsubmit = async function(e) {
    e.preventDefault();
    const groupName = document.getElementById('requestGroupName').value;
    const response = await fetch(`${SERVER_URL}/group/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({groupName,  userId: localStorage.getItem('userId') })
    });
    if (response.ok) {
        alert('Demande envoyée à l\'admin !');
        document.getElementById('requestGroupName').value = '';
    } else {
        alert('Erreur demande admin');
    }
};

// Récupérer les groupes dont je fais partie
async function fetchMyGroups() {
    const userId = localStorage.getItem('userId');
    const res = await fetch(`${SERVER_URL}/groups/member/${userId}`);
    const groups = await res.json();
    const myGroups = document.getElementById('myGroups');
    myGroups.innerHTML = '';
    groups.forEach(group => {
        const li = document.createElement('li');
        li.textContent = group.name;
        li.onclick = () => selectGroup(group);
        myGroups.appendChild(li);
    });
}

// Sélectionner un groupe pour s'y connecter ou demander à l'admin
function selectGroup(group) {
    document.getElementById('groupActions').style.display = 'block';

    // Quand on clique sur "Se connecter au groupe"
    document.getElementById('connectGroupBtn').onclick = () => {
        // Sauvegarde le groupe sélectionné dans localStorage
        localStorage.setItem('selectedGroupId', group.id);
        localStorage.setItem('selectedGroupName', group.name);

        // Redirection vers la page de chat
        window.location.href = 'chat.html';
        
    };
}


// Initialisation
fetchAdminGroups();
fetchMyGroups();

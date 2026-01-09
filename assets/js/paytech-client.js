// Configuration
const API_URL = 'https://api.pedaclic.sn';

/**
 * Initialiser un paiement PayTech
 * @param {string} plan - 'mensuel' ou 'annuel'
 */
async function initPayment(plan) {
    try {
        // Obtenir les infos utilisateur
        const userId = getCurrentUserId();
        const userEmail = await getUserEmail();
        const userName = getUserName();
        
        if (!userEmail) {
            showError('Veuillez entrer votre adresse email pour continuer.');
            return;
        }
        
        // Afficher un message de chargement
        showLoading('Préparation du paiement...');
        
        // Appeler l'API backend pour initier le paiement
        const response = await fetch(`${API_URL}/api/payment/initiate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                plan: plan,
                userId: userId || 'guest_' + Date.now(),
                userEmail: userEmail,
                userName: userName || 'Étudiant Pedaclic'
            })
        });
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.success && data.paymentUrl) {
            // Rediriger vers la page de paiement PayTech
            window.location.href = data.paymentUrl;
        } else {
            showError('Erreur lors de l\'initialisation du paiement. Veuillez réessayer.');
            console.error('Erreur PayTech:', data);
        }
        
    } catch (error) {
        hideLoading();
        showError('Une erreur est survenue. Veuillez vérifier votre connexion internet.');
        console.error('Erreur:', error);
    }
}

/**
 * Obtenir l'email de l'utilisateur
 */
async function getUserEmail() {
    // Si Firebase Auth est disponible et utilisateur connecté
    if (typeof firebase !== 'undefined' && firebase.auth) {
        const user = firebase.auth().currentUser;
        if (user && user.email) {
            return user.email;
        }
    }
    
    // Sinon, chercher dans localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            if (user.email) {
                return user.email;
            }
        } catch (e) {
            console.error('Erreur lecture user:', e);
        }
    }
    
    // Si pas d'email, demander à l'utilisateur
    const email = prompt('📧 Entrez votre adresse email pour continuer le paiement :');
    
    if (email && email.includes('@')) {
        // Sauvegarder dans localStorage pour la prochaine fois
        localStorage.setItem('pedaclic_user_email', email);
        return email;
    }
    
    return null;
}

/**
 * Obtenir le nom de l'utilisateur
 */
function getUserName() {
    // Si Firebase Auth est disponible
    if (typeof firebase !== 'undefined' && firebase.auth) {
        const user = firebase.auth().currentUser;
        if (user && user.displayName) {
            return user.displayName;
        }
    }
    
    // Sinon, chercher dans localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            return user.name || user.displayName || user.userName;
        } catch (e) {
            console.error('Erreur lecture user:', e);
        }
    }
    
    // Email sauvegardé ?
    const savedEmail = localStorage.getItem('pedaclic_user_email');
    if (savedEmail) {
        return savedEmail.split('@')[0]; // Utiliser la partie avant @ comme nom
    }
    
    return 'Étudiant Pedaclic';
}

/**
 * Obtenir l'ID de l'utilisateur connecté
 */
function getCurrentUserId() {
    // Si Firebase Auth est disponible
    if (typeof firebase !== 'undefined' && firebase.auth) {
        const user = firebase.auth().currentUser;
        if (user) {
            return user.uid;
        }
    }
    
    // Sinon, chercher dans localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            return user.uid || user.id;
        } catch (e) {
            console.error('Erreur lecture user:', e);
        }
    }
    
    // Créer un ID temporaire basé sur l'email
    const savedEmail = localStorage.getItem('pedaclic_user_email');
    if (savedEmail) {
        return 'email_' + btoa(savedEmail).substring(0, 16);
    }
    
    return 'guest_' + Date.now();
}

/**
 * Afficher un message de chargement
 */
function showLoading(message) {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'payment-loading';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-size: 20px;
        flex-direction: column;
        gap: 20px;
    `;
    
    loadingDiv.innerHTML = `
        <div style="width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <div>${message}</div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
    
    document.body.appendChild(loadingDiv);
}

/**
 * Masquer le message de chargement
 */
function hideLoading() {
    const loadingDiv = document.getElementById('payment-loading');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

/**
 * Afficher un message d'erreur
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #EF4444;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        font-size: 16px;
    `;
    
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

/**
 * Afficher un message de succès
 */
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10B981;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        font-size: 16px;
    `;
    
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
        successDiv.remove();
    }, 5000);
}

// Vérifier le statut du paiement au retour
if (window.location.search.includes('payment=success')) {
    showSuccess('🎉 Paiement réussi ! Votre compte Premium est maintenant actif.');
} else if (window.location.search.includes('payment=cancel')) {
    showError('❌ Paiement annulé. Vous pouvez réessayer quand vous voulez.');
}

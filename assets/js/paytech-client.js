// ========================================
// CLIENT PAYTECH - Frontend
// ========================================

class PaytechClient {
    constructor(apiUrl = 'http://localhost:3000/api') {
        this.apiUrl = apiUrl;
    }
    
    // ========================================
    // INITIER UN PAIEMENT
    // ========================================
    async initiatePayment(plan, userId, userEmail, userName) {
        try {
            showToast('Initialisation du paiement...', 'info');
            
            const response = await fetch(`${this.apiUrl}/payment/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan,
                    userId,
                    userEmail,
                    userName
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de l\'initialisation');
            }
            
            // Rediriger vers PayTech
            if (data.paymentUrl) {
                showToast('Redirection vers PayTech...', 'success');
                
                // Sauvegarder la référence en localStorage
                localStorage.setItem('pedaclic_payment_ref', data.ref);
                
                // Redirection après 1 seconde
                setTimeout(() => {
                    window.location.href = data.paymentUrl;
                }, 1000);
            }
            
            return data;
            
        } catch (error) {
            console.error('Erreur paiement:', error);
            showToast(`Erreur: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // ========================================
    // VÉRIFIER LE STATUT D'UNE TRANSACTION
    // ========================================
    async checkPaymentStatus(ref) {
        try {
            const response = await fetch(`${this.apiUrl}/payment/status/${ref}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la vérification');
            }
            
            return data.transaction;
            
        } catch (error) {
            console.error('Erreur vérification:', error);
            throw error;
        }
    }
    
    // ========================================
    // VÉRIFIER L'ABONNEMENT D'UN UTILISATEUR
    // ========================================
    async checkSubscription(userId) {
        try {
            const response = await fetch(`${this.apiUrl}/subscription/${userId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la vérification');
            }
            
            return {
                isPremium: data.isPremium,
                subscription: data.subscription
            };
            
        } catch (error) {
            console.error('Erreur abonnement:', error);
            return { isPremium: false, subscription: null };
        }
    }
}

// ========================================
// INTÉGRATION AVEC premium.html
// ========================================

// Initialiser le client
const paytechClient = new PaytechClient('https://votre-domaine.com/api');

// Fonction de souscription (à utiliser dans premium.html)
async function subscribe(plan) {
    try {
        // Vérifier si l'utilisateur est connecté
        const user = firebase.auth().currentUser;
        
        if (!user) {
            showToast('Vous devez être connecté pour souscrire', 'warning');
            window.location.href = 'login.html?redirect=premium.html';
            return;
        }
        
        // Confirmer avant paiement
        const planDetails = {
            monthly: { name: 'Mensuel', price: '2,000 FCFA/mois' },
            annual: { name: 'Annuel', price: '20,000 FCFA/an' }
        };
        
        const confirmed = confirm(
            `Confirmer l'abonnement ${planDetails[plan].name} pour ${planDetails[plan].price} ?`
        );
        
        if (!confirmed) {
            return;
        }
        
        // Initier le paiement
        await paytechClient.initiatePayment(
            plan,
            user.uid,
            user.email,
            user.displayName || user.email
        );
        
    } catch (error) {
        console.error('Erreur souscription:', error);
        showToast('Erreur lors de la souscription', 'error');
    }
}

// ========================================
// VÉRIFIER LE STATUT PREMIUM
// ========================================

async function checkPremiumStatus() {
    try {
        const user = firebase.auth().currentUser;
        
        if (!user) {
            return { isPremium: false };
        }
        
        const status = await paytechClient.checkSubscription(user.uid);
        
        // Mettre à jour l'UI
        updatePremiumUI(status);
        
        return status;
        
    } catch (error) {
        console.error('Erreur vérification Premium:', error);
        return { isPremium: false };
    }
}

// ========================================
// METTRE À JOUR L'UI SELON LE STATUT
// ========================================

function updatePremiumUI(status) {
    const body = document.body;
    
    if (status.isPremium) {
        // Ajouter classe premium au body
        body.classList.add('premium-user');
        
        // Afficher badge Premium dans le header
        const header = document.querySelector('.header');
        if (header && !document.querySelector('.premium-badge-header')) {
            const badge = document.createElement('div');
            badge.className = 'premium-badge-header';
            badge.innerHTML = '👑 Premium';
            badge.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: linear-gradient(135deg, #fbbf24, #f59e0b);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                font-size: 14px;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(251, 191, 36, 0.4);
            `;
            document.body.appendChild(badge);
        }
        
        // Afficher info d'abonnement
        if (status.subscription) {
            console.log(`Premium actif - Expire dans ${status.subscription.daysRemaining} jours`);
        }
        
    } else {
        body.classList.remove('premium-user');
        
        // Retirer le badge
        const badge = document.querySelector('.premium-badge-header');
        if (badge) {
            badge.remove();
        }
    }
}

// ========================================
// BLOQUER CONTENU PREMIUM
// ========================================

function restrictPremiumContent() {
    // Vérifier tous les éléments marqués comme premium
    const premiumElements = document.querySelectorAll('[data-premium="true"]');
    
    premiumElements.forEach(element => {
        if (!document.body.classList.contains('premium-user')) {
            // Ajouter overlay de verrouillage
            const overlay = document.createElement('div');
            overlay.className = 'premium-lock-overlay';
            overlay.innerHTML = `
                <div class="premium-lock-content">
                    <div class="lock-icon">🔒</div>
                    <h3>Contenu Premium</h3>
                    <p>Abonnez-vous pour accéder à ce contenu</p>
                    <button onclick="window.location.href='premium.html'" class="btn-primary">
                        Voir Premium
                    </button>
                </div>
            `;
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
                border-radius: inherit;
            `;
            
            element.style.position = 'relative';
            element.appendChild(overlay);
            
            // Rendre le contenu flou
            Array.from(element.children).forEach(child => {
                if (!child.classList.contains('premium-lock-overlay')) {
                    child.style.filter = 'blur(8px)';
                }
            });
        }
    });
}

// ========================================
// INITIALISATION AU CHARGEMENT
// ========================================

window.addEventListener('DOMContentLoaded', async () => {
    // Attendre que Firebase soit initialisé
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // Vérifier le statut Premium
            await checkPremiumStatus();
            
            // Appliquer les restrictions
            restrictPremiumContent();
        }
    });
});

// Exposer les fonctions globalement
window.subscribe = subscribe;
window.checkPremiumStatus = checkPremiumStatus;
window.paytechClient = paytechClient;

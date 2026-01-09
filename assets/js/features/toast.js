/* ========================================
   NOTIFICATIONS TOAST
   ======================================== */

// Configuration
const toastConfig = {
    duration: 3000,
    position: 'top-right', // top-right, top-left, bottom-right, bottom-left
    maxToasts: 3
};

// File d'attente
let toastQueue = [];
let toastContainer = null;

// ========================================
// INITIALISATION
// ========================================
function initToast() {
    createToastContainer();
}

// ========================================
// CRÉER LE CONTENEUR
// ========================================
function createToastContainer() {
    if (toastContainer) return;
    
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = `toast-container toast-${toastConfig.position}`;
    document.body.appendChild(toastContainer);
}

// ========================================
// AFFICHER UN TOAST
// ========================================
function showToast(message, type = 'info', duration = toastConfig.duration) {
    createToastContainer();
    
    // Limiter le nombre de toasts
    if (toastQueue.length >= toastConfig.maxToasts) {
        removeToast(toastQueue[0]);
    }
    
    // Créer le toast
    const toast = createToastElement(message, type);
    toastContainer.appendChild(toast);
    toastQueue.push(toast);
    
    // Animation d'entrée
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto-suppression
    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }
    
    return toast;
}

// ========================================
// CRÉER L'ÉLÉMENT TOAST
// ========================================
function createToastElement(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = getToastIcon(type);
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="removeToastById(this)">✕</button>
    `;
    
    return toast;
}

// ========================================
// SUPPRIMER UN TOAST
// ========================================
function removeToast(toast) {
    if (!toast || !toast.parentElement) return;
    
    toast.classList.add('hide');
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
        toastQueue = toastQueue.filter(t => t !== toast);
    }, 300);
}

// Helper pour suppression depuis le DOM
function removeToastById(button) {
    const toast = button.closest('.toast');
    removeToast(toast);
}

// ========================================
// ICÔNES PAR TYPE
// ========================================
function getToastIcon(type) {
    const icons = {
        'success': '✓',
        'error': '✕',
        'warning': '⚠',
        'info': 'ℹ'
    };
    return icons[type] || icons.info;
}

// ========================================
// RACCOURCIS POUR TYPES COURANTS
// ========================================
function toastSuccess(message, duration) {
    return showToast(message, 'success', duration);
}

function toastError(message, duration) {
    return showToast(message, 'error', duration);
}

function toastWarning(message, duration) {
    return showToast(message, 'warning', duration);
}

function toastInfo(message, duration) {
    return showToast(message, 'info', duration);
}

// ========================================
// INITIALISER
// ========================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToast);
} else {
    initToast();
}

// Exposer les fonctions globalement
window.showToast = showToast;
window.toastSuccess = toastSuccess;
window.toastError = toastError;
window.toastWarning = toastWarning;
window.toastInfo = toastInfo;
window.removeToastById = removeToastById;

// ============================================================
// PedaClic — Phase 46 : messages d'erreur Firestore lisibles
// ------------------------------------------------------------
// Traduit le code technique d'une erreur Firebase en message
// clair, au lieu d'un « Vérifiez votre connexion » générique.
// L'erreur brute reste visible dans la console (débogage).
// ============================================================

export function messageErreurFirestore(err: unknown, action = 'Enregistrement'): string {
  console.error(`[PedaClic] ${action} :`, err);
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'permission-denied':
      return `${action} refusé par Firestore (permission). Les règles de sécurité à jour ne sont peut-être pas encore publiées : npm run deploy:rules.`;
    case 'unauthenticated':
      return 'Session expirée : reconnectez-vous puis réessayez.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'Serveur injoignable pour le moment. Vérifiez votre connexion puis réessayez.';
    case 'failed-precondition':
      return `${action} impossible : un index Firestore est manquant ou en cours de création.`;
    case 'not-found':
      return 'Élément introuvable : il a peut-être été supprimé.';
    case 'invalid-argument':
      return `${action} impossible : une donnée saisie est invalide.`;
    default:
      return `${action} impossible${code ? ` (${code})` : ''}.`;
  }
}

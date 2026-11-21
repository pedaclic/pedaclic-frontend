// ============================================================
// PedaClic — Phase 58 : lien direct vers une séance
// ------------------------------------------------------------
// Logique PURE (aucun appel Firestore).
//   • Format unique pour tous les rôles : /seance/<entreeId>
//     → SeanceLienPage redirige ensuite vers la vue prof ou élève.
//   • Le paramètre « ?seance=<id> » est lu par CahierDetailPage
//     et ElveCahierPage pour défiler vers la séance ciblée.
// ============================================================

/** Nom du paramètre d'URL portant la séance ciblée */
export const PARAM_SEANCE = 'seance';

/** Chemin interne (routeur) vers la séance */
export const cheminSeance = (entreeId: string): string => `/seance/${entreeId}`;

/** Lien absolu à partager (fonctionne en local comme en production) */
export const construireLienSeance = (entreeId: string): string =>
  `${window.location.origin}${cheminSeance(entreeId)}`;

/**
 * Copie le lien de la séance dans le presse-papiers.
 * Repli : fenêtre de saisie sélectionnable si l'API Clipboard
 * est indisponible (HTTP non sécurisé, ancien navigateur…).
 * @returns true si la copie automatique a réussi
 */
export async function copierLienSeance(entreeId: string): Promise<boolean> {
  const url = construireLienSeance(entreeId);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    window.prompt('Copiez ce lien :', url);
    return false;
  }
}

/** Lien WhatsApp pré-rempli (le destinataire est choisi dans WhatsApp) */
export const lienWhatsAppSeance = (entreeId: string, titre?: string): string => {
  const texte = `${titre ? `${titre} — ` : ''}${construireLienSeance(entreeId)}`;
  return `https://wa.me/?text=${encodeURIComponent(texte)}`;
};

/**
 * Fait défiler la page vers la carte d'une séance et la met en
 * surbrillance 3 s (classe CSS `entree-focus`, déjà définie en Phase 40).
 * Les deux requestAnimationFrame garantissent que React a rendu la liste.
 * @returns false si la carte n'est pas (encore) dans la page
 */
export function defilerVersSeance(entreeId: string): boolean {
  const el = document.querySelector<HTMLElement>(`[data-entree-id="${entreeId}"]`);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('entree-focus');
  window.setTimeout(() => el.classList.remove('entree-focus'), 3000);
  return true;
}

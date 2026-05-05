/**
 * ============================================================================
 * useRoutePersistence — Persistance et restauration du chemin courant
 * ============================================================================
 * PHASE 40 — « Rester sur la même page lors d'une actualisation »
 *
 * En théorie, une SPA déployée avec un fallback `index.html` correct
 * (configuré dans `firebase.json` via `"rewrites"`) restaure d'elle-même
 * la route courante après un F5. Toutefois, plusieurs scénarios peuvent
 * casser ce contrat :
 *
 *   • un Service Worker précédent qui sert un `index.html` obsolète ;
 *   • un onglet ouvert avant un `purge cache` qui force une route 404 ;
 *   • un lien partagé vers une route Premium pour un utilisateur non
 *     authentifié, que le composant cible redirige vers la home ;
 *   • la route catch-all `<Route path="*" />` qui renvoie à `/`.
 *
 * Ce hook agit comme une SAUVEGARDE :
 *   1. Sur CHAQUE changement de route, il enregistre `pathname + search`
 *      dans `sessionStorage` (clé : `pedaclic.lastRoute`).
 *   2. Au PREMIER montage, si l'utilisateur arrive sur `/` ET que la
 *      navigation est de type `reload` (c.-à-d. un F5) ET qu'une route
 *      différente est en mémoire, on restaure cette dernière.
 *
 * Il est volontairement passif :
 *   • aucune redirection si l'utilisateur clique sur un lien interne
 *     vers la home (la nav est de type `navigate`, pas `reload`) ;
 *   • aucune redirection si la dernière route mémorisée est `/`
 *     (rien à restaurer) ;
 *   • la mémoire est limitée à la SESSION onglet (`sessionStorage`),
 *     donc fermer l'onglet repart proprement de la home.
 *
 * Auteur : PedaClic — Refactor UX avril 2026
 * ============================================================================
 */

import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Clé `sessionStorage` partagée entre persistance et restauration. */
const SS_LAST_ROUTE_KEY = 'pedaclic.lastRoute';

/**
 * Détecte si la navigation courante est un rechargement (F5 / Cmd+R)
 * plutôt qu'une navigation interne (lien, history.push…). Utilise
 * l'API Performance moderne avec un repli sur l'ancienne API.
 */
function estUnRechargement(): boolean {
  try {
    const entries = performance.getEntriesByType('navigation');
    if (entries.length > 0) {
      const nav = entries[0] as PerformanceNavigationTiming;
      return nav.type === 'reload';
    }
    // Fallback (anciens navigateurs)
    // 1 === TYPE_RELOAD (deprecated mais toujours supporté)
    return performance.navigation?.type === 1;
  } catch {
    return false;
  }
}

/**
 * Hook unique à brancher en haut de l'arbre, juste APRÈS BrowserRouter.
 * Doit être appelé dans un composant rendu à l'intérieur de `<Routes>` ou
 * de tout enfant ayant accès au Router (ce qui est le cas dans App.tsx).
 */
export function useRoutePersistence(): void {
  const location = useLocation();
  const navigate = useNavigate();
  /** Empêche la restauration de s'exécuter plus d'une fois par session. */
  const restaureFait = useRef(false);

  /* ------------------------------------------------------------------ */
  /* 1) RESTAURATION (au tout premier rendu)                            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (restaureFait.current) return;
    restaureFait.current = true;

    // On ne tente la restauration QUE si :
    //   • on est arrivé sur la home («/») ;
    //   • il s'agit d'un rechargement de page ;
    //   • une route différente est mémorisée.
    if (location.pathname !== '/') return;
    if (!estUnRechargement()) return;

    const saved = (() => {
      try {
        return sessionStorage.getItem(SS_LAST_ROUTE_KEY);
      } catch {
        return null;
      }
    })();

    if (!saved || saved === '/') return;

    // Sécurité : on accepte uniquement une URL relative qui commence par "/"
    // (jamais "//", jamais "http", pour parer un éventuel détournement).
    if (!saved.startsWith('/') || saved.startsWith('//')) return;

    // `replace: true` → on ne pollue pas l'historique avec l'étape "/"
    navigate(saved, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------ */
  /* 2) PERSISTANCE (à chaque changement de route)                      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    try {
      const value = `${location.pathname}${location.search}`;
      sessionStorage.setItem(SS_LAST_ROUTE_KEY, value);
    } catch {
      // sessionStorage indisponible (navigation privée stricte) → silencieux
    }
  }, [location.pathname, location.search]);
}

/**
 * Composant utilitaire — wrapper "sans markup" qui appelle le hook.
 *   Pratique à monter directement dans `App.tsx` sans transformer
 *   l'ensemble du composant en hooks-aware.
 */
export const RoutePersistence: React.FC = () => {
  useRoutePersistence();
  return null;
};

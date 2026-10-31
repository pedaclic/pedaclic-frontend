// ============================================================
// PedaClic — Phase 41 : useDragReorder
// ------------------------------------------------------------
// Hook générique de réordonnancement par glisser-déposer.
//
// Pourquoi un hook maison plutôt qu'une librairie ?
//   • Aucune dépendance supplémentaire (bundle PWA inchangé).
//   • Basé sur les Pointer Events : fonctionne À L'IDENTIQUE à la
//     souris, au doigt (tablette / smartphone) et au stylet — là où
//     l'API HTML5 « draggable » est peu fiable sur mobile.
//   • Accessible au clavier : poignée focusable + flèches ↑ / ↓.
//
// Principe :
//   1. Chaque élément déplaçable porte un attribut DOM
//      `data-<attr>="<id>"` (ex. data-reorder-rubrique="abc").
//   2. La poignée reçoit les props renvoyées par getHandleProps(id).
//   3. Pendant le glissement, on repère l'élément survolé avec
//      document.elementFromPoint() → overId.
//   4. Au relâchement, onDrop(fromId, toId) est appelé : c'est au
//      composant de calculer la nouvelle liste et de la persister.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

export interface UseDragReorderOptions {
  /** Nom de l'attribut data-* qui identifie les éléments cibles
   *  (sans le préfixe « data- »). Ex : 'reorder-rubrique'. */
  attr: string;
  /** Appelé au relâchement quand la cible diffère de la source. */
  onDrop: (fromId: string, toId: string) => void;
  /** Appelé quand l'utilisateur presse ↑ (-1) ou ↓ (+1) sur la poignée. */
  onKeyMove?: (id: string, delta: -1 | 1) => void;
  /** Filtre optionnel : autorise-t-on de déposer `from` sur `to` ?
   *  (ex. : un titre ne peut pas changer de rubrique). */
  accept?: (fromId: string, toId: string) => boolean;
  /** Désactive temporairement le glisser-déposer. */
  disabled?: boolean;
}

/** Marge (px) près des bords de la fenêtre déclenchant le défilement auto. */
const ZONE_AUTOSCROLL = 70;
/** Vitesse du défilement auto (px par mouvement de pointeur). */
const PAS_AUTOSCROLL = 14;

export function useDragReorder({
  attr,
  onDrop,
  onKeyMove,
  accept,
  disabled = false,
}: UseDragReorderOptions) {
  // id de l'élément en cours de déplacement (null = aucun)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // id de l'élément actuellement survolé (cible potentielle)
  const [overId, setOverId] = useState<string | null>(null);

  // Refs miroirs : lues dans les handlers sans dépendre d'un re-rendu
  const draggingRef = useRef<string | null>(null);
  const overRef = useRef<string | null>(null);

  /** Réinitialise l'état et retire la classe globale du <body>. */
  const reset = useCallback(() => {
    draggingRef.current = null;
    overRef.current = null;
    setDraggingId(null);
    setOverId(null);
    document.body.classList.remove('pc-drag-en-cours');
  }, []);

  // Sécurité : si le composant est démonté en plein glissement,
  // on nettoie la classe posée sur le <body>.
  useEffect(() => () => document.body.classList.remove('pc-drag-en-cours'), []);

  const getHandleProps = useCallback(
    (id: string) => ({
      // ── Début du glissement ───────────────────────────────
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (disabled) return;
        // Uniquement bouton principal de la souris (ou doigt / stylet)
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        // Capture : tous les événements suivants arrivent sur la poignée,
        // même si le pointeur sort de la ligne.
        e.currentTarget.setPointerCapture(e.pointerId);
        draggingRef.current = id;
        overRef.current = id;
        setDraggingId(id);
        setOverId(id);
        document.body.classList.add('pc-drag-en-cours');
      },

      // ── Déplacement : repérer la ligne survolée ───────────
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const from = draggingRef.current;
        if (!from) return;

        // Défilement automatique près des bords (listes longues, mobile)
        if (e.clientY < ZONE_AUTOSCROLL) window.scrollBy(0, -PAS_AUTOSCROLL);
        else if (e.clientY > window.innerHeight - ZONE_AUTOSCROLL) window.scrollBy(0, PAS_AUTOSCROLL);

        const el = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>(`[data-${attr}]`);
        const to = el?.getAttribute(`data-${attr}`) ?? null;
        if (!to) return;
        if (accept && !accept(from, to)) return;
        if (to !== overRef.current) {
          overRef.current = to;
          setOverId(to);
        }
      },

      // ── Relâchement : valider le déplacement ──────────────
      onPointerUp: () => {
        const from = draggingRef.current;
        const to = overRef.current;
        reset();
        if (from && to && from !== to && (!accept || accept(from, to))) {
          onDrop(from, to);
        }
      },

      // ── Annulation (appel entrant, perte de focus…) ───────
      onPointerCancel: () => reset(),

      // ── Accessibilité clavier : flèches ↑ / ↓ ─────────────
      onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
        if (disabled || !onKeyMove) return;
        if (e.key === 'ArrowUp') { e.preventDefault(); onKeyMove(id, -1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); onKeyMove(id, 1); }
        else if (e.key === 'Escape') reset();
      },
    }),
    [attr, accept, disabled, onDrop, onKeyMove, reset]
  );

  return { draggingId, overId, getHandleProps };
}

/**
 * Utilitaire pur : déplace l'élément d'index `from` vers l'index `to`
 * et renvoie une NOUVELLE liste (immutabilité React).
 */
export function deplacerElement<T>(liste: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= liste.length || to >= liste.length) {
    return liste;
  }
  const copie = [...liste];
  const [element] = copie.splice(from, 1);
  copie.splice(to, 0, element);
  return copie;
}

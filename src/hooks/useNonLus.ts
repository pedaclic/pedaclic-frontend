// ============================================================
// PedaClic — Phase 54 : useNonLus
// Gère les messages « non lus » d'un onglet de l'espace classe.
//   • nonLus        : nombre de messages d'autrui publiés depuis la
//                     dernière consultation (pastille de l'onglet) ;
//   • nouveauxDepuis: date figée à l'ouverture de l'onglet, pour
//                     signaler « Nouveau » sur les messages concernés.
// La date de consultation est mémorisée dans le navigateur
// (localStorage) : simple confort par appareil, aucune écriture Firestore.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import type { MessageClasse } from '../types/communication.types';
import { derniereVisite, marquerVu } from '../services/communicationService';

export function useNonLus(
  uid: string | undefined,
  groupeId: string | undefined,
  cle: string,                 // 'annonce' | 'forum' | 'prive'
  messages: MessageClasse[],
  actif: boolean               // l'onglet est-il affiché ?
) {
  const [tick, setTick] = useState(0);               // force le recalcul après marquerVu
  const [nouveauxDepuis, setNouveauxDepuis] = useState(0);

  // Ouverture de l'onglet (ou changement de groupe) : on fige la date
  // de dernière visite AVANT de la mettre à jour.
  useEffect(() => {
    if (!actif || !uid || !groupeId) return;
    setNouveauxDepuis(derniereVisite(uid, groupeId, cle));
    marquerVu(uid, groupeId, cle);
    setTick(t => t + 1);
  }, [actif, uid, groupeId, cle]);

  // Onglet affiché : les messages qui arrivent sont lus immédiatement
  useEffect(() => {
    if (!actif || !uid || !groupeId || messages.length === 0) return;
    marquerVu(uid, groupeId, cle);
    setTick(t => t + 1);
  }, [messages.length, actif, uid, groupeId, cle]);

  const nonLus = useMemo(() => {
    if (!uid || !groupeId || actif) return 0;
    const depuis = derniereVisite(uid, groupeId, cle);
    return messages.filter(m => m.auteurId !== uid && (m.createdAt?.toMillis?.() ?? 0) > depuis).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, uid, groupeId, cle, actif, tick]);

  return { nonLus, nouveauxDepuis };
}

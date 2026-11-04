// ============================================================
// PedaClic — Phase 46 : Hook useEtablissements
// ------------------------------------------------------------
// Abonnement temps réel au carnet d'établissements du professeur.
//
// Usage :
//   const { etablissements, actifs, parId, charge } = useEtablissements(uid);
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { subscribeEtablissements } from '../services/etablissementsService';
import type { EtablissementProf } from '../types/etablissement.types';

export interface UseEtablissements {
  /** Tous les établissements (actifs puis archivés) */
  etablissements: EtablissementProf[];
  /** Établissements actifs seulement (choix du formulaire) */
  actifs: EtablissementProf[];
  /** Accès direct par ID */
  parId: Map<string, EtablissementProf>;
  /** true dès la première réponse Firestore */
  charge: boolean;
}

export function useEtablissements(profId: string | undefined): UseEtablissements {
  const [etablissements, setEtablissements] = useState<EtablissementProf[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    if (!profId) return;
    const unsubscribe = subscribeEtablissements(
      profId,
      (liste) => { setEtablissements(liste); setCharge(true); },
      (err) => { console.error('Erreur chargement établissements :', err); setCharge(true); }
    );
    return () => unsubscribe();
  }, [profId]);

  return useMemo(() => ({
    etablissements,
    actifs: etablissements.filter(e => !e.isArchived),
    parId: new Map(etablissements.map(e => [e.id, e])),
    charge,
  }), [etablissements, charge]);
}

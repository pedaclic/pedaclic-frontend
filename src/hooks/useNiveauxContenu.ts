// ============================================================
// PedaClic — Phase 44 : Hook useNiveauxContenu
// Charge le contenu éditorial des niveaux (settings/niveaux).
// Renvoie IMMÉDIATEMENT les valeurs par défaut (aucun « saut »
// d'affichage sur l'accueil), puis les remplace par la version
// Firestore dès qu'elle est disponible.
// ============================================================

import { useEffect, useState } from 'react';
import { getNiveauxContenu } from '../services/niveauxService';
import { NIVEAUX_CONTENU_DEFAUT, type NiveauxContenuMap } from '../types/niveauxContenu.types';

export function useNiveauxContenu(): { contenu: NiveauxContenuMap; charge: boolean } {
  const [contenu, setContenu] = useState<NiveauxContenuMap>(NIVEAUX_CONTENU_DEFAUT);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let annule = false; // évite un setState après démontage
    getNiveauxContenu().then((c) => {
      if (!annule) {
        setContenu(c);
        setCharge(true);
      }
    });
    return () => { annule = true; };
  }, []);

  return { contenu, charge };
}

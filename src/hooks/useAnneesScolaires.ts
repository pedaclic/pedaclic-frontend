// ============================================================
// PedaClic — Phase 45 : Hook useAnneesScolaires
// ------------------------------------------------------------
// Renvoie IMMÉDIATEMENT une configuration calculée localement
// (année en cours correcte dès le premier rendu, sans « saut »),
// puis la remplace par la version Firestore (temps réel).
//
// Usage :
//   const { anneeCourante, annees, charge } = useAnneesScolaires();
//   <select>{annees.map(a => <option key={a}>{a}</option>)}</select>
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { subscribeAnneesScolairesConfig } from '../services/anneesScolairesService';
import {
  anneesPourSelect,
  configParDefaut,
  resoudreAnneeCourante,
  type AnneesScolairesConfig,
} from '../types/anneesScolaires.types';

export interface UseAnneesScolaires {
  /** Configuration complète (normalisée) */
  config: AnneesScolairesConfig;
  /** Année scolaire en cours (auto ou imposée par l'admin) */
  anneeCourante: string;
  /** Années actives + année en cours, triées chronologiquement */
  annees: string[];
  /** true dès que la configuration Firestore a été reçue */
  charge: boolean;
}

export function useAnneesScolaires(): UseAnneesScolaires {
  const [config, setConfig] = useState<AnneesScolairesConfig>(() => configParDefaut());
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeAnneesScolairesConfig((c) => {
      setConfig(c);
      setCharge(true);
    });
    return () => unsubscribe();
  }, []);

  // Valeurs dérivées mémoïsées (évite des re-rendus inutiles des <select>)
  return useMemo(() => {
    const anneeCourante = resoudreAnneeCourante(config);
    return { config, anneeCourante, annees: anneesPourSelect(config, anneeCourante), charge };
  }, [config, charge]);
}

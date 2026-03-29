// ============================================================
// PedaClic — Hook useDisciplinesOptions
// Charge les matières et niveaux DYNAMIQUEMENT depuis Firestore
// collection "disciplines" (gérée par l'admin).
//
// Remplace les listes statiques MATIERES_SENEGAL & NIVEAUX_SCOLAIRES
// pour garantir la cohérence entre l'admin et les formulaires profs.
//
// Usage :
//   const { matieres, niveaux, loading, error } = useDisciplinesOptions();
// ============================================================

import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';   // Ajustez le chemin si nécessaire

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

/** Option générique pour les selects (valeur + label) */
export interface SelectOption {
  valeur: string;
  label:  string;
}

/** État retourné par le hook */
export interface DisciplinesOptionsState {
  /** Liste dédupliquée et triée des matières (nom) */
  matieres: SelectOption[];
  /** Liste dédupliquée et triée des niveaux/classes */
  niveaux: SelectOption[];
  /** Vrai pendant le chargement Firestore */
  loading: boolean;
  /** Message d'erreur éventuel (null si aucun problème) */
  error: string | null;
}

// ------------------------------------------------------------
// ORDRE CANONIQUE DES NIVEAUX SCOLAIRES SÉNÉGALAIS
// Utilisé pour trier les niveaux dans un ordre logique,
// quel que soit l'ordre de stockage en Firestore.
// ------------------------------------------------------------
const ORDRE_NIVEAUX: Record<string, number> = {
  'ps':        1,
  'ms':        2,
  'gs':        3,
  'ci':        4,
  'cp':        5,
  'ce1':       6,
  'ce2':       7,
  'cm1':       8,
  'cm2':       9,
  '6eme':      10,
  '6ème':      10,
  '5eme':      11,
  '5ème':      11,
  '4eme':      12,
  '4ème':      12,
  '3eme':      13,
  '3ème':      13,
  '2nde':      14,
  'seconde':   14,
  '1ere':      15,
  '1ère':      15,
  'terminale': 16,
  'debutant':  17,
  'intermediaire': 18,
  'avance':    19,
};

/** Retourne l'ordre d'un niveau (ordre alphabétique si inconnu) */
function getOrdreNiveau(niveau: string): number {
  const cle = niveau.toLowerCase().trim();
  return ORDRE_NIVEAUX[cle] ?? 99;
}

// ------------------------------------------------------------
// HOOK PRINCIPAL
// ------------------------------------------------------------

/**
 * Charge dynamiquement les matières et niveaux depuis
 * la collection Firestore "disciplines".
 *
 * - Les matières sont dédupliquées (plusieurs docs peuvent
 *   avoir la même matière pour des niveaux différents).
 * - Les niveaux sont triés dans l'ordre scolaire sénégalais.
 * - En cas d'erreur Firestore, les listes sont vides et
 *   `error` contient le message.
 */
export function useDisciplinesOptions(): DisciplinesOptionsState {
  const [matieres, setMatieres] = useState<SelectOption[]>([]);
  const [niveaux,  setNiveaux]  = useState<SelectOption[]>([]);
  const [loading,  setLoading]  = useState<boolean>(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false; // Évite les mises à jour sur composant démonté

    async function chargerDisciplines() {
      setLoading(true);
      setError(null);

      try {
        // ── Requête Firestore ──────────────────────────────────
        // On ordonne par "ordre" (champ numérique) puis par "nom"
        // pour un affichage cohérent.
        const q = query(
          collection(db, 'disciplines'),
          orderBy('ordre'),
        );
        const snapshot = await getDocs(q);

        if (cancelled) return;

        // ── Extraction brute ───────────────────────────────────
        const matieresSet  = new Set<string>(); // Déduplique les matières
        const niveauxSet   = new Set<string>(); // Déduplique les niveaux

        snapshot.forEach((doc) => {
          const data = doc.data();

          // Champ "nom" = matière (ex: "Mathématiques")
          if (data.nom && typeof data.nom === 'string') {
            matieresSet.add(data.nom.trim());
          }

          // Champ "classe" = niveau (ex: "3eme", "Terminale")
          if (data.classe && typeof data.classe === 'string') {
            niveauxSet.add(data.classe.trim());
          }
        });

        // ── Tri des matières (alphabétique) ───────────────────
        const matieresTriees: SelectOption[] = Array
          .from(matieresSet)
          .sort((a, b) => a.localeCompare(b, 'fr'))
          .map((nom) => ({ valeur: nom, label: nom }));

        // ── Tri des niveaux (ordre scolaire sénégalais) ───────
        const niveauxTries: SelectOption[] = Array
          .from(niveauxSet)
          .sort((a, b) => {
            const ordreA = getOrdreNiveau(a);
            const ordreB = getOrdreNiveau(b);
            if (ordreA !== ordreB) return ordreA - ordreB;
            return a.localeCompare(b, 'fr');
          })
          .map((classe) => ({ valeur: classe, label: classe }));

        setMatieres(matieresTriees);
        setNiveaux(niveauxTries);

      } catch (err) {
        if (!cancelled) {
          console.error('[useDisciplinesOptions] Erreur Firestore :', err);
          setError('Impossible de charger les matières/niveaux.');
          // En cas d'erreur, on laisse les listes vides
          // (le composant peut afficher un message ou un fallback)
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    chargerDisciplines();

    // Nettoyage : évite les setState sur composant démonté
    return () => { cancelled = true; };
  }, []); // Exécuté une seule fois au montage

  return { matieres, niveaux, loading, error };
}

/**
 * ============================================================================
 * PedaClic — Phase 60 : Service de ciblage des quiz (quizCibleService.ts)
 * ============================================================================
 * Fournit la liste des classes / groupes (collection `groupes_prof`) auxquels
 * un quiz peut être LIÉ, selon le rôle de l'utilisateur :
 *   - admin : tous les groupes actifs de la plateforme (tous professeurs) ;
 *   - prof  : uniquement SES groupes actifs (propriétaire = profId).
 *
 * Rappel du modèle (inchangé, déjà exploité côté élève) :
 *   quiz.groupeId absent / null  → quiz global (visible selon Premium)
 *   quiz.groupeId = "<id>"       → réservé aux élèves inscrits à ce groupe
 * (cf. getQuizzesForEleve, getQuizzesAvanceForEleve, quizUnifiedService).
 *
 * Aucune écriture : ce service ne fait que LIRE `groupes_prof`
 * (règle existante : lecture autorisée à tout utilisateur connecté).
 *
 * Placement : src/services/quizCibleService.ts
 * ============================================================================
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/* ──────────────────────────────────────────────
   Type : une cible de quiz (classe / groupe)
   ────────────────────────────────────────────── */
export interface CibleQuiz {
  id: string;            // ID du document groupes_prof
  nom: string;           // Nom du groupe (ex : « 3ème A — Maths »)
  profId: string;        // Propriétaire du groupe
  profNom: string;       // Nom du professeur (affichage admin)
  classeNiveau: string;  // Niveau (ex : « 3eme », « Terminale »)
  matiereNom: string;    // Matière associée au groupe
  anneeScolaire: string; // Année scolaire (ex : « 2025-2026 »)
}

/* ──────────────────────────────────────────────
   Conversion d'un document Firestore → CibleQuiz
   (valeurs par défaut pour les groupes anciens incomplets)
   ────────────────────────────────────────────── */
const versCible = (id: string, d: Record<string, any>): CibleQuiz => ({
  id,
  nom: d.nom || 'Groupe sans nom',
  profId: d.profId || '',
  profNom: d.profNom || '',
  classeNiveau: d.classeNiveau || '',
  matiereNom: d.matiereNom || '',
  anneeScolaire: d.anneeScolaire || '',
});

/** Un groupe est proposable s'il est actif (ou sans statut : groupes historiques). */
const estActif = (d: Record<string, any>): boolean => !d.statut || d.statut === 'actif';

/** Tri alphabétique français (niveau puis nom), insensible aux accents. */
const trierCibles = (a: CibleQuiz, b: CibleQuiz): number =>
  `${a.classeNiveau} ${a.nom}`.localeCompare(`${b.classeNiveau} ${b.nom}`, 'fr', {
    sensitivity: 'base',
    numeric: true,
  });

/**
 * Liste des cibles proposables.
 * @param options.profId  si fourni → groupes de ce professeur uniquement ;
 *                        sinon → tous les groupes (usage ADMIN).
 * @param options.inclureIds  IDs à conserver même s'ils sont archivés
 *                        (ex. groupe déjà lié au quiz en cours d'édition),
 *                        afin de ne jamais « perdre » silencieusement un lien.
 */
export async function getCiblesQuiz(options?: {
  profId?: string;
  inclureIds?: (string | null | undefined)[];
}): Promise<CibleQuiz[]> {
  const ref = collection(db, 'groupes_prof');
  // Requête simple (un seul `where`, sans orderBy) → aucun index composite requis.
  const q = options?.profId ? query(ref, where('profId', '==', options.profId)) : ref;
  const snap = await getDocs(q);

  const aConserver = new Set((options?.inclureIds || []).filter(Boolean) as string[]);

  return snap.docs
    .filter((docSnap) => estActif(docSnap.data()) || aConserver.has(docSnap.id))
    .map((docSnap) => versCible(docSnap.id, docSnap.data()))
    .sort(trierCibles);
}

/**
 * Libellé lisible d'une cible.
 *  - vue prof  : « 3ème A — Maths (3eme) »
 *  - vue admin : « 3ème A — Maths (3eme) · M. Diop »  (le nom du prof lève
 *                l'ambiguïté entre deux groupes homonymes de profs différents)
 */
export function libelleCible(c: CibleQuiz, avecProf = false): string {
  const niveau = c.classeNiveau ? ` (${c.classeNiveau})` : '';
  const prof = avecProf && c.profNom ? ` · ${c.profNom}` : '';
  return `${c.nom}${niveau}${prof}`;
}

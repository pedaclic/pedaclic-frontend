// ============================================================
// PedaClic — Phase 23 : Service — Séquences Pédagogiques
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================
// Gère toutes les opérations Firestore sur la collection
// "sequences_pedagogiques" et l'export vers "entrees_cahier".
// ============================================================

// ✅ Import unique — EntreeCahier seulement (TypeContenu/StatutSeance
//    n'existent pas dans cahierTextes.types → on utilise "as const")
import type { EntreeCahier } from '../types/cahierTextes.types';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  SequencePedagogique,
  SequenceFormData,
  SeancePedagogique,
  EvaluationPrevue,
  SequenceFilters,
} from '../types/sequencePedagogique.types';

// ─────────────────────────────────────────────────────────────
// CONSTANTES DES COLLECTIONS
// ─────────────────────────────────────────────────────────────
const COL_SEQUENCES = 'sequences_pedagogiques';
const COL_ENTREES   = 'entrees_cahier';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES INTERNES
// ─────────────────────────────────────────────────────────────

/**
 * Génère un identifiant unique pour les séances embarquées.
 * Utilise crypto.randomUUID si disponible, sinon un fallback basé sur Date.
 */
function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extrait et recalcule le tableau evaluationsPrevues
 * à partir des séances marquées estEvaluation=true.
 * Appelé automatiquement avant chaque sauvegarde.
 */
function calcEvaluationsPrevues(seances: SeancePedagogique[]): EvaluationPrevue[] {
  return seances
    .filter((s) => s.estEvaluation && s.typeEvaluation)
    .map((s) => ({
      id:           s.id,
      titre:        s.titre,
      type:         s.typeEvaluation!,
      seanceNumero: s.numero,
      noteMax:      s.noteMax    ?? 20,
      coefficient:  s.coefficient ?? 1,
      datePrevue:   s.datePrevue,
    }));
}

// ─────────────────────────────────────────────────────────────
// LECTURE — Séquences du professeur
// ─────────────────────────────────────────────────────────────

/**
 * Retourne toutes les séquences d'un professeur,
 * triées par date de mise à jour décroissante.
 */
export async function getSequencesProf(profId: string): Promise<SequencePedagogique[]> {
  const q = query(
    collection(db, COL_SEQUENCES),
    where('profId', '==', profId),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SequencePedagogique));
}

/**
 * Retourne les séquences d'un prof filtrées par statut.
 */
export async function getSequencesByStatut(
  profId: string,
  statut: SequencePedagogique['statut']
): Promise<SequencePedagogique[]> {
  const q = query(
    collection(db, COL_SEQUENCES),
    where('profId',  '==', profId),
    where('statut',  '==', statut),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SequencePedagogique));
}

/**
 * Retourne les séquences liées à un groupe-classe spécifique.
 */
export async function getSequencesByGroupe(
  profId: string,
  groupeClasseId: string
): Promise<SequencePedagogique[]> {
  const q = query(
    collection(db, COL_SEQUENCES),
    where('profId',         '==', profId),
    where('groupeClasseId', '==', groupeClasseId),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SequencePedagogique));
}

/**
 * Retourne une séquence par son ID.
 * Retourne null si introuvable.
 */
export async function getSequenceById(
  sequenceId: string
): Promise<SequencePedagogique | null> {
  const snap = await getDoc(doc(db, COL_SEQUENCES, sequenceId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SequencePedagogique;
}

// ─────────────────────────────────────────────────────────────
// ÉCRITURE — Création et mise à jour
// ─────────────────────────────────────────────────────────────

/**
 * Crée une nouvelle séquence pédagogique.
 * - Assigne automatiquement les IDs manquants aux séances.
 * - Calcule evaluationsPrevues depuis les séances.
 * - Retourne l'ID Firestore généré.
 */
export async function createSequence(
  profId: string,
  data: SequenceFormData
): Promise<string> {
  const now = Timestamp.now();

  // S'assurer que chaque séance a un ID unique
  const seancesAvecIds: SeancePedagogique[] = data.seances.map((s) => ({
    ...s,
    id: s.id || genId(),
    exporterVersCahier: s.exporterVersCahier ?? true,
    entreesCahierIds:   s.entreesCahierIds   ?? [],
  }));

  // Recalculer les évaluations prévues
  const evaluationsPrevues = calcEvaluationsPrevues(seancesAvecIds);

  const ref = await addDoc(collection(db, COL_SEQUENCES), {
    ...data,
    profId,
    seances:             seancesAvecIds,
    evaluationsPrevues,
    statut:              data.statut ?? 'brouillon',
    genereeParIA:        data.genereeParIA ?? false,
    competences:         data.competences ?? [],
    createdAt:           now,
    updatedAt:           now,
  });

  return ref.id;
}

/**
 * Met à jour une séquence existante.
 * - Recalcule automatiquement evaluationsPrevues si les séances changent.
 */
export async function updateSequence(
  sequenceId: string,
  data: Partial<Omit<SequencePedagogique, 'id' | 'profId' | 'createdAt'>>
): Promise<void> {
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: Timestamp.now(),
  };

  // Si les séances sont modifiées, recalculer les évaluations prévues
  if (data.seances) {
    updateData.evaluationsPrevues = calcEvaluationsPrevues(data.seances);
  }

  await updateDoc(doc(db, COL_SEQUENCES, sequenceId), updateData);
}

/**
 * Change le statut d'une séquence.
 */
export async function updateStatutSequence(
  sequenceId: string,
  statut: SequencePedagogique['statut']
): Promise<void> {
  await updateDoc(doc(db, COL_SEQUENCES, sequenceId), {
    statut,
    updatedAt: Timestamp.now(),
  });
}

// ─────────────────────────────────────────────────────────────
// SUPPRESSION
// ─────────────────────────────────────────────────────────────

/**
 * Supprime définitivement une séquence.
 * Note : les entrées du cahier de textes créées via export ne sont PAS supprimées.
 */
export async function deleteSequence(sequenceId: string): Promise<void> {
  await deleteDoc(doc(db, COL_SEQUENCES, sequenceId));
}

// ─────────────────────────────────────────────────────────────
// DUPLICATION
// ─────────────────────────────────────────────────────────────

/**
 * Duplique une séquence existante.
 * - Génère de nouveaux IDs pour toutes les séances.
 * - Remet le statut à 'brouillon'.
 * - Efface les liens vers le cahier de textes (à re-choisir).
 * - Efface les dates d'export.
 * - Retourne l'ID du duplicata.
 */
export async function dupliquerSequence(
  sequenceId: string,
  profId: string
): Promise<string> {
  const original = await getSequenceById(sequenceId);
  if (!original) throw new Error(`Séquence ${sequenceId} introuvable`);

  const now = Timestamp.now();

  // Nouvelles séances avec nouveaux IDs, tracking réinitialisé
  const nouvellesSeances: SeancePedagogique[] = original.seances.map((s) => ({
    ...s,
    id:               genId(),
    exporterVersCahier: true,
    entreesCahierIds:   [],
    datePrevue:         undefined,
  }));

  const ref = await addDoc(collection(db, COL_SEQUENCES), {
    // Copier toutes les données pédagogiques
    titre:            `[Copie] ${original.titre}`,
    description:      original.description,
    niveau:           original.niveau,
    matiere:          original.matiere,
    theme:            original.theme,
    competences:      original.competences,
    objectifGeneral:  original.objectifGeneral,
    prerequis:        original.prerequis,
    nombreSeances:    original.nombreSeances,
    dureeSeanceMinutes: original.dureeSeanceMinutes,
    trimestre:        original.trimestre,
    seances:          nouvellesSeances,
    evaluationsPrevues: calcEvaluationsPrevues(nouvellesSeances),
    genereeParIA:     original.genereeParIA,
    // Réinitialiser les champs de suivi
    profId,
    statut:           'brouillon' as const,
    groupeClasseId:   undefined,
    groupeClasseNom:  undefined,
    cahierDeTextesId: undefined,
    cahierDeTextesNom: undefined,
    createdAt:        now,
    updatedAt:        now,
  });

  return ref.id;
}

// ─────────────────────────────────────────────────────────────
// EXPORT VERS LE CAHIER DE TEXTES
// ─────────────────────────────────────────────────────────────

export interface ParamExport {
  /** ID de la séquence à exporter */
  sequenceId: string;

  /** ID du cahier de textes cible */
  cahierDeTextesId: string;

  /** UID du professeur (pour la sécurité) */
  profId: string;

  /**
   * Map séanceId → date choisie par le prof dans la modal d'export.
   * Seules les séances présentes dans cette map seront exportées.
   */
  datesParSeance: Record<string, Timestamp>;
}

export interface ResultatExport {
  /** Nombre de séances exportées avec succès */
  nbExportees: number;

  /** IDs des entrées du cahier créées */
  idsEntrees: string[];

  /** IDs des séances en erreur (si partiel) */
  erreurs: string[];
}

/**
 * Exporte les séances sélectionnées d'une séquence vers un Cahier de Textes.
 *
 * Pour chaque séance sélectionnée :
 *   1. Crée une EntreeCahier dans Firestore
 *   2. Marque la séance (exporterVersCahier=false, entreesCahierIds=[...])
 *   3. Met à jour la séquence (exporteAt, cahierDeTextesId)
 *
 * L'export est partiel tolérant : si une séance échoue, les autres continuent.
 */
export async function exporterVersCahier(
  params: ParamExport
): Promise<ResultatExport> {
  const { sequenceId, cahierDeTextesId, profId, datesParSeance } = params;

  // 1. Charger la séquence
  const sequence = await getSequenceById(sequenceId);
  if (!sequence) throw new Error(`Séquence ${sequenceId} introuvable`);

  const now       = Timestamp.now();
  const idsEntrees: string[] = [];
  const erreurs:    string[] = [];

  // IDs des séances à exporter (celles présentes dans datesParSeance)
  const idsAExporter = Object.keys(datesParSeance);

  // 2. Copie des séances pour mise à jour
  const seancesMaj = [...sequence.seances];

  for (const seanceId of idsAExporter) {
    const idx = seancesMaj.findIndex((s) => s.id === seanceId);
    if (idx === -1) {
      erreurs.push(seanceId);
      continue;
    }

    const seance = seancesMaj[idx];
    const date   = datesParSeance[seanceId];

    try {
      // 3. Construire l'EntreeCahier depuis la séance
      // ✅ Mapping Phase 23 → interface réelle EntreeCahier (Phase 21/22)
      // ✅ "as const" évite d'importer TypeContenu/StatutSeance qui n'existent
      //    pas dans cahierTextes.types — TypeScript infère la compatibilité.
      const entreeData: Omit<EntreeCahier, 'id' | 'createdAt' | 'updatedAt'> = {
        cahierId:           cahierDeTextesId,
        profId,
        date,

        // titre de la séquence → chapitre (nom réel dans l'interface)
        chapitre:           seance.titre,

        // typeContenu requis — valeur par défaut 'cours'
        typeContenu:        'cours' as EntreeCahier['typeContenu'],

        // Contenu pédagogique
        contenu:            seance.contenu,

        // Objectifs spécifiques (optionnel)
        objectifs:          seance.objectifSpecifique,

        // Statut initial → planifié
        statut:             'planifie' as EntreeCahier['statut'],

        // Notes privées du prof : ressources de la séance
        notesPrivees:       seance.ressources.length > 0
          ? `Ressources : ${seance.ressources.join(' | ')}`
          : undefined,

        // Champ requis par l'interface (pas d'évaluation par défaut)
        isMarqueEvaluation: false,

        // Ordre basé sur la position de la séance dans la liste
        ordre:              idx,

        // Champs Phase 22 (vides — le prof peut enrichir ensuite)
        liens:              [],
        ebooksLies:         [],
        piecesJointes:      [],
      };

      // 4. Créer l'entrée dans Firestore
      const ref = await addDoc(collection(db, COL_ENTREES), {
        ...entreeData,
        createdAt: now,
        updatedAt: now,
      });

      idsEntrees.push(ref.id);

      // 5. Mettre à jour la séance dans le tableau local
      seancesMaj[idx] = {
        ...seance,
        exporterVersCahier: false,
        entreesCahierIds:   [
          ...(seance.entreesCahierIds ?? []),
          ref.id,
        ],
      };
    } catch (err) {
      console.error(`[exporterVersCahier] Erreur séance ${seanceId}:`, err);
      erreurs.push(seanceId);
    }
  }

  // 6. Mettre à jour la séquence : séances + exporteAt + cahierDeTextesId
  if (idsEntrees.length > 0) {
    await updateDoc(doc(db, COL_SEQUENCES, sequenceId), {
      seances:            seancesMaj,
      evaluationsPrevues: calcEvaluationsPrevues(seancesMaj),
      cahierDeTextesId,
      cahierDeTextesNom:  sequence.cahierDeTextesNom ?? '',
      exporteAt:          now,
      updatedAt:          now,
    });
  }

  return {
    nbExportees: idsEntrees.length,
    idsEntrees,
    erreurs,
  };
}

// ─────────────────────────────────────────────────────────────
// FILTRAGE CÔTÉ CLIENT
// ─────────────────────────────────────────────────────────────

/**
 * Filtre un tableau de séquences selon les critères donnés.
 * Appelé côté client après getDocs() pour éviter des index composites complexes.
 */
export function filtrerSequences(
  sequences: SequencePedagogique[],
  filtres: SequenceFilters
): SequencePedagogique[] {
  return sequences.filter((seq) => {
    if (filtres.matiere && seq.matiere !== filtres.matiere)         return false;
    if (filtres.niveau  && seq.niveau  !== filtres.niveau)          return false;
    if (filtres.statut  && seq.statut  !== filtres.statut)          return false;
    if (filtres.groupeClasseId && seq.groupeClasseId !== filtres.groupeClasseId) return false;
    if (filtres.recherche) {
      const q = filtres.recherche.toLowerCase();
      const match =
        seq.titre.toLowerCase().includes(q) ||
        seq.matiere.toLowerCase().includes(q) ||
        seq.theme.toLowerCase().includes(q) ||
        seq.description.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

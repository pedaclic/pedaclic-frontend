// ============================================================
// PedaClic — Phase 24 : Service — Cours en Ligne
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================

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
  limit,
  Timestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import type {
  CoursEnLigne,
  SectionCours,
  BlocContenu,
  FiltresCours,
  CoursFormData,
  SectionFormData,
} from '../types/cours_types';

// ─────────────────────────────────────────────────────────────
// CONSTANTES DES COLLECTIONS FIRESTORE
// ─────────────────────────────────────────────────────────────
const COL_COURS    = 'cours_en_ligne';
const COL_SECTIONS = 'cours_sections';

// ─────────────────────────────────────────────────────────────
// UTILITAIRE — Nettoyage des valeurs `undefined`
// ─────────────────────────────────────────────────────────────
/**
 * Supprime récursivement les clés dont la valeur est `undefined`.
 *
 * Pourquoi ? Firestore refuse `undefined` dans les payloads d'écriture et
 * lève `FirebaseError: Unsupported field value: undefined`. Les formulaires
 * de l'éditeur peuvent contenir légitimement des champs optionnels non
 * renseignés (ex. `niveauScolaire`, `cahierTextesId`, `serie`…), qu'il faut
 * donc simplement omettre avant l'envoi.
 *
 * NB : même convention que `sequencePedagogiqueService.ts`,
 * `travauxAFaireService.ts` et `chapitreService.ts` (voir commits 93929f0
 * et 94152a3). Les tableaux, Timestamps, Dates et valeurs primitives sont
 * préservés tels quels — seuls les objets littéraux sont nettoyés.
 */
function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as unknown as T;
  if (typeof obj === 'object' && obj.constructor === Object) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = stripUndefined(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────
// UTILITAIRE — Extraction de l'ID YouTube
// ─────────────────────────────────────────────────────────────

/**
 * Extrait l'ID YouTube depuis une URL standard ou youtu.be.
 * Retourne null si l'URL n'est pas valide.
 */
export function extractYoutubeId(url: string): string | null {
  const regexes = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const re of regexes) {
    const match = url.match(re);
    if (match) return match[1];
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// COURS — LECTURE (catalogue public)
// ─────────────────────────────────────────────────────────────

/**
 * Récupère tous les cours publiés avec filtres optionnels.
 * Utilisé pour le catalogue public (/cours).
 */
export async function getCoursPublies(
  filtres?: Pick<FiltresCours, 'matiere' | 'niveau'>
): Promise<CoursEnLigne[]> {
  let q = query(
    collection(db, COL_COURS),
    where('statut', '==', 'publie'),
    orderBy('updatedAt', 'desc'),
    limit(50)
  );

  // Note : les filtres matière/niveau se font côté client
  // pour éviter des index composites trop nombreux
  const snap = await getDocs(q);
  let cours = snap.docs.map(d => ({ id: d.id, ...d.data() } as CoursEnLigne));

  // Filtrage client
  if (filtres?.matiere) {
    cours = cours.filter(c => c.matiere === filtres.matiere);
  }
  if (filtres?.niveau) {
    cours = cours.filter(c => c.niveau === filtres.niveau);
  }

  return cours;
}

/**
 * Récupère un cours par son ID.
 * Vérifie le statut côté client pour les cours non publiés.
 */
export async function getCoursById(coursId: string): Promise<CoursEnLigne | null> {
  const snap = await getDoc(doc(db, COL_COURS, coursId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CoursEnLigne;
}

// ─────────────────────────────────────────────────────────────
// COURS — LECTURE (espace professeur)
// ─────────────────────────────────────────────────────────────

/**
 * Récupère tous les cours d'un professeur (tous statuts).
 */
export async function getCoursProf(profId: string): Promise<CoursEnLigne[]> {
  const q = query(
    collection(db, COL_COURS),
    where('profId', '==', profId),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CoursEnLigne));
}

/**
 * Récupère tous les cours (admin uniquement).
 */
export async function getAllCours(): Promise<CoursEnLigne[]> {
  const q = query(
    collection(db, COL_COURS),
    orderBy('updatedAt', 'desc'),
    limit(200)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CoursEnLigne));
}

// ─────────────────────────────────────────────────────────────
// COURS — ÉCRITURE (professeur)
// ─────────────────────────────────────────────────────────────

/**
 * Crée un nouveau cours (statut "brouillon" par défaut).
 * Retourne l'ID Firestore du nouveau document.
 */
export async function createCours(
  profId: string,
  profNom: string,
  data: CoursFormData
): Promise<string> {
  const now = Timestamp.now();
  // stripUndefined : retire les champs optionnels non renseignés
  // (niveauScolaire, cahierTextesId, serie, disciplineId…) pour éviter
  // l'erreur Firestore « Unsupported field value: undefined ».
  const payload = stripUndefined({
    ...data,
    profId,
    profNom,
    statut: data.statut ?? 'brouillon',
    nombreInscrits: 0,
    nombreSections: 0,
    createdAt: now,
    updatedAt: now,
  });
  const ref = await addDoc(collection(db, COL_COURS), payload);
  return ref.id;
}

/**
 * Met à jour les métadonnées d'un cours existant.
 *
 * Le payload est nettoyé via stripUndefined car l'éditeur peut envoyer
 * des champs optionnels à `undefined` (p. ex. cahierTextesId quand l'utilisateur
 * « délie » un cahier, ou niveauScolaire avant sélection en cascade). Sans ce
 * nettoyage, Firestore rejette l'écriture et l'UI affiche « Erreur lors de la
 * sauvegarde. Réessayez. ».
 */
export async function updateCours(
  coursId: string,
  data: Partial<Omit<CoursEnLigne, 'id' | 'profId' | 'createdAt'>>
): Promise<void> {
  const payload = stripUndefined({
    ...data,
    updatedAt: Timestamp.now(),
  });
  await updateDoc(doc(db, COL_COURS, coursId), payload);
}

/**
 * Publie un cours : passe le statut à "publié" et enregistre la date.
 */
export async function publierCours(coursId: string): Promise<void> {
  await updateDoc(doc(db, COL_COURS, coursId), {
    statut: 'publie',
    publieAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Archive un cours (le retire du catalogue sans le supprimer).
 */
export async function archiverCours(coursId: string): Promise<void> {
  await updateDoc(doc(db, COL_COURS, coursId), {
    statut: 'archive',
    updatedAt: Timestamp.now(),
  });
}

/**
 * Supprime un cours et toutes ses sections (batch write).
 * ⚠️ Action irréversible — à confirmer avant appel.
 */
export async function deleteCours(coursId: string): Promise<void> {
  const batch = writeBatch(db);

  // Supprimer toutes les sections du cours
  const sectionsSnap = await getDocs(
    query(collection(db, COL_SECTIONS), where('coursId', '==', coursId))
  );
  sectionsSnap.docs.forEach(d => batch.delete(d.ref));

  // Supprimer le cours
  batch.delete(doc(db, COL_COURS, coursId));

  await batch.commit();
}

// ─────────────────────────────────────────────────────────────
// SECTIONS — LECTURE
// ─────────────────────────────────────────────────────────────

/**
 * Récupère toutes les sections d'un cours, triées par ordre.
 */
export async function getSectionsCours(coursId: string): Promise<SectionCours[]> {
  const q = query(
    collection(db, COL_SECTIONS),
    where('coursId', '==', coursId),
    orderBy('ordre', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SectionCours));
}

/**
 * Récupère une section par son ID.
 */
export async function getSectionById(sectionId: string): Promise<SectionCours | null> {
  const snap = await getDoc(doc(db, COL_SECTIONS, sectionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SectionCours;
}

// ─────────────────────────────────────────────────────────────
// SECTIONS — ÉCRITURE
// ─────────────────────────────────────────────────────────────

/**
 * Crée une nouvelle section et incrémente le compteur du cours.
 * Retourne l'ID Firestore de la nouvelle section.
 */
export async function createSection(
  coursId: string,
  data: SectionFormData
): Promise<string> {
  const batch = writeBatch(db);
  const now = Timestamp.now();

  // Créer la section (stripUndefined : même logique que pour le cours parent)
  const sectionRef = doc(collection(db, COL_SECTIONS));
  const payload = stripUndefined({
    ...data,
    coursId,
    blocs: data.blocs ?? [],
    createdAt: now,
    updatedAt: now,
  });
  batch.set(sectionRef, payload);

  // Incrémenter nombreSections dans le cours parent
  batch.update(doc(db, COL_COURS, coursId), {
    nombreSections: increment(1),
    updatedAt: now,
  });

  await batch.commit();
  return sectionRef.id;
}

/**
 * Met à jour une section existante (titre, ordre, blocs).
 * Recalcule automatiquement la durée estimée d'après les blocs.
 */
export async function updateSection(
  sectionId: string,
  data: Partial<Omit<SectionCours, 'id' | 'coursId' | 'createdAt'>>
): Promise<void> {
  const now = Timestamp.now();

  // Recalcul durée si les blocs ont changé
  let update: Record<string, unknown> = { ...data, updatedAt: now };
  if (data.blocs) {
    update.dureeEstimee = calculerDureeSection(data.blocs);
  }

  // stripUndefined : les blocs peuvent contenir des champs optionnels
  // (legende, description, points, quizAvanceId, explication…) laissés
  // non renseignés par le prof — Firestore refuserait sans ce nettoyage.
  await updateDoc(doc(db, COL_SECTIONS, sectionId), stripUndefined(update));
}

/**
 * Supprime une section et décrémente le compteur du cours.
 */
export async function deleteSection(
  sectionId: string,
  coursId: string
): Promise<void> {
  const batch = writeBatch(db);
  const now = Timestamp.now();

  batch.delete(doc(db, COL_SECTIONS, sectionId));
  batch.update(doc(db, COL_COURS, coursId), {
    nombreSections: increment(-1),
    updatedAt: now,
  });

  await batch.commit();
}

/**
 * Réordonne les sections après un drag-and-drop.
 * Met à jour le champ `ordre` de chaque section en batch.
 */
export async function reordonnerSections(
  sections: Array<{ id: string; ordre: number }>
): Promise<void> {
  const batch = writeBatch(db);
  const now = Timestamp.now();

  sections.forEach(({ id, ordre }) => {
    batch.update(doc(db, COL_SECTIONS, id), { ordre, updatedAt: now });
  });

  await batch.commit();
}

// ─────────────────────────────────────────────────────────────
// BLOCS — Opérations sur les blocs d'une section
// Les blocs sont stockés dans SectionCours.blocs (tableau JSON)
// → pas de sous-collection, opération directe sur la section
// ─────────────────────────────────────────────────────────────

/**
 * Sauvegarde l'intégralité des blocs d'une section.
 * Appelé après chaque modification (ajout, suppression, réordonnancement).
 */
export async function saveBlocsSection(
  sectionId: string,
  blocs: BlocContenu[]
): Promise<void> {
  // Réindexer les ordres avant sauvegarde
  const blocsOrdres = blocs.map((b, i) => ({ ...b, ordre: i }));

  // stripUndefined : champs optionnels possibles dans les blocs
  // (legende, description, points, quizAvanceId, explication…).
  await updateDoc(doc(db, COL_SECTIONS, sectionId), stripUndefined({
    blocs: blocsOrdres,
    dureeEstimee: calculerDureeSection(blocsOrdres),
    updatedAt: Timestamp.now(),
  }));
}

// ─────────────────────────────────────────────────────────────
// UTILITAIRES MÉTIER
// ─────────────────────────────────────────────────────────────

/**
 * Calcule la durée estimée d'une section en minutes.
 * Basé sur : ~200 mots/min lecture, 2 min par vidéo, 1 min par quiz.
 */
export function calculerDureeSection(blocs: BlocContenu[]): number {
  let duree = 0;
  blocs.forEach(b => {
    switch (b.type) {
      case 'texte':
        // Estimation : 200 mots/minute
        duree += Math.max(1, Math.ceil(b.contenu.split(' ').length / 200));
        break;
      case 'video':
        duree += 5; // Durée moyenne d'une vidéo pédagogique
        break;
      case 'quiz':
        duree += 2; // 2 minutes par question QCM
        break;
      case 'exercice':
        duree += b.difficulte === 'difficile' ? 10 : b.difficulte === 'moyen' ? 5 : 3;
        break;
      case 'image':
      case 'encadre':
        duree += 1;
        break;
    }
  });
  return Math.max(1, duree);
}

/**
 * Incrémente le compteur d'inscrits d'un cours.
 * Appelé lors du premier accès d'un élève.
 */
export async function incrementerInscrits(coursId: string): Promise<void> {
  await updateDoc(doc(db, COL_COURS, coursId), {
    nombreInscrits: increment(1),
  });
}

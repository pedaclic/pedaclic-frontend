// ============================================================
// PedaClic — Phase 44 : Service — Niveaux scolaires publics
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ------------------------------------------------------------
// Alimente les pages publiques :
//   /niveaux/:slug                        → NiveauPage
//   /niveaux/lycee/:classe                → NiveauSeriesPage
//   /niveaux/:slug/:classe/cours          → NiveauCoursPage
//   /niveaux/lycee/:classe/:serie/cours   → NiveauCoursPage
//
// Sources Firestore (toutes administrables depuis /admin) :
//   • settings/niveaux   → textes des cartes & introductions   (/admin/niveaux)
//   • disciplines        → matières par niveau/classe/séries   (/admin/disciplines)
//   • cours_en_ligne     → cours publiés                       (Cours en ligne)
//
// Aucune nouvelle collection, aucun index composite requis :
// les requêtes n'utilisent qu'un filtre d'égalité ou un orderBy
// simple, le reste du filtrage se fait côté client (même stratégie
// que coursService.getCoursPublies).
// ============================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Classe, Discipline, Niveau } from '../types';
import { getClassesByNiveau } from '../types';
import type { CoursEnLigne } from '../types/cours_types';
import { normaliserClassePourComparaison } from '../types/cahierTextes.types';
import {
  NIVEAUX_CONTENU_DEFAUT,
  NIVEAUX_ORDONNES,
  type NiveauContenu,
  type NiveauxContenuMap,
} from '../types/niveauxContenu.types';

/** Référence du document de configuration */
const REF_CONTENU = () => doc(db, 'settings', 'niveaux');

// ------------------------------------------------------------
// 1. CONTENU ÉDITORIAL (settings/niveaux)
// ------------------------------------------------------------

/**
 * Fusionne un document Firestore (éventuellement partiel ou absent)
 * avec les valeurs par défaut. Garantit un objet complet et valide.
 */
function fusionnerAvecDefauts(data: Partial<Record<Niveau, Partial<NiveauContenu>>> | undefined): NiveauxContenuMap {
  const resultat = {} as NiveauxContenuMap;
  NIVEAUX_ORDONNES.forEach((niveau) => {
    const defaut = NIVEAUX_CONTENU_DEFAUT[niveau];
    const saisi = data?.[niveau] ?? {};
    resultat[niveau] = {
      ...defaut,
      ...saisi,
      // Sécurité : pointsForts doit toujours être un tableau de chaînes non vides
      pointsForts: Array.isArray(saisi.pointsForts)
        ? saisi.pointsForts.filter((p) => typeof p === 'string' && p.trim() !== '')
        : defaut.pointsForts,
    };
  });
  return resultat;
}

/** Lit le contenu des niveaux (valeurs par défaut si document absent ou erreur) */
export async function getNiveauxContenu(): Promise<NiveauxContenuMap> {
  try {
    const snap = await getDoc(REF_CONTENU());
    return fusionnerAvecDefauts(snap.exists() ? (snap.data().niveaux as any) : undefined);
  } catch (err) {
    // Hors-ligne ou erreur réseau : on n'empêche jamais l'affichage de l'accueil
    console.warn('[niveauxService] Contenu par défaut utilisé :', err);
    return fusionnerAvecDefauts(undefined);
  }
}

/** Enregistre le contenu des niveaux (admin uniquement — règle settings/*) */
export async function saveNiveauxContenu(contenu: NiveauxContenuMap, adminUid?: string): Promise<void> {
  await setDoc(
    REF_CONTENU(),
    {
      niveaux: contenu,
      updatedAt: serverTimestamp(),
      ...(adminUid ? { updatedBy: adminUid } : {}),
    },
    { merge: true },
  );
}

/** Liste des niveaux actifs, triés selon le champ « ordre » */
export function niveauxActifsTries(contenu: NiveauxContenuMap): Niveau[] {
  return NIVEAUX_ORDONNES
    .filter((n) => contenu[n].actif)
    .sort((a, b) => contenu[a].ordre - contenu[b].ordre);
}

// ------------------------------------------------------------
// 2. OUTILS DE CORRESPONDANCE CLASSE / NIVEAU
// ------------------------------------------------------------

/**
 * Normalise une classe pour comparaison.
 * Gère les deux formats coexistant dans la base :
 *   « 6eme » (DisciplineManager, CoursEditor) et « 6ème » (Cahier de textes).
 * Insensible à la casse (« terminale » = « Terminale »).
 */
export function cleClasse(classe: string | undefined): string {
  return normaliserClassePourComparaison((classe ?? '').trim()).toLowerCase();
}

/** Vrai si la classe donnée appartient au niveau */
export function classeAppartientAuNiveau(classe: string | undefined, niveau: Niveau): boolean {
  const cle = cleClasse(classe);
  return getClassesByNiveau(niveau).some((c) => cleClasse(c.value) === cle);
}

/** Retrouve la valeur canonique d'une classe à partir d'un paramètre d'URL */
export function classeDepuisUrl(param: string | undefined, niveau: Niveau): Classe | null {
  if (!param) return null;
  const cle = cleClasse(decodeURIComponent(param));
  return getClassesByNiveau(niveau).find((c) => cleClasse(c.value) === cle)?.value ?? null;
}

// ------------------------------------------------------------
// 3. DISCIPLINES
// ------------------------------------------------------------

/** Disciplines d'un niveau (filtre d'égalité seul → pas d'index composite) */
export async function getDisciplinesDuNiveau(niveau: Niveau): Promise<Discipline[]> {
  const snap = await getDocs(query(collection(db, 'disciplines'), where('niveau', '==', niveau)));
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
      updatedAt: d.data().updatedAt?.toDate?.(),
    }) as Discipline)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.nom.localeCompare(b.nom, 'fr'));
}

/**
 * Filtre les disciplines d'une classe (et d'une série au lycée).
 * Une discipline sans « series » renseignées est commune à toutes les séries.
 */
export function filtrerDisciplines(
  disciplines: Discipline[],
  classe: string,
  serie?: string,
): Discipline[] {
  const cle = cleClasse(classe);
  return disciplines.filter((d) => {
    if (cleClasse(d.classe) !== cle) return false;
    if (!serie) return true;
    return !d.series || d.series.length === 0 || d.series.includes(serie as any);
  });
}

// ------------------------------------------------------------
// 4. COURS PUBLIÉS
// ------------------------------------------------------------

/**
 * Tous les cours publiés (catalogue public).
 * Contrairement à getCoursPublies (limité à 50 pour le catalogue),
 * on charge l'ensemble pour que les pages de niveau soient complètes.
 * @param inclureReservesPro true pour les profs/admins
 */
export async function getTousCoursPublies(inclureReservesPro: boolean): Promise<CoursEnLigne[]> {
  const snap = await getDocs(query(collection(db, 'cours_en_ligne'), where('statut', '==', 'publie')));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as CoursEnLigne)
    .filter((c) => inclureReservesPro || !c.reservedPro)
    // Plus récents d'abord (même ordre que le catalogue /cours)
    .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
}

/** Cours rattachés à un niveau (par niveauScolaire OU par classe) */
export function filtrerCoursNiveau(cours: CoursEnLigne[], niveau: Niveau): CoursEnLigne[] {
  return cours.filter(
    (c) => (c.niveauScolaire as string) === niveau || classeAppartientAuNiveau(c.niveau as string, niveau),
  );
}

/**
 * Cours d'une classe (et d'une série au lycée).
 * Un cours sans série est considéré commun à toutes les séries.
 */
export function filtrerCoursClasse(cours: CoursEnLigne[], classe: string, serie?: string): CoursEnLigne[] {
  const cle = cleClasse(classe);
  return cours.filter((c) => {
    if (cleClasse(c.niveau as string) !== cle) return false;
    if (!serie) return true;
    return !c.serie || c.serie === serie;
  });
}

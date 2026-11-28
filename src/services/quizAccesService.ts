// ============================================================
// PedaClic — Phase 61 : quizAccesService.ts
// ------------------------------------------------------------
// Requêtes de quiz « scindées », acceptées À LA FOIS par les règles
// Firestore actuelles (Phase 60) et par les règles durcies (Phase 61) :
//
//   Firestore refuse une requête de LISTE entière dès qu'il ne peut pas
//   prouver que CHAQUE document possible est autorisé. On découpe donc :
//     (a) quiz globaux   : status == 'published' && groupeId == null
//     (b) quiz de classe : status == 'published' && groupeId == G
//                          (une requête par groupe : une seule vérification
//                           exists(membres_groupe/…) par requête, bien en deçà
//                           de la limite de lectures dépendantes des règles)
//     (c) quiz de séance : status == 'published' && cahierId == C [&& seanceId == S]
//
//   Seules des égalités sont utilisées (pas d'orderBy) : aucun index
//   composite n'est nécessaire ; le tri est fait ici, côté navigateur.
//
//   « Repli » : quand une requête est refusée (permission-denied), on rejoue
//   une variante plus restreinte. Exemples :
//     • quiz de classe Premium pour un élève non Premium : accepté par les
//       règles Phase 61 (membre de la classe), refusé par les règles Phase 60
//       → repli avec isPremium == false (comportement historique) ;
//     • prof : liste complète refusée par les règles Phase 61 (brouillons
//       des autres) → repli « publiés » + « les miens ».
// ============================================================

import {
  collection,
  getDocs,
  query,
  where,
  type Query,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';

export type CollectionQuiz = 'quizzes' | 'quizzes_v2';

/** Document brut : id + champs Firestore. */
export type QuizBrut = { id: string } & Record<string, any>;

// ─────────────────────────────────────────────────────────────
// OUTILS INTERNES
// ─────────────────────────────────────────────────────────────

/** Erreur de droits Firestore ? */
function estRefus(e: unknown): boolean {
  return (e as { code?: string })?.code === 'permission-denied';
}

/** Construit une requête sur une collection de quiz. */
function q(col: CollectionQuiz, ...contraintes: QueryConstraint[]): Query<DocumentData> {
  return query(collection(db, col), ...contraintes);
}

/**
 * Exécute une requête ; si elle est refusée et qu'une variante de repli
 * est fournie, exécute la variante. Toute autre erreur est remontée.
 */
async function avecRepli(
  principale: Query<DocumentData>,
  repli?: Query<DocumentData> | null
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  try {
    return (await getDocs(principale)).docs;
  } catch (e) {
    if (repli && estRefus(e)) return (await getDocs(repli)).docs;
    throw e;
  }
}

/**
 * Exécute plusieurs lectures en parallèle, SANS échec global : une lecture
 * refusée ou en erreur est journalisée et ignorée (les autres restent
 * affichées). Fusionne les documents en supprimant les doublons par id.
 */
async function fusionner(
  lectures: Array<Promise<QueryDocumentSnapshot<DocumentData>[]>>,
  contexte: string
): Promise<QuizBrut[]> {
  const resultats = await Promise.allSettled(lectures);
  const parId = new Map<string, QuizBrut>();
  resultats.forEach((r) => {
    if (r.status === 'fulfilled') {
      r.value.forEach((d) => {
        if (!parId.has(d.id)) parId.set(d.id, { id: d.id, ...d.data() });
      });
    } else {
      console.warn(`[quizAcces] ${contexte} : une lecture a échoué`, r.reason);
    }
  });
  return [...parId.values()];
}

/** Valeur de tri « date de création » (Timestamp, Date ou absent). */
function horodatage(v: any): number {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
}

/** Tri par titre (A → Z), comme les anciennes requêtes orderBy('titre'). */
export function trierParTitre<T extends Record<string, any>>(liste: T[]): T[] {
  return [...liste].sort((a, b) => (a.titre || '').localeCompare(b.titre || '', 'fr'));
}

/** Tri par date de création décroissante, comme orderBy('createdAt','desc'). */
export function trierParDateDesc<T extends Record<string, any>>(liste: T[]): T[] {
  return [...liste].sort((a, b) => horodatage(b.createdAt) - horodatage(a.createdAt));
}

/** Groupes valides et sans doublon. */
function nettoyerIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((x): x is string => typeof x === 'string' && x.length > 0))];
}

// ─────────────────────────────────────────────────────────────
// ÉLÈVE — QUIZ CLASSIQUES (collection `quizzes`)
// ─────────────────────────────────────────────────────────────

/**
 * Quiz classiques publiés visibles par un élève : globaux + ceux de ses
 * groupes + (option) ceux des cahiers partagés à ses classes.
 *
 * Premium :
 *   • quiz globaux : élève non Premium → isPremium == false (règle historique) ;
 *   • quiz de classe / de séance : tous les membres (Premium ou non) une fois
 *     les règles Phase 61 en place ; avant, repli sur isPremium == false.
 */
export async function lireQuizClassiquesEleve(params: {
  groupeIds: string[];
  isPremium: boolean;
  cahierIds?: string[];
}): Promise<QuizBrut[]> {
  const { isPremium } = params;
  const groupeIds = nettoyerIds(params.groupeIds);
  const cahierIds = nettoyerIds(params.cahierIds ?? []);
  const publie = where('status', '==', 'published');
  const gratuit = where('isPremium', '==', false);

  const lectures: Array<Promise<QueryDocumentSnapshot<DocumentData>[]>> = [];

  // (a) globaux
  lectures.push(
    avecRepli(
      isPremium
        ? q('quizzes', publie, where('groupeId', '==', null))
        : q('quizzes', publie, where('groupeId', '==', null), gratuit)
    )
  );

  // (b) un appel par groupe
  groupeIds.forEach((gid) => {
    lectures.push(
      avecRepli(
        q('quizzes', publie, where('groupeId', '==', gid)),
        isPremium ? null : q('quizzes', publie, where('groupeId', '==', gid), gratuit)
      )
    );
  });

  // (c) un appel par cahier partagé (quiz de séance)
  cahierIds.forEach((cid) => {
    lectures.push(
      avecRepli(
        q('quizzes', publie, where('cahierId', '==', cid)),
        isPremium ? null : q('quizzes', publie, where('cahierId', '==', cid), gratuit)
      )
    );
  });

  return trierParTitre(await fusionner(lectures, 'quiz classiques élève'));
}

// ─────────────────────────────────────────────────────────────
// ÉLÈVE — QUIZ AVANCÉS (collection `quizzes_v2`)
// ─────────────────────────────────────────────────────────────

/**
 * Quiz avancés publiés visibles par un élève : globaux + groupes + cahiers.
 * Le filtrage Premium reste fait côté application (comme avant).
 */
export async function lireQuizAvancesEleve(params: {
  groupeIds: string[];
  cahierIds?: string[];
}): Promise<QuizBrut[]> {
  const groupeIds = nettoyerIds(params.groupeIds);
  const cahierIds = nettoyerIds(params.cahierIds ?? []);
  const publie = where('status', '==', 'published');

  const lectures: Array<Promise<QueryDocumentSnapshot<DocumentData>[]>> = [
    avecRepli(q('quizzes_v2', publie, where('groupeId', '==', null))),
    ...groupeIds.map((gid) => avecRepli(q('quizzes_v2', publie, where('groupeId', '==', gid)))),
    ...cahierIds.map((cid) => avecRepli(q('quizzes_v2', publie, where('cahierId', '==', cid)))),
  ];
  return trierParDateDesc(await fusionner(lectures, 'quiz avancés élève'));
}

/**
 * Quiz (classiques ET avancés) d'une séance, vus par un ÉLÈVE.
 * La requête porte sur cahierId + seanceId + status : la règle Phase 61
 * vérifie l'appartenance de l'élève à l'une des classes du cahier.
 */
export async function lireQuizDeSeanceEleve(params: {
  seanceId: string;
  cahierId: string;
  isPremium: boolean;
}): Promise<{ classiques: QuizBrut[]; avances: QuizBrut[] }> {
  const { seanceId, cahierId, isPremium } = params;
  const filtres = [
    where('status', '==', 'published'),
    where('cahierId', '==', cahierId),
    where('seanceId', '==', seanceId),
  ];
  const [classiques, avances] = await Promise.all([
    fusionner(
      [
        avecRepli(
          q('quizzes', ...filtres),
          isPremium ? null : q('quizzes', ...filtres, where('isPremium', '==', false))
        ),
      ],
      'quiz de séance (classiques)'
    ),
    fusionner([avecRepli(q('quizzes_v2', ...filtres))], 'quiz de séance (avancés)'),
  ]);
  return { classiques, avances };
}

// ─────────────────────────────────────────────────────────────
// VISITEUR / PARENT — QUIZ GLOBAUX PUBLIÉS
// ─────────────────────────────────────────────────────────────

/** Quiz avancés globaux publiés (parents, comptes sans classe). */
export async function lireQuizAvancesGlobauxPublies(): Promise<QuizBrut[]> {
  return trierParDateDesc(
    await fusionner(
      [avecRepli(q('quizzes_v2', where('status', '==', 'published'), where('groupeId', '==', null)))],
      'quiz avancés globaux'
    )
  );
}

// ─────────────────────────────────────────────────────────────
// PROF / ADMIN — LISTES PAR CHAMP (option stricte des brouillons)
// ─────────────────────────────────────────────────────────────

/**
 * Quiz d'une collection filtrés sur un champ (ex. disciplineId, seanceId),
 * pour un PROF ou un ADMIN :
 *   1. requête simple champ == valeur (admin ; prof avec les règles Phase 60) ;
 *   2. si refusée (prof avec les règles Phase 61) : « publiés » + « les miens »
 *      (profId et auteurId pour les quiz classiques, auteurId pour les avancés).
 *
 * @param uid  utilisateur connecté (null → seulement les publiés)
 */
export async function lireQuizParChampProf(
  col: CollectionQuiz,
  champ: string,
  valeur: string | null,
  uid: string | null
): Promise<QuizBrut[]> {
  const filtre = where(champ, '==', valeur);
  try {
    const snap = await getDocs(q(col, filtre));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    if (!estRefus(e)) throw e;
  }
  const champsAuteur = col === 'quizzes' ? ['profId', 'auteurId'] : ['auteurId'];
  return fusionner(
    [
      avecRepli(q(col, filtre, where('status', '==', 'published'))),
      ...(uid ? champsAuteur.map((c) => avecRepli(q(col, filtre, where(c, '==', uid)))) : []),
    ],
    `quiz ${col} par ${champ} (prof)`
  );
}

/**
 * Toute une collection pour un PROF : liste complète si autorisée (règles
 * Phase 60), sinon « tous les publiés » + « mes quiz » (règles Phase 61).
 */
export async function lireTousQuizVisiblesProf(
  col: CollectionQuiz,
  uid: string
): Promise<QuizBrut[]> {
  try {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    if (!estRefus(e)) throw e;
  }
  const champsAuteur = col === 'quizzes' ? ['profId', 'auteurId'] : ['auteurId'];
  return fusionner(
    [
      avecRepli(q(col, where('status', '==', 'published'))),
      ...champsAuteur.map((c) => avecRepli(q(col, where(c, '==', uid)))),
    ],
    `quiz ${col} (prof)`
  );
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 3a — TEST DES RÈGLES SUR LA COLLECTION TÉMOIN `test_phase61`
// ─────────────────────────────────────────────────────────────

/**
 * Teste, sans aucun risque, la règle de lecture prévue pour l'étape 3 sur la
 * collection témoin `test_phase61` (lecture seule). À lancer dans la console
 * du navigateur d'un ÉLÈVE connecté (page tableau de bord ouverte) :
 *
 *     await __testPhase61('<id groupe de l\'élève>', '<id autre groupe>', '<id cahier>')
 *
 * Affiche un tableau « attendu / obtenu » pour chaque requête.
 */
export async function testerReglesPhase61(
  groupeMembre: string,
  groupeNonMembre: string,
  cahierId?: string
): Promise<Array<{ test: string; attendu: string; obtenu: string; ok: boolean }>> {
  const col = collection(db, 'test_phase61');
  const publie = where('status', '==', 'published');
  const essais: Array<{ test: string; attendu: 'autorisé' | 'refusé'; requete: Query<DocumentData> }> = [
    { test: 'Liste : quiz globaux publiés', attendu: 'autorisé', requete: query(col, publie, where('groupeId', '==', null)) },
    { test: 'Liste : groupe dont je suis membre', attendu: 'autorisé', requete: query(col, publie, where('groupeId', '==', groupeMembre)) },
    { test: 'Liste : groupe dont je ne suis PAS membre', attendu: 'refusé', requete: query(col, publie, where('groupeId', '==', groupeNonMembre)) },
    { test: 'Liste : toute la collection', attendu: 'refusé', requete: query(col) },
    ...(cahierId
      ? [{ test: 'Liste : séances du cahier', attendu: 'autorisé' as const, requete: query(col, publie, where('cahierId', '==', cahierId)) }]
      : []),
  ];
  const lignes: Array<{ test: string; attendu: string; obtenu: string; ok: boolean }> = [];
  for (const e of essais) {
    let obtenu: string;
    try {
      const snap = await getDocs(e.requete);
      obtenu = `autorisé (${snap.size} doc.)`;
    } catch (err) {
      obtenu = estRefus(err) ? 'refusé' : `erreur : ${(err as Error)?.message}`;
    }
    lignes.push({ test: e.test, attendu: e.attendu, obtenu, ok: obtenu.startsWith(e.attendu) });
  }
  console.table(lignes);
  return lignes;
}

// Exposition dans la console (lecture seule, sans effet sur l'application)
if (typeof window !== 'undefined') {
  (window as any).__testPhase61 = testerReglesPhase61;
}

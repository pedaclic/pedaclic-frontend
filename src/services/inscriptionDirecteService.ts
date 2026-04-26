// ============================================================
// PedaClic — inscriptionDirecteService.ts
// Inscription directe d'un élève (compte existant) dans un groupe
// par son professeur. Complète le système auto-inscription via code.
// www.pedaclic.sn
// ============================================================

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase'; // Adapter selon votre config

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** Profil allégé d'un élève retourné par la recherche */
export interface EleveResultat {
  uid: string;
  displayName: string;
  email: string;
  classe?: string;        // classe déclarée dans le profil (optionnel)
  photoURL?: string;
  dejaInscrit: boolean;   // true si déjà membre de ce groupe
  inscriptionId?: string; // id du doc inscriptions_groupe si inscrit
}

/**
 * Sexe de l'élève (cohérent avec `Sexe` de src/types/index.ts).
 *   - 'M'    : masculin
 *   - 'F'    : féminin
 *   - 'autre': précision libre stockée dans `eleveSexeAutre`
 *
 * Champ optionnel pour rétro-compatibilité (les anciennes inscriptions
 * antérieures à l'ajout de la fonctionnalité n'avaient pas ce champ).
 */
export type SexeEleve = 'M' | 'F' | 'autre';

/** Données d'une inscription (document inscriptions_groupe) */
export interface InscriptionGroupe {
  id: string;
  groupeId: string;
  eleveId: string;
  eleveNom: string;
  eleveEmail: string;
  /**
   * Sexe DÉNORMALISÉ depuis `users/{uid}.sexe` (ou saisi manuellement
   * pour une inscription offline / corrigé a posteriori par le prof).
   * Permet l'affichage des pictogrammes ♂/♀ et les statistiques genrées
   * sans relire la collection `users` à chaque rendu.
   */
  eleveSexe?: SexeEleve;
  /** Précision libre quand eleveSexe === 'autre'. */
  eleveSexeAutre?: string;
  profId: string;         // prof qui a effectué l'inscription
  dateInscription: Timestamp;
  statut: 'actif' | 'suspendu';
  /**
   * Origine de l'inscription :
   *   'code'    = auto-inscription de l'élève via code groupe
   *   'direct'  = inscrit par le prof depuis un compte PedaClic existant
   *   'offline' = Phase 34 : élève sans compte PedaClic (inscription manuelle)
   *               Permet au prof de suivre présences & notes même hors connexion
   */
  sourceInscription: 'code' | 'direct' | 'offline';
  /** Phase 34 : note libre saisie par le prof (ex. tuteur, téléphone, remarque) */
  remarque?: string;
  /** Phase 34 : true si l'élève n'a pas (encore) de compte PedaClic */
  isOffline?: boolean;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const COL_USERS         = 'users';
const COL_GROUPES       = 'groupes_prof';
const COL_INSCRIPTIONS  = 'inscriptions_groupe';

// Limite de résultats de recherche affichés
const SEARCH_LIMIT = 10;

// ─────────────────────────────────────────────────────────────
// RECHERCHE D'ÉLÈVES
// ─────────────────────────────────────────────────────────────

/**
 * Recherche des élèves PedaClic par email (exact) ou par nom (préfixe).
 * Retourne jusqu'à SEARCH_LIMIT résultats avec flag dejaInscrit.
 *
 * @param recherche  - chaîne saisie par le prof (email ou nom)
 * @param groupeId   - ID du groupe pour vérifier les inscriptions existantes
 * @returns          - liste d'élèves avec statut d'inscription
 */
export async function rechercherEleves(
  recherche: string,
  groupeId: string
): Promise<EleveResultat[]> {
  const terme = recherche.trim();
  if (terme.length < 2) return [];

  // ── Récupérer les inscriptions existantes (fail-safe) ────────
  // getInscritsMap ne lève jamais : retourne Map vide si permissions insuffisantes.
  // L'anti-doublon reste garanti par verifierDejaInscrit() dans inscrireEleveDirect().
  const inscritsMap = await getInscritsMap(groupeId);

  // ── Détecter si c'est un email ou un nom ─────────────────────
  const isEmail = terme.includes('@');

  let results: EleveResultat[] = [];

  if (isEmail) {
    // ── Recherche par email exact ────────────────────────────────
    // Les emails doivent être stockés en minuscules à l'inscription.
    const q = query(
      collection(db, COL_USERS),
      where('role', '==', 'eleve'),
      where('email', '==', terme.toLowerCase()),
      limit(SEARCH_LIMIT)
    );
    const snap = await getDocs(q);
    results = snap.docs.map(d => buildEleveResultat(d.id, d.data(), inscritsMap));
  } else {
    // ── Recherche par displayName (préfixe) ──────────────────────
    // Simule un LIKE 'terme%'. Requiert l'index composite :
    //   Collection: users | Champs: role (ASC) + displayName (ASC)
    const fin = terme + '\uf8ff';
    const q = query(
      collection(db, COL_USERS),
      where('role', '==', 'eleve'),
      where('displayName', '>=', terme),
      where('displayName', '<', fin),
      orderBy('displayName'),
      limit(SEARCH_LIMIT)
    );
    const snap = await getDocs(q);
    results = snap.docs.map(d => buildEleveResultat(d.id, d.data(), inscritsMap));
  }

  return results;
}

// ─────────────────────────────────────────────────────────────
// INSCRIPTION DIRECTE
// ─────────────────────────────────────────────────────────────

/**
 * Inscrit directement un élève dans un groupe par le professeur.
 * Vérifie l'absence de doublon, crée le document d'inscription
 * et incrémente le compteur du groupe.
 *
 * @param groupeId  - ID du groupe cible
 * @param eleve     - résultat de recherche de l'élève
 * @param profId    - UID du professeur connecté
 * @returns         - ID du nouveau document inscriptions_groupe
 * @throws          - Error si l'élève est déjà inscrit
 */
export async function inscrireEleveDirect(
  groupeId: string,
  eleve: Pick<EleveResultat, 'uid' | 'displayName' | 'email'>,
  profId: string
): Promise<string> {
  // ── 1. Vérifier le doublon ────────────────────────────────────
  const dejaInscrit = await verifierDejaInscrit(eleve.uid, groupeId);
  if (dejaInscrit) {
    throw new Error(`${eleve.displayName} est déjà inscrit dans ce groupe.`);
  }

  // ── 2. Vérifier que l'élève existe bien ──────────────────────
  const eleveSnap = await getDoc(doc(db, COL_USERS, eleve.uid));
  if (!eleveSnap.exists() || eleveSnap.data()?.role !== 'eleve') {
    throw new Error('Compte élève introuvable ou invalide.');
  }

  // ── 2 bis. Dénormalisation du SEXE de l'élève ────────────────
  //   On lit `users/{uid}.sexe` et `users/{uid}.sexeAutre` pour les
  //   copier sur le document d'inscription. Permet d'afficher les
  //   pictogrammes ♂/♀ côté prof sans relire `users` ligne par ligne.
  const eleveDoc = eleveSnap.data() || {};
  let eleveSexe: SexeEleve | undefined;
  let eleveSexeAutre: string | undefined;
  if (eleveDoc.sexe === 'M' || eleveDoc.sexe === 'F' || eleveDoc.sexe === 'autre') {
    eleveSexe = eleveDoc.sexe;
  }
  if (typeof eleveDoc.sexeAutre === 'string' && eleveDoc.sexeAutre.trim()) {
    eleveSexeAutre = eleveDoc.sexeAutre.trim();
  }

  // ── 3. Créer le document d'inscription ───────────────────────
  //   On omet les champs `eleveSexe`/`eleveSexeAutre` quand ils ne sont
  //   pas définis : Firestore refuse `undefined` sur un `addDoc`.
  const inscriptionData: Omit<InscriptionGroupe, 'id'> = {
    groupeId,
    eleveId:          eleve.uid,
    eleveNom:         eleve.displayName,
    eleveEmail:       eleve.email,
    ...(eleveSexe ? { eleveSexe } : {}),
    ...(eleveSexeAutre ? { eleveSexeAutre } : {}),
    profId,
    dateInscription:  Timestamp.now(),
    statut:           'actif',
    sourceInscription: 'direct',
  };

  const ref = await addDoc(collection(db, COL_INSCRIPTIONS), inscriptionData);

  // ── 4. Incrémenter le compteur du groupe ─────────────────────
  await updateDoc(doc(db, COL_GROUPES, groupeId), {
    nombreInscrits: increment(1),
  });

  return ref.id;
}

// ─────────────────────────────────────────────────────────────
// DÉSINSCRIPTION
// ─────────────────────────────────────────────────────────────

/**
 * Retire un élève d'un groupe (supprime l'inscription, décrémente le compteur).
 *
 * @param inscriptionId - ID du document inscriptions_groupe
 * @param groupeId      - ID du groupe (pour décrémenter le compteur)
 */
export async function desinscrireEleve(
  inscriptionId: string,
  groupeId: string
): Promise<void> {
  // Supprimer le document d'inscription
  await deleteDoc(doc(db, COL_INSCRIPTIONS, inscriptionId));

  // Décrémenter le compteur (sans jamais descendre sous 0)
  const groupeSnap = await getDoc(doc(db, COL_GROUPES, groupeId));
  if (groupeSnap.exists()) {
    const actuel = groupeSnap.data()?.nombreInscrits ?? 0;
    if (actuel > 0) {
      await updateDoc(doc(db, COL_GROUPES, groupeId), {
        nombreInscrits: increment(-1),
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// LISTE DES INSCRIPTIONS D'UN GROUPE
// ─────────────────────────────────────────────────────────────

/**
 * Retourne toutes les inscriptions actives d'un groupe,
 * triées par date d'inscription décroissante.
 *
 * @param groupeId - ID du groupe
 */
export async function getInscriptionsGroupe(
  groupeId: string
): Promise<InscriptionGroupe[]> {
  const q = query(
    collection(db, COL_INSCRIPTIONS),
    where('groupeId', '==', groupeId),
    where('statut', '==', 'actif'),
    orderBy('dateInscription', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  } as InscriptionGroupe));
}

/**
 * Retourne toutes les inscriptions d'un groupe (actifs + suspendus).
 * Utile pour la gestion complète côté prof.
 */
export async function getAllInscriptionsGroupe(
  groupeId: string
): Promise<InscriptionGroupe[]> {
  const q = query(
    collection(db, COL_INSCRIPTIONS),
    where('groupeId', '==', groupeId),
    orderBy('dateInscription', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  } as InscriptionGroupe));
}

// ─────────────────────────────────────────────────────────────
// SUSPENSION / RÉACTIVATION
// ─────────────────────────────────────────────────────────────

/**
 * Suspend ou réactive l'accès d'un élève à un groupe
 * sans supprimer l'inscription (préserve l'historique).
 */
export async function toggleStatutInscription(
  inscriptionId: string,
  nouveauStatut: 'actif' | 'suspendu'
): Promise<void> {
  await updateDoc(doc(db, COL_INSCRIPTIONS, inscriptionId), {
    statut: nouveauStatut,
  });
}

// ─────────────────────────────────────────────────────────────
// FONCTIONS UTILITAIRES INTERNES
// ─────────────────────────────────────────────────────────────

/**
 * Vérifie si un élève est déjà inscrit dans un groupe.
 */
async function verifierDejaInscrit(
  eleveId: string,
  groupeId: string
): Promise<boolean> {
  const q = query(
    collection(db, COL_INSCRIPTIONS),
    where('eleveId', '==', eleveId),
    where('groupeId', '==', groupeId),
    limit(1)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Construit une map { eleveId → inscriptionId } pour un groupe,
 * utilisée pour marquer dejaInscrit dans les résultats de recherche.
 *
 * ⚠️  Fail-safe : en cas d'erreur Firestore (index manquant, règle en transit),
 * retourne une Map vide pour ne pas bloquer la recherche.
 * La vérification du doublon reste assurée côté inscrireEleveDirect().
 */
async function getInscritsMap(
  groupeId: string
): Promise<Map<string, string>> {
  try {
    const q = query(
      collection(db, COL_INSCRIPTIONS),
      where('groupeId', '==', groupeId)
    );
    const snap = await getDocs(q);
    const map = new Map<string, string>();
    snap.docs.forEach(d => {
      map.set(d.data().eleveId as string, d.id);
    });
    return map;
  } catch (err) {
    // Ne pas bloquer la recherche si la lecture des inscriptions échoue.
    // L'anti-doublon reste garanti par verifierDejaInscrit() dans inscrireEleveDirect().
    console.warn('[inscriptionDirecteService] getInscritsMap non bloquant :', err);
    return new Map();
  }
}

/**
 * Transforme un document Firestore users en EleveResultat.
 */
function buildEleveResultat(
  uid: string,
  data: Record<string, unknown>,
  inscritsMap: Map<string, string>
): EleveResultat {
  const inscriptionId = inscritsMap.get(uid);
  return {
    uid,
    displayName: (data.displayName as string) || (data.email as string) || uid,
    email:       (data.email as string) || '',
    classe:      data.classe as string | undefined,
    photoURL:    data.photoURL as string | undefined,
    dejaInscrit: inscritsMap.has(uid),
    inscriptionId,
  };
}

// ══════════════════════════════════════════════════════════════════════
// PHASE 34 — INSCRIPTION D'UN ÉLÈVE SANS COMPTE PEDACLIC (OFFLINE)
//
// Cas d'usage : le prof souhaite suivre absences et notes d'un élève
// qui n'est pas (encore) inscrit sur la plateforme — par exemple un
// élève arrivé en cours d'année, ou sans connexion internet à domicile.
// On crée une inscription "virtuelle" avec un id eleve synthétique
// (préfixé "offline:") et aucun document `users/{uid}` associé.
// ══════════════════════════════════════════════════════════════════════

/** Génère un id élève offline stable (préfixe + timestamp) */
function genererEleveIdOffline(): string {
  // Préfixe clair pour distinguer des uid Firebase (28 caractères alphanum)
  return `offline:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Inscrit un élève "offline" (sans compte PedaClic) dans un groupe.
 * Cet élève pourra être pointé dans les listes d'absences et
 * recevoir des notes, mais ne verra rien côté élève tant qu'il n'aura
 * pas créé de compte. Une fois le compte créé, le prof pourra
 * réinscrire l'élève avec inscrireEleveDirect() pour relier les deux.
 *
 * 🆕 Le sexe est OPTIONNEL ici car l'élève n'a pas de compte ; on
 *    le saisit donc directement sur l'inscription pour alimenter les
 *    statistiques genrées du groupe (cf. carte « Répartition F/M »).
 *
 * @param groupeId   ID du groupe cible
 * @param nom        Nom complet de l'élève (obligatoire)
 * @param profId     UID du prof qui effectue l'inscription
 * @param remarque   Note libre optionnelle (tuteur, téléphone…)
 * @param sexe       Sexe de l'élève ('M' | 'F' | 'autre') — optionnel
 * @param sexeAutre  Précision libre quand sexe === 'autre' — optionnel
 * @returns          ID du document inscriptions_groupe créé
 */
export async function inscrireEleveOffline(
  groupeId: string,
  nom: string,
  profId: string,
  remarque?: string,
  sexe?: SexeEleve,
  sexeAutre?: string,
): Promise<string> {
  const nomPropre = nom.trim();
  if (nomPropre.length < 2) {
    throw new Error('Le nom de l\'élève doit contenir au moins 2 caractères.');
  }

  // Pas de vérification de doublon stricte (un prof peut avoir 2 "Diop"),
  // mais on garde la trace de la saisie dans `remarque` pour désambiguïser.
  const eleveId = genererEleveIdOffline();

  const inscriptionData: Omit<InscriptionGroupe, 'id'> = {
    groupeId,
    eleveId,
    eleveNom:          nomPropre,
    eleveEmail:        '', // pas d'email puisque pas de compte
    // Sexe écrit uniquement s'il est valide (Firestore refuse undefined).
    ...(sexe === 'M' || sexe === 'F' || sexe === 'autre' ? { eleveSexe: sexe } : {}),
    ...(sexe === 'autre' && sexeAutre && sexeAutre.trim()
      ? { eleveSexeAutre: sexeAutre.trim() }
      : {}),
    profId,
    dateInscription:   Timestamp.now(),
    statut:            'actif',
    sourceInscription: 'offline',
    isOffline:         true,
    ...(remarque && remarque.trim() ? { remarque: remarque.trim() } : {}),
  };

  const ref = await addDoc(collection(db, COL_INSCRIPTIONS), inscriptionData);

  // Incrémenter le compteur de membres du groupe
  await updateDoc(doc(db, COL_GROUPES, groupeId), {
    nombreInscrits: increment(1),
  });

  return ref.id;
}

/**
 * 🆕 Met à jour le SEXE d'une inscription (édition a posteriori).
 *
 *   - Pour une inscription 'offline' (pas de compte) : le sexe est
 *     stocké uniquement sur l'inscription, donc on met à jour ce doc.
 *   - Pour une inscription 'direct' / 'code' (élève avec compte) : on
 *     met à jour la dénormalisation locale ; le profil global
 *     (`users/{uid}.sexe`) reste sous le contrôle de l'élève.
 *
 *   Passer `sexe = null` retire le champ (cas rare : correction d'erreur).
 */
export async function mettreAJourSexeInscription(
  inscriptionId: string,
  sexe: SexeEleve | null,
  sexeAutre?: string | null,
): Promise<void> {
  // Firestore n'accepte pas `undefined` : on utilise `null` pour
  // matérialiser la suppression d'un champ existant. Les lectures côté
  // UI traitent `null` comme « non renseigné ».
  const payload: Record<string, unknown> = {
    eleveSexe: sexe ?? null,
    eleveSexeAutre:
      sexe === 'autre' && sexeAutre && sexeAutre.trim() ? sexeAutre.trim() : null,
  };
  await updateDoc(doc(db, COL_INSCRIPTIONS, inscriptionId), payload);
}

/**
 * Met à jour le nom ou la remarque d'un élève offline.
 * Utile si le prof corrige une faute de frappe après coup.
 */
export async function modifierInscriptionOffline(
  inscriptionId: string,
  modifs: { eleveNom?: string; remarque?: string }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (modifs.eleveNom && modifs.eleveNom.trim()) payload.eleveNom = modifs.eleveNom.trim();
  if (modifs.remarque !== undefined) payload.remarque = modifs.remarque.trim();
  if (Object.keys(payload).length === 0) return;
  await updateDoc(doc(db, COL_INSCRIPTIONS, inscriptionId), payload);
}

/**
 * Met à jour le nom affiché d'un élève dans une inscription,
 * qu'elle soit « offline », « code » ou « direct ».
 *
 * ⚠️ On met à jour UNIQUEMENT le document `inscriptions_groupe` : cela
 * corrige l'affichage côté prof (listes, feuille de notes, exports) sans
 * toucher au document `users/{uid}` (qui appartient à l'élève).
 *
 * Cette opération est strictement locale au groupe et n'affecte ni les
 * autres inscriptions de l'élève dans d'autres groupes, ni son profil
 * global. La remarque peut également être corrigée si fournie.
 *
 * @param inscriptionId ID du document `inscriptions_groupe`
 * @param modifs        Champs à mettre à jour (eleveNom / remarque)
 */
export async function modifierInscription(
  inscriptionId: string,
  modifs: { eleveNom?: string; remarque?: string }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (typeof modifs.eleveNom === 'string' && modifs.eleveNom.trim().length >= 2) {
    payload.eleveNom = modifs.eleveNom.trim();
  }
  if (modifs.remarque !== undefined) {
    payload.remarque = modifs.remarque.trim();
  }
  if (Object.keys(payload).length === 0) {
    throw new Error('Aucune donnée à mettre à jour (nom trop court ou vide).');
  }
  await updateDoc(doc(db, COL_INSCRIPTIONS, inscriptionId), payload);
}

// ══════════════════════════════════════════════════════════════════════
// PHASE 36 — INSCRIPTION EN LOT (BULK)
//
// Objectif : permettre au prof de saisir plusieurs élèves en une seule
// opération (copier-coller depuis une feuille d'élèves, par exemple) au
// lieu d'une inscription unitaire chronophage.
//
// Format d'entrée : tableau de lignes brutes (1 élève par ligne).
// Chaque ligne peut être :
//   - "Nom Prénom"                              → inscription OFFLINE
//   - "email@domaine"                           → tentative DIRECTE si compte existant
//   - "Nom Prénom ; email@domaine"              → idem, avec nom de secours
//   - "Nom Prénom ; email@domaine ; remarque"   → remarque utilisée si offline
//
// Séparateurs autorisés entre champs : ";" ou "," ou tabulation.
// Résultat : une entrée par ligne indiquant le statut (success / error /
// skipped), la source utilisée (direct / offline), et un message lisible.
// ══════════════════════════════════════════════════════════════════════

/** Statut d'une ligne traitée lors d'un import bulk. */
export type InscriptionBulkStatut = 'success' | 'error' | 'skipped';

/** Résultat détaillé pour une ligne saisie. */
export interface InscriptionBulkResultat {
  /** Numéro de ligne (1-indexed) dans la saisie d'origine */
  ligne: number;
  /** Contenu brut de la ligne (tel que saisi) */
  contenuBrut: string;
  /** Statut final du traitement */
  statut: InscriptionBulkStatut;
  /** Source effective d'inscription quand statut = success */
  source?: 'direct' | 'offline';
  /** Nom final retenu (utile pour l'affichage du rapport) */
  nom?: string;
  /** Email détecté (si présent dans la ligne) */
  email?: string;
  /** Message lisible (erreur, ou info « Ajouté sans compte » etc.) */
  message: string;
}

/**
 * Parse une ligne brute en champs structurés.
 * Tolère ";", ",", et "\t" comme séparateurs ; trim tout.
 *
 * Heuristiques :
 *   - Email   : tout champ contenant "@" est traité comme email.
 *   - Sexe    : tout champ qui est exactement "M" / "F" / "Masculin" /
 *               "Féminin" / "Garcon" / "Garçon" / "Fille" (insensible à
 *               la casse) est interprété comme sexe.
 *   - Nom     : premier champ non-email + non-sexe.
 *   - Remarque: champs restants concaténés.
 *
 * Cette détection permet aux profs d'importer une liste avec une colonne
 * sexe sans devoir respecter un ordre figé : « Diop Awa ; F ; awa@... »
 * fonctionne aussi bien que « Diop Awa ; awa@... ; F ».
 */
function parseLigneBulk(ligne: string): {
  nom: string;
  email: string;
  remarque: string;
  sexe?: SexeEleve;
} | null {
  const brut = ligne.trim();
  if (!brut) return null;
  // Split flexible : ; ou , ou tab
  const parties = brut.split(/[;,\t]/).map((s) => s.trim()).filter(Boolean);
  if (parties.length === 0) return null;

  // Helper : tente d'interpréter un champ comme sexe.
  //   Renvoie 'M' / 'F' / null. On accepte plusieurs synonymes français
  //   pour rester tolérant à la diversité des fichiers source.
  const detecterSexe = (champ: string): SexeEleve | null => {
    const c = champ.trim().toLowerCase();
    if (c === 'm' || c === 'masculin' || c === 'garcon' || c === 'garçon') return 'M';
    if (c === 'f' || c === 'féminin' || c === 'feminin' || c === 'fille') return 'F';
    return null;
  };

  let email = '';
  let sexe: SexeEleve | undefined;
  const nonClassifies: string[] = [];
  for (const p of parties) {
    if (p.includes('@') && !email) {
      email = p.toLowerCase();
      continue;
    }
    if (!sexe) {
      const s = detecterSexe(p);
      if (s) {
        sexe = s;
        continue;
      }
    }
    nonClassifies.push(p);
  }
  const nom = nonClassifies[0] ?? '';
  const remarque = nonClassifies.slice(1).join(' ').trim();
  return { nom, email, remarque, sexe };
}

/**
 * Inscrit en lot plusieurs élèves dans un groupe.
 *
 * Politique :
 *   - Si email renseigné et compte PedaClic trouvé avec ce mail (rôle "eleve")
 *       → inscrireEleveDirect
 *   - Sinon, si nom renseigné
 *       → inscrireEleveOffline (remarque optionnelle, email stocké dans remarque si fourni)
 *   - Sinon → ligne ignorée (statut "skipped" : vide ou inparsable)
 *
 * Le traitement est séquentiel (rythme raisonnable pour 10-100 lignes) :
 *   plus simple à déboguer, et évite les races sur `nombreInscrits`.
 */
export async function inscrireElevesEnLot(
  groupeId: string,
  profId: string,
  lignes: string[]
): Promise<InscriptionBulkResultat[]> {
  const resultats: InscriptionBulkResultat[] = [];

  for (let i = 0; i < lignes.length; i++) {
    const numeroLigne = i + 1;
    const contenuBrut = lignes[i];
    const parsed = parseLigneBulk(contenuBrut);

    // Ligne vide / non parsable
    if (!parsed) {
      resultats.push({
        ligne: numeroLigne,
        contenuBrut,
        statut: 'skipped',
        message: 'Ligne vide ou illisible — ignorée.',
      });
      continue;
    }

    const { nom, email, remarque, sexe } = parsed;

    // ── Cas 1 : email fourni → on tente l'inscription directe ───
    if (email) {
      try {
        const candidats = await rechercherEleves(email, groupeId);
        const match = candidats.find((c) => c.email.toLowerCase() === email);
        if (match) {
          if (match.dejaInscrit) {
            resultats.push({
              ligne: numeroLigne,
              contenuBrut,
              statut: 'skipped',
              source: 'direct',
              email,
              nom: match.displayName,
              message: `Déjà inscrit : ${match.displayName}`,
            });
            continue;
          }
          // Inscription directe via compte PedaClic existant
          await inscrireEleveDirect(
            groupeId,
            { uid: match.uid, displayName: match.displayName, email: match.email },
            profId
          );
          resultats.push({
            ligne: numeroLigne,
            contenuBrut,
            statut: 'success',
            source: 'direct',
            email,
            nom: match.displayName,
            message: `✓ Inscrit avec son compte PedaClic (${match.displayName}).`,
          });
          continue;
        }
        // Pas de compte trouvé → on bascule sur offline si on a un nom
        if (!nom) {
          resultats.push({
            ligne: numeroLigne,
            contenuBrut,
            statut: 'error',
            email,
            message: "Aucun compte PedaClic ne correspond à cet email, et aucun nom n'a été fourni.",
          });
          continue;
        }
        // Nom disponible : on tombe dans le flux offline ci-dessous (avec email en remarque)
      } catch (err) {
        // Les erreurs réseau / Firestore passent en "error" sans bloquer
        // le reste du batch.
        const msg = err instanceof Error ? err.message : String(err);
        resultats.push({
          ligne: numeroLigne,
          contenuBrut,
          statut: 'error',
          email,
          nom,
          message: `Erreur pendant la recherche de compte : ${msg}`,
        });
        continue;
      }
    }

    // ── Cas 2 : pas d'email exploitable, on crée une inscription offline ──
    if (!nom || nom.length < 2) {
      resultats.push({
        ligne: numeroLigne,
        contenuBrut,
        statut: 'error',
        message: 'Aucun nom valide (au moins 2 caractères) détecté sur la ligne.',
      });
      continue;
    }

    try {
      // Si un email était fourni mais introuvable en base, on le glisse
      // dans la remarque pour qu'il ne soit pas perdu.
      const remarqueFinale = [remarque, email ? `email: ${email}` : '']
        .filter(Boolean)
        .join(' — ');
      // 🆕 On transmet le sexe (s'il a été détecté dans la ligne) à
      //    `inscrireEleveOffline` qui le persistera sur l'inscription.
      await inscrireEleveOffline(groupeId, nom, profId, remarqueFinale || undefined, sexe);
      resultats.push({
        ligne: numeroLigne,
        contenuBrut,
        statut: 'success',
        source: 'offline',
        nom,
        email: email || undefined,
        message:
          (email
            ? `✓ Ajouté sans compte (email "${email}" consigné en remarque)`
            : '✓ Ajouté sans compte PedaClic') +
          (sexe ? ` — sexe : ${sexe === 'M' ? 'Masculin' : sexe === 'F' ? 'Féminin' : 'Autre'}.` : '.'),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      resultats.push({
        ligne: numeroLigne,
        contenuBrut,
        statut: 'error',
        nom,
        email: email || undefined,
        message: `Erreur lors de l'inscription : ${msg}`,
      });
    }
  }

  return resultats;
}

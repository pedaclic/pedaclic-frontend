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

/** Données d'une inscription (document inscriptions_groupe) */
export interface InscriptionGroupe {
  id: string;
  groupeId: string;
  eleveId: string;
  eleveNom: string;
  eleveEmail: string;
  profId: string;         // prof qui a effectué l'inscription
  dateInscription: Timestamp;
  statut: 'actif' | 'suspendu';
  sourceInscription: 'code' | 'direct'; // 'direct' = inscrit par le prof
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

  // ── 3. Créer le document d'inscription ───────────────────────
  const inscriptionData: Omit<InscriptionGroupe, 'id'> = {
    groupeId,
    eleveId:          eleve.uid,
    eleveNom:         eleve.displayName,
    eleveEmail:       eleve.email,
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

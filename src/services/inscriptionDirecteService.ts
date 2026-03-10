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
import { db } from '../firebase';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** Profil allégé d'un élève retourné par la recherche */
export interface EleveResultat {
  uid: string;
  displayName: string;
  email: string;
  classe?: string;
  photoURL?: string;
  dejaInscrit: boolean;
  inscriptionId?: string;
}

/** Données d'une inscription (document inscriptions_groupe) */
export interface InscriptionGroupe {
  id: string;
  groupeId: string;
  eleveId: string;
  eleveNom: string;
  eleveEmail: string;
  profId: string;
  dateInscription: Timestamp;
  statut: 'actif' | 'suspendu';
  sourceInscription: 'code' | 'direct';
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const COL_USERS = 'users';
const COL_GROUPES = 'groupes_prof';
const COL_INSCRIPTIONS = 'inscriptions_groupe';
const SEARCH_LIMIT = 10;

// ─────────────────────────────────────────────────────────────
// RECHERCHE D'ÉLÈVES
// ─────────────────────────────────────────────────────────────

export async function rechercherEleves(
  recherche: string,
  groupeId: string
): Promise<EleveResultat[]> {
  const terme = recherche.trim();
  if (terme.length < 2) return [];

  const inscritsMap = await getInscritsMap(groupeId);
  const isEmail = terme.includes('@');
  let results: EleveResultat[] = [];

  if (isEmail) {
    const q = query(
      collection(db, COL_USERS),
      where('role', '==', 'eleve'),
      where('email', '==', terme.toLowerCase()),
      limit(SEARCH_LIMIT)
    );
    const snap = await getDocs(q);
    results = snap.docs.map(d => buildEleveResultat(d.id, d.data(), inscritsMap));
  } else {
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

export async function inscrireEleveDirect(
  groupeId: string,
  eleve: Pick<EleveResultat, 'uid' | 'displayName' | 'email'>,
  profId: string
): Promise<string> {
  const dejaInscrit = await verifierDejaInscrit(eleve.uid, groupeId);
  if (dejaInscrit) {
    throw new Error(`${eleve.displayName} est déjà inscrit dans ce groupe.`);
  }

  const eleveSnap = await getDoc(doc(db, COL_USERS, eleve.uid));
  if (!eleveSnap.exists() || eleveSnap.data()?.role !== 'eleve') {
    throw new Error('Compte élève introuvable ou invalide.');
  }

  const inscriptionData = {
    groupeId,
    eleveId: eleve.uid,
    eleveNom: eleve.displayName,
    eleveEmail: eleve.email,
    profId,
    dateInscription: Timestamp.now(),
    statut: 'actif' as const,
    sourceInscription: 'direct' as const,
  };

  const ref = await addDoc(collection(db, COL_INSCRIPTIONS), inscriptionData);

  await updateDoc(doc(db, COL_GROUPES, groupeId), {
    nombreInscrits: increment(1),
  });

  return ref.id;
}

// ─────────────────────────────────────────────────────────────
// DÉSINSCRIPTION
// ─────────────────────────────────────────────────────────────

export async function desinscrireEleve(
  inscriptionId: string,
  groupeId: string
): Promise<void> {
  await deleteDoc(doc(db, COL_INSCRIPTIONS, inscriptionId));

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
// LISTE DES INSCRIPTIONS
// ─────────────────────────────────────────────────────────────

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
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InscriptionGroupe));
}

export async function getAllInscriptionsGroupe(
  groupeId: string
): Promise<InscriptionGroupe[]> {
  const q = query(
    collection(db, COL_INSCRIPTIONS),
    where('groupeId', '==', groupeId),
    orderBy('dateInscription', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as InscriptionGroupe));
}

// ─────────────────────────────────────────────────────────────
// SUSPENSION / RÉACTIVATION
// ─────────────────────────────────────────────────────────────

export async function toggleStatutInscription(
  inscriptionId: string,
  nouveauStatut: 'actif' | 'suspendu'
): Promise<void> {
  await updateDoc(doc(db, COL_INSCRIPTIONS, inscriptionId), {
    statut: nouveauStatut,
  });
}

// ─────────────────────────────────────────────────────────────
// UTILITAIRES INTERNES
// ─────────────────────────────────────────────────────────────

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

async function getInscritsMap(
  groupeId: string
): Promise<Map<string, string>> {
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
}

function buildEleveResultat(
  uid: string,
  data: Record<string, unknown>,
  inscritsMap: Map<string, string>
): EleveResultat {
  const inscriptionId = inscritsMap.get(uid);
  return {
    uid,
    displayName: (data.displayName as string) || (data.email as string) || uid,
    email: (data.email as string) || '',
    classe: data.classe as string | undefined,
    photoURL: data.photoURL as string | undefined,
    dejaInscrit: inscritsMap.has(uid),
    inscriptionId,
  };
}

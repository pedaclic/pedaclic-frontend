// ============================================================
// PedaClic — Phase 57 : adminUsersService.ts
// ------------------------------------------------------------
// Services réservés à l'ADMIN pour la page « Gestion des utilisateurs » :
//
//   1. getInscriptionsPourAdmin()
//        Lit TOUTES les inscriptions de classe (inscriptions_groupe) et les
//        groupes (groupes_prof) pour :
//          - rattacher à chaque compte la/les classe(s) où il est inscrit
//            (avec la date d'inscription) → historique ;
//          - remonter les élèves « sans compte » (inscriptions offline faites
//            par un prof), jusqu'ici INVISIBLES côté admin car absents de la
//            collection `users`.
//
//   2. creerCompteUtilisateur()
//        Création d'un compte (Auth + document users/{uid}) par l'admin, SANS
//        déconnecter l'admin : on passe par une instance Firebase SECONDAIRE
//        à persistance mémoire. Inscription optionnelle dans une classe.
//
//   3. supprimerCompteUtilisateur()
//        Suppression d'un compte : désinscription de toutes ses classes,
//        suppression du document users/{uid} et pose d'une « pierre tombale »
//        comptes_supprimes/{uid} qui empêche la recréation automatique du
//        profil à la prochaine connexion (cf. AuthContext).
//        ⚠️ Le compte Firebase Auth lui-même ne peut être supprimé que via le
//        SDK Admin (backend) ou la console Firebase.
//
//   4. supprimerEleveSansCompte()
//        Retire un élève offline de sa classe (réutilise desinscrireEleve).
//
// Placement : src/services/adminUsersService.ts
// www.pedaclic.sn
// ============================================================

import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import {
  inscrireEleveDirect,
  desinscrireEleve,
  type SexeEleve,
} from './inscriptionDirecteService';

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

const COL_USERS            = 'users';
const COL_GROUPES          = 'groupes_prof';
const COL_INSCRIPTIONS     = 'inscriptions_groupe';
/** Collection « pierres tombales » des comptes supprimés par l'admin. */
export const COL_COMPTES_SUPPRIMES = 'comptes_supprimes';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** Une inscription de classe, enrichie du nom du groupe (pour l'historique). */
export interface ClasseInscription {
  inscriptionId: string;
  groupeId: string;
  /** Nom lisible du groupe (ex. « 2nde S-B — Français ») */
  groupeNom: string;
  /** Niveau / classe du groupe si renseigné (ex. « 2nde ») */
  classeNiveau?: string;
  /** Nom du professeur propriétaire du groupe (si dénormalisé) */
  profNom?: string;
  /** Date d'inscription dans la classe (null si absente) */
  dateInscription: Date | null;
  statut: 'actif' | 'suspendu' | string;
  source: 'code' | 'direct' | 'offline' | string;
}

/** Élève inscrit par un prof SANS compte PedaClic (inscription offline). */
export interface EleveSansCompte extends ClasseInscription {
  /** Identifiant technique « offline:xxxx » */
  eleveId: string;
  eleveNom: string;
  /** Email éventuellement consigné par le prof (champ ou remarque) */
  eleveEmail: string;
  eleveSexe?: SexeEleve;
  remarque?: string;
}

/** Résultat agrégé consommé par UserManager. */
export interface InscriptionsAdmin {
  /** eleveId (uid) → classes où le COMPTE est inscrit */
  classesParCompte: Map<string, ClasseInscription[]>;
  /** Élèves sans compte (une ligne par inscription offline) */
  elevesSansCompte: EleveSansCompte[];
  /** Liste des groupes (pour le formulaire de création / le filtre) */
  groupes: { id: string; nom: string; classeNiveau?: string; profNom?: string }[];
}

/** Données du formulaire « Inscrire un utilisateur ». */
export interface NouveauCompteData {
  displayName: string;
  email: string;
  /** Mot de passe provisoire (≥ 6 caractères) à communiquer à l'utilisateur */
  motDePasse: string;
  role: 'eleve' | 'prof' | 'admin' | 'parent';
  sexe?: SexeEleve;
  /** Groupe (classe) dans lequel inscrire directement l'élève — optionnel */
  groupeId?: string;
}

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/** Convertit Timestamp / Date / string / number en Date (ou null). */
function versDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate();
  }
  const d = new Date(v as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/** Extrait un email consigné dans la remarque (« email: x@y.z »). */
function emailDepuisRemarque(remarque?: string): string {
  if (!remarque) return '';
  const m = remarque.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0].toLowerCase() : '';
}

/** Traduit les codes d'erreur Firebase Auth les plus courants. */
function messageErreurAuth(code?: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Cette adresse email est déjà utilisée par un compte PedaClic.';
    case 'auth/invalid-email':
      return 'Adresse email invalide.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/network-request-failed':
      return 'Erreur réseau. Vérifiez la connexion internet.';
    case 'auth/operation-not-allowed':
      return "La création de comptes email/mot de passe n'est pas activée dans Firebase.";
    default:
      return 'Impossible de créer le compte. Veuillez réessayer.';
  }
}

// ─────────────────────────────────────────────────────────────
// 1. INSCRIPTIONS DE CLASSE (comptes + élèves sans compte)
// ─────────────────────────────────────────────────────────────

/**
 * Charge toutes les inscriptions de classe et les groupes.
 * Fail-safe : en cas d'erreur (droits, réseau), renvoie des structures
 * vides pour ne jamais bloquer l'affichage de la liste des comptes.
 */
export async function getInscriptionsPourAdmin(): Promise<InscriptionsAdmin> {
  const vide: InscriptionsAdmin = {
    classesParCompte: new Map(),
    elevesSansCompte: [],
    groupes: [],
  };

  try {
    const [snapGroupes, snapInscriptions] = await Promise.all([
      getDocs(collection(db, COL_GROUPES)),
      getDocs(collection(db, COL_INSCRIPTIONS)),
    ]);

    // ── Index des groupes : id → infos lisibles ──
    const groupes = snapGroupes.docs.map((d) => {
      const g = d.data();
      return {
        id: d.id,
        nom: (g.nom as string) || (g.classe as string) || 'Classe sans nom',
        classeNiveau: (g.classeNiveau as string) || (g.classe as string) || undefined,
        profNom: (g.profNom as string) || undefined,
      };
    });
    const groupesParId = new Map(groupes.map((g) => [g.id, g]));

    const classesParCompte = new Map<string, ClasseInscription[]>();
    const elevesSansCompte: EleveSansCompte[] = [];

    snapInscriptions.docs.forEach((d) => {
      const ins = d.data();
      const eleveId = ins.eleveId as string | undefined;
      if (!eleveId) return;

      const groupe = groupesParId.get(ins.groupeId as string);
      const classe: ClasseInscription = {
        inscriptionId: d.id,
        groupeId: ins.groupeId as string,
        groupeNom: groupe?.nom ?? 'Classe supprimée',
        classeNiveau: groupe?.classeNiveau,
        profNom: groupe?.profNom,
        dateInscription: versDate(ins.dateInscription),
        statut: (ins.statut as string) || 'actif',
        source: (ins.sourceInscription as string) || 'code',
      };

      const estOffline =
        ins.sourceInscription === 'offline' ||
        ins.isOffline === true ||
        eleveId.startsWith('offline:');

      if (estOffline) {
        // Élève sans compte : une ligne dédiée dans la liste admin
        elevesSansCompte.push({
          ...classe,
          eleveId,
          eleveNom: (ins.eleveNom as string) || 'Élève sans nom',
          eleveEmail:
            ((ins.eleveEmail as string) || '').toLowerCase() ||
            emailDepuisRemarque(ins.remarque as string | undefined),
          eleveSexe: ins.eleveSexe as SexeEleve | undefined,
          remarque: (ins.remarque as string) || undefined,
        });
      } else {
        // Compte PedaClic : on rattache la classe à son uid
        const liste = classesParCompte.get(eleveId) ?? [];
        liste.push(classe);
        classesParCompte.set(eleveId, liste);
      }
    });

    // Historique chronologique (plus récente d'abord) pour chaque compte
    classesParCompte.forEach((liste) =>
      liste.sort(
        (a, b) => (b.dateInscription?.getTime() ?? 0) - (a.dateInscription?.getTime() ?? 0)
      )
    );

    return { classesParCompte, elevesSansCompte, groupes };
  } catch (error) {
    console.error('[adminUsersService] Lecture des inscriptions impossible :', error);
    return vide;
  }
}

// ─────────────────────────────────────────────────────────────
// 2. CRÉATION D'UN COMPTE PAR L'ADMIN
// ─────────────────────────────────────────────────────────────

/**
 * Crée un compte PedaClic (Firebase Auth + users/{uid}) sans toucher à la
 * session de l'admin, puis l'inscrit éventuellement dans une classe.
 *
 * @param data   Données du formulaire
 * @param adminUid  UID de l'admin connecté (traçabilité + inscription classe)
 * @returns      UID du compte créé
 */
export async function creerCompteUtilisateur(
  data: NouveauCompteData,
  adminUid: string
): Promise<string> {
  // ── Validations ──
  const displayName = data.displayName.trim();
  const email = data.email.trim().toLowerCase();
  if (displayName.length < 2) throw new Error('Le nom doit contenir au moins 2 caractères.');
  if (!email.includes('@')) throw new Error('Adresse email invalide.');
  if (data.motDePasse.length < 6) {
    throw new Error('Le mot de passe provisoire doit contenir au moins 6 caractères.');
  }

  // ── Instance Firebase secondaire, nom unique, persistance mémoire ──
  //    → la session de l'admin (instance principale) n'est jamais remplacée.
  let appSecondaire: FirebaseApp | null = null;
  let uid = '';

  try {
    appSecondaire = initializeApp(firebaseConfig, `pedaclic-admin-creation-${Date.now()}`);

    // App Check sur l'instance secondaire (si activé en production)
    const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (recaptchaKey) {
      try {
        initializeAppCheck(appSecondaire, {
          provider: new ReCaptchaV3Provider(recaptchaKey),
          isTokenAutoRefreshEnabled: false,
        });
      } catch (e) {
        console.warn('[adminUsersService] App Check secondaire non initialisé :', e);
      }
    }

    const authSecondaire = initializeAuth(appSecondaire, { persistence: inMemoryPersistence });

    try {
      const cred = await createUserWithEmailAndPassword(authSecondaire, email, data.motDePasse);
      uid = cred.user.uid;
      await updateProfile(cred.user, { displayName });
    } catch (err: unknown) {
      throw new Error(messageErreurAuth((err as { code?: string })?.code));
    } finally {
      // On ferme immédiatement la session du nouvel utilisateur
      await signOut(authSecondaire).catch(() => undefined);
    }
  } finally {
    if (appSecondaire) await deleteApp(appSecondaire).catch(() => undefined);
  }

  // ── Document Firestore users/{uid} (écrit par l'ADMIN, instance principale) ──
  //    Même structure que AuthContext.createOrUpdateUserDoc.
  const userData: Record<string, unknown> = {
    email,
    displayName,
    role: data.role,
    isPremium: false,
    isActive: true,
    photoURL: null,
    createdAt: serverTimestamp(),
    createdBy: adminUid,          // traçabilité : compte créé par l'admin
    sourceCreation: 'admin',
  };
  if (data.sexe === 'M' || data.sexe === 'F' || data.sexe === 'autre') {
    userData.sexe = data.sexe;
  }
  await setDoc(doc(db, COL_USERS, uid), userData);

  // ── Inscription optionnelle dans une classe (élèves uniquement) ──
  if (data.role === 'eleve' && data.groupeId) {
    await inscrireEleveDirect(data.groupeId, { uid, displayName, email }, adminUid);
  }

  return uid;
}

// ─────────────────────────────────────────────────────────────
// 3. SUPPRESSION D'UN COMPTE PAR L'ADMIN
// ─────────────────────────────────────────────────────────────

/**
 * Supprime un compte : désinscriptions, profil Firestore, pierre tombale.
 * Les résultats de quiz et les notes déjà saisies sont CONSERVÉS
 * (historique pédagogique des professeurs).
 *
 * @param uid       UID du compte à supprimer
 * @param email     Email du compte (mémorisé dans la pierre tombale)
 * @param adminUid  UID de l'admin qui supprime
 * @returns         Nombre d'inscriptions de classe retirées
 */
export async function supprimerCompteUtilisateur(
  uid: string,
  email: string,
  adminUid: string
): Promise<number> {
  if (uid === adminUid) {
    throw new Error('Vous ne pouvez pas supprimer votre propre compte administrateur.');
  }

  // 1. Pierre tombale EN PREMIER : si une étape suivante échoue, le compte
  //    est malgré tout bloqué à la reconnexion.
  await setDoc(doc(db, COL_COMPTES_SUPPRIMES, uid), {
    email: (email || '').toLowerCase(),
    deletedAt: serverTimestamp(),
    deletedBy: adminUid,
  });

  // 2. Désinscription de toutes les classes (décrémente les compteurs)
  const snap = await getDocs(
    query(collection(db, COL_INSCRIPTIONS), where('eleveId', '==', uid))
  );
  for (const d of snap.docs) {
    await desinscrireEleve(d.id, d.data().groupeId as string);
  }

  // 3. Suppression du profil
  await deleteDoc(doc(db, COL_USERS, uid));

  return snap.size;
}

// ─────────────────────────────────────────────────────────────
// 4. SUPPRESSION D'UN ÉLÈVE SANS COMPTE
// ─────────────────────────────────────────────────────────────

/** Retire un élève offline de sa classe (suppression de l'inscription). */
export async function supprimerEleveSansCompte(
  inscriptionId: string,
  groupeId: string
): Promise<void> {
  await desinscrireEleve(inscriptionId, groupeId);
}

/**
 * ==================== SERVICE ESPACE PARENTS (Phase 10) ====================
 * 
 * Service Firestore pour la gestion de l'espace parents.
 * Gère les liaisons parent ↔ enfant, la récupération du suivi,
 * les alertes parentales et les résumés hebdomadaires.
 * 
 * Fichier : src/services/parentService.ts
 * Dépendances : 
 *   - ../firebase (db, auth)
 *   - ./suiviService (getSuiviComplet, genererAlertes, etc.)
 *   - ../types/parent (toutes les interfaces parent)
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  getSuiviComplet,
  getResultatsEleve,
  genererAlertes,
  getCouleurUrgence,
  getLabelUrgence
} from './suiviService';

// ==================== IMPORTS TYPES ====================

import type {
  LienParentEnfant,
  AlerteParent,
  TypeAlerteParent,
  NiveauAlerteParent,
  QuizResultResume,
  EvolutionDiscipline,
  ResumeHebdomadaire,
  DashboardParentData,
  CodeInvitation
} from '../types/parent';

// ==================== CONSTANTES ====================

/** Préfixe des codes d'invitation parent */
const CODE_PREFIX = 'PEDA';

/** Longueur d'un segment du code (ex: XXXX) */
const CODE_SEGMENT_LENGTH = 4;

/** Nombre de jours d'inactivité avant alerte parent */
const JOURS_INACTIVITE_ALERTE_PARENT = 5;

/** Score global en-dessous duquel alerter le parent */
const SEUIL_SCORE_BAS = 40;

/** Nombre maximum de quiz dans le résumé */
const MAX_QUIZ_RESUME = 5;

// ==================== UTILITAIRES ====================

/**
 * Convertit un Timestamp Firestore ou Date en objet Date JavaScript
 * @param timestamp - Timestamp Firestore ou Date
 * @returns Date JavaScript
 */
function toDate(timestamp: Timestamp | Date | any): Date {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (timestamp?.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  return new Date(timestamp);
}

/**
 * Retourne le lundi de la semaine courante
 * @returns Date du lundi à 00:00:00
 */
function getLundiSemaine(date?: Date): Date {
  const ref = date ? new Date(date) : new Date();
  const jour = ref.getDay(); // 0=Dim, 1=Lun, ..., 6=Sam
  const diff = jour === 0 ? -6 : 1 - jour;
  const lundi = new Date(ref);
  lundi.setDate(ref.getDate() + diff);
  lundi.setHours(0, 0, 0, 0);
  return lundi;
}

/**
 * Retourne le dimanche de la semaine courante
 * @returns Date du dimanche à 23:59:59
 */
function getDimancheSemaine(date?: Date): Date {
  const lundi = getLundiSemaine(date);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  dimanche.setHours(23, 59, 59, 999);
  return dimanche;
}

/**
 * Formate une date au format "DD Mois" (ex: "27 Janvier")
 * @param date - Date à formater
 * @returns Chaîne formatée
 */
function formaterDateCourte(date: Date): string {
  const mois = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  return `${date.getDate()} ${mois[date.getMonth()]}`;
}

/**
 * Calcule la différence en jours entre deux dates
 * @param d1 - Première date
 * @param d2 - Deuxième date
 * @returns Nombre de jours (entier positif)
 */
function diffJours(d1: Date, d2: Date): number {
  const msParJour = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / msParJour);
}

// ==================== GESTION DES CODES D'INVITATION ====================

/**
 * Génère un code d'invitation unique au format PEDA-XXXX-XXXX
 * Le code est stocké dans le document utilisateur de l'élève
 * 
 * @param eleveId - UID de l'élève
 * @returns Code d'invitation généré
 */
export async function genererCodeInvitation(eleveId: string): Promise<string> {
  try {
    // ===== Générer un code aléatoire =====
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sans I, O, 0, 1 pour éviter confusion
    let segment1 = '';
    let segment2 = '';

    for (let i = 0; i < CODE_SEGMENT_LENGTH; i++) {
      segment1 += chars.charAt(Math.floor(Math.random() * chars.length));
      segment2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const code = `${CODE_PREFIX}-${segment1}-${segment2}`;

    // ===== Stocker le code dans le profil de l'élève =====
    const eleveRef = doc(db, 'users', eleveId);
    await updateDoc(eleveRef, {
      codeParent: code,
      codeParentGenere: new Date()
    });

    return code;
  } catch (error) {
    console.error('Erreur génération code invitation:', error);
    throw new Error('Impossible de générer le code d\'invitation');
  }
}

/**
 * Récupère le code d'invitation d'un élève.
 * Si aucun code n'existe, en génère un nouveau.
 * 
 * @param eleveId - UID de l'élève
 * @returns Code d'invitation existant ou nouvellement généré
 */
export async function getCodeInvitation(eleveId: string): Promise<string> {
  try {
    const eleveRef = doc(db, 'users', eleveId);
    const eleveSnap = await getDoc(eleveRef);

    if (!eleveSnap.exists()) {
      throw new Error('Élève introuvable');
    }

    const data = eleveSnap.data();

    // Si un code existe déjà, le retourner
    if (data.codeParent) {
      return data.codeParent;
    }

    // Sinon, en générer un nouveau
    return await genererCodeInvitation(eleveId);
  } catch (error) {
    console.error('Erreur récupération code invitation:', error);
    throw new Error('Impossible de récupérer le code d\'invitation');
  }
}

// ==================== LIAISON PARENT ↔ ENFANT ====================

/**
 * Lie un parent à un enfant via le code d'invitation.
 * 
 * Étapes :
 * 1. Recherche l'élève par code d'invitation
 * 2. Vérifie que le lien n'existe pas déjà
 * 3. Crée le document LienParentEnfant
 * 4. Met à jour le champ codeParent utilisé
 * 
 * @param parentId - UID du parent
 * @param codeInvitation - Code saisi par le parent (format PEDA-XXXX-XXXX)
 * @returns Le lien créé
 * @throws Error si code invalide, élève introuvable, ou lien déjà existant
 */
export async function lierEnfant(
  parentId: string,
  codeInvitation: string
): Promise<LienParentEnfant> {
  try {
    // ===== 1. Normaliser le code (majuscules, sans espaces) =====
    const codeNormalise = codeInvitation.trim().toUpperCase();

    // ===== 2. Rechercher l'élève par code =====
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('codeParent', '==', codeNormalise),
      where('role', '==', 'eleve'),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Code d\'invitation invalide. Vérifiez le code et réessayez.');
    }

    const eleveDoc = snapshot.docs[0];
    const eleveData = eleveDoc.data();
    const enfantId = eleveDoc.id;

    // ===== 3. Vérifier que le lien n'existe pas déjà =====
    const liensRef = collection(db, 'liens_parent_enfant');
    const lienExistant = query(
      liensRef,
      where('parentId', '==', parentId),
      where('enfantId', '==', enfantId),
      where('statut', '==', 'actif'),
      limit(1)
    );
    const lienSnap = await getDocs(lienExistant);

    if (!lienSnap.empty) {
      throw new Error('Cet enfant est déjà lié à votre compte.');
    }

    // ===== 4. Créer le document de liaison =====
    const lienData: Omit<LienParentEnfant, 'id'> = {
      parentId,
      enfantId,
      enfantNom: eleveData.displayName || eleveData.email,
      enfantEmail: eleveData.email,
      enfantClasse: eleveData.classe || undefined,
      codeInvitation: codeNormalise,
      statut: 'actif',
      dateCreation: new Date(),
    };

    const docRef = await addDoc(liensRef, lienData);

    return {
      id: docRef.id,
      ...lienData,
    };
  } catch (error: any) {
    console.error('Erreur liaison parent-enfant:', error);
    throw error;
  }
}

/**
 * Récupère la liste des enfants liés à un parent
 * 
 * @param parentId - UID du parent
 * @returns Liste des liens actifs parent ↔ enfant
 */
export async function getEnfantsLies(parentId: string): Promise<LienParentEnfant[]> {
  try {
    const liensRef = collection(db, 'liens_parent_enfant');
    const q = query(
      liensRef,
      where('parentId', '==', parentId),
      where('statut', '==', 'actif'),
      orderBy('dateCreation', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      dateCreation: toDate(doc.data().dateCreation),
      dateDerniereConsultation: doc.data().dateDerniereConsultation
        ? toDate(doc.data().dateDerniereConsultation)
        : undefined,
    })) as LienParentEnfant[];
  } catch (error) {
    console.error('Erreur récupération enfants liés:', error);
    return [];
  }
}

/**
 * Supprime le lien entre un parent et un enfant (révocation)
 * 
 * @param lienId - ID du document de liaison
 * @param parentId - UID du parent (pour vérification de sécurité)
 */
export async function revoquerLien(lienId: string, parentId: string): Promise<void> {
  try {
    const lienRef = doc(db, 'liens_parent_enfant', lienId);
    const lienSnap = await getDoc(lienRef);

    if (!lienSnap.exists()) {
      throw new Error('Lien introuvable');
    }

    // Vérification de sécurité : seul le parent propriétaire peut révoquer
    if (lienSnap.data().parentId !== parentId) {
      throw new Error('Action non autorisée');
    }

    await updateDoc(lienRef, {
      statut: 'revoque',
      dateRevocation: new Date()
    });
  } catch (error: any) {
    console.error('Erreur révocation lien:', error);
    throw error;
  }
}

// ==================== DASHBOARD PARENT ====================

/**
 * Récupère les données complètes du dashboard parent pour un enfant donné.
 * Combine le suivi de l'enfant (Phase 9) avec les alertes et le résumé.
 * 
 * @param parentId - UID du parent
 * @param enfantId - UID de l'enfant
 * @returns Données complètes du dashboard
 */
export async function getDashboardParent(
  parentId: string,
  enfantId: string
): Promise<DashboardParentData> {
  try {
    // ===== 1. Vérifier que le lien parent ↔ enfant est actif =====
    const liensRef = collection(db, 'liens_parent_enfant');
    const lienQuery = query(
      liensRef,
      where('parentId', '==', parentId),
      where('enfantId', '==', enfantId),
      where('statut', '==', 'actif'),
      limit(1)
    );
    const lienSnap = await getDocs(lienQuery);

    if (lienSnap.empty) {
      throw new Error('Vous n\'êtes pas autorisé à consulter le suivi de cet enfant.');
    }

    // ===== 2. Récupérer les infos de l'enfant =====
    const enfantRef = doc(db, 'users', enfantId);
    const enfantSnap = await getDoc(enfantRef);

    if (!enfantSnap.exists()) {
      throw new Error('Profil de l\'enfant introuvable.');
    }

    const enfantData = enfantSnap.data();

    // ===== 3. Récupérer le suivi complet de l'enfant (Phase 9) =====
    const suivi = await getSuiviComplet(enfantId);

    // ===== 4. Récupérer les derniers quiz =====
    const resultats = await getResultatsEleve(enfantId);
    const derniersQuiz: QuizResultResume[] = resultats
      .slice(0, MAX_QUIZ_RESUME)
      .map(r => ({
        quizTitre: r.quizTitre || 'Quiz',
        disciplineNom: r.disciplineNom || 'Discipline',
        pourcentage: r.pourcentage,
        noteSur20: Math.round((r.pourcentage / 100) * 20 * 10) / 10,
        reussi: r.reussi,
        datePassage: toDate(r.datePassage),
      }));

    // ===== 5. Générer les alertes parent =====
    const alertes = await genererAlertesParent(
      parentId,
      enfantId,
      enfantData.displayName || enfantData.email,
      suivi.lacunes,
      suivi.streak,
      suivi.scoreGlobal,
      resultats
    );

    // ===== 6. Construire le résumé hebdomadaire =====
    const resume = construireResumeHebdomadaire(
      enfantId,
      enfantData.displayName || enfantData.email,
      suivi,
      resultats
    );

    // ===== 7. Mettre à jour la date de dernière consultation =====
    const lienDoc = lienSnap.docs[0];
    await updateDoc(doc(db, 'liens_parent_enfant', lienDoc.id), {
      dateDerniereConsultation: new Date()
    });

    // ===== 8. Assembler les données du dashboard =====
    return {
      enfant: {
        id: enfantId,
        nom: enfantData.displayName || enfantData.email,
        email: enfantData.email,
        classe: enfantData.classe || undefined,
        derniereConnexion: enfantData.lastLogin
          ? toDate(enfantData.lastLogin)
          : undefined,
      },
      scoreGlobal: suivi.scoreGlobal,
      streak: {
        actuel: suivi.streak.streakActuel,
        meilleur: suivi.streak.meilleurStreak,
        semaineCourante: suivi.streak.semaineCourante,
      },
      lacunes: suivi.lacunes.map(l => ({
        disciplineNom: l.disciplineNom,
        moyenne: l.moyenne,
        niveauUrgence: l.niveauUrgence,
        tendance: l.tendance,
      })),
      objectifs: suivi.objectifs.map(o => ({
        titre: o.titre,
        progression: o.progression,
        cible: o.cible,
        statut: o.statut,
      })),
      derniersQuiz,
      resume,
      alertes,
    };
  } catch (error: any) {
    console.error('Erreur dashboard parent:', error);
    throw error;
  }
}

// ==================== ALERTES PARENT ====================

/**
 * Génère les alertes destinées au parent pour un enfant donné.
 * Analyse les lacunes, le streak, le score global et l'activité récente.
 * 
 * @param parentId - UID du parent
 * @param enfantId - UID de l'enfant
 * @param enfantNom - Nom de l'enfant
 * @param lacunes - Lacunes détectées (depuis suiviService)
 * @param streak - Données de streak
 * @param scoreGlobal - Score de santé global
 * @param resultats - Résultats de quiz
 * @returns Liste des alertes pour le parent
 */
async function genererAlertesParent(
  parentId: string,
  enfantId: string,
  enfantNom: string,
  lacunes: any[],
  streak: any,
  scoreGlobal: number,
  resultats: any[]
): Promise<AlerteParent[]> {
  const alertes: AlerteParent[] = [];
  const maintenant = new Date();

  // ===== 1. Alertes lacunes critiques =====
  lacunes
    .filter((l: any) => l.niveauUrgence === 'critique')
    .forEach((lacune: any) => {
      alertes.push({
        id: `alerte_parent_lacune_${lacune.id}`,
        parentId,
        enfantId,
        enfantNom,
        type: 'lacune_critique',
        niveau: 'critique',
        titre: `⚠️ Alerte critique en ${lacune.disciplineNom}`,
        message: `${enfantNom} a une moyenne de ${lacune.moyenne}/20 en ${lacune.disciplineNom}. Un suivi rapproché est recommandé.`,
        lue: false,
        dateCreation: maintenant,
      });
    });

  // ===== 2. Alerte inactivité =====
  if (streak.dernierJourActif) {
    const joursInactif = diffJours(toDate(streak.dernierJourActif), maintenant);
    if (joursInactif >= JOURS_INACTIVITE_ALERTE_PARENT) {
      alertes.push({
        id: `alerte_parent_inactif_${enfantId}`,
        parentId,
        enfantId,
        enfantNom,
        type: 'inactivite',
        niveau: 'important',
        titre: `📵 ${enfantNom} est inactif`,
        message: `${enfantNom} n'a pas utilisé PedaClic depuis ${joursInactif} jours. Un petit encouragement pourrait aider !`,
        lue: false,
        dateCreation: maintenant,
      });
    }
  } else if (resultats.length === 0) {
    // Aucun quiz jamais passé
    alertes.push({
      id: `alerte_parent_jamais_actif_${enfantId}`,
      parentId,
      enfantId,
      enfantNom,
      type: 'inactivite',
      niveau: 'modere',
      titre: `📝 ${enfantNom} n'a pas encore commencé`,
      message: `${enfantNom} n'a pas encore passé de quiz sur PedaClic. Encouragez-le à commencer !`,
      lue: false,
      dateCreation: maintenant,
    });
  }

  // ===== 3. Alerte score global bas =====
  if (scoreGlobal < SEUIL_SCORE_BAS && resultats.length > 0) {
    alertes.push({
      id: `alerte_parent_score_${enfantId}`,
      parentId,
      enfantId,
      enfantNom,
      type: 'score_bas',
      niveau: 'important',
      titre: `📊 Score global bas : ${scoreGlobal}/100`,
      message: `Le score de santé global de ${enfantNom} est de ${scoreGlobal}/100. Des efforts supplémentaires sont nécessaires dans plusieurs matières.`,
      lue: false,
      dateCreation: maintenant,
    });
  }

  // ===== 4. Alertes positives (progression) =====
  lacunes
    .filter((l: any) => l.tendance === 'hausse')
    .forEach((lacune: any) => {
      alertes.push({
        id: `alerte_parent_progression_${lacune.id}`,
        parentId,
        enfantId,
        enfantNom,
        type: 'progression',
        niveau: 'info',
        titre: `📈 Progression en ${lacune.disciplineNom}`,
        message: `Bonne nouvelle ! ${enfantNom} montre une tendance à la hausse en ${lacune.disciplineNom}.`,
        lue: false,
        dateCreation: maintenant,
      });
    });

  // ===== 5. Streak positif =====
  if (streak.streakActuel >= 5) {
    alertes.push({
      id: `alerte_parent_streak_${enfantId}`,
      parentId,
      enfantId,
      enfantNom,
      type: 'objectif_atteint',
      niveau: 'info',
      titre: `🔥 Streak de ${streak.streakActuel} jours !`,
      message: `Félicitations ! ${enfantNom} maintient un streak de ${streak.streakActuel} jours consécutifs de travail.`,
      lue: false,
      dateCreation: maintenant,
    });
  }

  // ===== Tri : critiques d'abord, puis info en dernier =====
  const ordreNiveau: Record<NiveauAlerteParent, number> = {
    critique: 0,
    important: 1,
    modere: 2,
    info: 3,
  };
  alertes.sort((a, b) => ordreNiveau[a.niveau] - ordreNiveau[b.niveau]);

  return alertes;
}

/**
 * Marque une alerte comme lue
 * 
 * @param alerteId - ID de l'alerte dans Firestore
 */
export async function marquerAlerteLue(alerteId: string): Promise<void> {
  try {
    const alerteRef = doc(db, 'alertes_parent', alerteId);
    await updateDoc(alerteRef, {
      lue: true,
      dateLecture: new Date()
    });
  } catch (error) {
    console.error('Erreur marquage alerte lue:', error);
  }
}

/**
 * Récupère les alertes non lues pour un parent
 * 
 * @param parentId - UID du parent
 * @returns Nombre d'alertes non lues
 */
export async function getNombreAlertesNonLues(parentId: string): Promise<number> {
  try {
    const alertesRef = collection(db, 'alertes_parent');
    const q = query(
      alertesRef,
      where('parentId', '==', parentId),
      where('lue', '==', false)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Erreur comptage alertes:', error);
    return 0;
  }
}

// ==================== RÉSUMÉ HEBDOMADAIRE ====================

/**
 * Construit le résumé hebdomadaire de l'activité d'un enfant.
 * Analyse les résultats de la semaine courante et compare avec la semaine précédente.
 * 
 * @param enfantId - UID de l'enfant
 * @param enfantNom - Nom de l'enfant
 * @param suivi - Données de suivi complet (Phase 9)
 * @param tousResultats - Tous les résultats de quiz
 * @returns Résumé hebdomadaire structuré
 */
function construireResumeHebdomadaire(
  enfantId: string,
  enfantNom: string,
  suivi: any,
  tousResultats: any[]
): ResumeHebdomadaire {
  const lundi = getLundiSemaine();
  const dimanche = getDimancheSemaine();

  // ===== Semaine précédente pour comparaison =====
  const lundiPrec = new Date(lundi);
  lundiPrec.setDate(lundiPrec.getDate() - 7);
  const dimanchePrec = new Date(dimanche);
  dimanchePrec.setDate(dimanchePrec.getDate() - 7);

  // ===== Filtrer les résultats par semaine =====
  const resultatsSemaine = tousResultats.filter(r => {
    const date = toDate(r.datePassage);
    return date >= lundi && date <= dimanche;
  });

  const resultatsSemainePrec = tousResultats.filter(r => {
    const date = toDate(r.datePassage);
    return date >= lundiPrec && date <= dimanchePrec;
  });

  // ===== Derniers quiz de la semaine =====
  const derniersQuiz: QuizResultResume[] = resultatsSemaine
    .slice(0, MAX_QUIZ_RESUME)
    .map(r => ({
      quizTitre: r.quizTitre || 'Quiz',
      disciplineNom: r.disciplineNom || 'Discipline',
      pourcentage: r.pourcentage,
      noteSur20: Math.round((r.pourcentage / 100) * 20 * 10) / 10,
      reussi: r.reussi,
      datePassage: toDate(r.datePassage),
    }));

  // ===== Évolution par discipline =====
  const evolutionDisciplines = calculerEvolutionDisciplines(
    resultatsSemaine,
    resultatsSemainePrec
  );

  // ===== Jours actifs cette semaine =====
  const joursActifsSet = new Set<string>();
  resultatsSemaine.forEach(r => {
    const date = toDate(r.datePassage);
    joursActifsSet.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
  });

  // ===== Temps estimé (approximatif : 5 min par quiz) =====
  const tempsEstime = resultatsSemaine.reduce(
    (acc: number, r: any) => acc + (r.tempsEcoule || 5),
    0
  );

  // ===== Score global précédent (approximation par les résultats) =====
  let scoreGlobalPrecedent = 0;
  if (resultatsSemainePrec.length > 0) {
    const moyennePrec =
      resultatsSemainePrec.reduce((acc: number, r: any) => acc + r.pourcentage, 0) /
      resultatsSemainePrec.length;
    scoreGlobalPrecedent = Math.round(moyennePrec);
  }

  // ===== Évolution du score =====
  let evolutionScore: 'hausse' | 'baisse' | 'stable' = 'stable';
  const ecartScore = suivi.scoreGlobal - scoreGlobalPrecedent;
  if (ecartScore > 5) evolutionScore = 'hausse';
  else if (ecartScore < -5) evolutionScore = 'baisse';

  // ===== Lacunes en difficulté =====
  const disciplinesEnDifficulte = suivi.lacunes
    .filter((l: any) => l.niveauUrgence === 'critique' || l.niveauUrgence === 'important')
    .map((l: any) => l.disciplineNom);

  // ===== Objectifs atteints =====
  const objectifsAtteints = suivi.objectifs.filter(
    (o: any) => o.statut === 'atteint'
  ).length;

  // ===== Libellé de la semaine =====
  const semaine = `${formaterDateCourte(lundi)} - ${formaterDateCourte(dimanche)} ${dimanche.getFullYear()}`;

  return {
    enfantId,
    enfantNom,
    semaine,
    dateDebut: lundi,
    dateFin: dimanche,

    scoreGlobal: suivi.scoreGlobal,
    scoreGlobalPrecedent,
    evolutionScore,

    nombreQuizSemaine: resultatsSemaine.length,
    tempsEstimeMinutes: Math.round(tempsEstime),
    joursActifsSemaine: joursActifsSet.size,
    streakActuel: suivi.streak.streakActuel,

    derniersQuiz,
    evolutionDisciplines,

    lacunesCritiques: suivi.lacunes.filter((l: any) => l.niveauUrgence === 'critique').length,
    lacunesImportantes: suivi.lacunes.filter((l: any) => l.niveauUrgence === 'important').length,
    disciplinesEnDifficulte,

    objectifsAtteints,
    objectifsTotal: suivi.objectifs.length,
  };
}

/**
 * Calcule l'évolution des performances par discipline entre deux semaines.
 * 
 * @param resultatsSemaine - Résultats de la semaine courante
 * @param resultatsSemainePrec - Résultats de la semaine précédente
 * @returns Évolution par discipline
 */
function calculerEvolutionDisciplines(
  resultatsSemaine: any[],
  resultatsSemainePrec: any[]
): EvolutionDiscipline[] {
  // ===== Regrouper par discipline (semaine courante) =====
  const parDiscipline = new Map<string, { scores: number[]; nom: string }>();

  resultatsSemaine.forEach(r => {
    if (!parDiscipline.has(r.disciplineId)) {
      parDiscipline.set(r.disciplineId, {
        scores: [],
        nom: r.disciplineNom || 'Discipline',
      });
    }
    parDiscipline.get(r.disciplineId)!.scores.push(r.pourcentage);
  });

  // ===== Regrouper par discipline (semaine précédente) =====
  const parDisciplinePrec = new Map<string, number[]>();
  resultatsSemainePrec.forEach(r => {
    if (!parDisciplinePrec.has(r.disciplineId)) {
      parDisciplinePrec.set(r.disciplineId, []);
    }
    parDisciplinePrec.get(r.disciplineId)!.push(r.pourcentage);
  });

  // ===== Calculer l'évolution =====
  const evolutions: EvolutionDiscipline[] = [];

  parDiscipline.forEach((data, disciplineId) => {
    const moyenneCourante =
      data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const scoresPrec = parDisciplinePrec.get(disciplineId) || [];
    const moyennePrec =
      scoresPrec.length > 0
        ? scoresPrec.reduce((a, b) => a + b, 0) / scoresPrec.length
        : moyenneCourante; // Pas de données précédentes = stable

    // Convertir en note sur 20
    const noteCourante = Math.round((moyenneCourante / 100) * 20 * 10) / 10;
    const notePrec = Math.round((moyennePrec / 100) * 20 * 10) / 10;
    const ecart = Math.round((noteCourante - notePrec) * 10) / 10;

    let evolution: 'hausse' | 'baisse' | 'stable' = 'stable';
    if (ecart > 1) evolution = 'hausse';
    else if (ecart < -1) evolution = 'baisse';

    evolutions.push({
      disciplineNom: data.nom,
      disciplineId,
      moyenneSemainePrecedente: notePrec,
      moyenneSemaineCourante: noteCourante,
      evolution,
      ecart,
    });
  });

  return evolutions;
}

// ==================== UTILITAIRES D'AFFICHAGE (EXPORTS) ====================

/**
 * Retourne la couleur CSS pour un niveau d'alerte parent
 * @param niveau - Niveau d'alerte
 * @returns Couleur hexadécimale
 */
export function getCouleurAlerteParent(niveau: NiveauAlerteParent): string {
  return getCouleurUrgence(niveau);
}

/**
 * Retourne le label français pour un type d'alerte
 * @param type - Type d'alerte parent
 * @returns Label en français
 */
export function getLabelAlerteParent(type: TypeAlerteParent): string {
  const labels: Record<TypeAlerteParent, string> = {
    lacune_critique: 'Lacune critique',
    inactivite: 'Inactivité',
    streak_perdu: 'Streak perdu',
    objectif_atteint: 'Objectif atteint',
    progression: 'Progression',
    score_bas: 'Score bas',
    nouveau_quiz: 'Nouveau quiz',
  };
  return labels[type] || 'Alerte';
}

/**
 * Retourne l'emoji pour une tendance d'évolution
 * @param evolution - Tendance
 * @returns Emoji correspondant
 */
export function getEmojiEvolution(evolution: 'hausse' | 'baisse' | 'stable'): string {
  switch (evolution) {
    case 'hausse': return '📈';
    case 'baisse': return '📉';
    case 'stable': return '➡️';
    default: return '❓';
  }
}

/**
 * Retourne un message d'encouragement basé sur le score global
 * destiné au parent
 * @param score - Score global de l'enfant (0-100)
 * @returns Message pour le parent
 */
export function getMessageParent(score: number): string {
  if (score >= 80) return 'Votre enfant fait un excellent travail ! Continuez à l\'encourager. 🌟';
  if (score >= 60) return 'De bons résultats ! Quelques efforts supplémentaires et ce sera parfait. 💪';
  if (score >= 40) return 'Des progrès sont possibles. Encouragez votre enfant à suivre les recommandations. 📚';
  if (score >= 20) return 'Votre enfant a besoin de soutien. Un suivi régulier est recommandé. 🎯';
  return 'Il est temps de commencer ! Encouragez votre enfant à passer ses premiers quiz. 🚀';
}

/**
 * Formate une date relative (ex: "Il y a 2 jours", "Aujourd'hui")
 * @param date - Date à formater
 * @returns Chaîne relative
 */
export function formaterDateRelative(date: Date): string {
  const maintenant = new Date();
  const diff = diffJours(date, maintenant);

  if (diff === 0) return 'Aujourd\'hui';
  if (diff === 1) return 'Hier';
  if (diff < 7) return `Il y a ${diff} jours`;
  if (diff < 30) return `Il y a ${Math.floor(diff / 7)} semaine(s)`;
  return `Il y a ${Math.floor(diff / 30)} mois`;
}

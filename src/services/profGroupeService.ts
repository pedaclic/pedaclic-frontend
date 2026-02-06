/**
 * ============================================================
 * SERVICE PROFESSEUR PHASE 11 — PedaClic
 * ============================================================
 * 
 * Service Firestore pour le Dashboard Analytics Professeurs.
 * Gère : création/gestion des groupes-classes, codes d'invitation
 * PROF-XXXX-XXXX, inscriptions élèves, calcul de statistiques,
 * détection des alertes, analyse par quiz, et export CSV.
 * 
 * Fichier : src/services/profGroupeService.ts
 * Dépendances :
 *   - ../firebase (db)
 *   - ./suiviService (getSuiviComplet, getLacunes, getStreakData)
 *   - ../types/prof (toutes les interfaces Phase 11)
 * ============================================================
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';

// ===== Imports depuis suiviService (Phase 9) =====
import {
  getSuiviComplet,
  getStreakData,
  detecterLacunes
} from './suiviService';

// ===== Imports des types Phase 11 =====
import type {
  GroupeProf,
  GroupeFormData,
  InscriptionGroupe,
  StatsGroupe,
  EleveGroupeStats,
  StatsQuizGroupe,
  QuestionRatee,
  AlerteProf,
  LigneExportCSV
} from '../types/prof';


// ==================== CONSTANTES ====================

/** Préfixe des codes d'invitation professeur */
const CODE_PROF_PREFIX = 'PROF';

/** Longueur d'un segment du code (XXXX) */
const CODE_SEGMENT_LENGTH = 4;

/** Caractères utilisés pour générer les codes (sans I, O, 0, 1 pour éviter confusion) */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Seuil de moyenne pour "élève en difficulté" (sur 20) */
const SEUIL_DIFFICULTE = 8;

/** Jours d'inactivité avant alerte */
const JOURS_INACTIVITE = 7;

/** Seuil de baisse significative (points de moyenne) */
const SEUIL_BAISSE = 3;

/** Seuil de félicitation (moyenne >= 16/20) */
const SEUIL_FELICITATION = 16;


// ==================== UTILITAIRES ====================

/**
 * Convertit un Timestamp Firestore ou toute valeur en Date JavaScript
 * @param val - Valeur à convertir (Timestamp, Date, objet avec seconds)
 * @returns Date JavaScript
 */
function toDate(val: any): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val?.seconds) return new Timestamp(val.seconds, val.nanoseconds || 0).toDate();
  return new Date(val);
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


// ============================================================
// SECTION 1 : GESTION DES CODES D'INVITATION
// ============================================================

/**
 * Génère un code d'invitation unique au format PROF-XXXX-XXXX.
 * Vérifie l'unicité dans Firestore avant de retourner le code.
 * 
 * @returns Code unique (ex: "PROF-K8NV-3WTD")
 */
async function genererCodeProf(): Promise<string> {
  let tentatives = 0;
  const maxTentatives = 10;

  while (tentatives < maxTentatives) {
    // ===== Générer 2 segments aléatoires =====
    let segment1 = '';
    let segment2 = '';
    for (let i = 0; i < CODE_SEGMENT_LENGTH; i++) {
      segment1 += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
      segment2 += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    const code = `${CODE_PROF_PREFIX}-${segment1}-${segment2}`;

    // ===== Vérifier l'unicité =====
    const q = query(
      collection(db, 'groupes_prof'),
      where('codeInvitation', '==', code),
      limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return code; // Code unique trouvé
    }

    tentatives++;
  }

  throw new Error('Impossible de générer un code unique après plusieurs tentatives');
}


// ============================================================
// SECTION 2 : CRUD GROUPES-CLASSES
// ============================================================

/**
 * Crée un nouveau groupe-classe pour un professeur.
 * Génère automatiquement un code d'invitation unique PROF-XXXX-XXXX.
 * 
 * @param profId - UID du professeur
 * @param profNom - Nom d'affichage du professeur
 * @param formData - Données du formulaire de création
 * @returns Le groupe créé avec son ID et code d'invitation
 * 
 * @example
 * const groupe = await creerGroupe(
 *   'uid_prof_123',
 *   'M. Diallo',
 *   { nom: '3ème A - Maths', matiereId: 'maths_3eme', matiereNom: 'Mathématiques', 
 *     classeNiveau: '3eme', anneeScolaire: '2024-2025' }
 * );
 * console.log(groupe.codeInvitation); // "PROF-K8NV-3WTD"
 */
export async function creerGroupe(
  profId: string,
  profNom: string,
  formData: GroupeFormData
): Promise<GroupeProf> {
  try {
    // ===== 1. Générer le code d'invitation unique =====
    const codeInvitation = await genererCodeProf();

    // ===== 2. Préparer les données du groupe =====
    const groupeData = {
      profId,
      profNom,
      nom: formData.nom.trim(),
      description: formData.description?.trim() || '',
      matiereId: formData.matiereId,
      matiereNom: formData.matiereNom,
      classeNiveau: formData.classeNiveau,
      codeInvitation,
      nombreInscrits: 0,
      statut: 'actif' as const,
      anneeScolaire: formData.anneeScolaire,
      dateCreation: new Date(),
      dateMiseAJour: new Date()
    };

    // ===== 3. Créer le document dans Firestore =====
    const docRef = await addDoc(collection(db, 'groupes_prof'), groupeData);

    console.log(`✅ Groupe "${formData.nom}" créé avec code: ${codeInvitation}`);

    return {
      id: docRef.id,
      ...groupeData
    };
  } catch (error) {
    console.error('❌ Erreur création groupe:', error);
    throw new Error('Impossible de créer le groupe. Réessayez.');
  }
}

/**
 * Récupère tous les groupes d'un professeur.
 * Triés par date de création décroissante.
 * 
 * @param profId - UID du professeur
 * @returns Liste des groupes du professeur
 */
export async function getGroupesProf(profId: string): Promise<GroupeProf[]> {
  try {
    const q = query(
      collection(db, 'groupes_prof'),
      where('profId', '==', profId),
      orderBy('dateCreation', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
      dateCreation: toDate(docSnap.data().dateCreation),
      dateMiseAJour: docSnap.data().dateMiseAJour 
        ? toDate(docSnap.data().dateMiseAJour) 
        : undefined
    })) as GroupeProf[];
  } catch (error) {
    console.error('❌ Erreur récupération groupes:', error);
    throw new Error('Impossible de charger vos groupes.');
  }
}

/**
 * Récupère un groupe spécifique par son ID.
 * 
 * @param groupeId - ID du groupe
 * @returns Le groupe ou null si introuvable
 */
export async function getGroupeById(groupeId: string): Promise<GroupeProf | null> {
  try {
    const docSnap = await getDoc(doc(db, 'groupes_prof', groupeId));
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      dateCreation: toDate(data.dateCreation),
      dateMiseAJour: data.dateMiseAJour ? toDate(data.dateMiseAJour) : undefined
    } as GroupeProf;
  } catch (error) {
    console.error('❌ Erreur récupération groupe:', error);
    return null;
  }
}

/**
 * Met à jour les informations d'un groupe-classe.
 * Seul le professeur créateur peut modifier son groupe.
 * 
 * @param groupeId - ID du groupe
 * @param updates - Champs à mettre à jour
 */
export async function modifierGroupe(
  groupeId: string,
  updates: Partial<GroupeFormData> & { statut?: string }
): Promise<void> {
  try {
    const ref = doc(db, 'groupes_prof', groupeId);
    await updateDoc(ref, {
      ...updates,
      dateMiseAJour: new Date()
    });
    console.log(`✅ Groupe ${groupeId} mis à jour`);
  } catch (error) {
    console.error('❌ Erreur modification groupe:', error);
    throw new Error('Impossible de modifier le groupe.');
  }
}

/**
 * Supprime un groupe et toutes ses inscriptions associées.
 * Utilise un batch write pour garantir l'atomicité.
 * 
 * @param groupeId - ID du groupe à supprimer
 */
export async function supprimerGroupe(groupeId: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    // ===== 1. Supprimer toutes les inscriptions du groupe =====
    const inscriptionsQ = query(
      collection(db, 'inscriptions_groupe'),
      where('groupeId', '==', groupeId)
    );
    const inscriptionsSnap = await getDocs(inscriptionsQ);
    inscriptionsSnap.docs.forEach(d => batch.delete(d.ref));

    // ===== 2. Supprimer le groupe lui-même =====
    batch.delete(doc(db, 'groupes_prof', groupeId));

    // ===== 3. Exécuter le batch =====
    await batch.commit();

    console.log(`✅ Groupe ${groupeId} et ses inscriptions supprimés`);
  } catch (error) {
    console.error('❌ Erreur suppression groupe:', error);
    throw new Error('Impossible de supprimer le groupe.');
  }
}

/**
 * Archive un groupe (fin d'année scolaire).
 * 
 * @param groupeId - ID du groupe à archiver
 */
export async function archiverGroupe(groupeId: string): Promise<void> {
  await modifierGroupe(groupeId, { statut: 'archive' });
}

/**
 * Régénère un nouveau code d'invitation pour un groupe.
 * Utile si le code a été compromis ou partagé trop largement.
 * 
 * @param groupeId - ID du groupe
 * @returns Le nouveau code généré
 */
export async function regenererCode(groupeId: string): Promise<string> {
  try {
    const nouveauCode = await genererCodeProf();
    await updateDoc(doc(db, 'groupes_prof', groupeId), {
      codeInvitation: nouveauCode,
      dateMiseAJour: new Date()
    });
    console.log(`✅ Nouveau code pour groupe ${groupeId}: ${nouveauCode}`);
    return nouveauCode;
  } catch (error) {
    console.error('❌ Erreur régénération code:', error);
    throw new Error('Impossible de régénérer le code.');
  }
}


// ============================================================
// SECTION 3 : INSCRIPTIONS ÉLÈVES
// ============================================================

/**
 * Inscrit un élève à un groupe-classe via le code d'invitation.
 * 
 * Étapes :
 * 1. Recherche le groupe par code PROF-XXXX-XXXX
 * 2. Vérifie que le groupe est actif
 * 3. Vérifie que l'élève n'est pas déjà inscrit
 * 4. Crée l'inscription + incrémente le compteur
 * 
 * @param eleveId - UID de l'élève
 * @param eleveNom - Nom de l'élève
 * @param eleveEmail - Email de l'élève
 * @param codeInvitation - Code saisi par l'élève (PROF-XXXX-XXXX)
 * @returns L'inscription créée
 * @throws Error si code invalide, groupe inactif, ou déjà inscrit
 */
export async function rejoindreGroupe(
  eleveId: string,
  eleveNom: string,
  eleveEmail: string,
  codeInvitation: string
): Promise<InscriptionGroupe> {
  try {
    // ===== 1. Normaliser le code =====
    const codeNormalise = codeInvitation.trim().toUpperCase();

    // ===== 2. Rechercher le groupe par code =====
    const groupesQ = query(
      collection(db, 'groupes_prof'),
      where('codeInvitation', '==', codeNormalise),
      limit(1)
    );
    const groupeSnap = await getDocs(groupesQ);

    if (groupeSnap.empty) {
      throw new Error('Code d\'invitation invalide. Vérifiez le code et réessayez.');
    }

    const groupeDoc = groupeSnap.docs[0];
    const groupeData = groupeDoc.data();

    // ===== 3. Vérifier que le groupe est actif =====
    if (groupeData.statut !== 'actif') {
      throw new Error('Ce groupe n\'accepte plus de nouvelles inscriptions.');
    }

    // ===== 4. Vérifier que l'élève n'est pas déjà inscrit =====
    const inscriptionExistante = query(
      collection(db, 'inscriptions_groupe'),
      where('groupeId', '==', groupeDoc.id),
      where('eleveId', '==', eleveId),
      where('statut', '==', 'actif'),
      limit(1)
    );
    const existeSnap = await getDocs(inscriptionExistante);

    if (!existeSnap.empty) {
      throw new Error('Tu es déjà inscrit(e) dans ce groupe.');
    }

    // ===== 5. Créer l'inscription =====
    const inscriptionData = {
      groupeId: groupeDoc.id,
      eleveId,
      eleveNom,
      eleveEmail,
      statut: 'actif' as const,
      dateInscription: new Date()
    };

    const inscRef = await addDoc(collection(db, 'inscriptions_groupe'), inscriptionData);

    // ===== 6. Incrémenter le compteur d'inscrits du groupe =====
    await updateDoc(doc(db, 'groupes_prof', groupeDoc.id), {
      nombreInscrits: increment(1),
      dateMiseAJour: new Date()
    });

    console.log(`✅ Élève ${eleveNom} inscrit au groupe "${groupeData.nom}"`);

    return {
      id: inscRef.id,
      ...inscriptionData
    };
  } catch (error: any) {
    console.error('❌ Erreur inscription groupe:', error);
    throw error; // Re-throw pour garder le message d'erreur spécifique
  }
}

/**
 * Récupère tous les élèves inscrits dans un groupe.
 * 
 * @param groupeId - ID du groupe
 * @param statut - Filtrer par statut (par défaut: 'actif')
 * @returns Liste des inscriptions actives
 */
export async function getElevesGroupe(
  groupeId: string,
  statut: string = 'actif'
): Promise<InscriptionGroupe[]> {
  try {
    const q = query(
      collection(db, 'inscriptions_groupe'),
      where('groupeId', '==', groupeId),
      where('statut', '==', statut),
      orderBy('dateInscription', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      dateInscription: toDate(d.data().dateInscription),
      dateRetrait: d.data().dateRetrait ? toDate(d.data().dateRetrait) : undefined
    })) as InscriptionGroupe[];
  } catch (error) {
    console.error('❌ Erreur récupération élèves groupe:', error);
    throw new Error('Impossible de charger les élèves du groupe.');
  }
}

/**
 * Récupère tous les groupes auxquels un élève est inscrit.
 * Utilisé dans le dashboard élève pour afficher ses groupes.
 * 
 * @param eleveId - UID de l'élève
 * @returns Liste des groupes avec détails
 */
export async function getGroupesEleve(eleveId: string): Promise<GroupeProf[]> {
  try {
    // ===== 1. Récupérer les inscriptions actives de l'élève =====
    const inscQ = query(
      collection(db, 'inscriptions_groupe'),
      where('eleveId', '==', eleveId),
      where('statut', '==', 'actif')
    );
    const inscSnap = await getDocs(inscQ);

    if (inscSnap.empty) return [];

    // ===== 2. Récupérer les détails de chaque groupe =====
    const groupes: GroupeProf[] = [];
    for (const inscDoc of inscSnap.docs) {
      const groupeId = inscDoc.data().groupeId;
      const groupe = await getGroupeById(groupeId);
      if (groupe && groupe.statut === 'actif') {
        groupes.push(groupe);
      }
    }

    return groupes;
  } catch (error) {
    console.error('❌ Erreur récupération groupes élève:', error);
    return [];
  }
}

/**
 * Retire un élève d'un groupe (ne supprime pas, change le statut).
 * Met à jour le compteur du groupe.
 * 
 * @param inscriptionId - ID de l'inscription
 * @param groupeId - ID du groupe (pour décrémenter le compteur)
 */
export async function retirerEleve(
  inscriptionId: string,
  groupeId: string
): Promise<void> {
  try {
    // ===== 1. Mettre à jour l'inscription =====
    await updateDoc(doc(db, 'inscriptions_groupe', inscriptionId), {
      statut: 'retire',
      dateRetrait: new Date()
    });

    // ===== 2. Décrémenter le compteur du groupe =====
    await updateDoc(doc(db, 'groupes_prof', groupeId), {
      nombreInscrits: increment(-1),
      dateMiseAJour: new Date()
    });

    console.log(`✅ Élève retiré du groupe`);
  } catch (error) {
    console.error('❌ Erreur retrait élève:', error);
    throw new Error('Impossible de retirer l\'élève du groupe.');
  }
}


// ============================================================
// SECTION 4 : STATISTIQUES PAR GROUPE
// ============================================================

/**
 * Calcule les statistiques globales d'un groupe-classe.
 * Agrège les résultats de quiz de tous les élèves inscrits.
 * 
 * @param groupeId - ID du groupe
 * @returns Statistiques globales du groupe
 */
export async function getStatsGroupe(groupeId: string): Promise<StatsGroupe> {
  try {
    // ===== 1. Récupérer les élèves du groupe =====
    const eleves = await getElevesGroupe(groupeId);
    const eleveIds = eleves.map(e => e.eleveId);

    if (eleveIds.length === 0) {
      return {
        groupeId,
        nombreEleves: 0,
        moyenneClasse: 0,
        tauxReussite: 0,
        tauxParticipation: 0,
        totalQuizPasses: 0,
        elevesEnDifficulte: 0,
        meilleureNote: 0,
        pireNote: 0,
        derniereMiseAJour: new Date()
      };
    }

    // ===== 2. Récupérer les résultats de quiz par lots de 10 (limite Firestore 'in') =====
    const tousResultats: any[] = [];
    const lots = [];
    for (let i = 0; i < eleveIds.length; i += 10) {
      lots.push(eleveIds.slice(i, i + 10));
    }

    for (const lot of lots) {
      const q = query(
        collection(db, 'quiz_results'),
        where('userId', 'in', lot)
      );
      const snap = await getDocs(q);
      snap.docs.forEach(d => tousResultats.push({ id: d.id, ...d.data() }));
    }

    // ===== 3. Calculer les statistiques par élève =====
    const statsParEleve = new Map<string, { total: number; somme: number; reussis: number }>();

    for (const result of tousResultats) {
      const uid = result.userId;
      if (!statsParEleve.has(uid)) {
        statsParEleve.set(uid, { total: 0, somme: 0, reussis: 0 });
      }
      const stat = statsParEleve.get(uid)!;
      stat.total++;
      stat.somme += result.score || 0;
      if ((result.score || 0) >= 10) stat.reussis++;
    }

    // ===== 4. Agréger les statistiques globales =====
    let sommeMoyennes = 0;
    let elevesAvecQuiz = 0;
    let elevesEnDifficulte = 0;
    let meilleureNote = 0;
    let pireNote = 20;
    let totalQuiz = 0;

    for (const [, stat] of statsParEleve) {
      const moyenne = stat.total > 0 ? stat.somme / stat.total : 0;
      sommeMoyennes += moyenne;
      elevesAvecQuiz++;
      totalQuiz += stat.total;

      if (moyenne < SEUIL_DIFFICULTE) elevesEnDifficulte++;
      if (moyenne > meilleureNote) meilleureNote = moyenne;
      if (moyenne < pireNote) pireNote = moyenne;
    }

    // Si aucun quiz n'a été passé
    if (elevesAvecQuiz === 0) pireNote = 0;

    return {
      groupeId,
      nombreEleves: eleveIds.length,
      moyenneClasse: elevesAvecQuiz > 0
        ? Math.round((sommeMoyennes / elevesAvecQuiz) * 10) / 10
        : 0,
      tauxReussite: totalQuiz > 0
        ? Math.round(
            (Array.from(statsParEleve.values()).reduce((s, v) => s + v.reussis, 0) / totalQuiz) * 100
          )
        : 0,
      tauxParticipation: Math.round((elevesAvecQuiz / eleveIds.length) * 100),
      totalQuizPasses: totalQuiz,
      elevesEnDifficulte,
      meilleureNote: Math.round(meilleureNote * 10) / 10,
      pireNote: Math.round(pireNote * 10) / 10,
      derniereMiseAJour: new Date()
    };
  } catch (error) {
    console.error('❌ Erreur calcul stats groupe:', error);
    throw new Error('Impossible de calculer les statistiques du groupe.');
  }
}

/**
 * Récupère les statistiques détaillées de chaque élève d'un groupe.
 * Utilise suiviService.getSuiviComplet() pour obtenir lacunes, streak, score.
 * 
 * @param groupeId - ID du groupe
 * @returns Liste des stats par élève, triée par moyenne décroissante
 */
export async function getStatsElevesGroupe(groupeId: string): Promise<EleveGroupeStats[]> {
  try {
    // ===== 1. Récupérer les élèves inscrits =====
    const inscriptions = await getElevesGroupe(groupeId);

    if (inscriptions.length === 0) return [];

    // ===== 2. Pour chaque élève, récupérer le suivi complet =====
    const statsEleves: EleveGroupeStats[] = [];

    for (const insc of inscriptions) {
      try {
        // Utilise suiviService.getSuiviComplet() (Phase 9)
        const suivi = await getSuiviComplet(insc.eleveId);

        // Récupérer les résultats de quiz de l'élève
        const qResults = query(
          collection(db, 'quiz_results'),
          where('userId', '==', insc.eleveId),
          orderBy('datePassage', 'desc')
        );
        const resultsSnap = await getDocs(qResults);
        const resultats = resultsSnap.docs.map(d => d.data());

        // Calculer la moyenne et le taux de réussite
        let moyenne = 0;
        let tauxReussite = 0;
        let dernierQuiz: Date | undefined;

        if (resultats.length > 0) {
          const sommeScores = resultats.reduce((s, r) => s + (r.score || 0), 0);
          moyenne = Math.round((sommeScores / resultats.length) * 10) / 10;
          tauxReussite = Math.round(
            (resultats.filter(r => (r.score || 0) >= 10).length / resultats.length) * 100
          );
          dernierQuiz = toDate(resultats[0].datePassage);
        }

        // Déterminer la tendance (comparer les 5 derniers quiz avec les 5 précédents)
        let tendance: 'hausse' | 'baisse' | 'stable' = 'stable';
        if (resultats.length >= 4) {
          const recents = resultats.slice(0, Math.ceil(resultats.length / 2));
          const anciens = resultats.slice(Math.ceil(resultats.length / 2));
          const moyRecente = recents.reduce((s, r) => s + (r.score || 0), 0) / recents.length;
          const moyAncienne = anciens.reduce((s, r) => s + (r.score || 0), 0) / anciens.length;
          if (moyRecente - moyAncienne > 1) tendance = 'hausse';
          else if (moyAncienne - moyRecente > 1) tendance = 'baisse';
        }

        // Mapper les lacunes depuis le suivi
        const lacunes = suivi.lacunes.map(l => ({
          disciplineNom: l.disciplineNom,
          chapitre: l.chapitre,
          moyenne: l.moyenne,
          niveauUrgence: l.niveauUrgence
        }));

        statsEleves.push({
          eleveId: insc.eleveId,
          eleveNom: insc.eleveNom,
          eleveEmail: insc.eleveEmail,
          moyenne,
          totalQuiz: resultats.length,
          tauxReussite,
          scoreGlobal: suivi.scoreGlobal,
          streak: {
            actuel: suivi.streak.streakActuel,
            meilleur: suivi.streak.meilleurStreak
          },
          lacunes,
          dernierQuiz,
          tendance
        });
      } catch (err) {
        // Si le suivi d'un élève échoue, ajouter avec des valeurs par défaut
        console.warn(`⚠️ Suivi incomplet pour élève ${insc.eleveNom}:`, err);
        statsEleves.push({
          eleveId: insc.eleveId,
          eleveNom: insc.eleveNom,
          eleveEmail: insc.eleveEmail,
          moyenne: 0,
          totalQuiz: 0,
          tauxReussite: 0,
          scoreGlobal: 0,
          streak: { actuel: 0, meilleur: 0 },
          lacunes: [],
          tendance: 'stable'
        });
      }
    }

    // ===== 3. Trier par moyenne décroissante =====
    statsEleves.sort((a, b) => b.moyenne - a.moyenne);

    return statsEleves;
  } catch (error) {
    console.error('❌ Erreur stats élèves groupe:', error);
    throw new Error('Impossible de charger les statistiques des élèves.');
  }
}


// ============================================================
// SECTION 5 : ANALYSE PAR QUIZ
// ============================================================

/**
 * Analyse les résultats d'un quiz spécifique au sein d'un groupe.
 * Identifie les questions les plus ratées.
 * 
 * @param groupeId - ID du groupe
 * @param quizId - ID du quiz à analyser
 * @returns Statistiques détaillées du quiz dans le groupe
 */
export async function getStatsQuizGroupe(
  groupeId: string,
  quizId: string
): Promise<StatsQuizGroupe | null> {
  try {
    // ===== 1. Récupérer les élèves du groupe =====
    const inscriptions = await getElevesGroupe(groupeId);
    const eleveIds = inscriptions.map(i => i.eleveId);
    if (eleveIds.length === 0) return null;

    // ===== 2. Récupérer le quiz =====
    const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
    if (!quizDoc.exists()) return null;
    const quizData = quizDoc.data();

    // ===== 3. Récupérer les résultats des élèves du groupe pour ce quiz =====
    const resultats: any[] = [];
    const lots = [];
    for (let i = 0; i < eleveIds.length; i += 10) {
      lots.push(eleveIds.slice(i, i + 10));
    }

    for (const lot of lots) {
      const q = query(
        collection(db, 'quiz_results'),
        where('quizId', '==', quizId),
        where('userId', 'in', lot)
      );
      const snap = await getDocs(q);
      snap.docs.forEach(d => resultats.push(d.data()));
    }

    if (resultats.length === 0) return null;

    // ===== 4. Calculer les statistiques globales du quiz =====
    const scores = resultats.map(r => r.score || 0);
    const temps = resultats.map(r => r.tempsEcoule || 0);

    // ===== 5. Analyser les questions ratées =====
    const questions = quizData.questions || [];
    const questionsRatees: QuestionRatee[] = [];

    for (let qIdx = 0; qIdx < questions.length; qIdx++) {
      const question = questions[qIdx];
      let echecs = 0;
      const compteurReponses = new Map<number, number>();

      for (const result of resultats) {
        const reponseEleve = result.reponses?.[qIdx];
        if (reponseEleve !== undefined) {
          compteurReponses.set(
            reponseEleve,
            (compteurReponses.get(reponseEleve) || 0) + 1
          );
          if (reponseEleve !== question.reponseCorrecte) {
            echecs++;
          }
        }
      }

      const tauxEchec = Math.round((echecs / resultats.length) * 100);

      // Construire les réponses fréquentes (hors bonne réponse)
      const reponsesFrequentes = Array.from(compteurReponses.entries())
        .filter(([idx]) => idx !== question.reponseCorrecte)
        .map(([idx, nombre]) => ({
          reponse: question.options?.[idx] || `Option ${idx + 1}`,
          nombre
        }))
        .sort((a, b) => b.nombre - a.nombre);

      questionsRatees.push({
        questionIndex: qIdx,
        questionTexte: question.question,
        tauxEchec,
        reponseCorrecte: question.options?.[question.reponseCorrecte] || 'N/A',
        reponsesFrequentes
      });
    }

    // Trier par taux d'échec décroissant
    questionsRatees.sort((a, b) => b.tauxEchec - a.tauxEchec);

    return {
      quizId,
      quizTitre: quizData.titre || 'Quiz sans titre',
      disciplineNom: quizData.disciplineNom || '',
      totalPassages: resultats.length,
      moyenneScore: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10,
      tauxReussite: Math.round(
        (scores.filter(s => s >= 10).length / scores.length) * 100
      ),
      tempsEcouleMoyen: Math.round(
        temps.reduce((s, v) => s + v, 0) / temps.length
      ),
      questionsRatees
    };
  } catch (error) {
    console.error('❌ Erreur analyse quiz groupe:', error);
    return null;
  }
}

/**
 * Récupère la liste des quiz disponibles pour la discipline d'un groupe.
 * Permet au prof de sélectionner un quiz à analyser.
 * 
 * @param matiereId - ID de la matière du groupe
 * @returns Liste simplifiée des quiz
 */
export async function getQuizParMatiere(
  matiereId: string
): Promise<{ id: string; titre: string }[]> {
  try {
    const q = query(
      collection(db, 'quizzes'),
      where('disciplineId', '==', matiereId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);

    return snap.docs.map(d => ({
      id: d.id,
      titre: d.data().titre || 'Quiz sans titre'
    }));
  } catch (error) {
    console.error('❌ Erreur récupération quiz par matière:', error);
    return [];
  }
}


// ============================================================
// SECTION 6 : ALERTES PROFESSEUR
// ============================================================

/**
 * Génère les alertes pour le professeur en analysant les élèves de ses groupes.
 * Types d'alertes :
 * - difficulte    : moyenne < 8/20
 * - inactivite    : pas de quiz depuis 7 jours
 * - baisse        : baisse significative de moyenne
 * - felicitation  : élève excellent (>= 16/20)
 * 
 * @param statsEleves - Statistiques des élèves d'un groupe
 * @param groupeNom - Nom du groupe (pour le message)
 * @returns Liste des alertes triées par urgence
 */
export function genererAlertesProf(
  statsEleves: EleveGroupeStats[],
  groupeNom: string
): AlerteProf[] {
  const alertes: AlerteProf[] = [];
  const maintenant = new Date();

  for (const eleve of statsEleves) {
    // ===== Alerte : Élève en difficulté =====
    if (eleve.totalQuiz > 0 && eleve.moyenne < SEUIL_DIFFICULTE) {
      alertes.push({
        id: `diff-${eleve.eleveId}`,
        type: 'difficulte',
        eleveNom: eleve.eleveNom,
        eleveId: eleve.eleveId,
        groupeNom,
        message: `${eleve.eleveNom} a une moyenne de ${eleve.moyenne}/20. `
          + `Lacunes : ${eleve.lacunes.map(l => l.disciplineNom).join(', ') || 'non détectées'}.`,
        niveauUrgence: eleve.moyenne < 5 ? 'critique' : 'important',
        dateCreation: maintenant
      });
    }

    // ===== Alerte : Inactivité =====
    if (eleve.dernierQuiz) {
      const joursInactif = diffJours(eleve.dernierQuiz, maintenant);
      if (joursInactif >= JOURS_INACTIVITE) {
        alertes.push({
          id: `inact-${eleve.eleveId}`,
          type: 'inactivite',
          eleveNom: eleve.eleveNom,
          eleveId: eleve.eleveId,
          groupeNom,
          message: `${eleve.eleveNom} n'a pas fait de quiz depuis ${joursInactif} jours.`,
          niveauUrgence: joursInactif >= 14 ? 'important' : 'info',
          dateCreation: maintenant
        });
      }
    } else if (eleve.totalQuiz === 0) {
      alertes.push({
        id: `inact-${eleve.eleveId}`,
        type: 'inactivite',
        eleveNom: eleve.eleveNom,
        eleveId: eleve.eleveId,
        groupeNom,
        message: `${eleve.eleveNom} n'a encore passé aucun quiz.`,
        niveauUrgence: 'info',
        dateCreation: maintenant
      });
    }

    // ===== Alerte : Baisse significative =====
    if (eleve.tendance === 'baisse' && eleve.totalQuiz >= 4) {
      alertes.push({
        id: `baisse-${eleve.eleveId}`,
        type: 'baisse',
        eleveNom: eleve.eleveNom,
        eleveId: eleve.eleveId,
        groupeNom,
        message: `${eleve.eleveNom} est en baisse de résultats (tendance négative).`,
        niveauUrgence: 'important',
        dateCreation: maintenant
      });
    }

    // ===== Alerte : Félicitation =====
    if (eleve.moyenne >= SEUIL_FELICITATION && eleve.totalQuiz >= 3) {
      alertes.push({
        id: `felicite-${eleve.eleveId}`,
        type: 'felicitation',
        eleveNom: eleve.eleveNom,
        eleveId: eleve.eleveId,
        groupeNom,
        message: `${eleve.eleveNom} excelle avec ${eleve.moyenne}/20 ! 🌟`,
        niveauUrgence: 'info',
        dateCreation: maintenant
      });
    }
  }

  // ===== Trier : critiques d'abord, puis importants, puis info =====
  const ordreUrgence = { critique: 0, important: 1, info: 2 };
  alertes.sort((a, b) => ordreUrgence[a.niveauUrgence] - ordreUrgence[b.niveauUrgence]);

  return alertes;
}


// ============================================================
// SECTION 7 : EXPORT CSV
// ============================================================

/**
 * Génère les données CSV à partir des statistiques des élèves d'un groupe.
 * 
 * @param statsEleves - Statistiques des élèves du groupe
 * @param groupeNom - Nom du groupe (pour le nom du fichier)
 * @returns Contenu CSV prêt à télécharger
 */
export function genererExportCSV(
  statsEleves: EleveGroupeStats[],
  groupeNom: string
): string {
  // ===== En-tête CSV =====
  const headers = [
    'Nom',
    'Email',
    'Moyenne (/20)',
    'Quiz passés',
    'Taux réussite (%)',
    'Streak (jours)',
    'Lacunes principales',
    'Tendance'
  ];

  // ===== Lignes de données =====
  const lignes = statsEleves.map(eleve => {
    const lacunesStr = eleve.lacunes
      .map(l => `${l.disciplineNom} (${l.moyenne}/20)`)
      .join(' | ') || 'Aucune';

    return [
      `"${eleve.eleveNom}"`,
      `"${eleve.eleveEmail}"`,
      eleve.moyenne.toString(),
      eleve.totalQuiz.toString(),
      eleve.tauxReussite.toString(),
      eleve.streak.actuel.toString(),
      `"${lacunesStr}"`,
      eleve.tendance
    ].join(',');
  });

  // ===== Assemblage CSV avec BOM UTF-8 =====
  const bom = '\uFEFF'; // Pour Excel: affichage correct des accents
  return bom + [headers.join(','), ...lignes].join('\n');
}

/**
 * Déclenche le téléchargement d'un fichier CSV dans le navigateur.
 * 
 * @param contenuCSV - Contenu CSV généré par genererExportCSV()
 * @param nomFichier - Nom du fichier sans extension
 */
export function telechargerCSV(contenuCSV: string, nomFichier: string): void {
  const blob = new Blob([contenuCSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${nomFichier}.csv`;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * ============================================================
 * SERVICE PROFESSEUR PHASE 11 — PedaClic (MAJ Phase 14b)
 * ============================================================
 * 
 * Service Firestore pour le Dashboard Analytics Professeurs.
 * Gère : création/gestion des groupes-classes, codes d'invitation
 * PROF-XXXX-XXXX, inscriptions élèves, calcul de statistiques,
 * détection des alertes, analyse par quiz, et export CSV.
 * 
 * ★ MAJ Phase 14b :
 *   - getQuizParMatiere() cherche dans quizzes ET quizzes_v2
 *   - getStatsQuizGroupe() supporte les 2 collections
 * 
 * Fichier : src/services/profGroupeService.ts
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

const CODE_PROF_PREFIX = 'PROF';
const CODE_SEGMENT_LENGTH = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SEUIL_DIFFICULTE = 8;
const JOURS_INACTIVITE = 7;
const SEUIL_BAISSE = 3;
const SEUIL_FELICITATION = 16;


// ==================== UTILITAIRES ====================

function toDate(val: any): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (val?.seconds) return new Timestamp(val.seconds, val.nanoseconds || 0).toDate();
  return new Date(val);
}

function diffJours(d1: Date, d2: Date): number {
  const msParJour = 24 * 60 * 60 * 1000;
  return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / msParJour);
}


// ============================================================
// SECTION 1 : GESTION DES CODES D'INVITATION
// ============================================================

async function genererCodeProf(): Promise<string> {
  let tentatives = 0;
  const maxTentatives = 10;

  while (tentatives < maxTentatives) {
    let segment1 = '';
    let segment2 = '';
    for (let i = 0; i < CODE_SEGMENT_LENGTH; i++) {
      segment1 += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
      segment2 += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    const code = `${CODE_PROF_PREFIX}-${segment1}-${segment2}`;

    const q = query(
      collection(db, 'groupes_prof'),
      where('codeInvitation', '==', code),
      limit(1)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return code;
    }

    tentatives++;
  }

  throw new Error('Impossible de générer un code unique après plusieurs tentatives');
}


// ============================================================
// SECTION 2 : CRUD GROUPES-CLASSES
// ============================================================

export async function creerGroupe(
  profId: string,
  profNom: string,
  formData: GroupeFormData
): Promise<GroupeProf> {
  try {
    const codeInvitation = await genererCodeProf();

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

export async function supprimerGroupe(groupeId: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    const inscriptionsQ = query(
      collection(db, 'inscriptions_groupe'),
      where('groupeId', '==', groupeId)
    );
    const inscriptionsSnap = await getDocs(inscriptionsQ);
    inscriptionsSnap.docs.forEach(d => batch.delete(d.ref));

    batch.delete(doc(db, 'groupes_prof', groupeId));
    await batch.commit();

    console.log(`✅ Groupe ${groupeId} et ses inscriptions supprimés`);
  } catch (error) {
    console.error('❌ Erreur suppression groupe:', error);
    throw new Error('Impossible de supprimer le groupe.');
  }
}

export async function archiverGroupe(groupeId: string): Promise<void> {
  await modifierGroupe(groupeId, { statut: 'archive' });
}

/**
 * Restaure un groupe archivé (statut → actif)
 */
export async function restaurerGroupe(groupeId: string): Promise<void> {
  await modifierGroupe(groupeId, { statut: 'actif' });
}

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

export async function rejoindreGroupe(
  eleveId: string,
  eleveNom: string,
  eleveEmail: string,
  codeInvitation: string
): Promise<InscriptionGroupe> {
  try {
    const codeNormalise = codeInvitation.trim().toUpperCase();

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

    if (groupeData.statut !== 'actif') {
      throw new Error('Ce groupe n\'accepte plus de nouvelles inscriptions.');
    }

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

    const inscriptionData = {
      groupeId: groupeDoc.id,
      eleveId,
      eleveNom,
      eleveEmail,
      statut: 'actif' as const,
      dateInscription: new Date()
    };

    const inscRef = await addDoc(collection(db, 'inscriptions_groupe'), inscriptionData);

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
    throw error;
  }
}

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

export async function getGroupesEleve(eleveId: string): Promise<GroupeProf[]> {
  try {
    const inscQ = query(
      collection(db, 'inscriptions_groupe'),
      where('eleveId', '==', eleveId),
      where('statut', '==', 'actif')
    );
    const inscSnap = await getDocs(inscQ);

    if (inscSnap.empty) return [];

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

export async function retirerEleve(
  inscriptionId: string,
  groupeId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'inscriptions_groupe', inscriptionId), {
      statut: 'retire',
      dateRetrait: new Date()
    });

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

export async function getStatsGroupe(groupeId: string): Promise<StatsGroupe> {
  try {
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

    // Récupérer les résultats de quiz par lots de 10 (limite Firestore 'in')
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

    // Calculer les statistiques par élève
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

    // Agréger les statistiques globales
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

export async function getStatsElevesGroupe(groupeId: string): Promise<EleveGroupeStats[]> {
  try {
    const inscriptions = await getElevesGroupe(groupeId);

    if (inscriptions.length === 0) return [];

    const statsEleves: EleveGroupeStats[] = [];

    for (const insc of inscriptions) {
      try {
        const suivi = await getSuiviComplet(insc.eleveId);

        const qResults = query(
          collection(db, 'quiz_results'),
          where('userId', '==', insc.eleveId),
          orderBy('datePassage', 'desc')
        );
        const resultsSnap = await getDocs(qResults);
        const resultats = resultsSnap.docs.map(d => d.data());

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

        let tendance: 'hausse' | 'baisse' | 'stable' = 'stable';
        if (resultats.length >= 4) {
          const recents = resultats.slice(0, Math.ceil(resultats.length / 2));
          const anciens = resultats.slice(Math.ceil(resultats.length / 2));
          const moyRecente = recents.reduce((s, r) => s + (r.score || 0), 0) / recents.length;
          const moyAncienne = anciens.reduce((s, r) => s + (r.score || 0), 0) / anciens.length;
          if (moyRecente - moyAncienne > 1) tendance = 'hausse';
          else if (moyAncienne - moyRecente > 1) tendance = 'baisse';
        }

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

    statsEleves.sort((a, b) => b.moyenne - a.moyenne);

    return statsEleves;
  } catch (error) {
    console.error('❌ Erreur stats élèves groupe:', error);
    throw new Error('Impossible de charger les statistiques des élèves.');
  }
}


// ============================================================
// SECTION 5 : ANALYSE PAR QUIZ (★ MAJ Phase 14b)
// ============================================================

/**
 * ★ Analyse les résultats d'un quiz au sein d'un groupe.
 * Supporte les quiz des 2 collections (quizzes + quizzes_v2).
 */
export async function getStatsQuizGroupe(
  groupeId: string,
  quizId: string,
  quizSource?: string
): Promise<StatsQuizGroupe | null> {
  try {
    // 1. Récupérer les élèves du groupe
    const inscriptions = await getElevesGroupe(groupeId);
    const eleveIds = inscriptions.map(i => i.eleveId);
    if (eleveIds.length === 0) return null;

    // 2. Récupérer le quiz (essayer les 2 collections)
    let quizData: any = null;
    let collectionResultats = 'quiz_results';

    if (quizSource === 'quizzes_v2') {
      const docSnap = await getDoc(doc(db, 'quizzes_v2', quizId));
      if (docSnap.exists()) {
        quizData = docSnap.data();
        collectionResultats = 'quiz_results_v2';
      }
    } else if (quizSource === 'quizzes') {
      const docSnap = await getDoc(doc(db, 'quizzes', quizId));
      if (docSnap.exists()) {
        quizData = docSnap.data();
        collectionResultats = 'quiz_results';
      }
    } else {
      const docV2 = await getDoc(doc(db, 'quizzes_v2', quizId));
      if (docV2.exists()) {
        quizData = docV2.data();
        collectionResultats = 'quiz_results_v2';
      } else {
        const docV1 = await getDoc(doc(db, 'quizzes', quizId));
        if (docV1.exists()) {
          quizData = docV1.data();
          collectionResultats = 'quiz_results';
        }
      }
    }

    if (!quizData) return null;

    // 3. Récupérer les résultats des élèves du groupe
    const resultats: any[] = [];
    const lots = [];
    for (let i = 0; i < eleveIds.length; i += 10) {
      lots.push(eleveIds.slice(i, i + 10));
    }

    for (const lot of lots) {
      const q = query(
        collection(db, collectionResultats),
        where('quizId', '==', quizId),
        where('userId', 'in', lot)
      );
      const snap = await getDocs(q);
      snap.docs.forEach(d => resultats.push(d.data()));
    }

    if (resultats.length === 0) return null;

    // 4. Calculer les statistiques
    const isV2 = collectionResultats === 'quiz_results_v2';

    const scores = resultats.map(r => {
      if (isV2) {
        return r.note20 || (r.scoreMax > 0 ? (r.score / r.scoreMax) * 20 : 0);
      }
      return r.score || 0;
    });
    const temps = resultats.map(r => r.tempsEcoule || 0);

    // 5. Analyser les questions ratées
    const questionsRatees: QuestionRatee[] = [];

    if (isV2 && quizData.questions) {
      for (let qIdx = 0; qIdx < quizData.questions.length; qIdx++) {
        const question = quizData.questions[qIdx];
        let echecs = 0;
        let passages = 0;

        for (const result of resultats) {
          const detail = result.detailsParQuestion?.find(
            (d: any) => d.questionId === question.id
          );
          if (detail) {
            passages++;
            if (!detail.isCorrect) echecs++;
          }
        }

        const tauxEchec = passages > 0 ? Math.round((echecs / passages) * 100) : 0;
        const enonceTexte = question.enonce?.replace(/<[^>]*>/g, '').trim() || `Question ${qIdx + 1}`;

        questionsRatees.push({
          questionIndex: qIdx,
          questionTexte: enonceTexte,
          tauxEchec,
          reponseCorrecte: 'Voir correction détaillée',
          reponsesFrequentes: []
        });
      }
    } else if (quizData.questions) {
      for (let qIdx = 0; qIdx < quizData.questions.length; qIdx++) {
        const question = quizData.questions[qIdx];
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
    }

    questionsRatees.sort((a, b) => b.tauxEchec - a.tauxEchec);

    return {
      quizId,
      quizTitre: quizData.titre || 'Quiz sans titre',
      disciplineNom: quizData.disciplineNom || quizData.matiereNom || '',
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
 * ★ Récupère les quiz disponibles pour une discipline.
 * Cherche dans les 2 collections : quizzes (Phase 6) ET quizzes_v2 (Phase 12).
 */
export async function getQuizParMatiere(
  matiereId: string
): Promise<{ id: string; titre: string; source?: string }[]> {
  try {
    const resultats: { id: string; titre: string; source?: string }[] = [];

    // 1. Chercher dans 'quizzes' (quiz simples Phase 6)
    try {
      const q1 = query(
        collection(db, 'quizzes'),
        where('disciplineId', '==', matiereId),
        orderBy('createdAt', 'desc')
      );
      const snap1 = await getDocs(q1);
      snap1.docs.forEach(d => {
        resultats.push({
          id: d.id,
          titre: d.data().titre || 'Quiz sans titre',
          source: 'quizzes'
        });
      });
    } catch (err) {
      console.warn('⚠️ Recherche quizzes échouée (index manquant ?):', err);
    }

    // 2. Chercher dans 'quizzes_v2' (quiz avancés Phase 12)
    try {
      const q2 = query(
        collection(db, 'quizzes_v2'),
        where('disciplineId', '==', matiereId),
        orderBy('createdAt', 'desc')
      );
      const snap2 = await getDocs(q2);
      snap2.docs.forEach(d => {
        resultats.push({
          id: d.id,
          titre: d.data().titre || 'Quiz avancé sans titre',
          source: 'quizzes_v2'
        });
      });
    } catch (err) {
      console.warn('⚠️ Recherche quizzes_v2 échouée (index manquant ?):', err);
    }

    console.log(`✅ ${resultats.length} quiz trouvé(s) pour discipline ${matiereId}`);
    return resultats;
  } catch (error) {
    console.error('❌ Erreur récupération quiz par matière:', error);
    return [];
  }
}


// ============================================================
// SECTION 6 : ALERTES PROFESSEUR
// ============================================================

export function genererAlertesProf(
  statsEleves: EleveGroupeStats[],
  groupeNom: string
): AlerteProf[] {
  const alertes: AlerteProf[] = [];
  const maintenant = new Date();

  for (const eleve of statsEleves) {
    // Alerte : Élève en difficulté
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

    // Alerte : Inactivité
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

    // Alerte : Baisse significative
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

    // Alerte : Félicitation
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

  const ordreUrgence = { critique: 0, important: 1, info: 2 };
  alertes.sort((a, b) => ordreUrgence[a.niveauUrgence] - ordreUrgence[b.niveauUrgence]);

  return alertes;
}


// ============================================================
// SECTION 7 : EXPORT CSV
// ============================================================

export function genererExportCSV(
  statsEleves: EleveGroupeStats[],
  groupeNom: string
): string {
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

  const bom = '\uFEFF';
  return bom + [headers.join(','), ...lignes].join('\n');
}

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

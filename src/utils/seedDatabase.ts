/**
 * ============================================================
 * SCRIPT DE SEED - DONNÉES DE TEST PEDACLIC
 * ============================================================
 * 
 * Ce script crée des données de test dans Firestore :
 * - Disciplines (Mathématiques, Français, SVT, etc.)
 * - Ressources (Cours, Exercices, Vidéos)
 * 
 * Usage : Importer et appeler seedDatabase() depuis la console
 * ou créer une page admin temporaire.
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  writeBatch,
  Timestamp 
} from 'firebase/firestore';

// ==================== TYPES ====================

interface DisciplineSeed {
  id: string;
  nom: string;
  description: string;
  niveau: 'college' | 'lycee' | 'tous';
  classe: string;
  coefficient: number;
  icone: string;
  couleur: string;
  ordre: number;
}

interface ResourceSeed {
  id: string;
  disciplineId: string;
  titre: string;
  type: 'cours' | 'exercice' | 'video' | 'document' | 'quiz';
  contenu: string;
  description: string;
  chapitre: string;
  ordre: number;
  isPremium: boolean;
  dureeEstimee?: number;
  tags: string[];
}

// ==================== DONNÉES DE TEST ====================

/**
 * Disciplines du système éducatif sénégalais
 */
const DISCIPLINES: DisciplineSeed[] = [
  {
    id: 'mathematiques-3eme',
    nom: 'Mathématiques',
    description: 'Algèbre, géométrie, statistiques et probabilités pour le BFEM',
    niveau: 'college',
    classe: '3ème',
    coefficient: 4,
    icone: '📐',
    couleur: '#2563eb',
    ordre: 1
  },
  {
    id: 'francais-3eme',
    nom: 'Français',
    description: 'Grammaire, conjugaison, rédaction et littérature',
    niveau: 'college',
    classe: '3ème',
    coefficient: 4,
    icone: '📖',
    couleur: '#dc2626',
    ordre: 2
  },
  {
    id: 'svt-3eme',
    nom: 'Sciences de la Vie et de la Terre',
    description: 'Biologie, géologie et environnement',
    niveau: 'college',
    classe: '3ème',
    coefficient: 2,
    icone: '🌿',
    couleur: '#059669',
    ordre: 3
  },
  {
    id: 'histoire-geo-3eme',
    nom: 'Histoire-Géographie',
    description: 'Histoire du Sénégal, de l\'Afrique et du monde. Géographie physique et humaine.',
    niveau: 'college',
    classe: '3ème',
    coefficient: 3,
    icone: '🌍',
    couleur: '#d97706',
    ordre: 4
  },
  {
    id: 'physique-chimie-3eme',
    nom: 'Physique-Chimie',
    description: 'Mécanique, électricité, optique et réactions chimiques',
    niveau: 'college',
    classe: '3ème',
    coefficient: 2,
    icone: '⚗️',
    couleur: '#7c3aed',
    ordre: 5
  },
  {
    id: 'anglais-3eme',
    nom: 'Anglais',
    description: 'Grammaire, vocabulaire, compréhension et expression',
    niveau: 'college',
    classe: '3ème',
    coefficient: 2,
    icone: '🇬🇧',
    couleur: '#0891b2',
    ordre: 6
  },
  // Lycée - Terminale
  {
    id: 'mathematiques-tle',
    nom: 'Mathématiques',
    description: 'Analyse, algèbre linéaire, probabilités pour le BAC',
    niveau: 'lycee',
    classe: 'Terminale S',
    coefficient: 5,
    icone: '📐',
    couleur: '#2563eb',
    ordre: 7
  },
  {
    id: 'philosophie-tle',
    nom: 'Philosophie',
    description: 'Réflexion critique, dissertation et commentaire de texte',
    niveau: 'lycee',
    classe: 'Terminale',
    coefficient: 4,
    icone: '🤔',
    couleur: '#6366f1',
    ordre: 8
  }
];

/**
 * Ressources pédagogiques de test
 */
const RESOURCES: ResourceSeed[] = [
  // ===== MATHÉMATIQUES 3ème =====
  {
    id: 'math-3-chap1-cours1',
    disciplineId: 'mathematiques-3eme',
    titre: 'Les nombres rationnels - Définition et propriétés',
    type: 'cours',
    contenu: `
      <h2>1. Définition</h2>
      <p>Un <strong>nombre rationnel</strong> est un nombre qui peut s'écrire sous la forme d'une fraction a/b où a et b sont des entiers relatifs et b ≠ 0.</p>
      
      <h2>2. Exemples</h2>
      <ul>
        <li>3/4 est un nombre rationnel</li>
        <li>-5/2 est un nombre rationnel</li>
        <li>7 = 7/1 est un nombre rationnel</li>
      </ul>
      
      <h2>3. Propriétés</h2>
      <p>Les nombres rationnels sont <strong>fermés</strong> pour l'addition, la soustraction, la multiplication et la division (sauf par zéro).</p>
      
      <h2>4. Représentation décimale</h2>
      <p>Tout nombre rationnel a une écriture décimale <strong>périodique</strong> ou <strong>finie</strong>.</p>
    `,
    description: 'Comprendre les nombres rationnels et leurs propriétés fondamentales',
    chapitre: 'Chapitre 1 - Nombres rationnels',
    ordre: 1,
    isPremium: false,
    dureeEstimee: 30,
    tags: ['nombres', 'fractions', 'rationnels', 'BFEM']
  },
  {
    id: 'math-3-chap1-exo1',
    disciplineId: 'mathematiques-3eme',
    titre: 'Exercices - Opérations sur les rationnels',
    type: 'exercice',
    contenu: `
      <h2>Exercice 1 : Simplification</h2>
      <p>Simplifier les fractions suivantes :</p>
      <ol>
        <li>12/18</li>
        <li>35/49</li>
        <li>-24/36</li>
      </ol>
      
      <h2>Exercice 2 : Additions et soustractions</h2>
      <p>Calculer :</p>
      <ol>
        <li>2/3 + 5/6</li>
        <li>7/4 - 3/8</li>
        <li>-2/5 + 3/10</li>
      </ol>
      
      <h2>Exercice 3 : Multiplications et divisions</h2>
      <p>Calculer et simplifier :</p>
      <ol>
        <li>3/4 × 8/9</li>
        <li>5/6 ÷ 15/18</li>
      </ol>
    `,
    description: '15 exercices progressifs sur les opérations avec les nombres rationnels',
    chapitre: 'Chapitre 1 - Nombres rationnels',
    ordre: 2,
    isPremium: false,
    dureeEstimee: 45,
    tags: ['exercices', 'fractions', 'calcul', 'BFEM']
  },
  {
    id: 'math-3-chap1-video1',
    disciplineId: 'mathematiques-3eme',
    titre: 'Vidéo - Comprendre les fractions',
    type: 'video',
    contenu: `
      <p>Cette vidéo explique de manière visuelle comment manipuler les fractions.</p>
      <p><strong>Durée :</strong> 12 minutes</p>
      <p><strong>Points abordés :</strong></p>
      <ul>
        <li>Représentation graphique des fractions</li>
        <li>Fractions équivalentes</li>
        <li>Simplification pas à pas</li>
      </ul>
    `,
    description: 'Explication visuelle des fractions et de leur manipulation',
    chapitre: 'Chapitre 1 - Nombres rationnels',
    ordre: 3,
    isPremium: true,
    dureeEstimee: 12,
    tags: ['vidéo', 'fractions', 'visuel']
  },
  {
    id: 'math-3-chap2-cours1',
    disciplineId: 'mathematiques-3eme',
    titre: 'Équations du premier degré',
    type: 'cours',
    contenu: `
      <h2>1. Définition</h2>
      <p>Une <strong>équation du premier degré</strong> à une inconnue x est une équation qui peut se ramener à la forme ax + b = 0, où a ≠ 0.</p>
      
      <h2>2. Méthode de résolution</h2>
      <ol>
        <li>Regrouper les termes en x d'un côté</li>
        <li>Regrouper les constantes de l'autre côté</li>
        <li>Isoler x</li>
      </ol>
      
      <h2>3. Exemple</h2>
      <p>Résoudre : 3x + 5 = 2x - 7</p>
      <p>3x - 2x = -7 - 5</p>
      <p>x = -12</p>
      
      <h2>4. Vérification</h2>
      <p>3(-12) + 5 = -36 + 5 = -31</p>
      <p>2(-12) - 7 = -24 - 7 = -31 ✓</p>
    `,
    description: 'Apprendre à résoudre les équations du premier degré',
    chapitre: 'Chapitre 2 - Équations',
    ordre: 1,
    isPremium: false,
    dureeEstimee: 35,
    tags: ['équations', 'algèbre', 'BFEM']
  },
  {
    id: 'math-3-chap2-exo1',
    disciplineId: 'mathematiques-3eme',
    titre: 'Exercices - Résolution d\'équations',
    type: 'exercice',
    contenu: `
      <h2>Niveau 1 : Équations simples</h2>
      <ol>
        <li>2x + 3 = 11</li>
        <li>5x - 7 = 18</li>
        <li>-3x + 4 = -8</li>
      </ol>
      
      <h2>Niveau 2 : Équations avec x des deux côtés</h2>
      <ol>
        <li>4x + 2 = 2x + 10</li>
        <li>7x - 3 = 3x + 13</li>
        <li>2(x + 3) = 3x - 1</li>
      </ol>
      
      <h2>Niveau 3 : Problèmes</h2>
      <p>Moussa a le triple de l'âge de son fils. Dans 10 ans, il n'aura que le double. Quels sont leurs âges actuels ?</p>
    `,
    description: 'Exercices progressifs de résolution d\'équations',
    chapitre: 'Chapitre 2 - Équations',
    ordre: 2,
    isPremium: true,
    dureeEstimee: 50,
    tags: ['exercices', 'équations', 'BFEM']
  },
  
  // ===== FRANÇAIS 3ème =====
  {
    id: 'fr-3-chap1-cours1',
    disciplineId: 'francais-3eme',
    titre: 'La proposition subordonnée relative',
    type: 'cours',
    contenu: `
      <h2>1. Définition</h2>
      <p>La <strong>proposition subordonnée relative</strong> est une proposition introduite par un pronom relatif (qui, que, dont, où, lequel...) qui complète un nom appelé <strong>antécédent</strong>.</p>
      
      <h2>2. Les pronoms relatifs</h2>
      <ul>
        <li><strong>Qui</strong> : sujet - "L'élève <u>qui travaille</u> réussit."</li>
        <li><strong>Que</strong> : COD - "Le livre <u>que je lis</u> est passionnant."</li>
        <li><strong>Dont</strong> : complément introduit par "de" - "La fille <u>dont je parle</u> est ma cousine."</li>
        <li><strong>Où</strong> : lieu ou temps - "La ville <u>où je suis né</u> s'appelle Dakar."</li>
      </ul>
      
      <h2>3. Fonction de la relative</h2>
      <p>La proposition subordonnée relative est toujours <strong>complément de l'antécédent</strong>.</p>
    `,
    description: 'Maîtriser les propositions subordonnées relatives',
    chapitre: 'Chapitre 1 - La phrase complexe',
    ordre: 1,
    isPremium: false,
    dureeEstimee: 25,
    tags: ['grammaire', 'relatives', 'BFEM']
  },
  {
    id: 'fr-3-chap1-exo1',
    disciplineId: 'francais-3eme',
    titre: 'Exercices - Les propositions relatives',
    type: 'exercice',
    contenu: `
      <h2>Exercice 1 : Identifier</h2>
      <p>Soulignez les propositions relatives et encadrez l'antécédent :</p>
      <ol>
        <li>Le professeur qui enseigne les mathématiques est absent.</li>
        <li>J'ai lu le roman dont tu m'as parlé.</li>
        <li>La maison où j'habite est ancienne.</li>
      </ol>
      
      <h2>Exercice 2 : Compléter</h2>
      <p>Complétez avec le pronom relatif qui convient :</p>
      <ol>
        <li>L'ami ... m'a aidé est généreux.</li>
        <li>Le stylo ... j'ai acheté ne marche plus.</li>
        <li>C'est le village ... je suis originaire.</li>
      </ol>
      
      <h2>Exercice 3 : Rédiger</h2>
      <p>Écrivez 3 phrases contenant chacune une proposition relative différente.</p>
    `,
    description: 'Exercices d\'application sur les relatives',
    chapitre: 'Chapitre 1 - La phrase complexe',
    ordre: 2,
    isPremium: false,
    dureeEstimee: 30,
    tags: ['exercices', 'grammaire', 'relatives']
  },
  
  // ===== SVT 3ème =====
  {
    id: 'svt-3-chap1-cours1',
    disciplineId: 'svt-3eme',
    titre: 'La reproduction humaine',
    type: 'cours',
    contenu: `
      <h2>1. Les appareils reproducteurs</h2>
      <p>L'être humain possède un appareil reproducteur qui diffère selon le sexe.</p>
      
      <h2>2. L'appareil reproducteur masculin</h2>
      <p>Il comprend les testicules (production de spermatozoïdes), les voies génitales et le pénis.</p>
      
      <h2>3. L'appareil reproducteur féminin</h2>
      <p>Il comprend les ovaires (production d'ovules), les trompes, l'utérus et le vagin.</p>
      
      <h2>4. La fécondation</h2>
      <p>La <strong>fécondation</strong> est la fusion d'un spermatozoïde et d'un ovule pour former une cellule-œuf.</p>
      
      <h2>5. La grossesse</h2>
      <p>La cellule-œuf se développe dans l'utérus pendant 9 mois environ.</p>
    `,
    description: 'Comprendre la reproduction humaine et son fonctionnement',
    chapitre: 'Chapitre 1 - Reproduction et sexualité',
    ordre: 1,
    isPremium: false,
    dureeEstimee: 40,
    tags: ['reproduction', 'biologie', 'BFEM']
  },
  
  // ===== HISTOIRE-GÉO 3ème =====
  {
    id: 'hg-3-chap1-cours1',
    disciplineId: 'histoire-geo-3eme',
    titre: 'L\'indépendance du Sénégal',
    type: 'cours',
    contenu: `
      <h2>1. Le contexte colonial</h2>
      <p>Le Sénégal était une colonie française depuis le XIXe siècle. Dakar était la capitale de l'AOF (Afrique Occidentale Française).</p>
      
      <h2>2. Les mouvements indépendantistes</h2>
      <p>Après la Seconde Guerre mondiale, les mouvements pour l'indépendance se renforcent. Des leaders comme <strong>Léopold Sédar Senghor</strong> et <strong>Mamadou Dia</strong> émergent.</p>
      
      <h2>3. La Fédération du Mali</h2>
      <p>En 1959, le Sénégal et le Soudan français forment la Fédération du Mali, qui accède à l'indépendance le 20 juin 1960.</p>
      
      <h2>4. L'indépendance du Sénégal</h2>
      <p>La fédération éclate en août 1960. Le <strong>4 avril 1960</strong> est retenu comme date officielle de l'indépendance du Sénégal.</p>
      <p>Léopold Sédar Senghor devient le premier Président de la République du Sénégal.</p>
    `,
    description: 'L\'histoire de l\'accession du Sénégal à l\'indépendance',
    chapitre: 'Chapitre 1 - La décolonisation en Afrique',
    ordre: 1,
    isPremium: false,
    dureeEstimee: 35,
    tags: ['Sénégal', 'indépendance', 'histoire', 'BFEM']
  },
  {
    id: 'hg-3-chap1-quiz1',
    disciplineId: 'histoire-geo-3eme',
    titre: 'Quiz - L\'indépendance du Sénégal',
    type: 'quiz',
    contenu: `
      <p>Testez vos connaissances sur l'indépendance du Sénégal !</p>
      <p><strong>10 questions</strong> - Durée estimée : 10 minutes</p>
    `,
    description: 'Quiz interactif sur l\'indépendance du Sénégal',
    chapitre: 'Chapitre 1 - La décolonisation en Afrique',
    ordre: 2,
    isPremium: true,
    dureeEstimee: 10,
    tags: ['quiz', 'Sénégal', 'histoire']
  }
];

// ==================== FONCTIONS DE SEED ====================

/**
 * Créer les disciplines dans Firestore
 */
export async function seedDisciplines(): Promise<void> {
  console.log('🌱 Création des disciplines...');
  
  const batch = writeBatch(db);
  
  for (const discipline of DISCIPLINES) {
    const docRef = doc(db, 'disciplines', discipline.id);
    batch.set(docRef, {
      ...discipline,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    console.log(`  ✓ ${discipline.nom} (${discipline.classe})`);
  }
  
  await batch.commit();
  console.log(`✅ ${DISCIPLINES.length} disciplines créées !`);
}

/**
 * Créer les ressources dans Firestore
 */
export async function seedResources(): Promise<void> {
  console.log('🌱 Création des ressources...');
  
  const batch = writeBatch(db);
  
  for (const resource of RESOURCES) {
    const docRef = doc(db, 'resources', resource.id);
    batch.set(docRef, {
      ...resource,
      auteurId: 'admin-seed',
      fichierURL: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    console.log(`  ✓ ${resource.titre}`);
  }
  
  await batch.commit();
  console.log(`✅ ${RESOURCES.length} ressources créées !`);
}

/**
 * Fonction principale de seed
 */
export async function seedDatabase(): Promise<void> {
  console.log('');
  console.log('========================================');
  console.log('🚀 SEED PEDACLIC - Données de test');
  console.log('========================================');
  console.log('');
  
  try {
    await seedDisciplines();
    console.log('');
    await seedResources();
    
    console.log('');
    console.log('========================================');
    console.log('✅ SEED TERMINÉ AVEC SUCCÈS !');
    console.log('========================================');
    console.log('');
    console.log('Données créées :');
    console.log(`  - ${DISCIPLINES.length} disciplines`);
    console.log(`  - ${RESOURCES.length} ressources`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur lors du seed :', error);
    throw error;
  }
}

/**
 * Supprimer toutes les données de test
 */
export async function clearDatabase(): Promise<void> {
  console.log('🗑️ Suppression des données de test...');
  
  const batch = writeBatch(db);
  
  // Supprimer les disciplines
  for (const discipline of DISCIPLINES) {
    const docRef = doc(db, 'disciplines', discipline.id);
    batch.delete(docRef);
  }
  
  // Supprimer les ressources
  for (const resource of RESOURCES) {
    const docRef = doc(db, 'resources', resource.id);
    batch.delete(docRef);
  }
  
  await batch.commit();
  console.log('✅ Données supprimées !');
}

// Export des données pour référence
export { DISCIPLINES, RESOURCES };

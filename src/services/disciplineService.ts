/**
 * ============================================
 * SERVICE DISCIPLINES - CRUD Firebase
 * ============================================
 * 
 * Service pour gérer les opérations CRUD sur les disciplines
 * dans Firestore :
 * - Création de discipline
 * - Lecture (toutes, par niveau, par ID)
 * - Mise à jour
 * - Suppression
 * 
 * @author PedaClic Team
 * @version 2.0.0
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

/* ==================== TYPES ==================== */

/**
 * Niveaux scolaires
 */
export type Niveau = 'college' | 'lycee';

/**
 * Classes disponibles
 */
export type Classe = 
  | '6eme' | '5eme' | '4eme' | '3eme'  // Collège
  | '2nde' | '1ere' | 'Terminale';      // Lycée

/**
 * Interface pour une discipline
 */
export interface Discipline {
  id: string;
  nom: string;
  niveau: Niveau;
  classe: Classe;
  ordre: number;
  coefficient?: number;
  couleur?: string;
  icone?: string;
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Données pour créer/modifier une discipline
 */
export interface DisciplineData {
  nom: string;
  niveau: Niveau;
  classe: Classe;
  ordre: number;
  coefficient?: number;
  couleur?: string;
  icone?: string;
  description?: string;
}

/**
 * Résultat d'opération générique
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/* ==================== CONSTANTES ==================== */

const COLLECTION_NAME = 'disciplines';

/* ==================== HELPERS ==================== */

/**
 * Convertit un document Firestore en objet Discipline
 */
const convertToDiscipline = (docSnapshot: any): Discipline => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    nom: data.nom,
    niveau: data.niveau,
    classe: data.classe,
    ordre: data.ordre || 0,
    coefficient: data.coefficient,
    couleur: data.couleur,
    icone: data.icone,
    description: data.description,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate()
  };
};

/* ==================== FONCTIONS CRUD ==================== */

/**
 * Crée une nouvelle discipline
 * 
 * @param data - Données de la discipline à créer
 * @returns Résultat avec l'ID de la discipline créée
 * 
 * @example
 * const result = await createDiscipline({
 *   nom: 'Mathématiques',
 *   niveau: 'college',
 *   classe: '6eme',
 *   ordre: 1,
 *   coefficient: 4
 * });
 */
export const createDiscipline = async (
  data: DisciplineData
): Promise<OperationResult<{ id: string }>> => {
  try {
    const disciplinesRef = collection(db, COLLECTION_NAME);
    
    const docRef = await addDoc(disciplinesRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return {
      success: true,
      data: { id: docRef.id }
    };
  } catch (error: any) {
    console.error('Erreur lors de la création de la discipline:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la création de la discipline.'
    };
  }
};

/**
 * Récupère une discipline par son ID
 * 
 * @param id - ID de la discipline
 * @returns La discipline ou null si non trouvée
 */
export const getDisciplineById = async (
  id: string
): Promise<OperationResult<Discipline>> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnapshot = await getDoc(docRef);

    if (!docSnapshot.exists()) {
      return {
        success: false,
        error: 'Discipline non trouvée.'
      };
    }

    return {
      success: true,
      data: convertToDiscipline(docSnapshot)
    };
  } catch (error: any) {
    console.error('Erreur lors de la récupération de la discipline:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la récupération de la discipline.'
    };
  }
};

/**
 * Récupère toutes les disciplines
 * 
 * @returns Liste de toutes les disciplines triées par ordre
 */
export const getAllDisciplines = async (): Promise<OperationResult<Discipline[]>> => {
  try {
    const disciplinesRef = collection(db, COLLECTION_NAME);
    const q = query(disciplinesRef, orderBy('ordre', 'asc'));
    const querySnapshot = await getDocs(q);

    const disciplines: Discipline[] = [];
    querySnapshot.forEach((doc) => {
      disciplines.push(convertToDiscipline(doc));
    });

    return {
      success: true,
      data: disciplines
    };
  } catch (error: any) {
    console.error('Erreur lors de la récupération des disciplines:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la récupération des disciplines.'
    };
  }
};

/**
 * Récupère les disciplines par niveau
 * 
 * @param niveau - Niveau scolaire ('college' | 'lycee')
 * @returns Liste des disciplines du niveau spécifié
 */
export const getDisciplinesByNiveau = async (
  niveau: Niveau
): Promise<OperationResult<Discipline[]>> => {
  try {
    const disciplinesRef = collection(db, COLLECTION_NAME);
    const q = query(
      disciplinesRef,
      where('niveau', '==', niveau),
      orderBy('ordre', 'asc')
    );
    const querySnapshot = await getDocs(q);

    const disciplines: Discipline[] = [];
    querySnapshot.forEach((doc) => {
      disciplines.push(convertToDiscipline(doc));
    });

    return {
      success: true,
      data: disciplines
    };
  } catch (error: any) {
    console.error('Erreur lors de la récupération des disciplines par niveau:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la récupération des disciplines.'
    };
  }
};

/**
 * Récupère les disciplines par classe
 * 
 * @param classe - Classe spécifique ('6eme', '3eme', 'Terminale', etc.)
 * @returns Liste des disciplines de la classe spécifiée
 */
export const getDisciplinesByClasse = async (
  classe: Classe
): Promise<OperationResult<Discipline[]>> => {
  try {
    const disciplinesRef = collection(db, COLLECTION_NAME);
    const q = query(
      disciplinesRef,
      where('classe', '==', classe),
      orderBy('ordre', 'asc')
    );
    const querySnapshot = await getDocs(q);

    const disciplines: Discipline[] = [];
    querySnapshot.forEach((doc) => {
      disciplines.push(convertToDiscipline(doc));
    });

    return {
      success: true,
      data: disciplines
    };
  } catch (error: any) {
    console.error('Erreur lors de la récupération des disciplines par classe:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la récupération des disciplines.'
    };
  }
};

/**
 * Met à jour une discipline
 * 
 * @param id - ID de la discipline à mettre à jour
 * @param data - Données partielles à mettre à jour
 * @returns Résultat de l'opération
 */
export const updateDiscipline = async (
  id: string,
  data: Partial<DisciplineData>
): Promise<OperationResult> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    
    // Vérifier que le document existe
    const docSnapshot = await getDoc(docRef);
    if (!docSnapshot.exists()) {
      return {
        success: false,
        error: 'Discipline non trouvée.'
      };
    }

    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de la discipline:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la mise à jour de la discipline.'
    };
  }
};

/**
 * Supprime une discipline
 * 
 * @param id - ID de la discipline à supprimer
 * @returns Résultat de l'opération
 * 
 * ⚠️ ATTENTION : Cette opération supprime également toutes les ressources
 * associées à cette discipline (cascade delete à implémenter si nécessaire)
 */
export const deleteDiscipline = async (
  id: string
): Promise<OperationResult> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    
    // Vérifier que le document existe
    const docSnapshot = await getDoc(docRef);
    if (!docSnapshot.exists()) {
      return {
        success: false,
        error: 'Discipline non trouvée.'
      };
    }

    await deleteDoc(docRef);

    return { success: true };
  } catch (error: any) {
    console.error('Erreur lors de la suppression de la discipline:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la suppression de la discipline.'
    };
  }
};

/* ==================== FONCTIONS UTILITAIRES ==================== */

/**
 * Initialise les disciplines par défaut
 * Utile pour le premier déploiement ou la réinitialisation
 * 
 * @returns Résultat de l'opération avec le nombre de disciplines créées
 */
export const initializeDefaultDisciplines = async (): Promise<OperationResult<{ count: number }>> => {
  const defaultDisciplines: DisciplineData[] = [
    // Collège - 6ème
    { nom: 'Français', niveau: 'college', classe: '6eme', ordre: 1, coefficient: 3, couleur: '#3b82f6', description: 'Langue française, grammaire, conjugaison, littérature' },
    { nom: 'Mathématiques', niveau: 'college', classe: '6eme', ordre: 2, coefficient: 3, couleur: '#ef4444', description: 'Nombres, géométrie, calculs, problèmes' },
    { nom: 'Anglais', niveau: 'college', classe: '6eme', ordre: 3, coefficient: 2, couleur: '#8b5cf6', description: 'Langue anglaise, vocabulaire, grammaire' },
    { nom: 'Histoire-Géographie', niveau: 'college', classe: '6eme', ordre: 4, coefficient: 2, couleur: '#f59e0b', description: 'Histoire et géographie du monde' },
    { nom: 'SVT', niveau: 'college', classe: '6eme', ordre: 5, coefficient: 2, couleur: '#10b981', description: 'Sciences de la Vie et de la Terre' },
    
    // Collège - 3ème
    { nom: 'Français', niveau: 'college', classe: '3eme', ordre: 1, coefficient: 4, couleur: '#3b82f6', description: 'Préparation au BFEM - Français' },
    { nom: 'Mathématiques', niveau: 'college', classe: '3eme', ordre: 2, coefficient: 4, couleur: '#ef4444', description: 'Préparation au BFEM - Mathématiques' },
    { nom: 'Physique-Chimie', niveau: 'college', classe: '3eme', ordre: 3, coefficient: 3, couleur: '#06b6d4', description: 'Sciences physiques et chimiques' },
    
    // Lycée - Terminale
    { nom: 'Philosophie', niveau: 'lycee', classe: 'Terminale', ordre: 1, coefficient: 5, couleur: '#6366f1', description: 'Préparation au BAC - Philosophie' },
    { nom: 'Mathématiques', niveau: 'lycee', classe: 'Terminale', ordre: 2, coefficient: 5, couleur: '#ef4444', description: 'Préparation au BAC - Mathématiques' },
    { nom: 'Physique-Chimie', niveau: 'lycee', classe: 'Terminale', ordre: 3, coefficient: 4, couleur: '#06b6d4', description: 'Préparation au BAC - Physique-Chimie' },
    { nom: 'SVT', niveau: 'lycee', classe: 'Terminale', ordre: 4, coefficient: 4, couleur: '#10b981', description: 'Préparation au BAC - SVT' }
  ];

  try {
    let count = 0;

    for (const discipline of defaultDisciplines) {
      const result = await createDiscipline(discipline);
      if (result.success) count++;
    }

    return {
      success: true,
      data: { count }
    };
  } catch (error: any) {
    console.error('Erreur lors de l\'initialisation des disciplines:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de l\'initialisation.'
    };
  }
};

/* ==================== EXPORT PAR DÉFAUT ==================== */

const disciplineService = {
  create: createDiscipline,
  getById: getDisciplineById,
  getAll: getAllDisciplines,
  getByNiveau: getDisciplinesByNiveau,
  getByClasse: getDisciplinesByClasse,
  update: updateDiscipline,
  delete: deleteDiscipline,
  initializeDefaults: initializeDefaultDisciplines
};

export default disciplineService;

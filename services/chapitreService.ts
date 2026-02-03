/**
 * ============================================================================
 * SERVICE CHAPITRES - PedaClic
 * ============================================================================
 * Gestion CRUD des chapitres par discipline dans Firestore
 * Les chapitres organisent les ressources pédagogiques
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

// ==================== INTERFACES ====================

/**
 * Interface pour un chapitre
 */
export interface Chapitre {
  id: string;                     // ID unique Firestore
  disciplineId: string;           // ID de la discipline parente
  numero: number;                 // Numéro du chapitre (ordre)
  titre: string;                  // Titre du chapitre
  description?: string;           // Description optionnelle
  objectifs?: string[];           // Objectifs pédagogiques
  dureeEstimee?: number;          // Durée estimée en heures
  isPremium: boolean;             // Chapitre Premium uniquement
  actif: boolean;                 // Chapitre visible ou non
  createdAt: Date;                // Date de création
  updatedAt?: Date;               // Dernière mise à jour
}

/**
 * Données du formulaire de chapitre
 */
export interface ChapitreFormData {
  disciplineId: string;
  numero: number;
  titre: string;
  description?: string;
  objectifs?: string[];
  dureeEstimee?: number;
  isPremium: boolean;
  actif?: boolean;
}

// ==================== CONSTANTES ====================

/** Nom de la collection Firestore */
const COLLECTION_NAME = 'chapitres';

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Convertit un document Firestore en objet Chapitre
 * @param docSnapshot - Document Firestore
 * @returns Objet Chapitre formaté
 */
const formatChapitre = (docSnapshot: any): Chapitre => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    disciplineId: data.disciplineId,
    numero: data.numero,
    titre: data.titre,
    description: data.description,
    objectifs: data.objectifs || [],
    dureeEstimee: data.dureeEstimee,
    isPremium: data.isPremium || false,
    actif: data.actif !== false, // Par défaut actif
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate()
  };
};

// ==================== SERVICE CRUD ====================

export const ChapitreService = {
  /**
   * Récupère tous les chapitres d'une discipline
   * @param disciplineId - ID de la discipline
   * @returns Liste des chapitres ordonnés par numéro
   */
  async getByDiscipline(disciplineId: string): Promise<Chapitre[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('disciplineId', '==', disciplineId),
        orderBy('numero', 'asc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(formatChapitre);
    } catch (error) {
      console.error('Erreur lors de la récupération des chapitres:', error);
      throw new Error('Impossible de récupérer les chapitres');
    }
  },

  /**
   * Récupère tous les chapitres (admin uniquement)
   * @returns Liste de tous les chapitres
   */
  async getAll(): Promise<Chapitre[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        orderBy('numero', 'asc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map(formatChapitre);
    } catch (error) {
      console.error('Erreur lors de la récupération des chapitres:', error);
      throw new Error('Impossible de récupérer les chapitres');
    }
  },

  /**
   * Récupère un chapitre par son ID
   * @param id - ID du chapitre
   * @returns Chapitre ou null si non trouvé
   */
  async getById(id: string): Promise<Chapitre | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) {
        return null;
      }

      return formatChapitre(docSnapshot);
    } catch (error) {
      console.error('Erreur lors de la récupération du chapitre:', error);
      throw new Error('Impossible de récupérer le chapitre');
    }
  },

  /**
   * Crée un nouveau chapitre
   * @param data - Données du formulaire
   * @returns ID du chapitre créé
   */
  async create(data: ChapitreFormData): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        actif: data.actif !== false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création du chapitre:', error);
      throw new Error('Impossible de créer le chapitre');
    }
  },

  /**
   * Met à jour un chapitre existant
   * @param id - ID du chapitre
   * @param data - Nouvelles données
   */
  async update(id: string, data: Partial<ChapitreFormData>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du chapitre:', error);
      throw new Error('Impossible de mettre à jour le chapitre');
    }
  },

  /**
   * Supprime un chapitre
   * ⚠️ Attention : Les ressources associées doivent être gérées séparément
   * @param id - ID du chapitre à supprimer
   */
  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erreur lors de la suppression du chapitre:', error);
      throw new Error('Impossible de supprimer le chapitre');
    }
  },

  /**
   * Supprime tous les chapitres d'une discipline
   * Utilisé lors de la suppression d'une discipline
   * @param disciplineId - ID de la discipline
   */
  async deleteByDiscipline(disciplineId: string): Promise<void> {
    try {
      const chapitres = await this.getByDiscipline(disciplineId);
      const batch = writeBatch(db);

      chapitres.forEach((chapitre) => {
        const docRef = doc(db, COLLECTION_NAME, chapitre.id);
        batch.delete(docRef);
      });

      await batch.commit();
    } catch (error) {
      console.error('Erreur lors de la suppression des chapitres:', error);
      throw new Error('Impossible de supprimer les chapitres');
    }
  },

  /**
   * Réordonne les chapitres d'une discipline
   * @param disciplineId - ID de la discipline
   * @param orderedIds - Liste des IDs dans le nouvel ordre
   */
  async reorder(disciplineId: string, orderedIds: string[]): Promise<void> {
    try {
      const batch = writeBatch(db);

      orderedIds.forEach((id, index) => {
        const docRef = doc(db, COLLECTION_NAME, id);
        batch.update(docRef, {
          numero: index + 1,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Erreur lors de la réorganisation des chapitres:', error);
      throw new Error('Impossible de réorganiser les chapitres');
    }
  },

  /**
   * Active ou désactive un chapitre
   * @param id - ID du chapitre
   * @param actif - Nouvel état
   */
  async toggleActive(id: string, actif: boolean): Promise<void> {
    await this.update(id, { actif } as any);
  },

  /**
   * Compte le nombre de chapitres d'une discipline
   * @param disciplineId - ID de la discipline
   * @returns Nombre de chapitres
   */
  async countByDiscipline(disciplineId: string): Promise<number> {
    const chapitres = await this.getByDiscipline(disciplineId);
    return chapitres.length;
  },

  /**
   * Récupère le prochain numéro de chapitre disponible
   * @param disciplineId - ID de la discipline
   * @returns Prochain numéro disponible
   */
  async getNextNumero(disciplineId: string): Promise<number> {
    const count = await this.countByDiscipline(disciplineId);
    return count + 1;
  }
};

export default ChapitreService;

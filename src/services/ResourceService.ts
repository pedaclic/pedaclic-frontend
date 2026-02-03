/**
 * ============================================================================
 * SERVICE RESSOURCES - PedaClic
 * ============================================================================
 * Gestion CRUD des ressources pédagogiques dans Firestore
 * Inclut la gestion des fichiers avec Firebase Storage
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
  limit,
  serverTimestamp,
  writeBatch,
  QueryConstraint
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage } from '../firebase';
import type { Resource, ResourceFormData, TypeRessource } from '../types';

// ==================== CONSTANTES ====================

/** Nom de la collection Firestore */
const COLLECTION_NAME = 'ressources';

/** Dossier Storage pour les fichiers */
const STORAGE_FOLDER = 'ressources';

// ==================== TYPES INTERNES ====================

/** Options de filtrage pour les requêtes */
interface ResourceFilters {
  disciplineId?: string;
  chapitreId?: string;
  type?: TypeRessource;
  isPremium?: boolean;
  auteurId?: string;
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Convertit un document Firestore en objet Resource
 * @param docSnapshot - Document Firestore
 * @returns Objet Resource formaté
 */
const formatResource = (docSnapshot: any): Resource => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    disciplineId: data.disciplineId,
    titre: data.titre,
    type: data.type,
    contenu: data.contenu,
    description: data.description,
    isPremium: data.isPremium || false,
    ordre: data.ordre || 0,
    chapitre: data.chapitre,
    fichierURL: data.fichierURL,
    dureeEstimee: data.dureeEstimee,
    tags: data.tags || [],
    auteurId: data.auteurId,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate()
  };
};

/**
 * Génère un nom de fichier unique pour le stockage
 * @param originalName - Nom original du fichier
 * @returns Nom de fichier unique avec timestamp
 */
const generateFileName = (originalName: string): string => {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop();
  const baseName = originalName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_');
  return `${baseName}_${timestamp}.${extension}`;
};

// ==================== SERVICE CRUD ====================

export const ResourceService = {
  /**
   * Récupère toutes les ressources avec filtres optionnels
   * @param filters - Filtres optionnels
   * @param maxResults - Nombre maximum de résultats
   * @returns Liste des ressources
   */
  async getAll(filters?: ResourceFilters, maxResults?: number): Promise<Resource[]> {
    try {
      const constraints: QueryConstraint[] = [orderBy('ordre', 'asc')];

      // Ajout des filtres si présents
      if (filters?.disciplineId) {
        constraints.unshift(where('disciplineId', '==', filters.disciplineId));
      }
      if (filters?.chapitreId) {
        constraints.unshift(where('chapitre', '==', filters.chapitreId));
      }
      if (filters?.type) {
        constraints.unshift(where('type', '==', filters.type));
      }
      if (filters?.isPremium !== undefined) {
        constraints.unshift(where('isPremium', '==', filters.isPremium));
      }
      if (filters?.auteurId) {
        constraints.unshift(where('auteurId', '==', filters.auteurId));
      }
      if (maxResults) {
        constraints.push(limit(maxResults));
      }

      const q = query(collection(db, COLLECTION_NAME), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map(formatResource);
    } catch (error) {
      console.error('Erreur lors de la récupération des ressources:', error);
      throw new Error('Impossible de récupérer les ressources');
    }
  },

  /**
   * Récupère une ressource par son ID
   * @param id - ID de la ressource
   * @returns Ressource ou null si non trouvée
   */
  async getById(id: string): Promise<Resource | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) {
        return null;
      }

      return formatResource(docSnapshot);
    } catch (error) {
      console.error('Erreur lors de la récupération de la ressource:', error);
      throw new Error('Impossible de récupérer la ressource');
    }
  },

  /**
   * Récupère les ressources d'une discipline
   * @param disciplineId - ID de la discipline
   * @returns Liste des ressources
   */
  async getByDiscipline(disciplineId: string): Promise<Resource[]> {
    return this.getAll({ disciplineId });
  },

  /**
   * Récupère les ressources d'un chapitre
   * @param chapitreId - ID du chapitre
   * @returns Liste des ressources
   */
  async getByChapitre(chapitreId: string): Promise<Resource[]> {
    return this.getAll({ chapitreId });
  },

  /**
   * Récupère les ressources par type
   * @param type - Type de ressource
   * @returns Liste des ressources
   */
  async getByType(type: TypeRessource): Promise<Resource[]> {
    return this.getAll({ type });
  },

  /**
   * Récupère les ressources Premium uniquement
   * @returns Liste des ressources Premium
   */
  async getPremium(): Promise<Resource[]> {
    return this.getAll({ isPremium: true });
  },

  /**
   * Récupère les ressources gratuites uniquement
   * @returns Liste des ressources gratuites
   */
  async getFree(): Promise<Resource[]> {
    return this.getAll({ isPremium: false });
  },

  /**
   * Crée une nouvelle ressource
   * @param data - Données du formulaire
   * @param auteurId - ID de l'auteur (professeur ou admin)
   * @returns ID de la ressource créée
   */
  async create(data: ResourceFormData, auteurId: string): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        auteurId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de la ressource:', error);
      throw new Error('Impossible de créer la ressource');
    }
  },

  /**
   * Met à jour une ressource existante
   * @param id - ID de la ressource
   * @param data - Nouvelles données
   */
  async update(id: string, data: Partial<ResourceFormData>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la ressource:', error);
      throw new Error('Impossible de mettre à jour la ressource');
    }
  },

  /**
   * Supprime une ressource et son fichier associé si présent
   * @param id - ID de la ressource à supprimer
   */
  async delete(id: string): Promise<void> {
    try {
      // Récupérer la ressource pour obtenir l'URL du fichier
      const resource = await this.getById(id);

      // Supprimer le fichier associé si présent
      if (resource?.fichierURL) {
        await this.deleteFile(resource.fichierURL);
      }

      // Supprimer le document Firestore
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erreur lors de la suppression de la ressource:', error);
      throw new Error('Impossible de supprimer la ressource');
    }
  },

  /**
   * Supprime toutes les ressources d'une discipline
   * @param disciplineId - ID de la discipline
   */
  async deleteByDiscipline(disciplineId: string): Promise<void> {
    try {
      const resources = await this.getByDiscipline(disciplineId);
      const batch = writeBatch(db);

      // Supprimer les fichiers associés
      for (const resource of resources) {
        if (resource.fichierURL) {
          await this.deleteFile(resource.fichierURL);
        }
        const docRef = doc(db, COLLECTION_NAME, resource.id);
        batch.delete(docRef);
      }

      await batch.commit();
    } catch (error) {
      console.error('Erreur lors de la suppression des ressources:', error);
      throw new Error('Impossible de supprimer les ressources');
    }
  },

  /**
   * Upload un fichier vers Firebase Storage
   * @param file - Fichier à uploader
   * @param resourceId - ID de la ressource (pour organisation)
   * @returns URL de téléchargement du fichier
   */
  async uploadFile(file: File, resourceId: string): Promise<string> {
    try {
      const fileName = generateFileName(file.name);
      const filePath = `${STORAGE_FOLDER}/${resourceId}/${fileName}`;
      const storageRef = ref(storage, filePath);

      // Upload du fichier
      await uploadBytes(storageRef, file);

      // Récupération de l'URL de téléchargement
      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    } catch (error) {
      console.error('Erreur lors de l\'upload du fichier:', error);
      throw new Error('Impossible d\'uploader le fichier');
    }
  },

  /**
   * Supprime un fichier de Firebase Storage
   * @param fileURL - URL du fichier à supprimer
   */
  async deleteFile(fileURL: string): Promise<void> {
    try {
      const storageRef = ref(storage, fileURL);
      await deleteObject(storageRef);
    } catch (error) {
      // Ignorer l'erreur si le fichier n'existe pas
      console.warn('Fichier non trouvé ou déjà supprimé:', error);
    }
  },

  /**
   * Réordonne les ressources d'un chapitre
   * @param chapitreId - ID du chapitre
   * @param orderedIds - Liste des IDs dans le nouvel ordre
   */
  async reorder(chapitreId: string, orderedIds: string[]): Promise<void> {
    try {
      const batch = writeBatch(db);

      orderedIds.forEach((id, index) => {
        const docRef = doc(db, COLLECTION_NAME, id);
        batch.update(docRef, {
          ordre: index + 1,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Erreur lors de la réorganisation des ressources:', error);
      throw new Error('Impossible de réorganiser les ressources');
    }
  },

  /**
   * Bascule le statut Premium d'une ressource
   * @param id - ID de la ressource
   * @param isPremium - Nouveau statut
   */
  async togglePremium(id: string, isPremium: boolean): Promise<void> {
    await this.update(id, { isPremium });
  },

  /**
   * Compte le nombre de ressources par type
   * @param type - Type de ressource
   * @returns Nombre de ressources
   */
  async countByType(type: TypeRessource): Promise<number> {
    const resources = await this.getByType(type);
    return resources.length;
  },

  /**
   * Récupère les statistiques des ressources
   * @returns Objet avec les statistiques
   */
  async getStats(): Promise<{
    total: number;
    premium: number;
    gratuit: number;
    parType: Record<TypeRessource, number>;
  }> {
    try {
      const allResources = await this.getAll();

      const stats = {
        total: allResources.length,
        premium: allResources.filter(r => r.isPremium).length,
        gratuit: allResources.filter(r => !r.isPremium).length,
        parType: {
          cours: 0,
          exercice: 0,
          video: 0,
          document: 0,
          quiz: 0
        } as Record<TypeRessource, number>
      };

      allResources.forEach(resource => {
        if (stats.parType[resource.type] !== undefined) {
          stats.parType[resource.type]++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      throw new Error('Impossible de calculer les statistiques');
    }
  }
};



// ==================== FONCTIONS EXPORTÉES INDIVIDUELLEMENT ====================

export const getResourcesByChapter = async (chapitreId: string) => {
  const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
  const { db } = await import('../firebase');
  const q = query(collection(db, 'ressources'), where('chapitreId', '==', chapitreId), orderBy('ordre', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const countResourcesByDiscipline = async (disciplineId: string) => {
  const { collection, query, where, getDocs } = await import('firebase/firestore');
  const { db } = await import('../firebase');
  const q = query(collection(db, 'ressources'), where('disciplineId', '==', disciplineId));
  const snapshot = await getDocs(q);
  return snapshot.size;
};

export const getResourceById = async (id: string) => {
  const { doc, getDoc } = await import('firebase/firestore');
  const { db } = await import('../firebase');
  const docRef = doc(db, 'ressources', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export default ResourceService;

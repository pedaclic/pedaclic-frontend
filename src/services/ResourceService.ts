/**
 * ============================================================================
 * SERVICE RESSOURCES PÉDAGOGIQUES - PEDACLIC
 * ============================================================================
 * 
 * Ce service gère toutes les opérations CRUD pour les ressources pédagogiques
 * (cours, exercices, vidéos, documents, quiz) dans Firestore.
 * 
 * Collection Firestore : 'resources'
 * 
 * @author PedaClic Team
 * @version 1.0.0
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
  limit,
  Timestamp,
  QueryConstraint,
  DocumentData,
  startAfter,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Resource, ResourceFormData, TypeRessource, OperationResult } from '../index';

// ==================== CONSTANTES ====================

/** Nom de la collection Firestore */
const COLLECTION_NAME = 'resources';

/** Référence à la collection */
const resourcesRef = collection(db, COLLECTION_NAME);

// ==================== TYPES INTERNES ====================

/**
 * Options de filtrage pour les requêtes de ressources
 */
export interface ResourceFilterOptions {
  disciplineId?: string;
  chapitre?: string;
  type?: TypeRessource;
  isPremium?: boolean;
  auteurId?: string;
  searchQuery?: string;
  orderByField?: 'ordre' | 'titre' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
  limitCount?: number;
  startAfterDoc?: QueryDocumentSnapshot<DocumentData>;
}

/**
 * Résultat paginé pour les listes de ressources
 */
export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Convertit un document Firestore en objet Resource
 */
const docToResource = (docSnap: QueryDocumentSnapshot<DocumentData>): Resource => {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    disciplineId: data.disciplineId,
    titre: data.titre,
    type: data.type as TypeRessource,
    contenu: data.contenu,
    description: data.description || '',
    isPremium: data.isPremium || false,
    ordre: data.ordre || 0,
    chapitre: data.chapitre || '',
    fichierURL: data.fichierURL || '',
    dureeEstimee: data.dureeEstimee || 0,
    tags: data.tags || [],
    auteurId: data.auteurId,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate()
  };
};

/**
 * Prépare les données pour Firestore
 */
const prepareResourceData = (formData: ResourceFormData, auteurId: string): DocumentData => {
  return {
    disciplineId: formData.disciplineId,
    titre: formData.titre.trim(),
    type: formData.type,
    contenu: formData.contenu,
    description: formData.description?.trim() || '',
    isPremium: formData.isPremium,
    ordre: formData.ordre,
    chapitre: formData.chapitre?.trim() || '',
    fichierURL: formData.fichierURL || '',
    dureeEstimee: formData.dureeEstimee || 0,
    tags: formData.tags || [],
    auteurId: auteurId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
};

// ==================== OPÉRATIONS CRUD ====================

/**
 * Crée une nouvelle ressource pédagogique
 */
export const createResource = async (
  formData: ResourceFormData,
  auteurId: string
): Promise<OperationResult<Resource>> => {
  try {
    // Validation des champs requis
    if (!formData.disciplineId || !formData.titre || !formData.type || !formData.contenu) {
      return {
        success: false,
        error: 'Veuillez remplir tous les champs obligatoires'
      };
    }

    const resourceData = prepareResourceData(formData, auteurId);
    const docRef = await addDoc(resourcesRef, resourceData);

    const resource: Resource = {
      id: docRef.id,
      ...resourceData,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Resource;

    return { success: true, data: resource };
  } catch (error) {
    console.error('Erreur création ressource:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la création'
    };
  }
};

/**
 * Récupère une ressource par son ID
 */
export const getResourceById = async (
  resourceId: string
): Promise<OperationResult<Resource>> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, resourceId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return { success: false, error: 'Ressource non trouvée' };
    }

    const data = docSnap.data();
    const resource: Resource = {
      id: docSnap.id,
      disciplineId: data.disciplineId,
      titre: data.titre,
      type: data.type as TypeRessource,
      contenu: data.contenu,
      description: data.description || '',
      isPremium: data.isPremium || false,
      ordre: data.ordre || 0,
      chapitre: data.chapitre || '',
      fichierURL: data.fichierURL || '',
      dureeEstimee: data.dureeEstimee || 0,
      tags: data.tags || [],
      auteurId: data.auteurId,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate()
    };

    return { success: true, data: resource };
  } catch (error) {
    console.error('Erreur récupération ressource:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la récupération'
    };
  }
};

/**
 * Récupère une liste de ressources avec filtres et pagination
 */
export const getResources = async (
  options: ResourceFilterOptions = {}
): Promise<OperationResult<PaginatedResult<Resource>>> => {
  try {
    const constraints: QueryConstraint[] = [];

    // Filtres conditionnels
    if (options.disciplineId) {
      constraints.push(where('disciplineId', '==', options.disciplineId));
    }
    if (options.chapitre) {
      constraints.push(where('chapitre', '==', options.chapitre));
    }
    if (options.type) {
      constraints.push(where('type', '==', options.type));
    }
    if (options.isPremium !== undefined) {
      constraints.push(where('isPremium', '==', options.isPremium));
    }
    if (options.auteurId) {
      constraints.push(where('auteurId', '==', options.auteurId));
    }

    // Tri
    const sortField = options.orderByField || 'ordre';
    const sortDirection = options.orderDirection || 'asc';
    constraints.push(orderBy(sortField, sortDirection));

    // Pagination
    if (options.startAfterDoc) {
      constraints.push(startAfter(options.startAfterDoc));
    }

    const requestLimit = (options.limitCount || 20) + 1;
    constraints.push(limit(requestLimit));

    // Exécution
    const q = query(resourcesRef, ...constraints);
    const snapshot = await getDocs(q);

    const resources: Resource[] = [];
    let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
    const hasMore = snapshot.docs.length > (options.limitCount || 20);

    snapshot.docs.slice(0, options.limitCount || 20).forEach(docSnap => {
      resources.push(docToResource(docSnap));
      lastDoc = docSnap;
    });

    return {
      success: true,
      data: { data: resources, lastDoc, hasMore }
    };
  } catch (error) {
    console.error('Erreur récupération ressources:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la récupération'
    };
  }
};

/**
 * Récupère les ressources d'une discipline groupées par chapitre
 */
export const getResourcesByChapter = async (
  disciplineId: string
): Promise<OperationResult<Map<string, Resource[]>>> => {
  try {
    const q = query(
      resourcesRef,
      where('disciplineId', '==', disciplineId),
      orderBy('chapitre', 'asc'),
      orderBy('ordre', 'asc')
    );

    const snapshot = await getDocs(q);
    const resourcesByChapter = new Map<string, Resource[]>();

    snapshot.docs.forEach(docSnap => {
      const resource = docToResource(docSnap);
      const chapter = resource.chapitre || 'Non classé';
      
      if (!resourcesByChapter.has(chapter)) {
        resourcesByChapter.set(chapter, []);
      }
      resourcesByChapter.get(chapter)!.push(resource);
    });

    return { success: true, data: resourcesByChapter };
  } catch (error) {
    console.error('Erreur récupération par chapitre:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la récupération'
    };
  }
};

/**
 * Met à jour une ressource existante
 */
export const updateResource = async (
  resourceId: string,
  updateData: Partial<ResourceFormData>
): Promise<OperationResult<Resource>> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, resourceId);
    const existingDoc = await getDoc(docRef);
    
    if (!existingDoc.exists()) {
      return { success: false, error: 'Ressource non trouvée' };
    }

    const dataToUpdate: DocumentData = {
      ...updateData,
      updatedAt: Timestamp.now()
    };

    // Nettoyer les champs texte
    if (dataToUpdate.titre) dataToUpdate.titre = dataToUpdate.titre.trim();
    if (dataToUpdate.description) dataToUpdate.description = dataToUpdate.description.trim();
    if (dataToUpdate.chapitre) dataToUpdate.chapitre = dataToUpdate.chapitre.trim();

    await updateDoc(docRef, dataToUpdate);

    // Récupérer la ressource mise à jour
    const result = await getResourceById(resourceId);
    return result;
  } catch (error) {
    console.error('Erreur mise à jour ressource:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour'
    };
  }
};

/**
 * Supprime une ressource
 */
export const deleteResource = async (
  resourceId: string
): Promise<OperationResult<void>> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, resourceId);
    const existingDoc = await getDoc(docRef);
    
    if (!existingDoc.exists()) {
      return { success: false, error: 'Ressource non trouvée' };
    }

    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    console.error('Erreur suppression ressource:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la suppression'
    };
  }
};

// ==================== FONCTIONS UTILITAIRES AVANCÉES ====================

/**
 * Compte les ressources par discipline avec statistiques
 */
export const countResourcesByDiscipline = async (
  disciplineId: string
): Promise<OperationResult<{
  total: number;
  premium: number;
  gratuit: number;
  parType: Record<TypeRessource, number>;
}>> => {
  try {
    const q = query(resourcesRef, where('disciplineId', '==', disciplineId));
    const snapshot = await getDocs(q);

    let total = 0, premium = 0, gratuit = 0;
    const parType: Record<TypeRessource, number> = {
      cours: 0, exercice: 0, video: 0, document: 0, quiz: 0
    };

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      total++;
      data.isPremium ? premium++ : gratuit++;
      const type = data.type as TypeRessource;
      if (parType.hasOwnProperty(type)) parType[type]++;
    });

    return { success: true, data: { total, premium, gratuit, parType } };
  } catch (error) {
    console.error('Erreur comptage ressources:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du comptage'
    };
  }
};

/**
 * Récupère les chapitres uniques d'une discipline
 */
export const getChaptersForDiscipline = async (
  disciplineId: string
): Promise<OperationResult<string[]>> => {
  try {
    const q = query(
      resourcesRef,
      where('disciplineId', '==', disciplineId),
      orderBy('chapitre', 'asc')
    );
    
    const snapshot = await getDocs(q);
    const chapters = new Set<string>();

    snapshot.docs.forEach(docSnap => {
      const chapitre = docSnap.data().chapitre;
      if (chapitre) chapters.add(chapitre);
    });

    return { success: true, data: Array.from(chapters) };
  } catch (error) {
    console.error('Erreur récupération chapitres:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la récupération'
    };
  }
};

/**
 * Récupère les ressources récentes
 */
export const getRecentResources = async (
  limitCount: number = 10
): Promise<OperationResult<Resource[]>> => {
  try {
    const q = query(
      resourcesRef,
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const resources = snapshot.docs.map(docSnap => docToResource(docSnap));

    return { success: true, data: resources };
  } catch (error) {
    console.error('Erreur récupération ressources récentes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la récupération'
    };
  }
};

// ==================== EXPORT DU SERVICE ====================

export const ResourceService = {
  createResource,
  getResourceById,
  getResources,
  updateResource,
  deleteResource,
  getResourcesByChapter,
  countResourcesByDiscipline,
  getChaptersForDiscipline,
  getRecentResources
};

export default ResourceService;

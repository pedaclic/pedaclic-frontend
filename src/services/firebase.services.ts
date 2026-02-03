/**
 * ============================================================
 * SERVICES FIREBASE - PEDACLIC
 * ============================================================
 * Services pour les opérations CRUD sur Firestore et Storage
 * ============================================================
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
  Timestamp,
  QueryConstraint,
  DocumentData,
  limit,
  startAfter,
  DocumentSnapshot
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import type {
  Discipline,
  DisciplineFormData,
  Resource,
  ResourceFormData,
  Chapitre,
  ChapitreFormData,
  Niveau,
  Classe,
  OperationResult
} from '../types';

// ==================== CONSTANTES ====================

const COLLECTIONS = {
  DISCIPLINES: 'disciplines',
  RESOURCES: 'resources',
  CHAPITRES: 'chapitres',
  USERS: 'users'
} as const;

const STORAGE_PATHS = {
  RESOURCES: 'resources',
  IMAGES: 'images',
  DOCUMENTS: 'documents'
} as const;

// ==================== UTILITAIRES ====================

function timestampToDate(timestamp: Timestamp | undefined): Date | undefined {
  return timestamp ? timestamp.toDate() : undefined;
}

function formatDocument<T>(doc: DocumentSnapshot): T | null {
  if (!doc.exists()) return null;
  const data = doc.data() as DocumentData;
  return {
    id: doc.id,
    ...data,
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt)
  } as T;
}

// ==================== SERVICE DISCIPLINES ====================

export const DisciplineService = {
  
  async getAll(filters?: { niveau?: Niveau; classe?: Classe }): Promise<Discipline[]> {
    try {
      const constraints: QueryConstraint[] = [orderBy('ordre', 'asc')];
      
      if (filters?.niveau) {
        constraints.unshift(where('niveau', '==', filters.niveau));
      }
      if (filters?.classe) {
        constraints.unshift(where('classe', '==', filters.classe));
      }
      
      const q = query(collection(db, COLLECTIONS.DISCIPLINES), ...constraints);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: timestampToDate(doc.data().createdAt),
        updatedAt: timestampToDate(doc.data().updatedAt)
      })) as Discipline[];
      
    } catch (error) {
      console.error('Erreur récupération disciplines:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Discipline | null> {
    try {
      const docRef = doc(db, COLLECTIONS.DISCIPLINES, id);
      const docSnap = await getDoc(docRef);
      return formatDocument<Discipline>(docSnap);
    } catch (error) {
      console.error('Erreur récupération discipline:', error);
      throw error;
    }
  },

  async create(data: DisciplineFormData): Promise<OperationResult<string>> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.DISCIPLINES), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, data: docRef.id };
    } catch (error) {
      console.error('Erreur création discipline:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  },

  async update(id: string, data: Partial<DisciplineFormData>): Promise<OperationResult> {
    try {
      const docRef = doc(db, COLLECTIONS.DISCIPLINES, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Erreur mise à jour discipline:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  },

  async delete(id: string): Promise<OperationResult> {
    try {
      // Supprimer les chapitres associés
      const chapitresSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.CHAPITRES), where('disciplineId', '==', id))
      );
      for (const chapDoc of chapitresSnapshot.docs) {
        await ChapitreService.delete(chapDoc.id);
      }
      
      // Supprimer les ressources directes
      const resourcesSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.RESOURCES), where('disciplineId', '==', id))
      );
      for (const resDoc of resourcesSnapshot.docs) {
        await ResourceService.delete(resDoc.id);
      }
      
      // Supprimer la discipline
      await deleteDoc(doc(db, COLLECTIONS.DISCIPLINES, id));
      return { success: true };
    } catch (error) {
      console.error('Erreur suppression discipline:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }
};

// ==================== SERVICE CHAPITRES ====================

export const ChapitreService = {
  
  async getByDiscipline(disciplineId: string): Promise<Chapitre[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.CHAPITRES),
        where('disciplineId', '==', disciplineId),
        orderBy('ordre', 'asc')
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: timestampToDate(doc.data().createdAt),
        updatedAt: timestampToDate(doc.data().updatedAt)
      })) as Chapitre[];
      
    } catch (error) {
      console.error('Erreur récupération chapitres:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Chapitre | null> {
    try {
      const docRef = doc(db, COLLECTIONS.CHAPITRES, id);
      const docSnap = await getDoc(docRef);
      return formatDocument<Chapitre>(docSnap);
    } catch (error) {
      console.error('Erreur récupération chapitre:', error);
      throw error;
    }
  },

  async create(data: ChapitreFormData): Promise<OperationResult<string>> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.CHAPITRES), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, data: docRef.id };
    } catch (error) {
      console.error('Erreur création chapitre:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  },

  async update(id: string, data: Partial<ChapitreFormData>): Promise<OperationResult> {
    try {
      const docRef = doc(db, COLLECTIONS.CHAPITRES, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Erreur mise à jour chapitre:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  },

  async delete(id: string): Promise<OperationResult> {
    try {
      // Supprimer les ressources du chapitre
      const resourcesSnapshot = await getDocs(
        query(collection(db, COLLECTIONS.RESOURCES), where('chapitreId', '==', id))
      );
      for (const resDoc of resourcesSnapshot.docs) {
        await ResourceService.delete(resDoc.id);
      }
      
      await deleteDoc(doc(db, COLLECTIONS.CHAPITRES, id));
      return { success: true };
    } catch (error) {
      console.error('Erreur suppression chapitre:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  },

  async countResources(chapitreId: string): Promise<number> {
    try {
      const q = query(
        collection(db, COLLECTIONS.RESOURCES),
        where('chapitreId', '==', chapitreId)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      return 0;
    }
  }
};

// ==================== SERVICE RESSOURCES ====================

export const ResourceService = {
  
  async getAll(options?: {
    disciplineId?: string;
    chapitreId?: string;
    type?: string;
    isPremium?: boolean;
    limitCount?: number;
  }): Promise<Resource[]> {
    try {
      const constraints: QueryConstraint[] = [orderBy('ordre', 'asc')];
      
      if (options?.disciplineId) {
        constraints.unshift(where('disciplineId', '==', options.disciplineId));
      }
      if (options?.chapitreId) {
        constraints.unshift(where('chapitreId', '==', options.chapitreId));
      }
      if (options?.type) {
        constraints.unshift(where('type', '==', options.type));
      }
      if (options?.isPremium !== undefined) {
        constraints.unshift(where('isPremium', '==', options.isPremium));
      }
      if (options?.limitCount) {
        constraints.push(limit(options.limitCount));
      }
      
      const q = query(collection(db, COLLECTIONS.RESOURCES), ...constraints);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: timestampToDate(doc.data().createdAt),
        updatedAt: timestampToDate(doc.data().updatedAt)
      })) as Resource[];
      
    } catch (error) {
      console.error('Erreur récupération ressources:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Resource | null> {
    try {
      const docRef = doc(db, COLLECTIONS.RESOURCES, id);
      const docSnap = await getDoc(docRef);
      return formatDocument<Resource>(docSnap);
    } catch (error) {
      console.error('Erreur récupération ressource:', error);
      throw error;
    }
  },

  async create(data: ResourceFormData, auteurId: string): Promise<OperationResult<string>> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.RESOURCES), {
        ...data,
        auteurId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, data: docRef.id };
    } catch (error) {
      console.error('Erreur création ressource:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  },

  async update(id: string, data: Partial<ResourceFormData>): Promise<OperationResult> {
    try {
      const docRef = doc(db, COLLECTIONS.RESOURCES, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Erreur mise à jour ressource:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  },

  async delete(id: string): Promise<OperationResult> {
    try {
      const resource = await this.getById(id);
      if (resource?.fichierURL) {
        await StorageService.deleteFile(resource.fichierURL);
      }
      await deleteDoc(doc(db, COLLECTIONS.RESOURCES, id));
      return { success: true };
    } catch (error) {
      console.error('Erreur suppression ressource:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }
};

// ==================== SERVICE STORAGE ====================

export const StorageService = {
  
  async uploadFile(file: File, path?: string): Promise<OperationResult<string>> {
    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${safeName}`;
      const storagePath = path || `${STORAGE_PATHS.RESOURCES}/${fileName}`;
      const storageRef = ref(storage, storagePath);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return { success: true, data: downloadURL };
    } catch (error) {
      console.error('Erreur upload fichier:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur upload'
      };
    }
  },

  async deleteFile(fileURL: string): Promise<OperationResult> {
    try {
      const storageRef = ref(storage, fileURL);
      await deleteObject(storageRef);
      return { success: true };
    } catch (error) {
      if ((error as any)?.code === 'storage/object-not-found') {
        return { success: true };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur suppression'
      };
    }
  }
};

// ==================== SERVICE STATISTIQUES ====================

export const StatsService = {
  
  async getGlobalStats(): Promise<{
    totalDisciplines: number;
    totalChapitres: number;
    totalResources: number;
    resourcesPremium: number;
    resourcesGratuites: number;
  }> {
    try {
      const disciplinesSnap = await getDocs(collection(db, COLLECTIONS.DISCIPLINES));
      const chapitresSnap = await getDocs(collection(db, COLLECTIONS.CHAPITRES));
      const resourcesSnap = await getDocs(collection(db, COLLECTIONS.RESOURCES));
      const premiumSnap = await getDocs(
        query(collection(db, COLLECTIONS.RESOURCES), where('isPremium', '==', true))
      );
      
      const totalResources = resourcesSnap.size;
      const resourcesPremium = premiumSnap.size;
      
      return {
        totalDisciplines: disciplinesSnap.size,
        totalChapitres: chapitresSnap.size,
        totalResources,
        resourcesPremium,
        resourcesGratuites: totalResources - resourcesPremium
      };
    } catch (error) {
      console.error('Erreur stats:', error);
      throw error;
    }
  }
};

export { COLLECTIONS, STORAGE_PATHS };

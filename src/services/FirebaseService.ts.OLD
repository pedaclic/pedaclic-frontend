// Service pour gérer toutes les opérations CRUD avec Firebase
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
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage } from '../config/firebase';

// ============================================
// TYPES TYPESCRIPT
// ============================================

export interface Niveau {
  id?: string;
  nom: string;
  ordre: number;
  timestamp?: any;
  updatedAt?: any;
}

export interface Classe {
  id?: string;
  nom: string;
  niveauId: string;
  timestamp?: any;
  updatedAt?: any;
}

export interface Matiere {
  id?: string;
  nom: string;
  classeId: string;
  niveauId: string;
  coefficient: number;
  volumeHoraire: number;
  type: 'obligatoire' | 'optionnel';
  timestamp?: any;
  updatedAt?: any;
}

export interface Ressource {
  id?: string;
  titre: string;
  matiereId: string;
  classeId: string;
  niveauId: string;
  type: 'pdf' | 'word' | 'video' | 'audio';
  url: string;
  storagePath?: string;
  taille?: string;
  telechargementAutorise: boolean;
  premium: boolean;
  timestamp?: any;
  updatedAt?: any;
}

export interface UploadResult {
  url: string;
  storagePath: string;
  taille: string;
}

// Types pour les données hiérarchiques
export interface MatiereWithRessources extends Matiere {
  ressources: Ressource[];
}

export interface ClasseWithMatieres extends Classe {
  matieres: MatiereWithRessources[];
}

export interface NiveauWithClasses extends Niveau {
  classes: ClasseWithMatieres[];
}

// ============================================
// CLASSE FIREBASESERVICE
// ============================================

class FirebaseService {
  
  // Helper pour convertir un document Firestore en objet avec ID
  private docToData<T>(doc: QueryDocumentSnapshot<DocumentData>): T {
    return { id: doc.id, ...doc.data() } as T;
  }

  // ==========================================
  // NIVEAUX
  // ==========================================
  
  async getNiveaux(): Promise<Niveau[]> {
    const q = query(collection(db, 'niveaux'), orderBy('ordre'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.docToData<Niveau>(doc));
  }

  async getNiveauById(id: string): Promise<Niveau | null> {
    const docRef = doc(db, 'niveaux', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? this.docToData<Niveau>(docSnap as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async createNiveau(data: Omit<Niveau, 'id' | 'timestamp'>): Promise<Niveau> {
    const docRef = await addDoc(collection(db, 'niveaux'), {
      ...data,
      timestamp: serverTimestamp()
    });
    return { id: docRef.id, ...data };
  }

  async updateNiveau(id: string, data: Partial<Niveau>): Promise<void> {
    const docRef = doc(db, 'niveaux', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async deleteNiveau(id: string): Promise<void> {
    // Supprimer le niveau
    await deleteDoc(doc(db, 'niveaux', id));
    
    // Supprimer les classes associées en cascade
    const classesQuery = query(
      collection(db, 'classes'), 
      where('niveauId', '==', id)
    );
    const classesSnapshot = await getDocs(classesQuery);
    
    for (const classDoc of classesSnapshot.docs) {
      await this.deleteClasse(classDoc.id);
    }
  }

  // ==========================================
  // CLASSES
  // ==========================================
  
  async getClassesByNiveau(niveauId: string): Promise<Classe[]> {
    const q = query(
      collection(db, 'classes'), 
      where('niveauId', '==', niveauId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.docToData<Classe>(doc));
  }

  async getClasseById(id: string): Promise<Classe | null> {
    const docRef = doc(db, 'classes', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? this.docToData<Classe>(docSnap as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async createClasse(data: Omit<Classe, 'id' | 'timestamp'>): Promise<Classe> {
    const docRef = await addDoc(collection(db, 'classes'), {
      ...data,
      timestamp: serverTimestamp()
    });
    return { id: docRef.id, ...data };
  }

  async updateClasse(id: string, data: Partial<Classe>): Promise<void> {
    const docRef = doc(db, 'classes', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async deleteClasse(id: string): Promise<void> {
    // Supprimer la classe
    await deleteDoc(doc(db, 'classes', id));
    
    // Supprimer les matières associées en cascade
    const matieresQuery = query(
      collection(db, 'matieres'), 
      where('classeId', '==', id)
    );
    const matieresSnapshot = await getDocs(matieresQuery);
    
    for (const matiereDoc of matieresSnapshot.docs) {
      await this.deleteMatiere(matiereDoc.id);
    }
  }

  // ==========================================
  // MATIÈRES
  // ==========================================
  
  async getMatieresByClasse(classeId: string): Promise<Matiere[]> {
    const q = query(
      collection(db, 'matieres'), 
      where('classeId', '==', classeId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.docToData<Matiere>(doc));
  }

  async getMatiereById(id: string): Promise<Matiere | null> {
    const docRef = doc(db, 'matieres', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? this.docToData<Matiere>(docSnap as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async createMatiere(data: Omit<Matiere, 'id' | 'timestamp'>): Promise<Matiere> {
    const docRef = await addDoc(collection(db, 'matieres'), {
      ...data,
      timestamp: serverTimestamp()
    });
    return { id: docRef.id, ...data };
  }

  async updateMatiere(id: string, data: Partial<Matiere>): Promise<void> {
    const docRef = doc(db, 'matieres', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async deleteMatiere(id: string): Promise<void> {
    // Supprimer la matière
    await deleteDoc(doc(db, 'matieres', id));
    
    // Supprimer les ressources associées en cascade
    const ressourcesQuery = query(
      collection(db, 'ressources'), 
      where('matiereId', '==', id)
    );
    const ressourcesSnapshot = await getDocs(ressourcesQuery);
    
    for (const ressourceDoc of ressourcesSnapshot.docs) {
      await this.deleteRessource(ressourceDoc.id);
    }
  }

  // ==========================================
  // RESSOURCES
  // ==========================================
  
  async getRessourcesByMatiere(matiereId: string): Promise<Ressource[]> {
    const q = query(
      collection(db, 'ressources'), 
      where('matiereId', '==', matiereId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => this.docToData<Ressource>(doc));
  }

  async getRessourceById(id: string): Promise<Ressource | null> {
    const docRef = doc(db, 'ressources', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? this.docToData<Ressource>(docSnap as QueryDocumentSnapshot<DocumentData>) : null;
  }

  async createRessource(data: Omit<Ressource, 'id' | 'timestamp'>): Promise<Ressource> {
    const docRef = await addDoc(collection(db, 'ressources'), {
      ...data,
      timestamp: serverTimestamp()
    });
    return { id: docRef.id, ...data };
  }

  async updateRessource(id: string, data: Partial<Ressource>): Promise<void> {
    const docRef = doc(db, 'ressources', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async deleteRessource(id: string): Promise<void> {
    // Récupérer les infos de la ressource
    const docRef = doc(db, 'ressources', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const ressource = docSnap.data() as Ressource;
      
      // Supprimer le fichier du Storage si l'URL est Firebase
      if (ressource.url && ressource.url.includes('firebasestorage')) {
        try {
          const fileRef = ref(storage, ressource.storagePath || ressource.url);
          await deleteObject(fileRef);
        } catch (error) {
          console.error('Erreur suppression fichier Storage:', error);
        }
      }
    }
    
    // Supprimer le document Firestore
    await deleteDoc(docRef);
  }

  // ==========================================
  // FIREBASE STORAGE - UPLOAD DE FICHIERS
  // ==========================================
  
  async uploadFile(file: File, path: string): Promise<UploadResult> {
    // Créer une référence unique pour le fichier
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `${path}/${fileName}`);
    
    // Uploader le fichier
    const snapshot = await uploadBytes(storageRef, file);
    
    // Obtenir l'URL de téléchargement
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return {
      url: downloadURL,
      storagePath: snapshot.ref.fullPath,
      taille: this.formatFileSize(file.size)
    };
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  // ==========================================
  // CHARGER TOUTES LES DONNÉES (HIÉRARCHIQUE)
  // ==========================================
  
  async loadAllData(): Promise<NiveauWithClasses[]> {
    const niveaux = await this.getNiveaux();
    
    const hierarchicalData = await Promise.all(
      niveaux.map(async (niveau): Promise<NiveauWithClasses> => {
        const classes = await this.getClassesByNiveau(niveau.id!);
        
        const classesWithMatieres = await Promise.all(
          classes.map(async (classe): Promise<ClasseWithMatieres> => {
            const matieres = await this.getMatieresByClasse(classe.id!);
            
            const matieresWithRessources = await Promise.all(
              matieres.map(async (matiere): Promise<MatiereWithRessources> => {
                const ressources = await this.getRessourcesByMatiere(matiere.id!);
                return { ...matiere, ressources };
              })
            );
            
            return { ...classe, matieres: matieresWithRessources };
          })
        );
        
        return { ...niveau, classes: classesWithMatieres };
      })
    );
    
    return hierarchicalData;
  }

  // ==========================================
  // MÉTHODES UTILITAIRES
  // ==========================================
  
  async getAllClasses(): Promise<Classe[]> {
    const querySnapshot = await getDocs(collection(db, 'classes'));
    return querySnapshot.docs.map(doc => this.docToData<Classe>(doc));
  }

  async getAllMatieres(): Promise<Matiere[]> {
    const querySnapshot = await getDocs(collection(db, 'matieres'));
    return querySnapshot.docs.map(doc => this.docToData<Matiere>(doc));
  }

  async getAllRessources(): Promise<Ressource[]> {
    const querySnapshot = await getDocs(collection(db, 'ressources'));
    return querySnapshot.docs.map(doc => this.docToData<Ressource>(doc));
  }
}

// ==========================================
// EXPORT DE L'INSTANCE UNIQUE
// ==========================================
export const firebaseService = new FirebaseService();
export default firebaseService;

/**
 * ============================================================================
 * SERVICE DISCIPLINES - PedaClic
 * ============================================================================
 * Gestion CRUD des disciplines (matières) dans Firestore
 * Inclut la gestion des chapitres associés
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
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Discipline, DisciplineFormData, Niveau, Classe } from '../types';

// ==================== CONSTANTES ====================

/** Nom de la collection Firestore */
const COLLECTION_NAME = 'disciplines';

// ==================== TYPES INTERNES ====================

/** Options de filtrage pour les requêtes */
interface DisciplineFilters {
  niveau?: Niveau;
  classe?: Classe;
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Convertit un document Firestore en objet Discipline
 * @param doc - Document Firestore
 * @returns Objet Discipline formaté
 */
const formatDiscipline = (docSnapshot: any): Discipline => {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    nom: data.nom,
    niveau: data.niveau,
    classe: data.classe,
    ordre: data.ordre,
    coefficient: data.coefficient,
    couleur: data.couleur,
    icone: data.icone,
    description: data.description,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate()
  };
};

// ==================== SERVICE CRUD ====================

export const DisciplineService = {
  /**
   * Récupère toutes les disciplines avec filtres optionnels
   * @param filters - Filtres optionnels (niveau, classe)
   * @returns Liste des disciplines
   */
  async getAll(filters?: DisciplineFilters): Promise<Discipline[]> {
    try {
      const constraints: QueryConstraint[] = [orderBy('ordre', 'asc')];

      // Ajout des filtres si présents
      if (filters?.niveau) {
        constraints.unshift(where('niveau', '==', filters.niveau));
      }
      if (filters?.classe) {
        constraints.unshift(where('classe', '==', filters.classe));
      }

      const q = query(collection(db, COLLECTION_NAME), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map(formatDiscipline);
    } catch (error) {
      console.error('Erreur lors de la récupération des disciplines:', error);
      throw new Error('Impossible de récupérer les disciplines');
    }
  },

  /**
   * Récupère une discipline par son ID
   * @param id - ID de la discipline
   * @returns Discipline ou null si non trouvée
   */
  async getById(id: string): Promise<Discipline | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) {
        return null;
      }

      return formatDiscipline(docSnapshot);
    } catch (error) {
      console.error('Erreur lors de la récupération de la discipline:', error);
      throw new Error('Impossible de récupérer la discipline');
    }
  },

  /**
   * Récupère les disciplines par niveau scolaire
   * @param niveau - Niveau (college ou lycee)
   * @returns Liste des disciplines du niveau
   */
  async getByNiveau(niveau: Niveau): Promise<Discipline[]> {
    return this.getAll({ niveau });
  },

  /**
   * Récupère les disciplines par classe
   * @param classe - Classe (6eme, 5eme, etc.)
   * @returns Liste des disciplines de la classe
   */
  async getByClasse(classe: Classe): Promise<Discipline[]> {
    return this.getAll({ classe });
  },

  /**
   * Crée une nouvelle discipline
   * @param data - Données du formulaire
   * @returns ID de la discipline créée
   */
  async create(data: DisciplineFormData): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error('Erreur lors de la création de la discipline:', error);
      throw new Error('Impossible de créer la discipline');
    }
  },

  /**
   * Met à jour une discipline existante
   * @param id - ID de la discipline
   * @param data - Nouvelles données
   */
  async update(id: string, data: Partial<DisciplineFormData>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la discipline:', error);
      throw new Error('Impossible de mettre à jour la discipline');
    }
  },

  /**
   * Supprime une discipline
   * ⚠️ Attention : Ne supprime pas les ressources associées automatiquement
   * @param id - ID de la discipline à supprimer
   */
  async delete(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erreur lors de la suppression de la discipline:', error);
      throw new Error('Impossible de supprimer la discipline');
    }
  },

  /**
   * Vérifie si une discipline existe
   * @param id - ID à vérifier
   * @returns true si la discipline existe
   */
  async exists(id: string): Promise<boolean> {
    const discipline = await this.getById(id);
    return discipline !== null;
  },

  /**
   * Compte le nombre de disciplines par niveau
   * @param niveau - Niveau scolaire
   * @returns Nombre de disciplines
   */
  async countByNiveau(niveau: Niveau): Promise<number> {
    const disciplines = await this.getByNiveau(niveau);
    return disciplines.length;
  }
};

export default DisciplineService;

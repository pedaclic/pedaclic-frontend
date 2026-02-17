// ==================== TYPES EBOOKS - PHASE 20 ====================
// PedaClic : Bibliothèque Ebooks Premium
// Interfaces TypeScript pour la gestion des ebooks
// =============================================================

import { Classe, Niveau } from './index';

/**
 * Catégories d'ebooks disponibles sur PedaClic
 */
export type CategorieEbook =
  | 'manuel'        // Manuels scolaires
  | 'annale'        // Annales corrigées (BFEM, BAC)
  | 'guide'         // Guides de révision / fiches résumés
  | 'litterature'   // Culture générale / Littérature
  | 'fiche';        // Fiches de lectures

/**
 * Labels lisibles pour chaque catégorie
 */
export const CATEGORIE_LABELS: Record<CategorieEbook, string> = {
  manuel: 'Manuels scolaires',
  annale: 'Annales corrigées',
  guide: 'Guides de révision',
  litterature: 'Culture générale & Littérature',
  fiche: 'Fiches de lectures'
};

/**
 * Icônes pour chaque catégorie
 */
export const CATEGORIE_ICONS: Record<CategorieEbook, string> = {
  manuel: '📘',
  annale: '📝',
  guide: '📋',
  litterature: '📖',
  fiche: '📄'
};

/**
 * Interface principale d'un ebook
 */
export interface Ebook {
  id: string;                       // ID unique Firestore
  titre: string;                    // Titre de l'ebook
  auteur: string;                   // Auteur(s) du document
  description: string;              // Description / résumé
  categorie: CategorieEbook;        // Catégorie d'ebook
  niveau: Niveau;                   // Niveau (collège ou lycée)
  classe: Classe | 'all';           // Classe spécifique ou toutes
  matiere?: string;                 // Matière associée (optionnel)
  couvertureURL?: string;           // URL de l'image de couverture
  fichierURL: string;               // URL du fichier PDF complet (Firebase Storage)
  aperçuURL?: string;               // URL du PDF aperçu (premières pages)
  nombrePages: number;              // Nombre total de pages
  pagesApercu: number;              // Nombre de pages en aperçu gratuit
  tailleFichier: number;            // Taille du fichier en octets
  annee?: string;                   // Année de publication (ex: "2024-2025")
  editeur?: string;                 // Éditeur du document
  isbn?: string;                    // ISBN (optionnel)
  tags?: string[];                  // Tags pour filtrage
  nombreTelechargements: number;    // Compteur de téléchargements
  nombreVues: number;               // Compteur de vues
  ordre: number;                    // Ordre d'affichage
  isActive: boolean;                // Actif ou désactivé
  createdAt: Date;                  // Date de création
  updatedAt?: Date;                 // Dernière mise à jour
  uploadedBy: string;               // ID admin qui a uploadé
}

/**
 * Données du formulaire d'ajout/modification d'ebook
 */
export interface EbookFormData {
  titre: string;
  auteur: string;
  description: string;
  categorie: CategorieEbook;
  niveau: Niveau;
  classe: Classe | 'all';
  matiere?: string;
  nombrePages: number;
  pagesApercu: number;
  annee?: string;
  editeur?: string;
  isbn?: string;
  tags?: string[];
  ordre: number;
  isActive: boolean;
}

/**
 * Filtres pour la bibliothèque d'ebooks
 */
export interface EbookFilters {
  categorie?: CategorieEbook | 'all';
  niveau?: Niveau | 'all';
  classe?: Classe | 'all';
  matiere?: string;
  recherche?: string;
}

/**
 * Statistiques de la bibliothèque (admin)
 */
export interface EbookStats {
  totalEbooks: number;
  totalTelechargements: number;
  totalVues: number;
  parCategorie: Record<CategorieEbook, number>;
  ebooksActifs: number;
}

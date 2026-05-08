// ==================== TYPES EBOOKS - PHASE 20 ====================
// PedaClic : Bibliothèque Ebooks Premium
// Interfaces TypeScript pour la gestion des ebooks
// =============================================================

import { Niveau } from './index';
import type { Classe } from './cahierTextes.types';

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
 * Format de stockage de l'ebook.
 *  - 'pdf'  : ebook publié sous forme de fichier PDF (comportement historique).
 *  - 'html' : ebook publié sous forme de page HTML autonome (fiche interactive,
 *             page éducative, infographie web). Le code HTML/CSS/JS est uploadé
 *             dans Firebase Storage en tant que fichier .html avec
 *             contentType = 'text/html; charset=utf-8'. L'affichage côté élève
 *             se fait via un <iframe sandbox> pour isoler le contenu de
 *             l'application principale (sécurité XSS).
 *
 * Les ebooks créés AVANT l'introduction de ce champ ne possèdent pas la
 * propriété `format` ; l'absence est traitée comme 'pdf' (rétrocompatibilité)
 * dans tous les composants consommateurs.
 */
export type FormatEbook = 'pdf' | 'html';

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
  // ⚠️ `fichierURL` reste l'URL canonique du contenu principal :
  //   - format 'pdf'  → URL du PDF complet
  //   - format 'html' → URL du fichier .html stocké dans Storage
  // Cette double-utilisation est volontaire pour préserver la rétro-
  // compatibilité de tous les ebooks PDF existants.
  fichierURL: string;               // URL du fichier complet (Firebase Storage)
  aperçuURL?: string;               // URL du PDF aperçu (premières pages — PDF uniquement)
  format?: FormatEbook;             // 'pdf' (défaut implicite) ou 'html' — voir FormatEbook
  nombrePages: number;              // Nombre total de pages (HTML : 1 par défaut)
  pagesApercu: number;              // Nombre de pages en aperçu gratuit (PDF uniquement)
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
 *
 * Le champ `format` est inclus pour permettre à l'admin de choisir
 * entre un upload PDF (par défaut) ou une intégration de code HTML.
 * Le champ reste optionnel pour la rétrocompatibilité du formulaire :
 * en l'absence de valeur, le format 'pdf' est utilisé.
 */
export interface EbookFormData {
  titre: string;
  auteur: string;
  description: string;
  categorie: CategorieEbook;
  niveau: Niveau;
  classe: Classe | 'all';
  matiere?: string;
  format?: FormatEbook;             // Choix admin : PDF (défaut) ou HTML
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

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
 *  - 'pdf'      : ebook publié sous forme de fichier PDF (comportement historique).
 *  - 'html'     : ebook publié sous forme de page HTML autonome (fiche interactive,
 *                 page éducative, infographie web). Le code HTML/CSS/JS est uploadé
 *                 dans Firebase Storage en tant que fichier .html avec
 *                 contentType = 'text/html; charset=utf-8'. L'affichage côté élève
 *                 se fait via un <iframe sandbox> pour isoler le contenu de
 *                 l'application principale (sécurité XSS).
 *  - 'compiled' : ebook compilé par un Prof Premium via le Générateur IA.
 *                 Les sections (Markdown) sont stockées DIRECTEMENT dans le
 *                 document Firestore (champ `sections`) plutôt que dans
 *                 Firebase Storage. Le rendu se fait à la volée côté EbookViewer
 *                 via le convertisseur markdownToHtml partagé. Avantage :
 *                 modification simple par l'admin, pas de fichier orphelin
 *                 à supprimer dans Storage, et possibilité d'édition incrémentale.
 *
 * Les ebooks créés AVANT l'introduction de ce champ ne possèdent pas la
 * propriété `format` ; l'absence est traitée comme 'pdf' (rétrocompatibilité)
 * dans tous les composants consommateurs.
 */
export type FormatEbook = 'pdf' | 'html' | 'compiled';

/**
 * Section d'un ebook compilé.
 * Reflet de la structure produite par EbookCompiler — gardée séparée
 * de `compiledEbookService.CompiledSection` pour éviter une dépendance
 * croisée types ↔ services. Les deux interfaces sont volontairement
 * identiques.
 */
export interface EbookCompiledSection {
  contenuId:  string;   // ID du generated_content source (traçabilité)
  type:       string;   // GenerationType (cours, exercice, sujet, fiche, …)
  discipline: string;
  classe:     string;
  chapitre:   string;
  content:    string;   // Texte Markdown brut
}

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
  /**
   * Autorisation du téléchargement du fichier (PDF ou HTML) par l'utilisateur final.
   *
   *  - `true`      → le bouton "Télécharger" est visible (Premium et non-Premium
   *                  selon les règles d'accès existantes).
   *  - `false`     → le bouton de téléchargement est masqué pour TOUS les
   *                  utilisateurs (Premium inclus). La lecture en ligne reste
   *                  possible : seule l'export/téléchargement est bloqué.
   *  - `undefined` → équivalent à `true` (RÉTROCOMPATIBILITÉ). Les ebooks
   *                  créés avant l'introduction de ce champ continuent donc
   *                  d'autoriser le téléchargement par défaut, sans migration.
   *
   * Ce champ est volontairement INDÉPENDANT de `isActive` :
   *  - `isActive` contrôle la visibilité de l'ebook dans la bibliothèque.
   *  - `telechargementActif` contrôle uniquement l'action de téléchargement.
   * Un ebook peut donc être visible et lisible en ligne, mais non téléchargeable.
   */
  telechargementActif?: boolean;
  createdAt: Date;                  // Date de création
  updatedAt?: Date;                 // Dernière mise à jour
  uploadedBy: string;               // ID admin qui a uploadé

  // ==================== CHAMPS EBOOKS COMPILÉS ====================
  /**
   * Sections de l'ebook au format Markdown.
   * Présent UNIQUEMENT pour les ebooks `format === 'compiled'`.
   * Pour les autres formats (pdf, html), ce champ est `undefined`.
   *
   * Le rendu côté EbookViewer concatène les sections et utilise le
   * convertisseur partagé `utils/markdownToHtml` pour produire le HTML
   * final. Le contenu n'est jamais uploadé dans Storage : il est
   * directement lu depuis Firestore à chaque ouverture.
   */
  sections?: EbookCompiledSection[];

  /**
   * ID de l'utilisateur Prof Premium qui a compilé l'ebook.
   * Présent UNIQUEMENT pour les ebooks `format === 'compiled'`.
   *
   * Utilisé pour :
   *  - Afficher au prof ses propres compilations dans la bibliothèque,
   *    même quand l'admin ne les a pas encore activées (`isActive=false`).
   *  - Limiter les actions d'édition/suppression côté prof à ses propres
   *    ebooks (sécurité côté client + règles Firestore).
   *  - Tracer la paternité de l'ebook dans le panneau Admin.
   */
  userId?: string;

  /**
   * Origine de l'ebook — sert à distinguer rapidement les ebooks créés
   * par un admin (`'admin'`) de ceux compilés par un Prof Premium
   * (`'compiled_prof'`). Implicitement `'admin'` quand le champ est absent
   * (rétrocompatibilité).
   *
   * Utilisé par AdminEbooks pour afficher un badge spécifique et faciliter
   * la modération des compilations en attente.
   */
  source?: 'admin' | 'compiled_prof';
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
  /**
   * Autorisation du téléchargement (voir doc complète sur `Ebook.telechargementActif`).
   * Champ optionnel dans le formulaire : si absent à la création, le service
   * écrira `true` par défaut (cf. addEbook dans ebookService.ts).
   */
  telechargementActif?: boolean;
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

// ============================================================
// PedaClic — Phase 54 : Espace classe (communication prof ↔ élèves)
// ------------------------------------------------------------
// Une seule collection Firestore : `messages_classe`.
// Chaque document est rattaché à UN groupe-classe (groupes_prof).
//
// Trois natures de message :
//   • 'annonce' : le professeur informe TOUT le groupe (événement,
//                 devoir, sortie…) — peut porter une date d'événement
//                 et être épinglée en tête du fil ;
//   • 'prive'   : le professeur écrit à UN élève (lecture réservée
//                 au professeur et à cet élève) — l'élève ne peut
//                 PAS répondre en privé ;
//   • 'forum'   : discussion PUBLIQUE du groupe, ouverte au professeur
//                 ET aux élèves (seul canal d'expression des élèves).
// ============================================================

import type { Timestamp } from 'firebase/firestore';

/** Nature d'un message de l'espace classe */
export type NatureMessage = 'annonce' | 'prive' | 'forum';

/** Rôle de l'auteur (affichage + règles Firestore) */
export type RoleAuteurMessage = 'prof' | 'eleve';

/** Document `messages_classe/{id}` */
export interface MessageClasse {
  id: string;

  // ── Rattachement ──
  groupeId: string;              // groupe-classe concerné
  groupeNom: string;             // dénormalisé (affichage)
  profId: string;                // propriétaire du groupe (règles Firestore)

  // ── Nature & portée ──
  nature: NatureMessage;
  /** 'groupe' = visible par tout le groupe ; 'individuel' = message privé */
  portee: 'groupe' | 'individuel';
  destinataireId?: string | null;  // élève visé (nature 'prive' uniquement)
  destinataireNom?: string | null;

  // ── Auteur ──
  auteurId: string;
  auteurNom: string;
  auteurRole: RoleAuteurMessage;
  /** Élève : ID de son inscription au groupe (preuve d'appartenance vérifiée par les règles) */
  inscriptionId?: string | null;

  // ── Contenu ──
  titre?: string;                // annonces : titre court
  contenu: string;
  /** Annonce d'événement : date (AAAA-MM-JJ) et heure (HH:mm) facultatives */
  evenementDate?: string | null;
  evenementHeure?: string | null;
  important?: boolean;           // annonce mise en évidence
  epingle?: boolean;             // annonce épinglée en tête

  // ── Dates ──
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/** Données saisies dans le formulaire de publication */
export interface NouveauMessage {
  groupeId: string;
  groupeNom: string;
  profId: string;
  nature: NatureMessage;
  destinataireId?: string;
  destinataireNom?: string;
  titre?: string;
  contenu: string;
  evenementDate?: string;
  evenementHeure?: string;
  important?: boolean;
  inscriptionId?: string;        // obligatoire pour un élève
}

/** Libellés et couleurs des natures (onglets, pastilles) */
export const NATURE_MESSAGE_CONFIG: Record<NatureMessage, { label: string; emoji: string; color: string; bg: string }> = {
  annonce: { label: 'Annonces',         emoji: '📢', color: '#1d4ed8', bg: '#dbeafe' },
  forum:   { label: 'Forum de classe',  emoji: '💬', color: '#047857', bg: '#d1fae5' },
  prive:   { label: 'Messages privés',  emoji: '✉️', color: '#7c3aed', bg: '#ede9fe' },
};

/** Longueurs maximales (contrôlées aussi par les règles Firestore) */
export const MAX_TITRE_MESSAGE = 120;
export const MAX_CONTENU_MESSAGE = 4000;

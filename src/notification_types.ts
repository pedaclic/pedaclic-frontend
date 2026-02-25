// ============================================================
// PedaClic — notification_types.ts
// Phase 26 : Types TypeScript pour le système de notifications
//
// Couvrent les notifications in-app (Firestore) ET email (Resend)
// pour tous les rôles : élève, parent, prof, admin.
// ============================================================

// ─── Types de notifications disponibles ─────────────────────

/**
 * Chaque type correspond à un déclencheur et un template email distinct.
 */
export type TypeNotification =
  | 'nouveau_cours'       // Un prof publie un nouveau cours
  | 'resultat_quiz'       // Un élève termine un quiz
  | 'rappel_echeance'     // Rappel BFEM / BAC / examen
  | 'message_prof'        // Message direct du prof à ses élèves
  | 'annonce'             // Devoir, information, événement
  | 'nouveau_abonnement'  // Confirmation d'abonnement Premium
  | 'bienvenue';          // Message d'accueil à l'inscription

/**
 * Rôles destinataires possibles
 */
export type RoleDestinataire = 'eleve' | 'parent' | 'prof' | 'admin' | 'tous';

/**
 * Canaux de diffusion
 */
export type CanalNotification = 'in_app' | 'email' | 'les_deux';

/**
 * Statut de lecture d'une notification in-app
 */
export type StatutNotification = 'non_lue' | 'lue' | 'archivee';

// ─── Interface principale : Notification Firestore ──────────

/**
 * Document stocké dans la collection `notifications` de Firestore.
 * Chaque document = une notification pour UN destinataire.
 */
export interface Notification {
  id: string;                        // ID Firestore auto-généré

  // ── Destinataire ──
  destinataireId: string;            // UID Firebase du destinataire
  destinataireRole: RoleDestinataire;// Rôle du destinataire

  // ── Contenu ──
  type: TypeNotification;            // Type de notification
  titre: string;                     // Titre court (ex: "Nouveau cours disponible")
  message: string;                   // Corps du message
  lienAction?: string;               // URL de redirection (ex: "/cours/abc123")
  labelAction?: string;              // Texte du bouton d'action (ex: "Voir le cours")

  // ── Métadonnées ──
  emetteurId?: string;               // UID de l'émetteur (prof/admin)
  emetteurNom?: string;              // Nom affiché de l'émetteur
  entiteId?: string;                 // ID de l'entité liée (cours, quiz, etc.)
  entiteType?: 'cours' | 'quiz' | 'sequence' | 'autre';

  // ── Statut & canal ──
  statut: StatutNotification;        // État de lecture
  canal: CanalNotification;          // Canal utilisé
  emailEnvoye?: boolean;             // Email envoyé avec succès ?
  emailErreur?: string;              // Message d'erreur email si échec

  // ── Dates ──
  createdAt: Date;                   // Date de création
  luAt?: Date;                       // Date de lecture
}

// ─── Interface : Payload pour créer une notification ────────

/**
 * Données nécessaires pour créer et envoyer une notification.
 * Utilisé par notificationService.ts côté client.
 */
export interface CreateNotificationPayload {
  // Destinataire(s)
  destinataireId?: string;           // Un seul destinataire (UID)
  destinataireRole?: RoleDestinataire; // Ou tous les utilisateurs d'un rôle
  groupeId?: string;                 // Ou tous les élèves d'un groupe-classe

  // Contenu
  type: TypeNotification;
  titre: string;
  message: string;
  lienAction?: string;
  labelAction?: string;

  // Métadonnées
  emetteurId?: string;
  emetteurNom?: string;
  entiteId?: string;
  entiteType?: 'cours' | 'quiz' | 'sequence' | 'autre';

  // Options d'envoi
  canal: CanalNotification;
  emailDestinataire?: string;        // Email du destinataire (pour Resend)
  emailDestinatairNom?: string;      // Nom affiché dans l'email
}

// ─── Interface : Payload API Railway (email) ─────────────────

/**
 * Corps de la requête POST vers Railway /api/notifications/send-email
 */
export interface EmailPayload {
  to: string;                        // Adresse email destinataire
  toName?: string;                   // Nom affiché
  type: TypeNotification;            // Détermine le template
  titre: string;
  message: string;
  lienAction?: string;
  labelAction?: string;
  emetteurNom?: string;
}

// ─── Interface : Réponse API Railway ────────────────────────

export interface EmailApiResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Interface : Compteurs de notifications ─────────────────

/**
 * Utilisé par NotificationBell pour afficher le badge
 */
export interface NotificationCounts {
  total: number;
  nonLues: number;
}

// ─── Interface : Filtres pour la page notifications ─────────

export interface NotificationFilters {
  statut?: StatutNotification | 'toutes';
  type?: TypeNotification | 'tous';
  dateDebut?: Date;
  dateFin?: Date;
}

// ─── Templates de notification prédéfinis ───────────────────

/**
 * Messages par défaut pour chaque type de notification.
 * Utilisés par le NotificationComposer pour pré-remplir les champs.
 */
export const TEMPLATES_NOTIFICATION: Record<TypeNotification, {
  titreDefaut: string;
  messageDefaut: string;
  icone: string;
  couleur: string;
}> = {
  nouveau_cours: {
    titreDefaut: 'Nouveau cours disponible',
    messageDefaut: 'Un nouveau cours vient d\'être publié dans votre matière.',
    icone: '📚',
    couleur: '#2563eb',
  },
  resultat_quiz: {
    titreDefaut: 'Résultat de votre quiz',
    messageDefaut: 'Votre résultat au quiz est disponible.',
    icone: '🎯',
    couleur: '#10b981',
  },
  rappel_echeance: {
    titreDefaut: 'Rappel d\'échéance',
    messageDefaut: 'N\'oubliez pas votre examen approche.',
    icone: '⏰',
    couleur: '#f59e0b',
  },
  message_prof: {
    titreDefaut: 'Message de votre professeur',
    messageDefaut: '',
    icone: '💬',
    couleur: '#8b5cf6',
  },
  annonce: {
    titreDefaut: 'Annonce importante',
    messageDefaut: '',
    icone: '📢',
    couleur: '#ef4444',
  },
  nouveau_abonnement: {
    titreDefaut: 'Abonnement Premium activé 🎉',
    messageDefaut: 'Votre abonnement Premium PedaClic est maintenant actif. Profitez de tous les contenus !',
    icone: '⭐',
    couleur: '#f59e0b',
  },
  bienvenue: {
    titreDefaut: 'Bienvenue sur PedaClic !',
    messageDefaut: 'Bienvenue sur PedaClic, la plateforme éducative sénégalaise. Commencez votre apprentissage dès maintenant !',
    icone: '🎓',
    couleur: '#10b981',
  },
};

// ─── Labels affichés dans l'interface ───────────────────────

export const LABELS_TYPE_NOTIFICATION: Record<TypeNotification, string> = {
  nouveau_cours:      '📚 Nouveau cours',
  resultat_quiz:      '🎯 Résultat quiz',
  rappel_echeance:    '⏰ Rappel échéance',
  message_prof:       '💬 Message prof',
  annonce:            '📢 Annonce',
  nouveau_abonnement: '⭐ Abonnement',
  bienvenue:          '🎓 Bienvenue',
};

export const LABELS_ROLE: Record<RoleDestinataire, string> = {
  eleve:  '👨‍🎓 Élèves',
  parent: '👨‍👩‍👧 Parents',
  prof:   '👨‍🏫 Professeurs',
  admin:  '⚙️ Admins',
  tous:   '🌍 Tous les utilisateurs',
};

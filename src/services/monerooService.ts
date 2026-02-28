// ============================================================
// PEDACLIC — Service Moneroo (Frontend)
// ============================================================
// Fichier : src/services/monerooService.ts
//
// Gère les appels au backend Railway pour les paiements Moneroo
// et la vérification après redirection.
// ============================================================

// ── URL du backend Railway ────────────────────────────────────
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://api.pedaclic.sn';

// ── Types ─────────────────────────────────────────────────────

export type PlanPremium =
  | 'illimite_3m'
  | 'illimite_6m'
  | 'illimite_1an'
  | 'a_la_carte_1'
  | 'a_la_carte_3'
  | 'a_la_carte_7'
  | 'a_la_carte_tous';

export interface InitiationPaiementParams {
  plan:          PlanPremium;
  userId:        string;
  userEmail:     string;
  userFirstName?: string;
  userLastName?:  string;
}

export interface InitiationPaiementResponse {
  success:     boolean;
  paymentId:   string;
  checkoutUrl: string;
}

export interface VerificationPaiementResponse {
  success: boolean;
  status:  'pending' | 'success' | 'failed' | 'cancelled';
  payment: Record<string, unknown>;
}

// ── Labels et montants ────────────────────────────────────────

export const PLANS_PREMIUM: Record<PlanPremium, {
  label:       string;
  montant:     number;
  duree:       string;
  description: string;
}> = {
  a_la_carte_1: {
    label:       '1 cours',
    montant:     1000,
    duree:       '1 mois',
    description: 'Choisissez 1 cours par discipline et niveau',
  },
  a_la_carte_3: {
    label:       '3 cours',
    montant:     2000,
    duree:       '1 mois',
    description: 'Choisissez 3 cours par discipline et niveau',
  },
  a_la_carte_7: {
    label:       '7 cours',
    montant:     5000,
    duree:       '1 mois',
    description: 'Choisissez 7 cours par discipline et niveau',
  },
  a_la_carte_tous: {
    label:       'Tous les contenus',
    montant:     25000,
    duree:       '9 mois',
    description: 'Accès à l\'intégralité du catalogue pendant 9 mois',
  },
  illimite_3m: {
    label:       '3 mois',
    montant:     10000,
    duree:       '3 mois',
    description: 'Accès illimité aux cours, quiz et ressources pendant 3 mois',
  },
  illimite_6m: {
    label:       '6 mois',
    montant:     20000,
    duree:       '6 mois',
    description: 'Accès illimité pendant 6 mois — économisez 10 000 FCFA !',
  },
  illimite_1an: {
    label:       '1 an',
    montant:     30000,
    duree:       '1 an',
    description: 'Accès illimité toute l\'année — économisez 30 000 FCFA !',
  },
};

// ============================================================
// FONCTION 1 : Initier un paiement Moneroo
// Appelle le backend Railway qui contacte api.moneroo.io
// Retourne l'URL de checkout vers laquelle rediriger l'utilisateur
// ============================================================

export async function initierPaiementMoneroo(
  params: InitiationPaiementParams
): Promise<InitiationPaiementResponse> {
  const response = await fetch(`${API_BASE_URL}/api/moneroo/initiate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { error?: string }).error ||
      `Erreur serveur (${response.status})`
    );
  }

  const data: InitiationPaiementResponse = await response.json();

  if (!data.success || !data.checkoutUrl) {
    throw new Error('Réponse invalide du serveur de paiement');
  }

  return data;
}

// ============================================================
// FONCTION 2 : Vérifier un paiement après retour
// À appeler sur la page /premium/confirmation
// après la redirection depuis Moneroo
// ============================================================

export async function verifierPaiementMoneroo(
  paymentId: string
): Promise<VerificationPaiementResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/moneroo/verify/${paymentId}`,
    {
      method:  'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    throw new Error(`Erreur vérification paiement (${response.status})`);
  }

  return response.json();
}

// ============================================================
// FONCTION 3 : Rediriger vers le checkout Moneroo
// Ouvre la page de paiement Moneroo dans le même onglet
// ============================================================

export function redirigerVersCheckout(checkoutUrl: string): void {
  window.location.href = checkoutUrl;
}

// ============================================================
// FONCTION 4 : Lire les paramètres de retour dans l'URL
// Moneroo redirige vers return_url?status=...&paymentId=...
// ============================================================

export function lireParamsRetourMoneroo(): {
  paymentId:     string | null;
  paymentStatus: string | null;
  status:        string | null;
} {
  const params = new URLSearchParams(window.location.search);
  return {
    paymentId:     params.get('paymentId'),
    paymentStatus: params.get('paymentStatus'),
    status:        params.get('status'),
  };
}

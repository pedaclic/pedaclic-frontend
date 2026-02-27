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

export type PlanPremium = 'mensuel' | 'annuel';

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
  mensuel: {
    label:       'Premium Mensuel',
    montant:     2000,
    duree:       '1 mois',
    description: 'Accès illimité aux cours, quiz et ressources pendant 1 mois',
  },
  annuel: {
    label:       'Premium Annuel',
    montant:     20000,
    duree:       '1 an',
    description: 'Accès illimité toute l\'année — économisez 4 000 FCFA !',
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

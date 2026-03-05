// ============================================================
// PedaClic — Page Confirmation Paiement Premium (Moneroo)
// ============================================================
// Fichier  : src/pages/PremiumConfirmationPage.tsx
// Route    : /premium/confirmation
// Accès    : Tous (appelé après redirection Moneroo)
// Auteur   : Kadou / PedaClic — www.pedaclic.sn
// ============================================================
// Moneroo redirige ici après paiement avec les paramètres :
//   ?paymentId=xxx&paymentStatus=success|failed&status=success
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  verifierPaiementMoneroo,
  lireParamsRetourMoneroo,
} from '../services/monerooService';
import '../styles/PremiumPage.css';

/** Route du tableau de bord selon le rôle utilisateur */
function getDashboardPath(role?: string): string {
  switch (role) {
    case 'eleve':  return '/eleve/dashboard';
    case 'prof':   return '/prof/dashboard';
    case 'parent': return '/parent/dashboard';
    case 'admin':  return '/admin';
    default:       return '/eleve/dashboard';
  }
}

// ============================================================
// COMPOSANT : PremiumConfirmationPage
// ============================================================

export default function PremiumConfirmationPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const dashboardPath = getDashboardPath(currentUser?.role);

  // ── États ──────────────────────────────────────────────────
  const [statut, setStatut] = useState<'chargement' | 'succes' | 'echec' | 'attente'>('chargement');
  const [erreur, setErreur] = useState<string | null>(null);

  // ──────────────────────────────────────────────────────────
  // EFFET : Vérification du paiement au chargement
  // ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function verifierPaiement() {
      // Lire les paramètres retournés par Moneroo dans l'URL
      const { paymentId, paymentStatus } = lireParamsRetourMoneroo();

      // Aucun ID de paiement → rediriger vers Premium
      if (!paymentId) {
        navigate('/premium');
        return;
      }

      // Paiement annulé ou échoué directement depuis Moneroo
      if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
        setStatut('echec');
        setErreur('Le paiement a été annulé ou a échoué. Aucun montant n\'a été débité.');
        return;
      }

      try {
        // Vérification côté serveur (évite les fraudes)
        const verification = await verifierPaiementMoneroo(paymentId);

        if (verification.status === 'success') {
          setStatut('succes');
        } else if (verification.status === 'pending') {
          // Paiement en cours de traitement (ex: virement)
          setStatut('attente');
        } else {
          setStatut('echec');
          setErreur('Le paiement n\'a pas pu être confirmé. Contactez le support si le montant a été débité.');
        }

      } catch {
        // Erreur réseau — on considère le paiement en attente
        // Le webhook Moneroo activera le Premium automatiquement
        setStatut('attente');
      }
    }

    verifierPaiement();
  }, [navigate]);

  // ──────────────────────────────────────────────────────────
  // RENDU : Écran de chargement
  // ──────────────────────────────────────────────────────────

  if (statut === 'chargement') {
    return (
      <div className="premium-confirmation">
        <div className="premium-confirmation__card">
          <div className="premium-spinner premium-spinner--lg" aria-label="Vérification en cours" />
          <h2>Vérification du paiement…</h2>
          <p>Merci de patienter quelques secondes.</p>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // RENDU : Paiement réussi
  // ──────────────────────────────────────────────────────────

  if (statut === 'succes') {
    return (
      <div className="premium-confirmation">
        <div className="premium-confirmation__card premium-confirmation__card--succes">

          {/* Icône succès animée */}
          <div className="premium-confirmation__icone premium-confirmation__icone--succes">
            ✅
          </div>

          <h1>Bienvenue dans Premium ! 🎉</h1>
          <p className="premium-confirmation__message">
            Ton abonnement est activé. Tu as maintenant accès à <strong>tous les cours,
            quiz et ressources</strong> de PedaClic.
          </p>

          <div className="premium-confirmation__actions">
            <button
              className="premium-btn premium-btn--principal"
              onClick={() => navigate(dashboardPath)}
            >
              🚀 Accéder au tableau de bord
            </button>
            <button
              className="premium-btn premium-btn--secondaire"
              onClick={() => navigate('/cours')}
            >
              📚 Voir les cours
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // RENDU : Paiement en attente
  // ──────────────────────────────────────────────────────────

  if (statut === 'attente') {
    return (
      <div className="premium-confirmation">
        <div className="premium-confirmation__card premium-confirmation__card--attente">

          <div className="premium-confirmation__icone premium-confirmation__icone--attente">
            ⏳
          </div>

          <h1>Paiement en cours de traitement</h1>
          <p className="premium-confirmation__message">
            Ton paiement est en cours de vérification. Ton accès Premium sera
            activé automatiquement dès confirmation (généralement moins de 5 minutes).
          </p>
          <p className="premium-confirmation__message">
            Tu recevras une notification dès que c'est prêt. Tu peux fermer cette page.
          </p>

          <button
            className="premium-btn premium-btn--secondaire"
            onClick={() => navigate(dashboardPath)}
          >
            Aller au tableau de bord
          </button>

        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // RENDU : Paiement échoué
  // ──────────────────────────────────────────────────────────

  return (
    <div className="premium-confirmation">
      <div className="premium-confirmation__card premium-confirmation__card--echec">

        <div className="premium-confirmation__icone premium-confirmation__icone--echec">
          ❌
        </div>

        <h1>Paiement non abouti</h1>
        <p className="premium-confirmation__message">
          {erreur || 'Une erreur est survenue lors du paiement.'}
        </p>

        <div className="premium-confirmation__actions">
          <button
            className="premium-btn premium-btn--principal"
            onClick={() => navigate('/premium')}
          >
            🔄 Réessayer
          </button>
          <button
            className="premium-btn premium-btn--secondaire"
            onClick={() => navigate(dashboardPath)}
          >
            Retour au tableau de bord
          </button>
        </div>

      </div>
    </div>
  );
}

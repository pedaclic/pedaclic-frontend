// ============================================================
// PedaClic — Page Premium (Moneroo)
// ============================================================
// Fichier  : src/pages/PremiumPage.tsx
// Route    : /premium
// Accès    : Tous les utilisateurs connectés
// Auteur   : Kadou / PedaClic — www.pedaclic.sn
// ============================================================
// Permet aux élèves, profs et parents de souscrire à
// l'abonnement Premium via Moneroo (Wave, Orange Money, etc.)
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../hooks/useAuth';
import {
  initierPaiementMoneroo,
  redirigerVersCheckout,
  PLANS_PREMIUM,
  type PlanPremium,
} from '../services/monerooService';
import '../styles/PremiumPage.css';

// ─────────────────────────────────────────────────────────────
// DONNÉES : Avantages Premium par rôle
// ─────────────────────────────────────────────────────────────

const AVANTAGES_PREMIUM = [
  { icone: '📚', titre: 'Cours complets',       description: 'Accès illimité à tous les cours du programme sénégalais 6ème → Terminale' },
  { icone: '🎯', titre: 'Quiz illimités',        description: 'Tous les quiz par matière avec corrections détaillées et explications' },
  { icone: '🤖', titre: 'Générateur IA',         description: 'Génération de cours, fiches de révision et évaluations par intelligence artificielle' },
  { icone: '📊', titre: 'Suivi de progression',  description: 'Tableaux de bord analytiques pour suivre les performances en temps réel' },
  { icone: '📖', titre: 'Bibliothèque ebooks',   description: 'Accès à tous les manuels et ressources pédagogiques numériques' },
  { icone: '🔔', titre: 'Notifications',         description: 'Alertes personnalisées pour devoirs, évaluations et rappels scolaires' },
];

// ─────────────────────────────────────────────────────────────
// DONNÉES : Moyens de paiement acceptés
// ─────────────────────────────────────────────────────────────

const MOYENS_PAIEMENT = [
  { nom: 'Wave',         couleur: '#1976D2', emoji: '🌊' },
  { nom: 'Orange Money', couleur: '#FF6B00', emoji: '🟠' },
  { nom: 'Free Money',   couleur: '#E30613', emoji: '🔴' },
  { nom: 'FLASH',        couleur: '#6B21A8', emoji: '⚡' },
  { nom: 'Carte Bancaire', couleur: '#059669', emoji: '💳' },
];

// ============================================================
// COMPOSANT PRINCIPAL : PremiumPage
// ============================================================

export default function PremiumPage() {
  const navigate              = useNavigate();
  const { currentUser }       = useAuth();

  // ── État local ─────────────────────────────────────────────
  const [ongletPlans, setOngletPlans] = useState<'a_la_carte' | 'illimite'>('a_la_carte');
  const [planSelectionne, setPlanSelectionne] = useState<PlanPremium>('a_la_carte_3');
  const [loading, setLoading]                 = useState(false);
  const [erreur, setErreur]                   = useState<string | null>(null);

  // ── Si l'utilisateur est déjà Premium ──────────────────────
  const estDejaAbonne = currentUser?.isPremium === true;

  // ──────────────────────────────────────────────────────────
  // HANDLER : Lancer le paiement Moneroo
  // ──────────────────────────────────────────────────────────

  async function lancerPaiement() {
    // Rediriger vers la page de connexion si non connecté
    if (!currentUser) {
      navigate('/login?redirect=/premium');
      return;
    }

    setLoading(true);
    setErreur(null);

    try {
      // Appel au backend Railway → Moneroo
      const result = await initierPaiementMoneroo({
        plan:          planSelectionne,
        userId:        currentUser.uid,
        userEmail:     currentUser.email || '',
        userFirstName: currentUser.displayName?.split(' ')[0] || 'Élève',
        userLastName:  currentUser.displayName?.split(' ')[1] || 'PedaClic',
      });

      // Redirection vers la page de paiement Moneroo
      redirigerVersCheckout(result.checkoutUrl);

    } catch (err) {
      setErreur(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue. Veuillez réessayer.'
      );
      setLoading(false);
    }
  }

  // ──────────────────────────────────────────────────────────
  // RENDU
  // ──────────────────────────────────────────────────────────

  return (
    <div className="premium-page">

      {/* ── EN-TÊTE ─────────────────────────────────────────── */}
      <header className="premium-hero">
        <div className="premium-hero__content">
          <span className="premium-hero__badge">⭐ PREMIUM</span>
          <h1 className="premium-hero__titre">
            Débloque tout PedaClic
          </h1>
          <p className="premium-hero__sous-titre">
            Accède à tous les cours, quiz et ressources du programme sénégalais.<br />
            Du 6ème au BAC — <strong>L'école en un clic !</strong>
          </p>
        </div>
      </header>

      <div className="premium-contenu">

        {/* ── DÉJÀ ABONNÉ ─────────────────────────────────── */}
        {estDejaAbonne && (
          <section className="premium-abonne">
            <div className="premium-abonne__icone">✅</div>
            <h2>Tu es déjà abonné Premium !</h2>
            <p>Ton abonnement est actif. Profite de tous les contenus exclusifs.</p>
            <button
              className="premium-btn premium-btn--secondaire"
              onClick={() => navigate('/dashboard')}
            >
              Aller au tableau de bord
            </button>
          </section>
        )}

        {/* ── PLANS DE TARIFICATION ───────────────────────── */}
        {!estDejaAbonne && (
          <section className="premium-plans">
            <h2 className="premium-section__titre">Choisir un abonnement</h2>

            {/* Onglets : Cours à la carte ou Illimité */}
            <div className="premium-pricing__tabs" style={{ marginBottom: '1.5rem' }}>
              <button
                type="button"
                className={`premium-pricing__tab ${ongletPlans === 'a_la_carte' ? 'premium-pricing__tab--active' : ''}`}
                onClick={() => { setOngletPlans('a_la_carte'); setPlanSelectionne('a_la_carte_3'); }}
              >
                📚 Cours à la carte
              </button>
              <button
                type="button"
                className={`premium-pricing__tab ${ongletPlans === 'illimite' ? 'premium-pricing__tab--active' : ''}`}
                onClick={() => { setOngletPlans('illimite'); setPlanSelectionne('annuel'); }}
              >
                ⭐ Accès illimité
              </button>
            </div>

            <div
              className="premium-plans__grille"
              style={{
                gridTemplateColumns: ongletPlans === 'a_la_carte'
                  ? 'repeat(auto-fit, minmax(160px, 1fr))'
                  : undefined,
              }}
            >

              {ongletPlans === 'a_la_carte' ? (
                <>
                  {(['a_la_carte_1', 'a_la_carte_3', 'a_la_carte_7', 'a_la_carte_tous'] as const).map(planId => (
                    <div
                      key={planId}
                      className={`premium-plan-card ${planSelectionne === planId ? 'premium-plan-card--actif' : ''} ${planId === 'a_la_carte_3' ? 'premium-plan-card--populaire' : ''}`}
                      onClick={() => setPlanSelectionne(planId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && setPlanSelectionne(planId)}
                    >
                      {planId === 'a_la_carte_3' && <div className="premium-plan-card__badge-populaire">Populaire</div>}
                      <div className="premium-plan-card__select">
                        <span className={planSelectionne === planId ? 'premium-plan-card__radio--actif' : 'premium-plan-card__radio'} />
                      </div>
                      <div className="premium-plan-card__header">
                        <span className="premium-plan-card__icone">📚</span>
                        <h3 className="premium-plan-card__nom">{PLANS_PREMIUM[planId].label}</h3>
                      </div>
                      <div className="premium-plan-card__prix">
                        <span className="premium-plan-card__montant">{PLANS_PREMIUM[planId].montant.toLocaleString('fr-FR')}</span>
                        <span className="premium-plan-card__devise">FCFA / mois</span>
                      </div>
                      <p className="premium-plan-card__description">{PLANS_PREMIUM[planId].description}</p>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {/* Plan Mensuel */}
                  <div
                    className={`premium-plan-card ${planSelectionne === 'mensuel' ? 'premium-plan-card--actif' : ''}`}
                    onClick={() => setPlanSelectionne('mensuel')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setPlanSelectionne('mensuel')}
                  >
                    <div className="premium-plan-card__select">
                      <span className={planSelectionne === 'mensuel' ? 'premium-plan-card__radio--actif' : 'premium-plan-card__radio'} />
                    </div>
                    <div className="premium-plan-card__header">
                      <span className="premium-plan-card__icone">📅</span>
                      <h3 className="premium-plan-card__nom">Mensuel</h3>
                    </div>
                    <div className="premium-plan-card__prix">
                      <span className="premium-plan-card__montant">2 000</span>
                      <span className="premium-plan-card__devise">FCFA / mois</span>
                    </div>
                    <p className="premium-plan-card__description">{PLANS_PREMIUM.mensuel.description}</p>
                  </div>

                  {/* Plan Annuel */}
                  <div
                    className={`premium-plan-card premium-plan-card--populaire ${planSelectionne === 'annuel' ? 'premium-plan-card--actif' : ''}`}
                    onClick={() => setPlanSelectionne('annuel')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setPlanSelectionne('annuel')}
                  >
                    <div className="premium-plan-card__badge-populaire">🏆 Meilleure offre</div>
                    <div className="premium-plan-card__select">
                      <span className={planSelectionne === 'annuel' ? 'premium-plan-card__radio--actif' : 'premium-plan-card__radio'} />
                    </div>
                    <div className="premium-plan-card__header">
                      <span className="premium-plan-card__icone">🎓</span>
                      <h3 className="premium-plan-card__nom">Annuel</h3>
                    </div>
                    <div className="premium-plan-card__prix">
                      <span className="premium-plan-card__montant">20 000</span>
                      <span className="premium-plan-card__devise">FCFA / an</span>
                    </div>
                    <div className="premium-plan-card__economie">💰 Économisez 4 000 FCFA vs mensuel</div>
                    <p className="premium-plan-card__description">{PLANS_PREMIUM.annuel.description}</p>
                  </div>
                </>
              )}

            </div>

            {/* ── MESSAGE D'ERREUR ──────────────────────────── */}
            {erreur && (
              <div className="premium-erreur" role="alert">
                ⚠️ {erreur}
              </div>
            )}

            {/* ── BOUTON DE PAIEMENT ────────────────────────── */}
            <div className="premium-paiement">
              <button
                className="premium-btn premium-btn--principal"
                onClick={lancerPaiement}
                disabled={loading}
                aria-busy={loading}
              >
                {loading
                  ? <><span className="premium-spinner" aria-hidden="true" /> Redirection en cours…</>
                  : <>🚀 S'abonner — {PLANS_PREMIUM[planSelectionne]?.montant.toLocaleString('fr-FR')} FCFA</>
                }
              </button>

              <p className="premium-paiement__securite">
                🔒 Paiement 100% sécurisé via Moneroo
              </p>

              {/* ── MOYENS DE PAIEMENT ACCEPTÉS ───────────────── */}
              <div className="premium-moyens-paiement">
                <p className="premium-moyens-paiement__titre">Moyens de paiement acceptés :</p>
                <div className="premium-moyens-paiement__liste">
                  {MOYENS_PAIEMENT.map(moyen => (
                    <span
                      key={moyen.nom}
                      className="premium-moyen-badge"
                      style={{ borderColor: moyen.couleur, color: moyen.couleur }}
                      title={moyen.nom}
                    >
                      {moyen.emoji} {moyen.nom}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── AVANTAGES PREMIUM ───────────────────────────── */}
        <section className="premium-avantages">
          <h2 className="premium-section__titre">Ce qui est inclus</h2>
          <div className="premium-avantages__grille">
            {AVANTAGES_PREMIUM.map(avantage => (
              <div key={avantage.titre} className="premium-avantage-card">
                <span className="premium-avantage-card__icone">{avantage.icone}</span>
                <div className="premium-avantage-card__texte">
                  <h3>{avantage.titre}</h3>
                  <p>{avantage.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────── */}
        <section className="premium-faq">
          <h2 className="premium-section__titre">Questions fréquentes</h2>
          <div className="premium-faq__liste">

            <div className="premium-faq__item">
              <h3>Comment payer avec Wave ou Orange Money ?</h3>
              <p>Clique sur "S'abonner", tu seras redirigé vers la page de paiement Moneroo. Choisis ton moyen de paiement préféré et suis les instructions.</p>
            </div>

            <div className="premium-faq__item">
              <h3>Mon accès est activé quand ?</h3>
              <p>L'accès Premium est activé automatiquement dès la confirmation de ton paiement, en quelques secondes.</p>
            </div>

            <div className="premium-faq__item">
              <h3>Puis-je annuler mon abonnement ?</h3>
              <p>Oui. Contacte-nous via WhatsApp ou email. L'accès reste actif jusqu'à la fin de la période payée.</p>
            </div>

            <div className="premium-faq__item">
              <h3>Le plan annuel est-il renouvelé automatiquement ?</h3>
              <p>Non. Tu recevras une notification avant l'expiration pour renouveler si tu le souhaites.</p>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}

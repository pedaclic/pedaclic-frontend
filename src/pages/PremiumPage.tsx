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
import { useAuth } from '../hooks/useAuth';
import {
  initierPaiementMoneroo,
  redirigerVersCheckout,
  PLANS_PREMIUM,
  type PlanPremium,
} from '../services/monerooService';
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import { CLASSES_OPTIONS } from '../types/cahierTextes.types';
import MatieresNiveauxSelector from '../components/premium/MatieresNiveauxSelector';
import { estFormuleALaCarte } from '../types/premiumPlans';
import '../styles/PremiumPage.css';

// ─────────────────────────────────────────────────────────────
// DONNÉES : Avantages Premium
// ─────────────────────────────────────────────────────────────

const AVANTAGES_ELEVE = [
  { icone: '📚', titre: 'Cours complets',       description: 'Accès aux cours du programme sénégalais 6ème → Terminale' },
  { icone: '🎯', titre: 'Quiz illimités',        description: 'Tous les quiz par matière avec corrections détaillées et explications' },
  { icone: '📊', titre: 'Suivi de progression',  description: 'Tableaux de bord analytiques pour suivre les performances en temps réel' },
  { icone: '📖', titre: 'Bibliothèque ebooks',   description: 'Accès aux manuels et ressources pédagogiques numériques' },
  { icone: '🔔', titre: 'Notifications',         description: 'Alertes personnalisées pour devoirs, évaluations et rappels scolaires' },
];

const AVANTAGES_PRO = [
  { icone: '📓', titre: 'Cahier de textes',   description: 'Gérez vos cahiers de textes numériques et partagez avec vos élèves' },
  { icone: '🤖', titre: 'Générateur de contenus', description: 'Génération de cours, fiches et évaluations par intelligence artificielle' },
  { icone: '📚', titre: 'Cours en ligne',     description: 'Créez et publiez des cours pour vos élèves' },
  { icone: '🎬', titre: 'Médiathèque',       description: 'Accédez à la médiathèque pédagogique et enrichissez vos séquences' },
  { icone: '📖', titre: 'Créateur de séquences', description: 'Construisez des séquences pédagogiques complètes' },
  { icone: '📊', titre: 'Suivi des groupes',  description: 'Suivez la progression de vos classes et élèves' },
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
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { matieres } = useDisciplinesOptions();

  // ── État local ─────────────────────────────────────────────
  const [ongletPlans, setOngletPlans] = useState<'a_la_carte' | 'illimite'>('a_la_carte');
  const [planSelectionne, setPlanSelectionne] = useState<PlanPremium>('a_la_carte_3');
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtresSelection, setFiltresSelection] = useState({ matiere: '', niveau: '' });

  // ── Si l'utilisateur est déjà Premium ──────────────────────
  const estDejaAbonne = currentUser?.isPremium === true;

  // ── Rôle pour adapter le contenu ───────────────────────────
  const estProf = currentUser?.role === 'prof';
  const avantagesPremium = estProf ? AVANTAGES_PRO : AVANTAGES_ELEVE;
  const isALaCarte = estFormuleALaCarte(planSelectionne);

  // ──────────────────────────────────────────────────────────
  // HANDLER : Lancer le paiement Moneroo
  // ──────────────────────────────────────────────────────────

  async function lancerPaiement() {
    // Rediriger vers la page de connexion si non connecté
    if (!currentUser) {
      navigate('/connexion?redirect=/premium');
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
        userFirstName: currentUser.displayName?.split(' ')[0] || (estProf ? 'Professeur' : 'Élève'),
        userLastName:  currentUser.displayName?.split(' ').slice(1).join(' ') || 'PedaClic',
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
            {estProf ? 'Premium Pro — Outils pédagogiques' : 'Débloque tout PedaClic'}
          </h1>
          <p className="premium-hero__sous-titre">
            {estProf
              ? 'Cahier de textes, Générateur IA, Cours en ligne, Médiathèque… Accédez à tous les outils Premium Pro.'
              : 'Accède à tous les cours, quiz et ressources du programme sénégalais. De la 6ème au BAC — L\'école en un clic !'}
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
              onClick={() => {
              const dest = currentUser?.role === 'eleve' ? '/eleve/dashboard' : currentUser?.role === 'prof' ? '/prof/dashboard' : currentUser?.role === 'parent' ? '/parent/dashboard' : '/';
              navigate(dest);
            }}
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
                onClick={() => { setOngletPlans('illimite'); setPlanSelectionne('illimite_6m'); }}
              >
                ⭐ Accès illimité
              </button>
            </div>

            <div
              className="premium-plans__grille"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
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
                        <span className="premium-plan-card__devise">FCFA / {PLANS_PREMIUM[planId].duree}</span>
                      </div>
                      <p className="premium-plan-card__description">{PLANS_PREMIUM[planId].description}</p>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {(['illimite_3m', 'illimite_6m', 'illimite_1an'] as const).map(planId => (
                    <div
                      key={planId}
                      className={`premium-plan-card ${planSelectionne === planId ? 'premium-plan-card--actif' : ''} ${planId === 'illimite_6m' ? 'premium-plan-card--populaire' : ''}`}
                      onClick={() => setPlanSelectionne(planId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && setPlanSelectionne(planId)}
                    >
                      {planId === 'illimite_6m' && <div className="premium-plan-card__badge-populaire">🏆 Meilleure offre</div>}
                      <div className="premium-plan-card__select">
                        <span className={planSelectionne === planId ? 'premium-plan-card__radio--actif' : 'premium-plan-card__radio'} />
                      </div>
                      <div className="premium-plan-card__header">
                        <span className="premium-plan-card__icone">⭐</span>
                        <h3 className="premium-plan-card__nom">{PLANS_PREMIUM[planId].label}</h3>
                      </div>
                      <div className="premium-plan-card__prix">
                        <span className="premium-plan-card__montant">{PLANS_PREMIUM[planId].montant.toLocaleString('fr-FR')}</span>
                        <span className="premium-plan-card__devise">FCFA / {PLANS_PREMIUM[planId].duree}</span>
                      </div>
                      {planId === 'illimite_6m' && (
                        <div className="premium-plan-card__economie">💰 Économisez 10 000 FCFA vs 2×3 mois</div>
                      )}
                      {planId === 'illimite_1an' && (
                        <div className="premium-plan-card__economie">💰 Économisez 30 000 FCFA vs 4×3 mois</div>
                      )}
                      <p className="premium-plan-card__description">{PLANS_PREMIUM[planId].description}</p>
                    </div>
                  ))}
                </>
              )}

            </div>

            {/* ── SÉLECTEUR MATIÈRES / NIVEAUX (aperçu si formule à la carte) ── */}
            {isALaCarte && (
              <div className="premium-plans__selector" style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#475569' }}>
                  Aperçu — Choisir matière et niveau
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
                  Après votre souscription, vous pourrez sélectionner vos cours par matière et niveau. La sélection du niveau affichera uniquement les contenus correspondants.
                </p>
                <MatieresNiveauxSelector
                  matieres={matieres}
                  niveaux={CLASSES_OPTIONS}
                  value={filtresSelection}
                  onChange={setFiltresSelection}
                  formule={planSelectionne}
                  hint="Filtrez pour prévisualiser les contenus disponibles."
                />
              </div>
            )}

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
          <h2 className="premium-section__titre">
            {estProf ? 'Ce qui est inclus — Premium Pro' : 'Ce qui est inclus'}
          </h2>
          <div className="premium-avantages__grille">
            {avantagesPremium.map(avantage => (
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
              <h3>L'abonnement est-il renouvelé automatiquement ?</h3>
              <p>Non. Tu recevras une notification avant l'expiration pour renouveler si tu le souhaites.</p>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}

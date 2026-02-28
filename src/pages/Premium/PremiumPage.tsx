/**
 * PAGE PREMIUM - PedaClic
 * Présentation des avantages Premium et intégration paiement PayTech
 * Formules : Cours à la carte (1, 3, 7, tous) + Mensuel/Annuel illimité
 */

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  PLANS_A_LA_CARTE,
  PLANS_CLASSIQUES,
  type FormulePremium,
} from '../../types/premiumPlans';
import './PremiumPage.css';

/** Tous les plans pour la sélection */
const TOUS_LES_PLANS = [...PLANS_A_LA_CARTE, ...PLANS_CLASSIQUES];

/**
 * Liste des avantages Premium
 */
const AVANTAGES = [
  {
    icone: '📚',
    titre: 'Accès illimité',
    description: 'Tous les cours de la 6ème à la Terminale, sans restriction.',
  },
  {
    icone: '🎬',
    titre: 'Vidéos explicatives',
    description: 'Des cours en vidéo par des professeurs expérimentés.',
  },
  {
    icone: '✏️',
    titre: 'Exercices corrigés',
    description: 'Des milliers d\'exercices avec corrections détaillées.',
  },
  {
    icone: '📊',
    titre: 'Suivi de progression',
    description: 'Tableau de bord personnel pour suivre vos résultats.',
  },
  {
    icone: '❓',
    titre: 'Quiz interactifs',
    description: 'Testez vos connaissances avec des quiz par matière.',
  },
  {
    icone: '💬',
    titre: 'Support prioritaire',
    description: 'Assistance rapide pour toutes vos questions.',
  },
  {
    icone: '📱',
    titre: 'Accès mobile',
    description: 'Apprenez partout, sur téléphone ou tablette.',
  },
  {
    icone: '🔄',
    titre: 'Mises à jour',
    description: 'Nouveaux contenus ajoutés régulièrement.',
  },
];

/**
 * FAQ Premium
 */
const FAQ = [
  {
    question: 'Comment fonctionne l\'abonnement Premium ?',
    reponse: 'Une fois votre paiement effectué via Wave, Orange Money ou carte bancaire, votre compte est instantanément mis à niveau. Vous avez accès à tous les contenus Premium pendant la durée de votre abonnement.',
  },
  {
    question: 'Puis-je annuler mon abonnement ?',
    reponse: 'Oui, vous pouvez annuler à tout moment depuis votre espace personnel. Vous conservez l\'accès Premium jusqu\'à la fin de la période payée.',
  },
  {
    question: 'L\'abonnement se renouvelle-t-il automatiquement ?',
    reponse: 'Non, chez PedaClic, il n\'y a pas de renouvellement automatique. Vous décidez quand renouveler votre abonnement.',
  },
  {
    question: 'Quels moyens de paiement acceptez-vous ?',
    reponse: 'Nous acceptons Wave, Orange Money, Free Money et les cartes bancaires (Visa, Mastercard) via notre partenaire PayTech.',
  },
  {
    question: 'Puis-je partager mon compte Premium ?',
    reponse: 'Chaque compte Premium est personnel et lié à une adresse email. Le partage de compte est interdit pour garantir un suivi de progression personnalisé.',
  },
];

const PremiumPage: React.FC = () => {
  // ==================== HOOKS ====================
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ==================== ÉTATS ====================
  const [selectedPlan, setSelectedPlan] = useState<FormulePremium>('a_la_carte_3');
  const [ongletPlans, setOngletPlans] = useState<'a_la_carte' | 'illimite'>('a_la_carte');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Page de retour après connexion
  const returnTo = (location.state as { from?: string })?.from || '/';

  // ==================== VÉRIFICATION PREMIUM ====================
  
  /**
   * Vérifier si l'utilisateur est déjà Premium
   */
  const isAlreadyPremium = (): boolean => {
    if (!currentUser) return false;
    if (!currentUser.isPremium) return false;
    
    // Vérifier si l'abonnement n'est pas expiré
    if (currentUser.subscriptionEnd) {
      const endDate = currentUser.subscriptionEnd instanceof Date 
        ? currentUser.subscriptionEnd 
        : new Date(currentUser.subscriptionEnd);
      return endDate > new Date();
    }
    
    return true;
  };

  // ==================== HANDLERS ====================

  /**
   * Initialiser le paiement PayTech
   */
  const handlePayment = async () => {
    // Vérifier l'authentification
    if (!currentUser) {
      navigate('/connexion', { state: { from: '/premium' } });
      return;
    }

    // Vérifier si déjà Premium
    if (isAlreadyPremium()) {
      setError('Vous êtes déjà abonné Premium !');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const plan = TOUS_LES_PLANS.find(p => p.id === selectedPlan);
      if (!plan) {
        throw new Error('Plan invalide');
      }

      // Créer une transaction en attente dans Firestore
      const transactionRef = await addDoc(collection(db, 'transactions'), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        planType: selectedPlan,
        montant: plan?.prix || 0,
        devise: 'XOF',
        statut: 'pending',
        dateTransaction: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // Configuration PayTech
      const paytechConfig = {
        // Clé API PayTech (à remplacer par votre clé)
        apiKey: import.meta.env.VITE_PAYTECH_API_KEY || 'demo_api_key',
        apiSecret: import.meta.env.VITE_PAYTECH_API_SECRET || 'demo_api_secret',
        
        // Informations transaction
        item_name: `PedaClic Premium ${plan?.nom || selectedPlan}`,
        item_price: plan?.prix || 0,
        currency: 'XOF',
        ref_command: transactionRef.id,
        
        // URLs de callback
        success_url: `${window.location.origin}/premium/success?ref=${transactionRef.id}`,
        cancel_url: `${window.location.origin}/premium/cancel?ref=${transactionRef.id}`,
        ipn_url: `${import.meta.env.VITE_API_URL || ''}/api/paytech/ipn`,
        
        // Informations client
        custom_field: JSON.stringify({
          userId: currentUser.uid,
          planType: selectedPlan,
          transactionId: transactionRef.id,
        }),
        
        // Mode (test ou live)
        env: import.meta.env.VITE_PAYTECH_ENV || 'test',
      };

      // Appel à l'API PayTech pour obtenir l'URL de paiement
      // Note: En production, cet appel devrait être fait côté serveur
      const response = await fetch('https://paytech.sn/api/payment/request-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API_KEY': paytechConfig.apiKey,
          'API_SECRET': paytechConfig.apiSecret,
        },
        body: JSON.stringify({
          item_name: paytechConfig.item_name,
          item_price: paytechConfig.item_price,
          currency: paytechConfig.currency,
          ref_command: paytechConfig.ref_command,
          command_name: `Abonnement Premium ${plan?.nom || selectedPlan} - ${currentUser.email}`,
          env: paytechConfig.env,
          ipn_url: paytechConfig.ipn_url,
          success_url: paytechConfig.success_url,
          cancel_url: paytechConfig.cancel_url,
          custom_field: paytechConfig.custom_field,
        }),
      });

      const data = await response.json();

      if (data.success === 1 && data.redirect_url) {
        // Rediriger vers la page de paiement PayTech
        window.location.href = data.redirect_url;
      } else {
        // Mode démo - simuler le succès
        console.log('Mode démo PayTech - Simulation de paiement');
        
        // Calculer la date d'expiration
        const now = new Date();
        const expirationDate = new Date(now);
        const plan = TOUS_LES_PLANS.find(p => p.id === selectedPlan);
        if (plan?.duree.includes('3 mois')) {
          expirationDate.setMonth(expirationDate.getMonth() + 3);
        } else if (plan?.duree.includes('6 mois')) {
          expirationDate.setMonth(expirationDate.getMonth() + 6);
        } else if (plan?.duree.includes('9 mois')) {
          expirationDate.setMonth(expirationDate.getMonth() + 9);
        } else if (plan?.duree.includes('12') || plan?.duree.includes('an')) {
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        } else {
          expirationDate.setMonth(expirationDate.getMonth() + 1);
        }

        // Mettre à jour le statut Premium de l'utilisateur
        await updateDoc(doc(db, 'users', currentUser.uid), {
          isPremium: true,
          subscriptionEnd: expirationDate,
          subscriptionPlan: selectedPlan as string,
          updatedAt: serverTimestamp(),
        });

        // Mettre à jour la transaction
        await updateDoc(doc(db, 'transactions', transactionRef.id), {
          statut: 'success',
          paytechTransactionId: 'DEMO_' + Date.now(),
          dateExpiration: expirationDate,
          updatedAt: serverTimestamp(),
        });

        // Rediriger vers la page de succès
        navigate('/premium/success', { 
          state: { 
            plan: plan?.nom || selectedPlan, 
            montant: plan?.prix || 0,
            expiration: expirationDate.toLocaleDateString('fr-FR'),
          } 
        });
      }

    } catch (err) {
      console.error('Erreur paiement:', err);
      setError('Une erreur est survenue lors du paiement. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle FAQ
   */
  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  /**
   * Formater le prix en FCFA
   */
  const formatPrice = (price: number): string => {
    return price.toLocaleString('fr-FR') + ' FCFA';
  };

  // ==================== RENDU SI DÉJÀ PREMIUM ====================
  if (isAlreadyPremium()) {
    const endDate = currentUser?.subscriptionEnd instanceof Date 
      ? currentUser.subscriptionEnd 
      : new Date(currentUser?.subscriptionEnd || Date.now());

    return (
      <div className="premium-page">
        <div className="container">
          <div className="premium-already">
            <span className="premium-already__icon">⭐</span>
            <h1>Vous êtes déjà Premium !</h1>
            <p>
              Votre abonnement est actif jusqu'au{' '}
              <strong>{endDate.toLocaleDateString('fr-FR')}</strong>
            </p>
            <div className="premium-already__actions">
              <Link to="/disciplines" className="btn btn--primary">
                Accéder aux cours
              </Link>
              <Link to="/dashboard" className="btn btn--outline">
                Mon tableau de bord
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDU PRINCIPAL ====================
  return (
    <div className="premium-page">
      {/* ========== HERO SECTION ========== */}
      <section className="premium-hero">
        <div className="container">
          <span className="premium-hero__badge">⭐ Premium</span>
          <h1 className="premium-hero__title">
            Débloquez tout le potentiel de <span>PedaClic</span>
          </h1>
          <p className="premium-hero__subtitle">
            Accédez à tous les cours, exercices corrigés, vidéos et quiz 
            de la 6ème à la Terminale. Réussissez vos examens !
          </p>
        </div>
      </section>

      {/* ========== SECTION TARIFS ========== */}
      <section className="premium-pricing">
        <div className="container">
          <h2 className="section-title">Choisissez votre formule</h2>
          
          {/* Onglets : Cours à la carte ou Illimité */}
          <div className="premium-pricing__tabs">
            <button
              type="button"
              className={`premium-pricing__tab ${ongletPlans === 'a_la_carte' ? 'premium-pricing__tab--active' : ''}`}
              onClick={() => { setOngletPlans('a_la_carte'); setSelectedPlan('a_la_carte_3'); }}
            >
              📚 Cours à la carte
            </button>
            <button
              type="button"
              className={`premium-pricing__tab ${ongletPlans === 'illimite' ? 'premium-pricing__tab--active' : ''}`}
              onClick={() => { setOngletPlans('illimite'); setSelectedPlan('illimite_6m'); }}
            >
              ⭐ Accès illimité
            </button>
          </div>
          
          <div className="pricing-cards">
            {(ongletPlans === 'a_la_carte' ? PLANS_A_LA_CARTE : PLANS_CLASSIQUES).map((plan) => (
              <div 
                key={plan.id}
                className={`pricing-card ${selectedPlan === plan.id ? 'pricing-card--selected' : ''} ${plan.popular ? 'pricing-card--popular' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {/* Badge populaire */}
                {plan.popular && (
                  <span className="pricing-card__badge">Le plus populaire</span>
                )}

                {/* En-tête */}
                <div className="pricing-card__header">
                  <h3 className="pricing-card__name">{plan.nom}</h3>
                  <p className="pricing-card__duration">{plan.duree}</p>
                </div>

                {/* Prix */}
                <div className="pricing-card__price">
                  {plan.prixOriginal && (
                    <span className="pricing-card__original">
                      {formatPrice(plan.prixOriginal)}
                    </span>
                  )}
                  <span className="pricing-card__amount">
                    {formatPrice(plan.prix)}
                  </span>
                  <span className="pricing-card__period">/{plan.duree}</span>
                </div>

                {/* Économie */}
                {plan.economie && (
                  <p className="pricing-card__savings">
                    Économisez {plan.economie}
                  </p>
                )}

                {/* Radio button */}
                <div className="pricing-card__radio">
                  <span className={`radio-dot ${selectedPlan === plan.id ? 'radio-dot--active' : ''}`}></span>
                </div>
              </div>
            ))}
          </div>

          {/* Bouton paiement */}
          <div className="pricing-cta">
            {error && (
              <div className="pricing-error">
                <span>⚠️</span> {error}
              </div>
            )}
            
            {!currentUser ? (
              <div className="pricing-login">
                <p>Connectez-vous pour souscrire à Premium</p>
                <Link 
                  to="/connexion" 
                  state={{ from: '/premium' }}
                  className="btn btn--primary btn--lg"
                >
                  Se connecter
                </Link>
                <p className="pricing-login__register">
                  Pas encore inscrit ?{' '}
                  <Link to="/inscription" state={{ from: '/premium' }}>
                    Créer un compte
                  </Link>
                </p>
              </div>
            ) : (
              <button 
                className="btn btn--premium btn--lg"
                onClick={handlePayment}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-sm"></span>
                    Traitement en cours...
                  </>
                ) : (
                  <>
                    Payer {formatPrice(TOUS_LES_PLANS.find(p => p.id === selectedPlan)?.prix || 0)}
                  </>
                )}
              </button>
            )}

            {/* Moyens de paiement */}
            <div className="payment-methods">
              <p>Paiement sécurisé par</p>
              <div className="payment-methods__logos">
                <span className="payment-logo">🟠 Orange Money</span>
                <span className="payment-logo">🔵 Wave</span>
                <span className="payment-logo">🟢 Free Money</span>
                <span className="payment-logo">💳 Carte bancaire</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SECTION AVANTAGES ========== */}
      <section className="premium-features">
        <div className="container">
          <h2 className="section-title">Tout ce que vous obtenez</h2>
          <p className="section-subtitle">
            Un accès complet à toutes les ressources pédagogiques
          </p>

          <div className="features-grid">
            {AVANTAGES.map((avantage, index) => (
              <div key={index} className="feature-card">
                <span className="feature-card__icon">{avantage.icone}</span>
                <h3 className="feature-card__title">{avantage.titre}</h3>
                <p className="feature-card__description">{avantage.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SECTION COMPARAISON ========== */}
      <section className="premium-comparison">
        <div className="container">
          <h2 className="section-title">Tableau comparatif des formules</h2>

          <div className="comparison-table comparison-table--extended">
            <div className="comparison-header">
              <div className="comparison-feature">Fonctionnalités</div>
              <div className="comparison-free">Gratuit</div>
              <div className="comparison-col">1 cours</div>
              <div className="comparison-col">3 cours</div>
              <div className="comparison-col">7 cours</div>
              <div className="comparison-col">Tous</div>
              <div className="comparison-premium">Illimité</div>
            </div>

            {[
              { feature: 'Cours de base', free: true, a1: true, a3: true, a7: true, tous: true, illimite: true },
              { feature: 'Choix par discipline et niveau', free: false, a1: true, a3: true, a7: true, tous: true, illimite: true },
              { feature: 'Exercices avec corrections', free: false, a1: true, a3: true, a7: true, tous: true, illimite: true },
              { feature: 'Vidéos explicatives', free: false, a1: true, a3: true, a7: true, tous: true, illimite: true },
              { feature: 'Quiz interactifs (QCM, glisser-déposer…)', free: false, a1: true, a3: true, a7: true, tous: true, illimite: true },
              { feature: 'Suivi de progression', free: false, a1: true, a3: true, a7: true, tous: true, illimite: true },
              { feature: 'Téléchargement de documents', free: false, a1: true, a3: true, a7: true, tous: true, illimite: true },
              { feature: 'Support prioritaire', free: false, a1: true, a3: true, a7: true, tous: true, illimite: true },
              { feature: 'Accès mobile optimisé', free: true, a1: true, a3: true, a7: true, tous: true, illimite: true },
            ].map((row, index) => (
              <div key={index} className="comparison-row">
                <div className="comparison-feature">{row.feature}</div>
                <div className="comparison-free">
                  {row.free ? <span className="check">✓</span> : <span className="cross">✗</span>}
                </div>
                <div className="comparison-col">{row.a1 ? <span className="check">✓</span> : <span className="cross">✗</span>}</div>
                <div className="comparison-col">{row.a3 ? <span className="check">✓</span> : <span className="cross">✗</span>}</div>
                <div className="comparison-col">{row.a7 ? <span className="check">✓</span> : <span className="cross">✗</span>}</div>
                <div className="comparison-col">{row.tous ? <span className="check">✓</span> : <span className="cross">✗</span>}</div>
                <div className="comparison-premium">{row.illimite ? <span className="check check--premium">✓</span> : <span className="cross">✗</span>}</div>
              </div>
            ))}
            <div className="comparison-row comparison-row--prices">
              <div className="comparison-feature">Prix</div>
              <div className="comparison-free">—</div>
              <div className="comparison-col">1 000 /mois</div>
              <div className="comparison-col">2 000 /mois</div>
              <div className="comparison-col">5 000 /mois</div>
              <div className="comparison-col">25 000 /9 mois</div>
              <div className="comparison-premium">Dès 10 000 /3 mois</div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SECTION TÉMOIGNAGES ========== */}
      <section className="premium-testimonials">
        <div className="container">
          <h2 className="section-title">Ils ont choisi Premium</h2>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-card__stars">
                {'★'.repeat(5)}
              </div>
              <p className="testimonial-card__text">
                "Grâce à PedaClic Premium, j'ai eu 16/20 au BFEM. Les exercices corrigés m'ont beaucoup aidé !"
              </p>
              <div className="testimonial-card__author">
                <div className="testimonial-card__avatar">AN</div>
                <div>
                  <p className="testimonial-card__name">Aminata Ndiaye</p>
                  <p className="testimonial-card__info">3ème - Dakar</p>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-card__stars">
                {'★'.repeat(5)}
              </div>
              <p className="testimonial-card__text">
                "Les vidéos sont très bien expliquées. Je comprends mieux les maths maintenant. Merci PedaClic !"
              </p>
              <div className="testimonial-card__author">
                <div className="testimonial-card__avatar">IF</div>
                <div>
                  <p className="testimonial-card__name">Ibrahima Fall</p>
                  <p className="testimonial-card__info">Terminale S - Thiès</p>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-card__stars">
                {'★'.repeat(5)}
              </div>
              <p className="testimonial-card__text">
                "20 000 FCFA pour 6 mois, c'est vraiment abordable. Mon fils a accès à tout ce dont il a besoin."
              </p>
              <div className="testimonial-card__author">
                <div className="testimonial-card__avatar">FD</div>
                <div>
                  <p className="testimonial-card__name">Fatou Diop</p>
                  <p className="testimonial-card__info">Parent d'élève - Saint-Louis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== SECTION FAQ ========== */}
      <section className="premium-faq">
        <div className="container">
          <h2 className="section-title">Questions fréquentes</h2>

          <div className="faq-list">
            {FAQ.map((item, index) => (
              <div 
                key={index}
                className={`faq-item ${openFaq === index ? 'faq-item--open' : ''}`}
              >
                <button 
                  className="faq-item__question"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={openFaq === index}
                >
                  <span>{item.question}</span>
                  <span className="faq-item__icon">
                    {openFaq === index ? '−' : '+'}
                  </span>
                </button>
                {openFaq === index && (
                  <div className="faq-item__answer">
                    <p>{item.reponse}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA FINALE ========== */}
      <section className="premium-cta-final">
        <div className="container">
          <h2>Prêt à réussir vos examens ?</h2>
          <p>Rejoignez des milliers d'élèves sénégalais qui ont choisi PedaClic Premium</p>
          <button 
            className="btn btn--white btn--lg"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Commencer maintenant
          </button>
        </div>
      </section>
    </div>
  );
};

export default PremiumPage;

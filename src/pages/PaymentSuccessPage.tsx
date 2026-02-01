import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './PaymentResult.css';

const PaymentSuccessPage: React.FC = () => {
  const location = useLocation();
  const state = location.state as { plan?: string; montant?: number; expiration?: string } | null;

  return (
    <div className="payment-result">
      <div className="container">
        <div className="payment-result__card payment-result__card--success">
          <div className="payment-result__icon"><span className="success-icon">✓</span></div>
          <h1 className="payment-result__title">Paiement réussi !</h1>
          <p className="payment-result__message">Votre abonnement Premium est actif.</p>
          {state && (
            <div className="payment-result__details">
              {state.plan && <div className="detail-row"><span className="detail-label">Formule</span><span className="detail-value">{state.plan}</span></div>}
              {state.montant && <div className="detail-row"><span className="detail-label">Montant</span><span className="detail-value">{state.montant.toLocaleString()} FCFA</span></div>}
              {state.expiration && <div className="detail-row"><span className="detail-label">Valide jusqu'au</span><span className="detail-value">{state.expiration}</span></div>}
            </div>
          )}
          <div className="payment-result__badge"><span>⭐</span> Vous êtes Premium !</div>
          <div className="payment-result__actions">
            <Link to="/disciplines" className="btn btn--primary">Accéder aux cours</Link>
            <Link to="/" className="btn btn--outline">Accueil</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;

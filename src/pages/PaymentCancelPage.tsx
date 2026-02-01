import React from 'react';
import { Link } from 'react-router-dom';
import './PaymentResult.css';

const PaymentCancelPage: React.FC = () => {
  return (
    <div className="payment-result">
      <div className="container">
        <div className="payment-result__card payment-result__card--cancel">
          <div className="payment-result__icon"><span className="cancel-icon">✗</span></div>
          <h1 className="payment-result__title">Paiement annulé</h1>
          <p className="payment-result__message">Aucun montant n'a été débité.</p>
          <div className="payment-result__actions">
            <Link to="/premium" className="btn btn--primary">Réessayer</Link>
            <Link to="/" className="btn btn--outline">Accueil</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancelPage;

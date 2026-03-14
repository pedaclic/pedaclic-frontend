/**
 * ============================================================================
 * PAGE POLITIQUE DE CONFIDENTIALITÉ - PedaClic
 * ============================================================================
 * Informations sur le traitement des données personnelles.
 * Accessible depuis le Footer, l'interface Admin et le bandeau cookies.
 *
 * @author PedaClic Team
 * @route /confidentialite
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import './ConfidentialitePage.css';

const ConfidentialitePage: React.FC = () => {
  return (
    <div className="confidentialite-page">
      <div className="confidentialite__container">
        <header className="confidentialite__header">
          <Link to="/" className="confidentialite__back">
            <ArrowLeft size={18} />
            Retour à l'accueil
          </Link>
          <div className="confidentialite__brand">
            <Shield className="confidentialite__logo" size={40} />
            <h1 className="confidentialite__title">Politique de Confidentialité</h1>
            <p className="confidentialite__subtitle">PedaClic — L'école en un clic</p>
          </div>
          <p className="confidentialite__date">
            <em>Dernière mise à jour : Mars 2026</em>
          </p>
        </header>

        <main className="confidentialite__content">
          <section className="confidentialite__section">
            <h2>1. Responsable du traitement</h2>
            <p>
              Les données collectées sur <strong>pedaclic.sn</strong> sont traitées par
              PedaClic, agissant en tant qu'éditeur de la plateforme, domicilié à Dakar,
              Sénégal.
            </p>
            <p>
              <strong>Contact :</strong>{' '}
              <a href="mailto:contact@pedaclic.sn">contact@pedaclic.sn</a>
            </p>
          </section>

          <section className="confidentialite__section">
            <h2>2. Données collectées</h2>
            <p>
              Nous collectons les informations strictement nécessaires à la fourniture de nos
              services éducatifs :
            </p>
            <ul>
              <li>
                <strong>Identification :</strong> Nom, prénom et adresse e-mail via Firebase
                Auth.
              </li>
              <li>
                <strong>Paiement :</strong> Les transactions sont gérées par notre partenaire
                sécurisé <strong>PayTech</strong> (Wave, Orange Money, Free Money, cartes
                bancaires). Nous ne stockons aucun code PIN, numéro de carte ou donnée
                bancaire sensible.
              </li>
              <li>
                <strong>Suivi pédagogique :</strong> Progression dans les cours, résultats
                aux quiz et statistiques d'apprentissage pour personnaliser l'expérience.
              </li>
            </ul>
          </section>

          <section className="confidentialite__section">
            <h2>3. Hébergement et sécurité</h2>
            <p>
              Vos données sont hébergées via l'infrastructure <strong>Google Firebase</strong>{' '}
              (Firestore, Authentication, Storage). Nous utilisons des protocoles de sécurité
              avancés : chiffrement SSL/TLS, règles de sécurité Firestore, et authentification
              sécurisée pour garantir l'intégrité et la confidentialité de vos informations.
            </p>
          </section>

          <section className="confidentialite__section">
            <h2>4. Cookies et traceurs</h2>
            <p>
              PedaClic utilise des cookies strictement nécessaires au fonctionnement de la
              plateforme : authentification, préférences de session, sécurité. Ces cookies ne
              sont pas utilisés à des fins publicitaires. En poursuivant votre navigation,
              vous acceptez leur utilisation. Pour en savoir plus, consultez nos{' '}
              <Link to="/mentions-legales">Mentions légales</Link>.
            </p>
          </section>

          <section className="confidentialite__section">
            <h2>5. Vos droits (CDP et RGPD)</h2>
            <p>
              Conformément à la législation sénégalaise sur les données à caractère personnel
              et au Règlement Général sur la Protection des Données (RGPD) pour les
              utilisateurs résidant dans l'Union européenne, vous disposez d'un droit
              d'accès, de rectification, de suppression et de portabilité de vos données.
            </p>
            <p>
              Pour toute demande, contactez-nous à :{' '}
              <strong>
                <a href="mailto:contact@pedaclic.sn">contact@pedaclic.sn</a>
              </strong>
            </p>
          </section>

          <section className="confidentialite__section confidentialite__section--links">
            <p>
              Consultez également nos{' '}
              <Link to="/mentions-legales">Mentions légales</Link> et nos{' '}
              <Link to="/cgu">Conditions générales d'utilisation</Link>.
            </p>
          </section>

          <section className="confidentialite__section confidentialite__section--update">
            <p>
              <em>Dernière mise à jour : Mars 2026</em>
            </p>
          </section>
        </main>

        <footer className="confidentialite__footer">
          <Link to="/" className="confidentialite__cta">
            <ArrowLeft size={18} />
            Retour à l'accueil
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default ConfidentialitePage;

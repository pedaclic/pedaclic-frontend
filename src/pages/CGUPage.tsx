/**
 * ============================================================================
 * PAGE CONDITIONS GÉNÉRALES D'UTILISATION (CGU) - PedaClic
 * ============================================================================
 * Règles d'utilisation de la plateforme.
 * Accessible depuis le Footer, l'interface Admin et la page d'inscription.
 *
 * @author PedaClic Team
 * @route /cgu
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import './CGUPage.css';

const CGUPage: React.FC = () => {
  return (
    <div className="cgu-page">
      <div className="cgu__container">
        <header className="cgu__header">
          <Link to="/" className="cgu__back">
            <ArrowLeft size={18} />
            Retour à l'accueil
          </Link>
          <div className="cgu__brand">
            <FileText className="cgu__logo" size={40} />
            <h1 className="cgu__title">Conditions Générales d'Utilisation (CGU)</h1>
            <p className="cgu__subtitle">PedaClic — L'école en un clic</p>
          </div>
          <p className="cgu__date">
            <em>En vigueur au 14 Mars 2026</em>
          </p>
        </header>

        <main className="cgu__content">
          <section className="cgu__section">
            <h2>1. Objet</h2>
            <p>
              Les présentes CGU ont pour objet d'encadrer l'accès et l'utilisation de la
              plateforme <strong>PedaClic</strong>. L'accès au site par tout utilisateur
              signifie son acceptation des présentes conditions.
            </p>
          </section>

          <section className="cgu__section">
            <h2>2. Accès aux services</h2>
            <p>
              PedaClic permet d'accéder à des ressources pédagogiques numériques. L'accès aux
              contenus « Premium » est subordonné à :
            </p>
            <ul>
              <li>La création d'un compte personnel et sécurisé.</li>
              <li>Le paiement des frais d'accès via les méthodes proposées (Wave, Orange
                Money, Free Money, carte bancaire).</li>
            </ul>
            <div className="cgu__highlight">
              <strong>Règle d'or :</strong> L'identifiant et le mot de passe sont strictement
              personnels. Toute transmission de ces accès à un tiers peut entraîner la
              suspension du compte sans remboursement.
            </div>
          </section>

          <section className="cgu__section">
            <h2>3. Propriété intellectuelle</h2>
            <p>
              Tous les contenus présents (textes, vidéos, quiz, schémas) sont protégés par le
              droit d'auteur. L'utilisateur bénéficie d'un droit d'usage privé et non exclusif.{' '}
              <strong>
                Toute reproduction, revente ou diffusion publique des supports de cours est
                strictement interdite
              </strong>{' '}
              sous peine de poursuites conformément au Code de la Propriété Intellectuelle du
              Sénégal.
            </p>
          </section>

          <section className="cgu__section">
            <h2>4. Responsabilité</h2>
            <p>
              L'éditeur s'efforce de fournir des contenus de qualité. Toutefois, PedaClic ne
              saurait être tenu responsable des éventuelles erreurs ou omissions dans les
              ressources pédagogiques, ni des interruptions techniques liées à l'hébergement
              (Firebase Hosting, Google Cloud).
            </p>
          </section>

          <section className="cgu__section">
            <h2>5. Droit applicable</h2>
            <p>
              Les présentes CGU sont régies par la loi sénégalaise. En cas de litige, et à
              défaut d'accord amiable, les tribunaux de Dakar seront seuls compétents.
            </p>
          </section>

          <section className="cgu__section cgu__section--links">
            <p>
              Consultez également nos{' '}
              <Link to="/mentions-legales">Mentions légales</Link> et notre{' '}
              <Link to="/confidentialite">Politique de confidentialité</Link>.
            </p>
          </section>

          <section className="cgu__section cgu__section--update">
            <p>
              <em>En vigueur au 14 Mars 2026</em>
            </p>
          </section>
        </main>

        <footer className="cgu__footer">
          <Link to="/" className="cgu__cta">
            <ArrowLeft size={18} />
            Retour à l'accueil
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default CGUPage;

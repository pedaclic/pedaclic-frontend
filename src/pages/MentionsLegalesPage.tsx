/**
 * ============================================================================
 * PAGE MENTIONS LÉGALES - PedaClic
 * ============================================================================
 * Informations légales obligatoires conformément à la réglementation sénégalaise.
 * Accessible depuis le Footer et l'interface Admin.
 *
 * @author PedaClic Team
 * @route /mentions-legales
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import './MentionsLegalesPage.css';

const MentionsLegalesPage: React.FC = () => {
  return (
    <div className="mentions-legales-page">
      <div className="mentions-legales__container">
        <header className="mentions-legales__header">
          <Link to="/" className="mentions-legales__back">
            <ArrowLeft size={18} />
            Retour à l'accueil
          </Link>
          <div className="mentions-legales__brand">
            <GraduationCap className="mentions-legales__logo" size={40} />
            <h1 className="mentions-legales__title">Mentions Légales</h1>
            <p className="mentions-legales__subtitle">PedaClic — L'école en un clic</p>
          </div>
        </header>

        <main className="mentions-legales__content">
          <section className="mentions-legales__section">
            <h2>1. Présentation de la plateforme</h2>
            <p>
              Le site <strong>pedaclic.sn</strong> est une plateforme éducative dédiée à la
              diffusion de ressources pédagogiques numériques pour les élèves du collège au
              lycée au Sénégal.
            </p>
            <div className="mentions-legales__block">
              <p>
                <strong>Éditeur :</strong> PedaClic<br />
                <strong>Statut :</strong> Entreprise Individuelle / Entreprenant<br />
                <strong>RCCM :</strong> À compléter<br />
                <strong>NINEA :</strong> À compléter<br />
                <strong>Siège social :</strong> Dakar, Sénégal<br />
                <strong>Email :</strong>{' '}
                <a href="mailto:contact@pedaclic.sn">contact@pedaclic.sn</a>
              </p>
            </div>
          </section>

          <section className="mentions-legales__section">
            <h2>2. Hébergement</h2>
            <p>
              <strong>Hébergement du site :</strong> Firebase Hosting (Google Cloud), 8 Rue de
              Londres, 75009 Paris, France (UE).
            </p>
            <p>
              <strong>Infrastructure Backend :</strong> Google Firebase (Firestore, Auth,
              Storage) et Railway pour les services de paiement.
            </p>
          </section>

          <section className="mentions-legales__section">
            <h2>3. Propriété intellectuelle</h2>
            <p>
              L'ensemble des contenus (textes, cours, quiz, logos, médias) présents sur{' '}
              <strong>PedaClic</strong> sont la propriété exclusive de leurs auteurs ou de
              PedaClic. Toute reproduction, représentation, modification ou diffusion sans
              autorisation préalable écrite est interdite, conformément au Code de la
              Propriété Intellectuelle du Sénégal.
            </p>
          </section>

          <section className="mentions-legales__section">
            <h2>4. Transactions financières</h2>
            <p>
              Les paiements relatifs aux accès « Premium » sont gérés par notre partenaire
              sécurisé <strong>PayTech</strong> (Wave, Orange Money, Free Money, cartes
              bancaires). PedaClic ne stocke aucune donnée bancaire, code secret (PIN) ou
              information de paiement sensible sur ses serveurs. Toutes les transactions
              transitent par des canaux sécurisés et certifiés.
            </p>
          </section>

          <section className="mentions-legales__section">
            <h2>5. Données personnelles</h2>
            <p>
              Conformément à la loi sénégalaise sur les données à caractère personnel et au
              Règlement Général sur la Protection des Données (RGPD) pour les utilisateurs
              résidant dans l'Union européenne, vous disposez d'un droit d'accès, de
              rectification, de suppression et de portabilité des données vous concernant.
            </p>
            <p>
              Ces droits s'exercent par email à l'adresse{' '}
              <a href="mailto:contact@pedaclic.sn">contact@pedaclic.sn</a>. Pour plus
              d'informations, consultez notre{' '}
              <Link to="/confidentialite">Politique de confidentialité</Link>.
            </p>
          </section>

          <section className="mentions-legales__section">
            <h2>6. Cookies et traceurs</h2>
            <p>
              PedaClic utilise des cookies et traceurs strictement nécessaires au
              fonctionnement de la plateforme (authentification, préférences, sécurité). Ces
              cookies ne sont pas utilisés à des fins publicitaires. En poursuivant votre
              navigation, vous acceptez l'utilisation de ces cookies essentiels.
            </p>
          </section>

          <section className="mentions-legales__section">
            <h2>7. Limitation de responsabilité</h2>
            <p>
              PedaClic s'efforce de fournir des contenus exacts et à jour. Toutefois, la
              plateforme ne peut garantir l'exhaustivité ou l'absence d'erreur des
              informations diffusées. L'utilisation du site et des ressources pédagogiques
              relève de la responsabilité de l'utilisateur. PedaClic décline toute
              responsabilité en cas de dommage indirect résultant de l'utilisation du site.
            </p>
          </section>

          <section className="mentions-legales__section">
            <h2>8. Droit applicable et litiges</h2>
            <p>
              Les présentes mentions légales sont régies par le droit sénégalais. Tout litige
              relatif à l'utilisation du site pedaclic.sn sera de la compétence exclusive des
              tribunaux sénégalais.
            </p>
          </section>

          <section className="mentions-legales__section mentions-legales__section--links">
            <p>
              Consultez également nos{' '}
              <Link to="/cgu">Conditions générales d'utilisation</Link> et notre{' '}
              <Link to="/confidentialite">Politique de confidentialité</Link>.
            </p>
          </section>

          <section className="mentions-legales__section mentions-legales__section--update">
            <p>
              <em>Dernière mise à jour : mars 2025</em>
            </p>
          </section>
        </main>

        <footer className="mentions-legales__footer">
          <Link to="/" className="mentions-legales__cta">
            <ArrowLeft size={18} />
            Retour à l'accueil
          </Link>
        </footer>
      </div>
    </div>
  );
};

export default MentionsLegalesPage;

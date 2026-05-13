// ==================== LECTEUR EBOOK (PDF VIEWER) - PHASE 20 ====================
// PedaClic : Visionneuse PDF avec limitation aperçu pour non-Premium
// Utilise <iframe> pour la lecture en ligne des PDF
// Les non-Premium voient uniquement l'aperçu (premières pages)
// ========================================================================

import React, { useState, useEffect } from 'react';
import { Ebook, CATEGORIE_LABELS, CATEGORIE_ICONS } from '../types/ebook.types';
import { incrementVues, incrementTelechargements, formatFileSize } from '../services/ebookService';
import { EbookPdfPreview } from '../components/eleve/EbookPdfPreview';
// Visualiseur PDF dédié (rendu canvas, défilement horizontal).
// Remplace l'iframe PDF natif pour empêcher le bouton de téléchargement
// intégré au navigateur de contourner la règle d'admin (canDownload === false).
import { EbookPdfReader } from '../components/eleve/EbookPdfReader';
import '../styles/EbookViewer.css';

// --- Interface des props ---
interface EbookViewerProps {
  ebook: Ebook;
  isPremium: boolean;
  onBack: () => void;       // Retour à la bibliothèque
  onGoPremium: () => void;  // Navigation vers page Premium
}

export const EbookViewer: React.FC<EbookViewerProps> = ({
  ebook,
  isPremium,
  onBack,
  onGoPremium
}) => {
  // ==================== STATES ====================
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'read' | 'info'>('info');

  // ==================== EFFETS ====================
  // --- Incrément du compteur de vues, dédoublonné par session ---
  // Pourquoi un guard ?
  //   1. React.StrictMode (dev) déclenche useEffect 2 fois → +2 vues
  //   2. Un refresh accidentel de l'onglet ne doit pas compter 2 fois
  //      la même consultation pour le même ebook dans la même session.
  // Implémentation : sessionStorage (purgé à la fermeture de l'onglet)
  // → un seul incrément par (ebook × session navigateur).
  useEffect(() => {
    const SESSION_KEY = 'pedaclic_ebook_viewed';
    try {
      const viewedRaw = sessionStorage.getItem(SESSION_KEY);
      const viewed: string[] = viewedRaw ? JSON.parse(viewedRaw) : [];

      if (!viewed.includes(ebook.id)) {
        // Marquer AVANT l'appel async pour bloquer le second pass StrictMode
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify([...viewed, ebook.id])
        );
        incrementVues(ebook.id);
      }
    } catch {
      // sessionStorage indisponible (navigation privée stricte) :
      // on retombe sur le comportement précédent (incrément simple).
      incrementVues(ebook.id);
    }
  }, [ebook.id]);

  // ==================== HANDLERS ====================

  /**
   * Détermine la stratégie d'affichage du document selon le format de
   * l'ebook (PDF/HTML), le statut Premium et la présence d'un aperçu :
   *
   *  Format HTML (nouveau)
   *    - Premium     → iframe sandbox sur le HTML complet (allow-scripts +
   *                    allow-same-origin pour les polices Google et tous les
   *                    scripts internes au document)
   *    - Non-Premium → écran de blocage Premium (pas d'aperçu HTML partiel
   *                    fiable : on ne peut pas tronquer du HTML arbitraire)
   *
   *  Format PDF (historique, comportement inchangé)
   *    - Premium                                   → iframe sur le PDF complet
   *    - Non-Premium + aperçuURL fourni            → iframe sur le PDF aperçu
   *    - Non-Premium sans aperçuURL + fichierURL  → rendu canvas limité à pagesApercu
   *    - Aucun fichier disponible                  → écran de blocage Premium
   */
  type ViewStrategy =
    | { kind: 'iframe'; url: string }
    | { kind: 'html-iframe'; url: string }
    | { kind: 'limited-render'; url: string; maxPages: number }
    | { kind: 'blocked' };

  // Rétrocompat : un ebook sans champ `format` est un PDF historique.
  const ebookFormat = ebook.format || 'pdf';

  // --- Autorisation du téléchargement ---
  // L'admin peut désactiver le téléchargement depuis le panneau AdminEbooks.
  // Pour les ebooks créés AVANT cette fonctionnalité, le champ
  // `telechargementActif` n'existe pas ; on le traite comme `true` (comportement
  // historique). La règle s'applique à TOUS les utilisateurs (Premium inclus) :
  // c'est l'admin qui décide si un document est exportable.
  const canDownload = ebook.telechargementActif !== false;

  const getViewStrategy = (): ViewStrategy => {
    // ----- Format HTML : stratégie dédiée (sandbox iframe) -----
    if (ebookFormat === 'html') {
      // On exige Premium pour servir un HTML potentiellement long ; sinon
      // on bloque. Dégrader un HTML en "n premières pages" n'a pas de sens.
      if (isPremium && ebook.fichierURL) {
        return { kind: 'html-iframe', url: ebook.fichierURL };
      }
      return { kind: 'blocked' };
    }

    // ----- Format PDF : stratégies historiques inchangées -----
    if (isPremium && ebook.fichierURL) {
      return { kind: 'iframe', url: ebook.fichierURL };
    }
    if (ebook.aperçuURL) {
      return { kind: 'iframe', url: ebook.aperçuURL };
    }
    if (ebook.fichierURL && ebook.pagesApercu > 0) {
      return {
        kind: 'limited-render',
        url: ebook.fichierURL,
        maxPages: ebook.pagesApercu
      };
    }
    return { kind: 'blocked' };
  };

  const strategy = getViewStrategy();

  /**
   * Gère le téléchargement (Premium uniquement, et autorisé par l'admin).
   *
   * Garde de sécurité défensive : même si le bouton est masqué via `canDownload`,
   * on revérifie ici pour éviter qu'un appel programmatique direct (devtools,
   * gestionnaire JS conservé en mémoire après bascule serveur) ne déclenche
   * un téléchargement non autorisé.
   */
  const handleDownload = async () => {
    if (!canDownload) {
      // Téléchargement bloqué par l'administrateur — silencieux : le bouton
      // ne devrait normalement pas être présent dans le DOM.
      return;
    }
    if (!isPremium) {
      onGoPremium();
      return;
    }
    await incrementTelechargements(ebook.id);
    // Le téléchargement se fait via le lien direct
    window.open(ebook.fichierURL, '_blank');
  };

  /**
   * Gère le chargement du PDF dans l'iframe
   */
  const handleIframeLoad = () => {
    setLoading(false);
  };

  // ==================== RENDER ====================
  return (
    <div className="ebook-viewer">

      {/* <!-- Barre de navigation supérieure --> */}
      <div className="viewer-navbar">
        <button onClick={onBack} className="btn-back">
          ← Retour à la bibliothèque
        </button>
        <div className="viewer-title-bar">
          <span className="viewer-category">
            {CATEGORIE_ICONS[ebook.categorie]} {CATEGORIE_LABELS[ebook.categorie]}
          </span>
          <h2 className="viewer-title">{ebook.titre}</h2>
        </div>
        <div className="viewer-actions-bar">
          {/* <!-- Bouton lecture / info --> */}
          <button
            className={`btn-tab ${viewMode === 'info' ? 'active' : ''}`}
            onClick={() => setViewMode('info')}
          >
            ℹ️ Détails
          </button>
          <button
            className={`btn-tab ${viewMode === 'read' ? 'active' : ''}`}
            onClick={() => setViewMode('read')}
          >
            📖 {isPremium ? 'Lire' : 'Aperçu'}
          </button>
        </div>
      </div>

      {/* ==================== MODE INFO ==================== */}
      {viewMode === 'info' && (
        <div className="viewer-info-panel">
          <div className="info-layout">

            {/* <!-- Colonne couverture --> */}
            <div className="info-cover-column">
              {ebook.couvertureURL ? (
                <img
                  src={ebook.couvertureURL}
                  alt={ebook.titre}
                  className="info-cover-image"
                />
              ) : (
                <div className="info-cover-placeholder">
                  <span>{CATEGORIE_ICONS[ebook.categorie]}</span>
                  <span>{ebook.titre}</span>
                </div>
              )}

              {/* <!-- Boutons principaux --> */}
              {/* Les libellés s'adaptent au format de l'ebook :
                   - PDF  : "Lire le document" / "Aperçu (n pages)" / "Télécharger le PDF"
                   - HTML : "Consulter la page" (Premium) / "Accès Premium" (sinon)
                            / "Télécharger le HTML" */}
              <div className="info-actions">
                <button
                  className="btn-action-read"
                  onClick={() => setViewMode('read')}
                  // En HTML non-Premium, on bloque l'entrée en mode lecture :
                  // le viewer affichera l'écran "blocked", mais l'expérience
                  // est plus claire si l'on incite directement au passage Premium.
                  disabled={ebookFormat === 'html' && !isPremium}
                  title={
                    ebookFormat === 'html' && !isPremium
                      ? 'Réservé aux abonnés Premium'
                      : undefined
                  }
                >
                  {ebookFormat === 'html'
                    ? (isPremium ? '📖 Consulter la page' : '🔒 Réservé Premium')
                    : `📖 ${isPremium ? 'Lire le document' : `Aperçu (${ebook.pagesApercu} pages)`}`
                  }
                </button>

                {/* Bouton de téléchargement — affichage conditionnel :
                     1. Si `canDownload === false` : l'admin a interdit le DL,
                        on affiche un petit message "Téléchargement désactivé"
                        à la place du bouton (pour Premium ET non-Premium).
                     2. Sinon, comportement historique :
                        - Premium     → bouton "Télécharger"
                        - Non-Premium → bouton "Passer Premium". */}
                {!canDownload ? (
                  <div className="info-download-disabled" role="note">
                    🚫 Téléchargement désactivé par l'administrateur.
                    <small>Lecture en ligne uniquement.</small>
                  </div>
                ) : isPremium ? (
                  <button className="btn-action-download" onClick={handleDownload}>
                    ⬇️ {ebookFormat === 'html' ? 'Télécharger le HTML' : 'Télécharger le PDF'}
                  </button>
                ) : (
                  <button className="btn-action-premium" onClick={onGoPremium}>
                    🔒 Accès complet — Passer Premium
                  </button>
                )}
              </div>
            </div>

            {/* <!-- Colonne détails --> */}
            <div className="info-details-column">
              <h1 className="info-title">{ebook.titre}</h1>
              <p className="info-author">par {ebook.auteur}</p>

              <div className="info-description">
                <h3>Description</h3>
                <p>{ebook.description}</p>
              </div>

              {/* <!-- Métadonnées détaillées --> */}
              <div className="info-metadata">
                <div className="metadata-item">
                  <span className="metadata-label">Catégorie</span>
                  <span className="metadata-value">
                    {CATEGORIE_ICONS[ebook.categorie]} {CATEGORIE_LABELS[ebook.categorie]}
                  </span>
                </div>
                <div className="metadata-item">
                  <span className="metadata-label">Niveau</span>
                  <span className="metadata-value">
                    {ebook.niveau === 'college' ? 'Collège' : 'Lycée'}
                  </span>
                </div>
                {ebook.classe !== 'all' && (
                  <div className="metadata-item">
                    <span className="metadata-label">Classe</span>
                    <span className="metadata-value">{ebook.classe}</span>
                  </div>
                )}
                {ebook.matiere && (
                  <div className="metadata-item">
                    <span className="metadata-label">Matière</span>
                    <span className="metadata-value">{ebook.matiere}</span>
                  </div>
                )}
                {/* "Pages" n'a de sens que pour un PDF. Pour un HTML on
                     remplace par un libellé "Format" plus pertinent. */}
                {ebookFormat === 'pdf' ? (
                  <div className="metadata-item">
                    <span className="metadata-label">Pages</span>
                    <span className="metadata-value">{ebook.nombrePages}</span>
                  </div>
                ) : (
                  <div className="metadata-item">
                    <span className="metadata-label">Format</span>
                    <span className="metadata-value">🌐 Page web interactive</span>
                  </div>
                )}
                <div className="metadata-item">
                  <span className="metadata-label">Taille</span>
                  <span className="metadata-value">{formatFileSize(ebook.tailleFichier)}</span>
                </div>
                {ebook.annee && (
                  <div className="metadata-item">
                    <span className="metadata-label">Année</span>
                    <span className="metadata-value">{ebook.annee}</span>
                  </div>
                )}
                {ebook.editeur && (
                  <div className="metadata-item">
                    <span className="metadata-label">Éditeur</span>
                    <span className="metadata-value">{ebook.editeur}</span>
                  </div>
                )}
              </div>

              {/* <!-- Statistiques --> */}
              <div className="info-stats">
                <span>👁️ {ebook.nombreVues} vue{ebook.nombreVues > 1 ? 's' : ''}</span>
                <span>⬇️ {ebook.nombreTelechargements} téléchargement{ebook.nombreTelechargements > 1 ? 's' : ''}</span>
              </div>

              {/* <!-- Tags --> */}
              {ebook.tags && ebook.tags.length > 0 && (
                <div className="info-tags">
                  {ebook.tags.map((tag, index) => (
                    <span key={index} className="info-tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODE LECTURE ==================== */}
      {viewMode === 'read' && (
        <div className="viewer-read-panel">

          {/* --- Stratégie 0 : iframe HTML sandboxée (format HTML, Premium) ---
                Sécurité : le sandbox isole le document de l'application
                principale. On autorise les scripts et `same-origin` pour
                permettre aux fiches interactives (intersection observer,
                accordions, polices Google) de fonctionner. On EXCLUT
                délibérément `allow-top-navigation` : un script malveillant
                ne peut pas rediriger PedaClic.
                ────────────────────────────────────────────────────────
                NB sur le téléchargement HTML :
                Quand l'admin a interdit l'export (canDownload === false),
                on resserre le sandbox en SUPPRIMANT `allow-popups` afin
                qu'un script du document ne puisse pas ouvrir une fenêtre
                pointant directement vers l'URL du fichier (et donc la
                proposer au téléchargement). On supprime également
                `allow-forms` (jamais utile pour une fiche pédagogique
                consultative — réduit la surface d'attaque).
                Pour un HTML libre au téléchargement, on conserve la
                permissivité historique. */}
          {strategy.kind === 'html-iframe' && (
            <>
              {loading && (
                <div className="viewer-loading">
                  <div className="loading-spinner"></div>
                  <p>Chargement du document HTML...</p>
                </div>
              )}
              <iframe
                src={strategy.url}
                className="pdf-iframe html-iframe"
                title={ebook.titre}
                onLoad={handleIframeLoad}
                style={{ display: loading ? 'none' : 'block' }}
                sandbox={
                  canDownload
                    ? 'allow-scripts allow-same-origin allow-popups allow-forms'
                    /* DL bloqué → on retire allow-popups + allow-forms pour
                       empêcher la « fuite » via window.open / form submit */
                    : 'allow-scripts allow-same-origin'
                }
                referrerPolicy="no-referrer"
              />
            </>
          )}

          {/* --- Stratégie 1 : Visualiseur PDF dédié (Premium OU aperçu PDF admin) ---
                 ─────────────────────────────────────────────────────────────
                 IMPORTANT : on n'utilise PLUS l'<iframe> PDF natif ici, car la
                 barre d'outils du navigateur (Chrome/Edge/Firefox) exposait un
                 bouton « Télécharger » qui contournait la règle d'admin
                 (canDownload === false). Le nouveau composant <EbookPdfReader>
                 rend le PDF dans un <canvas> via pdf.js — pas de toolbar
                 navigateur, donc plus de fuite de téléchargement.
                 Le défilement entre les pages est maintenant HORIZONTAL.
                 ───────────────────────────────────────────────────────────── */}
          {strategy.kind === 'iframe' && (
            <>
              <EbookPdfReader
                pdfUrl={strategy.url}
                title={ebook.titre}
                // Le bouton de téléchargement maison n'est rendu QUE si
                // l'admin a explicitement autorisé l'export pour cet ebook
                // ET que l'utilisateur est Premium. Toute autre situation
                // ne rendra simplement aucun bouton (cf. composant).
                canDownload={canDownload && isPremium}
                onDownload={handleDownload}
              />
              {/* Overlay « Premium » pour les non-Premium qui consultent
                  un aperçu (cas où l'admin a fourni un aperçuURL dédié).
                  Conservé tel quel — comportement identique à avant. */}
              {!isPremium && (
                <div className="viewer-premium-overlay">
                  <div className="overlay-content">
                    <div className="overlay-lock">🔒</div>
                    <h3>Aperçu limité à {ebook.pagesApercu} pages</h3>
                    <p>
                      Pour lire l'intégralité de ce document ({ebook.nombrePages} pages)
                      et le télécharger, passez à PedaClic Premium.
                    </p>
                    <button onClick={onGoPremium} className="btn-overlay-premium">
                      Passer Premium — 2 000 FCFA/mois
                    </button>
                    <button onClick={onBack} className="btn-overlay-back">
                      Retour à la bibliothèque
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* --- Stratégie 2 : rendu canvas limité (non-Premium, aucun aperçu PDF dédié) --- */}
          {strategy.kind === 'limited-render' && (
            <>
              <EbookPdfPreview
                pdfUrl={strategy.url}
                maxPages={strategy.maxPages}
                totalPages={ebook.nombrePages}
              />
              <div className="viewer-premium-overlay">
                <div className="overlay-content">
                  <div className="overlay-lock">🔒</div>
                  <h3>Aperçu gratuit — {strategy.maxPages} premières pages</h3>
                  <p>
                    Pour lire l'intégralité de ce document ({ebook.nombrePages} pages)
                    et le télécharger, passez à PedaClic Premium.
                  </p>
                  <button onClick={onGoPremium} className="btn-overlay-premium">
                    Passer Premium — 2 000 FCFA/mois
                  </button>
                  <button onClick={onBack} className="btn-overlay-back">
                    Retour à la bibliothèque
                  </button>
                </div>
              </div>
            </>
          )}

          {/* --- Stratégie 3 : aucun fichier disponible → blocage --- */}
          {strategy.kind === 'blocked' && (
            <div className="viewer-no-preview">
              <div className="no-preview-content">
                <div className="overlay-lock">🔒</div>
                <h3>Document réservé aux abonnés Premium</h3>
                <p>
                  Ce document de {ebook.nombrePages} pages est accessible uniquement
                  avec un abonnement PedaClic Premium.
                </p>
                <button onClick={onGoPremium} className="btn-overlay-premium">
                  Passer Premium — 2 000 FCFA/mois
                </button>
                <button onClick={onBack} className="btn-overlay-back">
                  Retour à la bibliothèque
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EbookViewer;

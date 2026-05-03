// ==================== LECTEUR EBOOK (PDF VIEWER) - PHASE 20 ====================
// PedaClic : Visionneuse PDF avec limitation aperçu pour non-Premium
// Utilise <iframe> pour la lecture en ligne des PDF
// Les non-Premium voient uniquement l'aperçu (premières pages)
// ========================================================================

import React, { useState, useEffect } from 'react';
import { Ebook, CATEGORIE_LABELS, CATEGORIE_ICONS } from '../types/ebook.types';
import { incrementVues, incrementTelechargements, formatFileSize } from '../services/ebookService';
import { EbookPdfPreview } from '../components/eleve/EbookPdfPreview';
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
  useEffect(() => {
    // Incrémenter le compteur de vues à l'ouverture
    incrementVues(ebook.id);
  }, [ebook.id]);

  // ==================== HANDLERS ====================

  /**
   * Détermine la stratégie d'affichage du document selon le statut Premium
   * et la présence d'un PDF aperçu séparé :
   *  - Premium                                   → iframe sur le PDF complet
   *  - Non-Premium + aperçuURL fourni            → iframe sur le PDF aperçu
   *  - Non-Premium sans aperçuURL + fichierURL  → rendu canvas limité à pagesApercu
   *  - Aucun fichier disponible                  → écran de blocage Premium
   */
  type ViewStrategy =
    | { kind: 'iframe'; url: string }
    | { kind: 'limited-render'; url: string; maxPages: number }
    | { kind: 'blocked' };

  const getViewStrategy = (): ViewStrategy => {
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
   * Gère le téléchargement (Premium uniquement)
   */
  const handleDownload = async () => {
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
              <div className="info-actions">
                <button
                  className="btn-action-read"
                  onClick={() => setViewMode('read')}
                >
                  📖 {isPremium ? 'Lire le document' : `Aperçu (${ebook.pagesApercu} pages)`}
                </button>

                {isPremium ? (
                  <button className="btn-action-download" onClick={handleDownload}>
                    ⬇️ Télécharger le PDF
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
                <div className="metadata-item">
                  <span className="metadata-label">Pages</span>
                  <span className="metadata-value">{ebook.nombrePages}</span>
                </div>
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

          {/* --- Stratégie 1 : iframe (Premium ou aperçu PDF dédié) --- */}
          {strategy.kind === 'iframe' && (
            <>
              {loading && (
                <div className="viewer-loading">
                  <div className="loading-spinner"></div>
                  <p>Chargement du document...</p>
                </div>
              )}
              <iframe
                src={`${strategy.url}#toolbar=1&navpanes=0`}
                className="pdf-iframe"
                title={ebook.titre}
                onLoad={handleIframeLoad}
                style={{ display: loading ? 'none' : 'block' }}
              />
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

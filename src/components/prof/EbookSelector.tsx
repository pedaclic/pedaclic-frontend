// ============================================================
// PedaClic — Phase 22 : EbookSelector
// Permet de lier des ebooks de la bibliothèque à une séance.
// S'ouvre en modale, avec recherche en temps réel.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import type { EbookApercu, LienEbook } from '../../types/cahierTextes.types';
import { getEbooksApercu } from '../../services/cahierTextesService';
import '../../styles/CahierEnrichi.css';

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Modale de sélection d'ebooks
// ─────────────────────────────────────────────────────────────

interface EbookModalProps {
  /** IDs des ebooks déjà sélectionnés (pour désactiver) */
  selectedIds: string[];
  onSelect: (ebook: EbookApercu) => void;
  onFermer: () => void;
}

const EbookModal: React.FC<EbookModalProps> = ({ selectedIds, onSelect, onFermer }) => {
  // État de la recherche textuelle
  const [recherche, setRecherche]   = useState('');
  // Liste complète chargée depuis Firestore
  const [ebooks, setEbooks]         = useState<EbookApercu[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur]         = useState('');

  /* Charge les ebooks au montage de la modale */
  useEffect(() => {
    async function charger() {
      try {
        const liste = await getEbooksApercu();
        setEbooks(liste);
      } catch {
        setErreur('Impossible de charger la bibliothèque.');
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, []);

  /**
   * Filtre les ebooks selon la recherche (titre ou auteur ou catégorie).
   * Utilise useMemo pour éviter des recalculs à chaque rendu.
   */
  const ebooksFiltres = useMemo(() => {
    const terme = recherche.toLowerCase().trim();
    if (!terme) return ebooks;
    return ebooks.filter(
      e =>
        e.titre.toLowerCase().includes(terme) ||
        e.auteur.toLowerCase().includes(terme) ||
        e.categorie.toLowerCase().includes(terme)
    );
  }, [ebooks, recherche]);

  /**
   * Ferme la modale si l'utilisateur clique sur l'overlay (hors panneau).
   */
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onFermer();
  }

  return (
    /* Overlay sombre bloquant le reste de l'interface */
    <div
      className="ebook-selector-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Sélectionner un ebook"
    >
      {/* Panneau principal */}
      <div className="ebook-selector-panel">
        {/* En-tête */}
        <div className="ebook-selector-header">
          <h3>📚 Bibliothèque PedaClic</h3>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.3rem',
              cursor: 'pointer',
              color: '#6b7280',
            }}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="ebook-search">
          <input
            type="search"
            placeholder="🔍 Rechercher par titre, auteur ou catégorie..."
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            autoFocus
            aria-label="Recherche ebook"
          />
        </div>

        {/* Corps — liste des ebooks */}
        <div className="ebook-liste">
          {/* Chargement en cours */}
          {chargement && (
            <p style={{ color: '#6b7280', textAlign: 'center' }}>
              ⏳ Chargement de la bibliothèque…
            </p>
          )}

          {/* Erreur de chargement */}
          {erreur && (
            <p style={{ color: '#dc2626', textAlign: 'center' }}>{erreur}</p>
          )}

          {/* Aucun résultat */}
          {!chargement && !erreur && ebooksFiltres.length === 0 && (
            <p style={{ color: '#9ca3af', textAlign: 'center' }}>
              Aucun ebook ne correspond à votre recherche.
            </p>
          )}

          {/* Liste des ebooks filtrés */}
          {!chargement &&
            ebooksFiltres.map(ebook => {
              const dejaSelectionne = selectedIds.includes(ebook.id);
              return (
                <button
                  key={ebook.id}
                  type="button"
                  className={`ebook-item ${dejaSelectionne ? 'selected' : ''}`}
                  onClick={() => !dejaSelectionne && onSelect(ebook)}
                  disabled={dejaSelectionne}
                  aria-pressed={dejaSelectionne}
                  aria-label={`${dejaSelectionne ? 'Déjà lié : ' : ''}${ebook.titre}`}
                >
                  {/* Couverture ou placeholder */}
                  {ebook.couvertureUrl ? (
                    <img
                      src={ebook.couvertureUrl}
                      alt={`Couverture de ${ebook.titre}`}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 48,
                        background: '#e5e7eb',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    >
                      📖
                    </div>
                  )}

                  {/* Informations de l'ebook */}
                  <div className="ebook-item-info">
                    <div className="ebook-item-titre">{ebook.titre}</div>
                    <div className="ebook-item-meta">
                      {ebook.auteur} · {ebook.categorie}
                    </div>
                    {dejaSelectionne && (
                      <div
                        style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: 2 }}
                      >
                        ✓ Déjà lié à cette séance
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : EbookSelector
// ─────────────────────────────────────────────────────────────

interface EbookSelectorProps {
  /** Ebooks actuellement liés à la séance */
  ebooksLies: LienEbook[];
  /** Appelé quand la liste change */
  onChange: (ebooksLies: LienEbook[]) => void;
  /** Mode lecture seule (vue élève) */
  readonly?: boolean;
}

const EbookSelector: React.FC<EbookSelectorProps> = ({
  ebooksLies,
  onChange,
  readonly = false,
}) => {
  // Contrôle l'affichage de la modale
  const [modalOuverte, setModalOuverte] = useState(false);

  /** IDs déjà sélectionnés (pour désactiver dans la modale) */
  const idsSelectionnes = ebooksLies.map(e => e.ebookId);

  /**
   * Ajoute un ebook à la liste des ebooks liés.
   */
  function handleSelect(ebook: EbookApercu) {
    const lien: LienEbook = {
      ebookId:  ebook.id,
      titre:    ebook.titre,
      categorie: ebook.categorie,
      auteur:   ebook.auteur,
    };
    onChange([...ebooksLies, lien]);
    setModalOuverte(false); // Ferme la modale après sélection
  }

  /**
   * Retire un ebook de la liste.
   */
  function handleRetirer(ebookId: string) {
    onChange(ebooksLies.filter(e => e.ebookId !== ebookId));
  }

  return (
    <section aria-label="Ebooks liés à la séance" style={{ marginTop: 16 }}>
      {/* En-tête */}
      <h4
        style={{
          fontSize: '0.95rem',
          fontWeight: 600,
          color: '#111827',
          margin: '0 0 8px',
        }}
      >
        📚 Ebooks de la bibliothèque
      </h4>

      {/* Chips des ebooks sélectionnés */}
      {ebooksLies.length > 0 && (
        <div className="ebooks-lies">
          {ebooksLies.map(ebook => (
            <span key={ebook.ebookId} className="ebook-chip">
              {/* Lien vers la page de lecture de l'ebook */}
              <a
                href={`/bibliotheque/${ebook.ebookId}`}
                className="ebook-chip"
                style={{ textDecoration: 'none' }}
                title={`Lire : ${ebook.titre}`}
              >
                📖 {ebook.titre}
              </a>

              {/* Bouton de retrait (masqué en lecture seule) */}
              {!readonly && (
                <button
                  onClick={() => handleRetirer(ebook.ebookId)}
                  title={`Retirer ${ebook.titre}`}
                  type="button"
                  aria-label={`Retirer l'ebook ${ebook.titre}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Message vide */}
      {ebooksLies.length === 0 && !readonly && (
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0 0 8px' }}>
          Aucun ebook lié. Associez un ebook de la bibliothèque à cette séance.
        </p>
      )}

      {/* Bouton ouverture modale (prof uniquement) */}
      {!readonly && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setModalOuverte(true)}
          style={{ marginTop: 8 }}
        >
          📚 Choisir dans la bibliothèque
        </button>
      )}

      {/* Modale de sélection */}
      {modalOuverte && (
        <EbookModal
          selectedIds={idsSelectionnes}
          onSelect={handleSelect}
          onFermer={() => setModalOuverte(false)}
        />
      )}
    </section>
  );
};

export default EbookSelector;

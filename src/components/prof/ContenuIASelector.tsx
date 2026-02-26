// ============================================================
// PedaClic — Phase 23 : ContenuIASelector
// Permet de lier des contenus générés par l'IA à une séance
// du cahier de textes. Miroir de EbookSelector.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import type { LienContenuIA } from '../../types/cahierTextes.types';
import {
  getGeneratedHistory,
  GeneratedContent,
  GENERATION_TYPE_LABELS,
  GENERATION_TYPE_ICONS,
} from '../../services/aiGeneratorService';
import '../../styles/CahierEnrichi.css';

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Modale de sélection de contenus IA
// ─────────────────────────────────────────────────────────────

interface ContenuIAModalProps {
  userId: string;
  selectedIds: string[];
  onSelect: (item: GeneratedContent) => void;
  onFermer: () => void;
}

const ContenuIAModal: React.FC<ContenuIAModalProps> = ({
  userId,
  selectedIds,
  onSelect,
  onFermer,
}) => {
  const [recherche, setRecherche]   = useState('');
  const [items, setItems]           = useState<GeneratedContent[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur]         = useState('');

  useEffect(() => {
    async function charger() {
      try {
        const liste = await getGeneratedHistory(userId, 50);
        setItems(liste);
      } catch {
        setErreur('Impossible de charger les contenus générés.');
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, [userId]);

  const itemsFiltres = useMemo(() => {
    const terme = recherche.toLowerCase().trim();
    if (!terme) return items;
    return items.filter(
      it =>
        it.chapitre.toLowerCase().includes(terme) ||
        it.discipline.toLowerCase().includes(terme) ||
        it.classe.toLowerCase().includes(terme) ||
        GENERATION_TYPE_LABELS[it.type]?.toLowerCase().includes(terme)
    );
  }, [items, recherche]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onFermer();
  }

  return (
    <div
      className="ebook-selector-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Sélectionner un contenu IA"
    >
      <div className="ebook-selector-panel">
        <div className="ebook-selector-header">
          <h3>🤖 Contenus générés par l'IA</h3>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            type="button"
            style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#6b7280' }}
          >
            ✕
          </button>
        </div>

        <div className="ebook-search">
          <input
            type="search"
            placeholder="🔍 Rechercher par chapitre, discipline ou classe…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            autoFocus
            aria-label="Recherche contenu IA"
          />
        </div>

        <div className="ebook-liste">
          {chargement && (
            <p style={{ color: '#6b7280', textAlign: 'center' }}>⏳ Chargement…</p>
          )}
          {erreur && (
            <p style={{ color: '#dc2626', textAlign: 'center' }}>{erreur}</p>
          )}
          {!chargement && !erreur && itemsFiltres.length === 0 && (
            <p style={{ color: '#9ca3af', textAlign: 'center' }}>
              Aucun contenu ne correspond à votre recherche.
            </p>
          )}
          {!chargement &&
            itemsFiltres.map(item => {
              const dejaSelectionne = item.id ? selectedIds.includes(item.id) : false;
              const dateStr = item.createdAt?.toDate
                ? item.createdAt.toDate().toLocaleDateString('fr-FR')
                : '';
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`ebook-item ${dejaSelectionne ? 'selected' : ''}`}
                  onClick={() => !dejaSelectionne && onSelect(item)}
                  disabled={dejaSelectionne}
                  aria-pressed={dejaSelectionne}
                >
                  <div
                    style={{
                      width: 36,
                      height: 48,
                      background: '#eff6ff',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    {GENERATION_TYPE_ICONS[item.type]}
                  </div>
                  <div className="ebook-item-info">
                    <div className="ebook-item-titre">{item.chapitre}</div>
                    <div className="ebook-item-meta">
                      {GENERATION_TYPE_LABELS[item.type]} · {item.discipline} · {item.classe}
                      {dateStr && ` · ${dateStr}`}
                    </div>
                    {dejaSelectionne && (
                      <div style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: 2 }}>
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
// COMPOSANT PRINCIPAL : ContenuIASelector
// ─────────────────────────────────────────────────────────────

interface ContenuIASelectorProps {
  userId: string;
  contenuIA: LienContenuIA[];
  onChange: (contenuIA: LienContenuIA[]) => void;
  readonly?: boolean;
}

const ContenuIASelector: React.FC<ContenuIASelectorProps> = ({
  userId,
  contenuIA,
  onChange,
  readonly = false,
}) => {
  const [modalOuverte, setModalOuverte] = useState(false);

  const idsSelectionnes = contenuIA.map(c => c.contenuId);

  function handleSelect(item: GeneratedContent) {
    if (!item.id) return;
    const lien: LienContenuIA = {
      contenuId:  item.id,
      type:       item.type,
      discipline: item.discipline,
      classe:     item.classe,
      chapitre:   item.chapitre,
      createdAt:  item.createdAt?.toDate
        ? item.createdAt.toDate().toISOString()
        : undefined,
    };
    onChange([...contenuIA, lien]);
    setModalOuverte(false);
  }

  function handleRetirer(contenuId: string) {
    onChange(contenuIA.filter(c => c.contenuId !== contenuId));
  }

  return (
    <section aria-label="Contenus IA liés à la séance" style={{ marginTop: 16 }}>
      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
        🤖 Contenus générés par l'IA
      </h4>

      {contenuIA.length > 0 && (
        <div className="ebooks-lies">
          {contenuIA.map(item => (
            <span key={item.contenuId} className="ebook-chip ebook-chip--ia">
              <span title={`${item.discipline} · ${item.classe} · ${item.chapitre}`}>
                {GENERATION_TYPE_ICONS[item.type as keyof typeof GENERATION_TYPE_ICONS] ?? '🤖'}{' '}
                {item.chapitre}
              </span>
              {!readonly && (
                <button
                  onClick={() => handleRetirer(item.contenuId)}
                  title={`Retirer : ${item.chapitre}`}
                  type="button"
                  aria-label={`Retirer le contenu ${item.chapitre}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {contenuIA.length === 0 && !readonly && (
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0 0 8px' }}>
          Aucun contenu IA lié. Associez un contenu généré à cette séance.
        </p>
      )}

      {!readonly && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setModalOuverte(true)}
          style={{ marginTop: 8 }}
        >
          🤖 Choisir un contenu IA
        </button>
      )}

      {modalOuverte && (
        <ContenuIAModal
          userId={userId}
          selectedIds={idsSelectionnes}
          onSelect={handleSelect}
          onFermer={() => setModalOuverte(false)}
        />
      )}
    </section>
  );
};

export default ContenuIASelector;

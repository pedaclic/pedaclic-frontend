// ============================================================
// PedaClic — Phase 22 : LienExterneEditor
// Composant pour ajouter, afficher et supprimer des liens
// externes dans une entrée du cahier de textes.
// ============================================================

import React, { useState } from 'react';
import type { LienExterne, LienType } from '../../types/cahierTextes.types';
import '../../styles/CahierEnrichi.css';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/**
 * Retourne l'icône correspondant au type de lien.
 */
function getIconeLien(type: LienType): string {
  const icones: Record<LienType, string> = {
    video:    '🎬',
    article:  '📰',
    exercice: '✏️',
    autre:    '🔗',
  };
  return icones[type] ?? '🔗';
}

/**
 * Détecte si une URL est une vidéo YouTube et retourne l'ID vidéo.
 * Supporte les formats : youtu.be/ID et youtube.com/watch?v=ID
 */
function extractYoutubeId(url: string): string | null {
  const regex =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_\-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Formulaire d'ajout d'un lien
// ─────────────────────────────────────────────────────────────

interface LienFormProps {
  onAjouter: (lien: LienExterne) => void;
  onAnnuler: () => void;
}

const LienForm: React.FC<LienFormProps> = ({ onAjouter, onAnnuler }) => {
  // État local du formulaire d'ajout
  const [titre, setTitre]           = useState('');
  const [url, setUrl]               = useState('');
  const [type, setType]             = useState<LienType>('article');
  const [description, setDescription] = useState('');
  const [erreur, setErreur]         = useState('');

  /**
   * Détecte automatiquement le type si l'URL contient "youtube".
   */
  function handleUrlChange(value: string) {
    setUrl(value);
    if (value.includes('youtube.com') || value.includes('youtu.be')) {
      setType('video');
    }
  }

  /**
   * Valide et soumet le lien.
   */
  function handleSubmit() {
    if (!titre.trim()) {
      setErreur('Le titre est requis.');
      return;
    }
    if (!url.trim() || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      setErreur('Entrez une URL valide commençant par https://');
      return;
    }
    // Génère un identifiant local unique
    const nouveauLien: LienExterne = {
      id:          String(Date.now()),
      titre:       titre.trim(),
      url:         url.trim(),
      type,
      description: description.trim() || undefined,
    };
    onAjouter(nouveauLien);
  }

  return (
    /* Formulaire stylisé avec pointillés bleus (voir CahierEnrichi.css) */
    <div className="lien-form">
      {/* Champ titre */}
      <input
        type="text"
        placeholder="Titre du lien *"
        value={titre}
        onChange={e => setTitre(e.target.value)}
        aria-label="Titre du lien"
      />

      {/* Champ URL avec détection auto YouTube */}
      <input
        type="url"
        placeholder="https://... *"
        value={url}
        onChange={e => handleUrlChange(e.target.value)}
        aria-label="URL du lien"
      />

      {/* Sélection du type */}
      <select
        value={type}
        onChange={e => setType(e.target.value as LienType)}
        aria-label="Type de lien"
      >
        <option value="article">📰 Article</option>
        <option value="video">🎬 Vidéo</option>
        <option value="exercice">✏️ Exercice</option>
        <option value="autre">🔗 Autre</option>
      </select>

      {/* Description optionnelle */}
      <textarea
        placeholder="Description (optionnelle)"
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={2}
        aria-label="Description du lien"
      />

      {/* Message d'erreur */}
      {erreur && (
        <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: 0 }}>{erreur}</p>
      )}

      {/* Boutons d'action */}
      <div className="lien-form-actions">
        <button className="btn-secondary" onClick={onAnnuler} type="button">
          Annuler
        </button>
        <button className="btn-pedaclic" onClick={handleSubmit} type="button">
          ➕ Ajouter
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Aperçu YouTube embed
// ─────────────────────────────────────────────────────────────

interface YoutubeEmbedProps {
  videoId: string;
}

const YoutubeEmbed: React.FC<YoutubeEmbedProps> = ({ videoId }) => (
  /* Conteneur 16:9 responsive (voir .youtube-embed dans le CSS) */
  <div className="youtube-embed">
    <iframe
      src={`https://www.youtube.com/embed/${videoId}`}
      title="Vidéo YouTube"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy" /* Lazy loading pour économiser la bande passante */
    />
  </div>
);

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : LienExterneEditor
// ─────────────────────────────────────────────────────────────

interface LienExterneEditorProps {
  /** Liste des liens actuellement rattachés à la séance */
  liens: LienExterne[];
  /** Appelé quand la liste de liens change (ajout ou suppression) */
  onChange: (liens: LienExterne[]) => void;
  /** Mode lecture seule (vue élève) */
  readonly?: boolean;
}

const LienExterneEditor: React.FC<LienExterneEditorProps> = ({
  liens,
  onChange,
  readonly = false,
}) => {
  // Contrôle l'affichage du formulaire d'ajout
  const [afficherForm, setAfficherForm] = useState(false);

  /**
   * Ajoute un nouveau lien à la liste.
   */
  function handleAjouter(lien: LienExterne) {
    onChange([...liens, lien]);
    setAfficherForm(false);
  }

  /**
   * Supprime un lien par son identifiant.
   */
  function handleSupprimer(id: string) {
    onChange(liens.filter(l => l.id !== id));
  }

  return (
    <section className="liens-section" aria-label="Liens externes">
      {/* En-tête de la section */}
      <h4>🔗 Liens et ressources</h4>

      {/* Liste des liens existants */}
      {liens.length > 0 && (
        <div className="liens-liste">
          {liens.map(lien => {
            const youtubeId = extractYoutubeId(lien.url);

            return (
              <div key={lien.id} className="lien-card">
                {/* Icône du type de lien */}
                <span className="lien-icone" aria-hidden="true">
                  {getIconeLien(lien.type)}
                </span>

                {/* Informations du lien */}
                <div className="lien-infos">
                  <a
                    href={lien.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lien-titre"
                    title={lien.url}
                  >
                    {lien.titre}
                  </a>
                  {lien.description && (
                    <p className="lien-description">{lien.description}</p>
                  )}
                  {/* Embed YouTube si détecté */}
                  {youtubeId && <YoutubeEmbed videoId={youtubeId} />}
                </div>

                {/* Bouton suppression (masqué en lecture seule) */}
                {!readonly && (
                  <button
                    className="lien-suppr"
                    onClick={() => handleSupprimer(lien.id)}
                    title="Supprimer ce lien"
                    type="button"
                    aria-label={`Supprimer le lien ${lien.titre}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Message si aucun lien (mode édition) */}
      {liens.length === 0 && !readonly && (
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0 0 12px' }}>
          Aucun lien ajouté. Ajoutez des ressources pour enrichir cette séance.
        </p>
      )}

      {/* Formulaire d'ajout (prof uniquement) */}
      {!readonly && (
        <>
          {afficherForm ? (
            <LienForm
              onAjouter={handleAjouter}
              onAnnuler={() => setAfficherForm(false)}
            />
          ) : (
            <button
              className="btn-secondary"
              onClick={() => setAfficherForm(true)}
              type="button"
            >
              ➕ Ajouter un lien
            </button>
          )}
        </>
      )}
    </section>
  );
};

export default LienExterneEditor;

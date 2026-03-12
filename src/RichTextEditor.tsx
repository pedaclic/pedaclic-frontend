// ============================================================
// PedaClic — Composant RichTextEditor
// Éditeur de texte enrichi réutilisable
// Utilisé par : EntreeEditorPage, SequenceEditorPage, etc.
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================
// Fonctionnalités :
//   - Formatage : Gras, Italique, Souligné, Barré
//   - Titres H1/H2/H3, Paragraphe, Citation
//   - Alignement : Gauche, Centre, Droite, Justifié
//   - Listes à puces avec indentation hiérarchique
//   - Listes ordonnées : Arabes, Romains MAJ/min, Lettres MAJ/min
//   - Retrait : Augmenter / Diminuer (Tab / Shift+Tab)
//   - Couleur du texte
//   - Insertion de tableau configurable
//   - Historique : Annuler / Rétablir
// ============================================================

import React, { useRef, useEffect, useState, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** Types de numérotation pour les listes ordonnées */
type TypeListeOrdonnee =
  | 'decimal'
  | 'upper-roman'
  | 'lower-roman'
  | 'upper-alpha'
  | 'lower-alpha';

/** Props du composant RichTextEditor */
export interface RichTextEditorProps {
  /** Contenu HTML (valeur contrôlée) */
  value: string;
  /** Callback déclenché à chaque modification */
  onChange: (html: string) => void;
  /** Texte indicatif affiché quand l'éditeur est vide */
  placeholder?: string;
  /** Hauteur minimale de la zone d'édition en pixels */
  minHeight?: number;
  /** Désactive l'éditeur (lecture seule) */
  disabled?: boolean;
  /** Classe CSS supplémentaire pour le wrapper */
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// CONFIGURATION — Types de liste ordonnée
// ─────────────────────────────────────────────────────────────

/** Définition des 5 types de numérotation disponibles */
const TYPES_LISTE_ORDONNEE: {
  valeur: TypeListeOrdonnee;
  label: string;
  exemple: string;
  icone: string;
}[] = [
  { valeur: 'decimal',     label: 'Chiffres arabes',        exemple: '1, 2, 3',       icone: '①' },
  { valeur: 'upper-roman', label: 'Romains majuscules',     exemple: 'I, II, III',    icone: 'Ⅰ' },
  { valeur: 'lower-roman', label: 'Romains minuscules',     exemple: 'i, ii, iii',    icone: 'ⅰ' },
  { valeur: 'upper-alpha', label: 'Lettres majuscules',     exemple: 'A, B, C',       icone: 'Ⓐ' },
  { valeur: 'lower-alpha', label: 'Lettres minuscules',     exemple: 'a, b, c',       icone: 'ⓐ' },
];

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/**
 * Exécute une commande d'édition native sur le document.
 * @deprecated document.execCommand est déprécié mais reste le seul
 *             moyen standard sans bibliothèque externe.
 */
function execCmd(commande: string, valeur?: string): boolean {
  return document.execCommand(commande, false, valeur ?? undefined);
}

/**
 * Remonte l'arbre DOM depuis un nœud pour trouver l'ancêtre le plus proche
 * correspondant à la balise HTML spécifiée.
 */
function trouverAncetre(noeud: Node | null, balise: string): HTMLElement | null {
  const baliseUpper = balise.toUpperCase();
  let courant: Node | null = noeud;
  while (courant) {
    if (
      courant.nodeType === Node.ELEMENT_NODE &&
      (courant as HTMLElement).tagName === baliseUpper
    ) {
      return courant as HTMLElement;
    }
    courant = courant.parentNode;
  }
  return null;
}

/**
 * Applique le style list-style-type sur le <ol> le plus proche
 * de la sélection actuelle.
 */
function appliquerStyleListeOrdonnee(type: TypeListeOrdonnee): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const ol = trouverAncetre(sel.anchorNode, 'ol');
  if (ol) {
    ol.style.listStyleType = type;
  }
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Saisir le contenu…',
  minHeight = 220,
  disabled = false,
  className = '',
}) => {
  // ── Références ──────────────────────────────────────────────
  /** Référence vers la div contentEditable */
  const zoneRef = useRef<HTMLDivElement>(null);
  /** Sauvegarde de la sélection avant ouverture des modales */
  const selectionRef = useRef<Range | null>(null);

  // ── États de l'interface ────────────────────────────────────
  /** Dropdown type de liste ordonnée ouvert ? */
  const [dropdownOuvert, setDropdownOuvert]         = useState(false);
  /** Modale d'insertion de tableau ouverte ? */
  const [modaleTableauOuverte, setModaleTableauOuverte] = useState(false);
  /** Nombre de lignes pour le tableau à insérer */
  const [tableauLignes, setTableauLignes]           = useState(3);
  /** Nombre de colonnes pour le tableau à insérer */
  const [tableauColonnes, setTableauColonnes]       = useState(3);
  /** Type de liste ordonnée actuellement sélectionné */
  const [typeListeActuel, setTypeListeActuel]       = useState<TypeListeOrdonnee>('decimal');

  // ── Synchronisation value → DOM (montage uniquement) ────────
  useEffect(() => {
    if (zoneRef.current) {
      // On n'écrase le DOM que si la valeur diffère (évite la perte du curseur)
      if (zoneRef.current.innerHTML !== value) {
        zoneRef.current.innerHTML = value;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sauvegarde / restauration de la sélection ───────────────

  /** Mémorise la position du curseur avant d'ouvrir une modale */
  const sauvegarderSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      selectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  /** Restaure la position du curseur après fermeture d'une modale */
  const restaurerSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && selectionRef.current) {
      sel.removeAllRanges();
      sel.addRange(selectionRef.current);
    }
  }, []);

  // ── Émission des changements vers le parent ──────────────────
  const emettrChangement = useCallback(() => {
    if (zoneRef.current) {
      onChange(zoneRef.current.innerHTML);
    }
  }, [onChange]);

  // ── Exécution d'une commande de formatage ────────────────────
  const formater = useCallback(
    (commande: string, valeur?: string) => {
      zoneRef.current?.focus();
      execCmd(commande, valeur);
      emettrChangement();
    },
    [emettrChangement]
  );

  // ── Changement de style de paragraphe ───────────────────────
  const changerStyleParagraphe = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (!val) return;
      zoneRef.current?.focus();
      execCmd('formatBlock', val);
      emettrChangement();
      // Réinitialise le select pour permettre re-sélection
      e.target.value = '';
    },
    [emettrChangement]
  );

  // ── Insertion d'une liste ordonnée avec style ────────────────
  const insererListeOrdonnee = useCallback(
    (type: TypeListeOrdonnee) => {
      zoneRef.current?.focus();
      restaurerSelection();

      // Insère la liste si pas déjà dans une liste ordonnée
      const sel = window.getSelection();
      const dejaDansOL = sel?.anchorNode
        ? trouverAncetre(sel.anchorNode, 'ol') !== null
        : false;

      if (!dejaDansOL) {
        execCmd('insertOrderedList');
      }

      // Applique le style list-style-type sur le <ol> parent
      appliquerStyleListeOrdonnee(type);

      setTypeListeActuel(type);
      setDropdownOuvert(false);
      emettrChangement();
    },
    [emettrChangement, restaurerSelection]
  );

  // ── Gestion du retrait via Tab / Shift+Tab ───────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        zoneRef.current?.focus();
        execCmd(e.shiftKey ? 'outdent' : 'indent');
        emettrChangement();
      }
    },
    [emettrChangement]
  );

  // ── Construction et insertion du tableau HTML ────────────────
  const insererTableau = useCallback(() => {
    // Bornes de sécurité
    const nbLignes = Math.max(1, Math.min(20, tableauLignes));
    const nbCols   = Math.max(1, Math.min(10, tableauColonnes));

    zoneRef.current?.focus();
    restaurerSelection();

    // ── En-tête du tableau ──
    let html = '<table class="rte-tableau"><thead><tr>';
    for (let c = 0; c < nbCols; c++) {
      html += `<th>Colonne ${c + 1}</th>`;
    }
    html += '</tr></thead><tbody>';

    // ── Lignes de données ──
    // nbLignes inclut l'en-tête, donc nbLignes - 1 lignes de corps
    const lignesCorps = Math.max(1, nbLignes - 1);
    for (let r = 0; r < lignesCorps; r++) {
      html += '<tr>';
      for (let c = 0; c < nbCols; c++) {
        html += '<td>&#8203;</td>'; // &#8203; = zéro-width space pour placer le curseur
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    // Paragraphe vide après le tableau pour continuer la saisie
    html += '<p><br></p>';

    execCmd('insertHTML', html);
    setModaleTableauOuverte(false);
    emettrChangement();
  }, [tableauLignes, tableauColonnes, emettrChangement, restaurerSelection]);

  // ── Fermeture du dropdown au clic extérieur ──────────────────
  useEffect(() => {
    const fermer = () => setDropdownOuvert(false);
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────

  /** Icône du type de liste actuellement sélectionné */
  const iconeTypeActuel =
    TYPES_LISTE_ORDONNEE.find(t => t.valeur === typeListeActuel)?.icone ?? '①';

  return (
    <div className={`rte-wrapper ${className}`} aria-disabled={disabled}>

      {/* ══════════════════════════════════════════════════════
          BARRE D'OUTILS
          ══════════════════════════════════════════════════════ */}
      <div
        className="rte-toolbar"
        role="toolbar"
        aria-label="Barre d'outils de mise en forme"
      >
        {/* ── Rangée 1 : Historique, Formatage, Style, Listes ── */}
        <div className="rte-toolbar__row">
          <div className="rte-toolbar__group" aria-label="Historique">
            <button type="button" className="rte-btn" onClick={() => formater('undo')} title="Annuler (Ctrl+Z)" aria-label="Annuler">↩</button>
            <button type="button" className="rte-btn" onClick={() => formater('redo')} title="Rétablir (Ctrl+Y)" aria-label="Rétablir">↪</button>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Formatage">
            <button type="button" className="rte-btn" onClick={() => formater('bold')} title="Gras (Ctrl+B)" aria-label="Gras"><strong>G</strong></button>
            <button type="button" className="rte-btn" onClick={() => formater('italic')} title="Italique (Ctrl+I)" aria-label="Italique"><em>I</em></button>
            <button type="button" className="rte-btn" onClick={() => formater('underline')} title="Souligné (Ctrl+U)" aria-label="Souligné"><span style={{ textDecoration: 'underline' }}>S</span></button>
            <button type="button" className="rte-btn" onClick={() => formater('strikeThrough')} title="Barré" aria-label="Barré"><span style={{ textDecoration: 'line-through' }}>B</span></button>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Style de paragraphe">
            <select
              className="rte-select"
              onChange={changerStyleParagraphe}
              value=""
              title="Style de paragraphe"
              aria-label="Style de paragraphe"
            >
              <option value="" disabled>Style…</option>
              <option value="p">Paragraphe</option>
              <option value="h1">Titre 1</option>
              <option value="h2">Titre 2</option>
              <option value="h3">Titre 3</option>
              <option value="blockquote">Citation</option>
            </select>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          {/* ── Groupe : Listes ── */}
        <div className="rte-toolbar__group rte-toolbar__group--listes" aria-label="Listes">

          {/* Liste à puces */}
          <button
            type="button"
            className="rte-btn"
            onClick={() => formater('insertUnorderedList')}
            title="Liste à puces"
            aria-label="Insérer une liste à puces"
          >
            <span className="rte-icone-liste-puces">
              <span /><span /><span />
            </span>
          </button>

          {/* Liste ordonnée avec dropdown de type */}
          <div
            className="rte-dropdown-wrapper"
            onMouseDown={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="rte-btn rte-btn--avec-caret"
              onClick={() => {
                sauvegarderSelection();
                setDropdownOuvert(o => !o);
              }}
              title="Liste numérotée — cliquer pour choisir le style"
              aria-label="Insérer une liste numérotée"
              aria-expanded={dropdownOuvert}
              aria-haspopup="listbox"
            >
              <span className="rte-icone-liste-ordonnee">{iconeTypeActuel}</span>
              <span className="rte-btn__caret" aria-hidden="true">▾</span>
            </button>

            {dropdownOuvert && (
              <div
                className="rte-dropdown"
                role="listbox"
                aria-label="Types de numérotation"
              >
                <div className="rte-dropdown__titre">Style de numérotation</div>
                {TYPES_LISTE_ORDONNEE.map(t => (
                  <button
                    key={t.valeur}
                    type="button"
                    role="option"
                    aria-selected={typeListeActuel === t.valeur}
                    className={`rte-dropdown__item${typeListeActuel === t.valeur ? ' actif' : ''}`}
                    onMouseDown={e => {
                      e.preventDefault();
                      insererListeOrdonnee(t.valeur);
                    }}
                  >
                    <span className="rte-dropdown__exemple" aria-hidden="true">
                      {t.exemple}
                    </span>
                    <span className="rte-dropdown__label">{t.label}</span>
                    {typeListeActuel === t.valeur && (
                      <span className="rte-dropdown__coche" aria-hidden="true">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
        {/* fin rangée 1 */}

        {/* ── Rangée 2 : Alignement, Retrait, Couleur, Tableau ── */}
        <div className="rte-toolbar__row">
          <div className="rte-toolbar__group" aria-label="Alignement">
            <button type="button" className="rte-btn" onClick={() => formater('justifyLeft')} title="Aligner à gauche" aria-label="Aligner à gauche">≡</button>
            <button type="button" className="rte-btn" onClick={() => formater('justifyCenter')} title="Centrer" aria-label="Centrer">☰</button>
            <button type="button" className="rte-btn" onClick={() => formater('justifyRight')} title="Aligner à droite" aria-label="Aligner à droite">≡</button>
            <button type="button" className="rte-btn" onClick={() => formater('justifyFull')} title="Justifier" aria-label="Justifier">⊟</button>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Retrait">
            <button
              type="button"
              className="rte-btn"
              onClick={() => formater('outdent')}
              title="Diminuer le retrait (Shift+Tab)"
              aria-label="Diminuer le retrait"
            >⇤</button>
            <button
              type="button"
              className="rte-btn"
              onClick={() => formater('indent')}
              title="Augmenter le retrait (Tab)"
              aria-label="Augmenter le retrait"
            >⇥</button>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Couleur">
            <label className="rte-btn rte-btn--couleur" title="Couleur du texte" aria-label="Couleur du texte">
              <span aria-hidden="true">A</span>
              <input
                type="color"
                className="rte-color-input"
                defaultValue="#111827"
                onChange={e => formater('foreColor', e.target.value)}
                aria-label="Choisir la couleur du texte"
              />
            </label>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Insertion">
            <button
              type="button"
              className="rte-btn"
              onClick={() => {
                sauvegarderSelection();
                setModaleTableauOuverte(true);
              }}
              title="Insérer un tableau"
              aria-label="Insérer un tableau"
              aria-haspopup="dialog"
            >
              <span className="rte-icone-tableau">⊞</span>
            </button>
          </div>
        </div>
        {/* fin rangée 2 */}

      </div>

      <div
        ref={zoneRef}
        className="rte-content"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emettrChangement}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        style={{ minHeight: `${minHeight}px` }}
        role="textbox"
        aria-multiline="true"
        aria-label="Zone de saisie du contenu"
        aria-readonly={disabled}
        spellCheck
        lang="fr"
      />

      {modaleTableauOuverte && (
        <div
          className="rte-modale-overlay"
          onClick={() => setModaleTableauOuverte(false)}
          role="presentation"
        >
          <div
            className="rte-modale"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Insérer un tableau"
            aria-labelledby="rte-modale-titre"
          >
            <div className="rte-modale__header">
              <h3 id="rte-modale-titre" className="rte-modale__titre">
                ⊞ Insérer un tableau
              </h3>
              <button
                type="button"
                className="rte-modale__fermer"
                onClick={() => setModaleTableauOuverte(false)}
                aria-label="Fermer la modale"
              >✕</button>
            </div>

            <div className="rte-modale__body">
              <div
                className="rte-grille-apercu"
                aria-label={`Aperçu : tableau ${tableauLignes} × ${tableauColonnes}`}
              >
                {Array.from({ length: Math.min(tableauLignes, 8) }).map((_, r) => (
                  <div key={r} className="rte-grille-apercu__ligne">
                    {Array.from({ length: Math.min(tableauColonnes, 8) }).map((_, c) => (
                      <div
                        key={c}
                        className={`rte-grille-apercu__cell${r === 0 ? ' entete' : ''}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                ))}
                {tableauLignes > 8 && (
                  <p className="rte-grille-apercu__plus" aria-hidden="true">
                    +{tableauLignes - 8} lignes supplémentaires
                  </p>
                )}
              </div>

              <div className="rte-modale__controls">
                <div className="rte-modale__control-bloc">
                  <label className="rte-modale__label" htmlFor="rte-lignes">
                    Lignes (total)
                  </label>
                  <div className="rte-spinner">
                    <button
                      type="button"
                      className="rte-spinner__btn"
                      onClick={() => setTableauLignes(l => Math.max(1, l - 1))}
                      aria-label="Diminuer le nombre de lignes"
                    >−</button>
                    <span id="rte-lignes" className="rte-spinner__valeur">
                      {tableauLignes}
                    </span>
                    <button
                      type="button"
                      className="rte-spinner__btn"
                      onClick={() => setTableauLignes(l => Math.min(20, l + 1))}
                      aria-label="Augmenter le nombre de lignes"
                    >+</button>
                  </div>
                  <p className="rte-modale__hint">
                    dont 1 ligne d'en-tête
                  </p>
                </div>

                <div className="rte-modale__control-bloc">
                  <label className="rte-modale__label" htmlFor="rte-colonnes">
                    Colonnes
                  </label>
                  <div className="rte-spinner">
                    <button
                      type="button"
                      className="rte-spinner__btn"
                      onClick={() => setTableauColonnes(c => Math.max(1, c - 1))}
                      aria-label="Diminuer le nombre de colonnes"
                    >−</button>
                    <span id="rte-colonnes" className="rte-spinner__valeur">
                      {tableauColonnes}
                    </span>
                    <button
                      type="button"
                      className="rte-spinner__btn"
                      onClick={() => setTableauColonnes(c => Math.min(10, c + 1))}
                      aria-label="Augmenter le nombre de colonnes"
                    >+</button>
                  </div>
                  <p className="rte-modale__hint">maximum 10</p>
                </div>
              </div>
            </div>

            <div className="rte-modale__footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setModaleTableauOuverte(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn-pedaclic"
                onClick={insererTableau}
              >
                ⊞ Insérer le tableau
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default RichTextEditor;

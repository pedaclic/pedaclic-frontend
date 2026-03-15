/**
 * ============================================================
 * PEDACLIC — Éditeur de Texte Riche (v2 — enrichi)
 * ============================================================
 * Features v2 :
 *   - Palette couleurs étendue (24 couleurs)
 *   - Fond de texte (trame) étendu (20 teintes)
 *   - Fond de bloc / paragraphe (backColor)
 *   - Sélecteur de taille de police
 *   - Sélecteur de niveau de titre (H1–H4, ¶)
 *   - Indentation, citation (blockquote)
 *   - Toutes les options précédentes conservées
 * ============================================================
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';

// ==================== INTERFACES ====================

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  toolbar?: ToolbarOption[];
  disabled?: boolean;
  className?: string;
}

type ToolbarOption =
  | 'bold' | 'italic' | 'underline' | 'strikethrough'
  | 'headinglevel' | 'fontsize'
  | 'color' | 'highlight' | 'blockBg'
  | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'bulletList' | 'numberedList'
  | 'indent' | 'outdent'
  | 'blockquote'
  | 'subscript' | 'superscript'
  | 'link' | 'clean'
  | 'separator'
  | 'rowBreak';

// ==================== PALETTES ====================

/** 24 couleurs de texte */
const COLORS = [
  '#000000', '#1f2937', '#374151', '#6b7280',   // noirs / gris
  '#dc2626', '#ef4444', '#f97316', '#d97706',   // rouges / oranges
  '#eab308', '#65a30d', '#059669', '#14b8a6',   // jaunes / verts
  '#2563eb', '#3b82f6', '#0891b2', '#7c3aed',   // bleus / violet
  '#db2777', '#ec4899', '#be185d', '#9333ea',   // roses / violets
  '#ffffff', '#f3f4f6', '#fef3c7', '#dbeafe',   // clairs
];

/** 20 teintes de fond de texte */
const HIGHLIGHTS = [
  '#fef08a', '#fde68a', '#fef3c7',   // jaunes
  '#bbf7d0', '#d1fae5', '#a7f3d0',   // verts
  '#bfdbfe', '#dbeafe', '#c7d2fe',   // bleus
  '#fecaca', '#fee2e2', '#fde8e8',   // rouges
  '#e9d5ff', '#f3e8ff', '#d8b4fe',   // violets
  '#fed7aa', '#ffedd5', '#fce7f3',   // oranges / roses
  'transparent', '#ffffff',          // aucun / blanc
];

/** Teintes de fond de bloc (paragraphe) */
const BLOCK_BGS = [
  '#f0fdf4', '#ecfdf5', '#f0f9ff',
  '#eff6ff', '#faf5ff', '#fdf2f8',
  '#fff7ed', '#fffbeb', '#fef2f2',
  '#f9fafb', '#f3f4f6', 'transparent',
];

/** Labels niveaux de titre */
const HEADING_LEVELS = [
  { tag: 'p',  label: '¶ Paragraphe' },
  { tag: 'h1', label: 'H1 — Titre 1' },
  { tag: 'h2', label: 'H2 — Titre 2' },
  { tag: 'h3', label: 'H3 — Titre 3' },
  { tag: 'h4', label: 'H4 — Titre 4' },
  { tag: 'pre', label: '</> Code' },
  { tag: 'blockquote', label: '❝ Citation' },
];

/** Tailles de police (via execCommand fontSize 1–7) */
const FONT_SIZES: { value: string; label: string }[] = [
  { value: '1', label: 'Très petit' },
  { value: '2', label: 'Petit' },
  { value: '3', label: 'Normal' },
  { value: '4', label: 'Grand' },
  { value: '5', label: 'Très grand' },
  { value: '6', label: 'Énorme' },
];

// ==================== TOOLBAR PAR DÉFAUT ====================

const DEFAULT_TOOLBAR: ToolbarOption[] = [
  'headinglevel', 'fontsize', 'separator',
  'bold', 'italic', 'underline', 'strikethrough', 'separator',
  'color', 'highlight', 'blockBg',
  'rowBreak',
  'alignLeft', 'alignCenter', 'alignRight', 'alignJustify', 'separator',
  'bulletList', 'numberedList', 'indent', 'outdent', 'separator',
  'subscript', 'superscript', 'link', 'clean',
];

// ==================== COMPOSANT ====================

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Saisissez votre texte...',
  minHeight = 120,
  maxHeight = 500,
  toolbar = DEFAULT_TOOLBAR,
  disabled = false,
  className = '',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showBlockBgPicker, setShowBlockBgPicker] = useState(false);

  // Sync HTML initial
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execCmd = useCallback(
    (command: string, val?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, val);
      handleInput();
    },
    [handleInput]
  );

  // Applique une couleur de fond au bloc courant
  const applyBlockBg = useCallback((color: string) => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    // Remonte l'arbre DOM jusqu'à un élément bloc dans l'éditeur
    let node: Node | null = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName;
        if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI', 'BLOCKQUOTE', 'PRE'].includes(tag)) {
          el.style.backgroundColor = color === 'transparent' ? '' : color;
          handleInput();
          return;
        }
      }
      node = node.parentNode;
    }
    // Fallback : appliquer via hiliteColor sur la sélection
    document.execCommand('hiliteColor', false, color === 'transparent' ? 'transparent' : color);
    handleInput();
  }, [handleInput]);

  const insertLink = useCallback(() => {
    const url = prompt('URL du lien :', 'https://');
    if (url) execCmd('createLink', url);
  }, [execCmd]);

  const cleanFormat = useCallback(() => {
    execCmd('removeFormat');
    execCmd('formatBlock', 'p');
  }, [execCmd]);

  // Fermer les menus au clic extérieur
  useEffect(() => {
    const close = () => {
      setShowColorPicker(false);
      setShowHighlightPicker(false);
      setShowBlockBgPicker(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ── Rendu d'un bouton / widget de toolbar ────────────────
  const renderItem = (option: ToolbarOption, key: number) => {
    switch (option) {

      case 'separator':
        return <span key={`sep-${key}`} className="rte-separator" />;

      case 'rowBreak':
        return null;

      case 'bold':
        return (
          <button key="bold" type="button" className="rte-btn" title="Gras (Ctrl+B)"
            onMouseDown={e => { e.preventDefault(); execCmd('bold'); }}>
            <strong>G</strong>
          </button>
        );

      case 'italic':
        return (
          <button key="italic" type="button" className="rte-btn" title="Italique (Ctrl+I)"
            onMouseDown={e => { e.preventDefault(); execCmd('italic'); }}>
            <em>I</em>
          </button>
        );

      case 'underline':
        return (
          <button key="underline" type="button" className="rte-btn" title="Souligné (Ctrl+U)"
            onMouseDown={e => { e.preventDefault(); execCmd('underline'); }}>
            <u>S</u>
          </button>
        );

      case 'strikethrough':
        return (
          <button key="strike" type="button" className="rte-btn" title="Barré"
            onMouseDown={e => { e.preventDefault(); execCmd('strikeThrough'); }}>
            <s>R</s>
          </button>
        );

      case 'headinglevel':
        return (
          <select
            key="headinglevel"
            className="rte-select"
            title="Niveau de titre"
            defaultValue=""
            onChange={e => {
              const val = e.target.value;
              editorRef.current?.focus();
              document.execCommand('formatBlock', false, val);
              handleInput();
              e.target.value = '';
            }}
          >
            <option value="" disabled>Titre…</option>
            {HEADING_LEVELS.map(h => (
              <option key={h.tag} value={h.tag}>{h.label}</option>
            ))}
          </select>
        );

      case 'fontsize':
        return (
          <select
            key="fontsize"
            className="rte-select"
            title="Taille de police"
            defaultValue=""
            onChange={e => {
              const val = e.target.value;
              editorRef.current?.focus();
              document.execCommand('fontSize', false, val);
              handleInput();
              e.target.value = '';
            }}
          >
            <option value="" disabled>Taille…</option>
            {FONT_SIZES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        );

      case 'color':
        return (
          <span key="color" className="rte-dropdown-wrapper" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="rte-btn"
              title="Couleur du texte"
              onClick={() => { setShowColorPicker(p => !p); setShowHighlightPicker(false); setShowBlockBgPicker(false); }}
            >
              <span style={{ borderBottom: '3px solid #dc2626', paddingBottom: 1 }}>A</span>
            </button>
            {showColorPicker && (
              <div className="rte-color-picker rte-color-picker--grid">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className="rte-color-swatch"
                    style={{ backgroundColor: color, border: color === '#ffffff' || color === '#f3f4f6' ? '1px solid #d1d5db' : '1px solid transparent' }}
                    title={color}
                    onMouseDown={e => {
                      e.preventDefault();
                      execCmd('foreColor', color);
                      setShowColorPicker(false);
                    }}
                  />
                ))}
              </div>
            )}
          </span>
        );

      case 'highlight':
        return (
          <span key="highlight" className="rte-dropdown-wrapper" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="rte-btn"
              title="Fond de texte (surlignage)"
              onClick={() => { setShowHighlightPicker(p => !p); setShowColorPicker(false); setShowBlockBgPicker(false); }}
            >
              <span style={{ backgroundColor: '#fef08a', padding: '0 3px', borderRadius: 2 }}>A̲</span>
            </button>
            {showHighlightPicker && (
              <div className="rte-color-picker rte-color-picker--grid">
                {HIGHLIGHTS.map((color, i) => (
                  <button
                    key={i}
                    type="button"
                    className="rte-color-swatch"
                    style={{
                      backgroundColor: color === 'transparent' ? '#fff' : color,
                      border: '1px solid #d1d5db',
                    }}
                    title={color === 'transparent' ? 'Aucun fond' : color}
                    onMouseDown={e => {
                      e.preventDefault();
                      execCmd('hiliteColor', color === 'transparent' ? 'transparent' : color);
                      setShowHighlightPicker(false);
                    }}
                  >
                    {color === 'transparent' ? <span style={{ fontSize: 10, color: '#6b7280' }}>✕</span> : null}
                  </button>
                ))}
              </div>
            )}
          </span>
        );

      case 'blockBg':
        return (
          <span key="blockbg" className="rte-dropdown-wrapper" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="rte-btn"
              title="Trame de fond du paragraphe"
              onClick={() => { setShowBlockBgPicker(p => !p); setShowColorPicker(false); setShowHighlightPicker(false); }}
            >
              <span style={{
                background: 'linear-gradient(135deg, #dbeafe 40%, #d1fae5 100%)',
                padding: '0 3px',
                borderRadius: 2,
              }}>¶</span>
            </button>
            {showBlockBgPicker && (
              <div className="rte-color-picker rte-color-picker--grid">
                {BLOCK_BGS.map((color, i) => (
                  <button
                    key={i}
                    type="button"
                    className="rte-color-swatch rte-color-swatch--block"
                    style={{
                      backgroundColor: color === 'transparent' ? '#fff' : color,
                      border: '1px solid #d1d5db',
                    }}
                    title={color === 'transparent' ? 'Aucun fond' : 'Fond de bloc'}
                    onMouseDown={e => {
                      e.preventDefault();
                      applyBlockBg(color);
                      setShowBlockBgPicker(false);
                    }}
                  >
                    {color === 'transparent' ? <span style={{ fontSize: 10, color: '#6b7280' }}>✕</span> : null}
                  </button>
                ))}
              </div>
            )}
          </span>
        );

      case 'alignLeft':
        return (
          <button key="alignL" type="button" className="rte-btn" title="Aligner à gauche"
            onMouseDown={e => { e.preventDefault(); execCmd('justifyLeft'); }}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2 12.5a.5.5 0 010-1h7a.5.5 0 010 1H2zm0-3a.5.5 0 010-1h11a.5.5 0 010 1H2zm0-3a.5.5 0 010-1h7a.5.5 0 010 1H2zm0-3a.5.5 0 010-1h11a.5.5 0 010 1H2z"/>
            </svg>
          </button>
        );

      case 'alignCenter':
        return (
          <button key="alignC" type="button" className="rte-btn" title="Centrer"
            onMouseDown={e => { e.preventDefault(); execCmd('justifyCenter'); }}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 12.5a.5.5 0 010-1h8a.5.5 0 010 1H4zm-2-3a.5.5 0 010-1h12a.5.5 0 010 1H2zm2-3a.5.5 0 010-1h8a.5.5 0 010 1H4zm-2-3a.5.5 0 010-1h12a.5.5 0 010 1H2z"/>
            </svg>
          </button>
        );

      case 'alignRight':
        return (
          <button key="alignR" type="button" className="rte-btn" title="Aligner à droite"
            onMouseDown={e => { e.preventDefault(); execCmd('justifyRight'); }}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M14 12.5a.5.5 0 010-1H7a.5.5 0 010 1h7zm0-3a.5.5 0 010-1H3a.5.5 0 010 1h11zm0-3a.5.5 0 010-1H7a.5.5 0 010 1h7zm0-3a.5.5 0 010-1H3a.5.5 0 010 1h11z"/>
            </svg>
          </button>
        );

      case 'alignJustify':
        return (
          <button key="alignJ" type="button" className="rte-btn" title="Justifier"
            onMouseDown={e => { e.preventDefault(); execCmd('justifyFull'); }}>
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2 12.5a.5.5 0 010-1h12a.5.5 0 010 1H2zm0-3a.5.5 0 010-1h12a.5.5 0 010 1H2zm0-3a.5.5 0 010-1h12a.5.5 0 010 1H2zm0-3a.5.5 0 010-1h12a.5.5 0 010 1H2z"/>
            </svg>
          </button>
        );

      case 'bulletList':
        return (
          <button key="ul" type="button" className="rte-btn" title="Liste à puces"
            onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList'); }}>
            •≡
          </button>
        );

      case 'numberedList':
        return (
          <button key="ol" type="button" className="rte-btn" title="Liste numérotée"
            onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList'); }}>
            1≡
          </button>
        );

      case 'indent':
        return (
          <button key="indent" type="button" className="rte-btn" title="Augmenter le retrait"
            onMouseDown={e => { e.preventDefault(); execCmd('indent'); }}>
            →
          </button>
        );

      case 'outdent':
        return (
          <button key="outdent" type="button" className="rte-btn" title="Diminuer le retrait"
            onMouseDown={e => { e.preventDefault(); execCmd('outdent'); }}>
            ←
          </button>
        );

      case 'blockquote':
        return (
          <button key="blockquote" type="button" className="rte-btn" title="Citation"
            onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'blockquote'); }}>
            ❝
          </button>
        );

      case 'subscript':
        return (
          <button key="sub" type="button" className="rte-btn" title="Indice"
            onMouseDown={e => { e.preventDefault(); execCmd('subscript'); }}>
            X<sub>₂</sub>
          </button>
        );

      case 'superscript':
        return (
          <button key="sup" type="button" className="rte-btn" title="Exposant"
            onMouseDown={e => { e.preventDefault(); execCmd('superscript'); }}>
            X<sup>²</sup>
          </button>
        );

      case 'link':
        return (
          <button key="link" type="button" className="rte-btn" title="Insérer un lien"
            onMouseDown={e => { e.preventDefault(); insertLink(); }}>
            🔗
          </button>
        );

      case 'clean':
        return (
          <button key="clean" type="button" className="rte-btn rte-btn-clean" title="Effacer le formatage"
            onMouseDown={e => { e.preventDefault(); cleanFormat(); }}>
            ✕
          </button>
        );

      default:
        return null;
    }
  };

  // Grouper la toolbar par rowBreak — max 2 lignes horizontales
  const toolbarRows: ToolbarOption[][] = [];
  let currentRow: ToolbarOption[] = [];
  for (const opt of toolbar) {
    if (opt === 'rowBreak') {
      if (currentRow.length) {
        toolbarRows.push(currentRow);
        currentRow = [];
      }
    } else {
      currentRow.push(opt);
    }
  }
  if (currentRow.length) toolbarRows.push(currentRow);

  return (
    <div className={`rte-container ${disabled ? 'rte-disabled' : ''} ${className}`}>
      {!disabled && (
        <div className="rte-toolbar" role="toolbar">
          {toolbarRows.map((row, rowIdx) => (
            <div key={rowIdx} className="rte-toolbar__row">
              {row.map((opt, i) => renderItem(opt, rowIdx * 100 + i))}
            </div>
          ))}
        </div>
      )}
      <div
        ref={editorRef}
        className="rte-editor"
        contentEditable={!disabled}
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
        suppressContentEditableWarning
      />
    </div>
  );
};

export default RichTextEditor;

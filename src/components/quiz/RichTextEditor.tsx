/**
 * ============================================================
 * PEDACLIC — Phase 12 : Éditeur de Texte Riche (Mini)
 * Composant réutilisable pour la mise en forme du texte
 * ============================================================
 * Utilise contentEditable + execCommand pour un éditeur léger
 * sans dépendance externe (alternative à React-Quill)
 * ============================================================
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';

// ==================== INTERFACES ====================

interface RichTextEditorProps {
  value: string;                    // Contenu HTML
  onChange: (html: string) => void; // Callback quand le contenu change
  placeholder?: string;             // Texte placeholder
  minHeight?: number;               // Hauteur minimale en px
  maxHeight?: number;               // Hauteur maximale en px
  toolbar?: ToolbarOption[];         // Options de la barre d'outils
  disabled?: boolean;                // Désactiver l'éditeur
  className?: string;                // Classe CSS supplémentaire
}

type ToolbarOption =
  | 'bold' | 'italic' | 'underline' | 'strikethrough'
  | 'heading' | 'color' | 'highlight'
  | 'alignLeft' | 'alignCenter' | 'alignRight'
  | 'bulletList' | 'numberedList'
  | 'subscript' | 'superscript'
  | 'link' | 'clean';

// ==================== CONFIGURATION BARRE D'OUTILS ====================

/** Configuration par défaut */
const DEFAULT_TOOLBAR: ToolbarOption[] = [
  'bold', 'italic', 'underline', 'strikethrough',
  'heading', 'color', 'highlight',
  'alignLeft', 'alignCenter', 'alignRight',
  'bulletList', 'numberedList',
  'subscript', 'superscript',
  'link', 'clean',
];

/** Couleurs disponibles */
const COLORS = [
  '#000000', '#dc2626', '#2563eb', '#059669', '#d97706',
  '#7c3aed', '#ec4899', '#64748b', '#ffffff',
];

/** Couleurs de surlignage */
const HIGHLIGHTS = [
  '#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca',
  '#e9d5ff', '#fed7aa', 'transparent',
];

// ==================== COMPOSANT ÉDITEUR ====================

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Saisissez votre texte...',
  minHeight = 100,
  maxHeight = 400,
  toolbar = DEFAULT_TOOLBAR,
  disabled = false,
  className = '',
}) => {
  // Ref vers la zone éditable
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Menus déroulants actifs
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // ---- Synchroniser le contenu HTML initial ----
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  // ---- Gérer les changements de contenu ----
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // ---- Exécuter une commande de formatage ----
  const execCmd = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      handleInput();
    },
    [handleInput]
  );

  // ---- Insérer un lien ----
  const insertLink = useCallback(() => {
    const url = prompt('URL du lien :', 'https://');
    if (url) {
      execCmd('createLink', url);
    }
  }, [execCmd]);

  // ---- Nettoyer le formatage ----
  const cleanFormat = useCallback(() => {
    execCmd('removeFormat');
    execCmd('formatBlock', 'p');
  }, [execCmd]);

  // ---- Fermer les menus au clic extérieur ----
  useEffect(() => {
    const handleClickOutside = () => {
      setShowColorPicker(false);
      setShowHighlightPicker(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // ---- Rendu d'un bouton de toolbar ----
  const renderToolbarButton = (option: ToolbarOption) => {
    switch (option) {
      case 'bold':
        return (
          <button
            key="bold"
            type="button"
            className="rte-btn"
            title="Gras (Ctrl+B)"
            onMouseDown={(e) => { e.preventDefault(); execCmd('bold'); }}
          >
            <strong>G</strong>
          </button>
        );
      case 'italic':
        return (
          <button
            key="italic"
            type="button"
            className="rte-btn"
            title="Italique (Ctrl+I)"
            onMouseDown={(e) => { e.preventDefault(); execCmd('italic'); }}
          >
            <em>I</em>
          </button>
        );
      case 'underline':
        return (
          <button
            key="underline"
            type="button"
            className="rte-btn"
            title="Souligné (Ctrl+U)"
            onMouseDown={(e) => { e.preventDefault(); execCmd('underline'); }}
          >
            <u>S</u>
          </button>
        );
      case 'strikethrough':
        return (
          <button
            key="strike"
            type="button"
            className="rte-btn"
            title="Barré"
            onMouseDown={(e) => { e.preventDefault(); execCmd('strikeThrough'); }}
          >
            <s>B</s>
          </button>
        );
      case 'heading':
        return (
          <button
            key="heading"
            type="button"
            className="rte-btn"
            title="Titre"
            onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'h3'); }}
          >
            H
          </button>
        );
      case 'color':
        return (
          <span key="color" className="rte-dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rte-btn"
              title="Couleur du texte"
              onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); }}
            >
              <span style={{ borderBottom: '3px solid #dc2626' }}>A</span>
            </button>
            {showColorPicker && (
              <div className="rte-color-picker">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="rte-color-swatch"
                    style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #ccc' : 'none' }}
                    onMouseDown={(e) => {
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
          <span key="highlight" className="rte-dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rte-btn"
              title="Surligner"
              onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); }}
            >
              <span style={{ backgroundColor: '#fef08a', padding: '0 3px' }}>S</span>
            </button>
            {showHighlightPicker && (
              <div className="rte-color-picker">
                {HIGHLIGHTS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="rte-color-swatch"
                    style={{
                      backgroundColor: color === 'transparent' ? '#fff' : color,
                      border: '1px solid #ccc',
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      execCmd('hiliteColor', color);
                      setShowHighlightPicker(false);
                    }}
                  >
                    {color === 'transparent' ? '✕' : ''}
                  </button>
                ))}
              </div>
            )}
          </span>
        );
      case 'alignLeft':
        return (
          <button
            key="alignL"
            type="button"
            className="rte-btn"
            title="Aligner à gauche"
            onMouseDown={(e) => { e.preventDefault(); execCmd('justifyLeft'); }}
          >
            ≡
          </button>
        );
      case 'alignCenter':
        return (
          <button
            key="alignC"
            type="button"
            className="rte-btn"
            title="Centrer"
            onMouseDown={(e) => { e.preventDefault(); execCmd('justifyCenter'); }}
          >
            ≡
          </button>
        );
      case 'alignRight':
        return (
          <button
            key="alignR"
            type="button"
            className="rte-btn"
            title="Aligner à droite"
            onMouseDown={(e) => { e.preventDefault(); execCmd('justifyRight'); }}
          >
            ≡
          </button>
        );
      case 'bulletList':
        return (
          <button
            key="ul"
            type="button"
            className="rte-btn"
            title="Liste à puces"
            onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList'); }}
          >
            •≡
          </button>
        );
      case 'numberedList':
        return (
          <button
            key="ol"
            type="button"
            className="rte-btn"
            title="Liste numérotée"
            onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList'); }}
          >
            1≡
          </button>
        );
      case 'subscript':
        return (
          <button
            key="sub"
            type="button"
            className="rte-btn"
            title="Indice"
            onMouseDown={(e) => { e.preventDefault(); execCmd('subscript'); }}
          >
            X<sub>₂</sub>
          </button>
        );
      case 'superscript':
        return (
          <button
            key="sup"
            type="button"
            className="rte-btn"
            title="Exposant"
            onMouseDown={(e) => { e.preventDefault(); execCmd('superscript'); }}
          >
            X<sup>²</sup>
          </button>
        );
      case 'link':
        return (
          <button
            key="link"
            type="button"
            className="rte-btn"
            title="Insérer un lien"
            onMouseDown={(e) => { e.preventDefault(); insertLink(); }}
          >
            🔗
          </button>
        );
      case 'clean':
        return (
          <button
            key="clean"
            type="button"
            className="rte-btn rte-btn-clean"
            title="Nettoyer le formatage"
            onMouseDown={(e) => { e.preventDefault(); cleanFormat(); }}
          >
            ✕
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`rte-container ${disabled ? 'rte-disabled' : ''} ${className}`}>
      {/* ---- Barre d'outils ---- */}
      {!disabled && (
        <div className="rte-toolbar">
          {toolbar.map((opt) => renderToolbarButton(opt))}
        </div>
      )}

      {/* ---- Zone d'édition ---- */}
      <div
        ref={editorRef}
        className="rte-editor"
        contentEditable={!disabled}
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
        }}
        suppressContentEditableWarning
      />
    </div>
  );
};

export default RichTextEditor;

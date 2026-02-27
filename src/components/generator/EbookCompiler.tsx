// ============================================================
// PedaClic — Phase 23 : EbookCompiler
// Permet de sélectionner plusieurs contenus générés par l'IA
// et de les compiler en un ebook (PDF / Word / sauvegarde).
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  GeneratedContent,
  GENERATION_TYPE_LABELS,
  GENERATION_TYPE_ICONS,
} from '../../services/aiGeneratorService';
import {
  saveCompiledEbook,
  CompiledSection,
} from '../../services/compiledEbookService';

// ==================== PROPS ====================

interface EbookCompilerProps {
  userId: string;
  history: GeneratedContent[];
  onClose: () => void;
  onSaved: () => void;            // Callback après sauvegarde réussie
  markdownToHtml: (md: string) => string;
}

// ==================== COMPOSANT ====================

const EbookCompiler: React.FC<EbookCompilerProps> = ({
  userId,
  history,
  onClose,
  onSaved,
  markdownToHtml,
}) => {
  // ── Étapes : 'select' → 'configure' → 'preview' ──────────
  const [etape, setEtape] = useState<'select' | 'configure' | 'preview'>('select');

  // ── Sélection des sections ────────────────────────────────
  const [selection, setSelection] = useState<GeneratedContent[]>([]);

  // ── Métadonnées de l'ebook ────────────────────────────────
  const [titre, setTitre]             = useState('');
  const [description, setDescription] = useState('');

  // ── États UI ──────────────────────────────────────────────
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  // ── Filtrage de l'historique (quiz exclus car non textuels) ──
  const items = history.filter(it => it.type !== 'quiz_auto' && it.content);

  // ─────────────────────────────────────────────────────────
  // Gestion de la sélection (toggle + réordonnancement)
  // ─────────────────────────────────────────────────────────

  function toggleItem(item: GeneratedContent) {
    setSelection(prev => {
      const isIn = prev.some(s => s.id === item.id);
      return isIn ? prev.filter(s => s.id !== item.id) : [...prev, item];
    });
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setSelection(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setSelection(prev => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────
  // Construction HTML de l'ebook compilé
  // ─────────────────────────────────────────────────────────

  const buildEbookHtml = useCallback(
    (forPrint = false) => {
      const sectionsHtml = selection
        .map(
          (item, i) => `
      <section class="ebook-section">
        <div class="section-header">
          <span class="section-num">${i + 1}</span>
          <div class="section-meta">
            <h2 class="section-title">${item.chapitre}</h2>
            <p class="section-subtitle">
              ${GENERATION_TYPE_LABELS[item.type]} &nbsp;·&nbsp;
              ${item.discipline} &nbsp;·&nbsp; Classe : ${item.classe}
            </p>
          </div>
        </div>
        <div class="section-body">${markdownToHtml(item.content || '')}</div>
      </section>`,
        )
        .join('<div class="page-break"></div>');

      return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${titre || 'Ebook PedaClic'}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', serif;
      font-size: 12pt;
      line-height: 1.75;
      color: #1a1a2e;
      background: #fff;
      padding: ${forPrint ? '0' : '2rem'};
      max-width: 860px;
      margin: auto;
    }
    /* ── Couverture ── */
    .cover {
      min-height: ${forPrint ? '100vh' : '280px'};
      background: linear-gradient(135deg, #1a56db 0%, #7c3aed 100%);
      border-radius: ${forPrint ? '0' : '12px'};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 3rem 2rem;
      color: #fff;
      margin-bottom: 2.5rem;
    }
    .cover-logo { font-size: 3rem; margin-bottom: 1rem; }
    .cover-title { font-size: 2rem; font-weight: 700; line-height: 1.2; margin-bottom: 0.75rem; }
    .cover-desc { font-size: 1rem; opacity: 0.85; max-width: 480px; }
    .cover-meta { margin-top: 1.5rem; font-size: 0.85rem; opacity: 0.7; }
    /* ── Sommaire ── */
    .toc {
      background: #f8faff;
      border: 1px solid #dbeafe;
      border-radius: 10px;
      padding: 1.5rem 2rem;
      margin-bottom: 2.5rem;
    }
    .toc h2 { font-size: 1.1rem; color: #1a56db; margin-bottom: 1rem; }
    .toc ol { padding-left: 1.25rem; }
    .toc li { padding: 0.3rem 0; font-size: 0.95rem; color: #374151; }
    .toc li span { color: #6b7280; font-size: 0.85rem; margin-left: 0.5rem; }
    /* ── Sections ── */
    .ebook-section { margin-bottom: 2.5rem; }
    .section-header {
      display: flex;
      gap: 1rem;
      align-items: flex-start;
      background: #eff6ff;
      border-left: 4px solid #1a56db;
      padding: 1rem 1.25rem;
      border-radius: 0 8px 8px 0;
      margin-bottom: 1.25rem;
    }
    .section-num {
      background: #1a56db;
      color: #fff;
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 0.9rem;
      flex-shrink: 0;
    }
    .section-title { font-size: 1.3rem; font-weight: 700; color: #1e3a8a; }
    .section-subtitle { font-size: 0.82rem; color: #6b7280; margin-top: 2px; }
    .section-body { padding: 0 0.5rem; }
    .section-body h1, .section-body h2 { color: #1a56db; margin: 1rem 0 0.5rem; }
    .section-body h3 { color: #4f46e5; margin: 0.75rem 0 0.4rem; }
    .section-body p { margin-bottom: 0.6rem; }
    .section-body ul, .section-body ol { margin: 0.4rem 0 0.8rem 1.5rem; }
    .section-body li { margin-bottom: 0.3rem; }
    .section-body strong { font-weight: 700; color: #111827; }
    .section-body em { font-style: italic; color: #374151; }
    .section-body code {
      font-family: 'Courier New', monospace;
      background: #f3f4f6;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    .section-body pre {
      background: #f3f4f6;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 0.8rem 0;
    }
    .section-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0; }
    /* ── Sauts de page ── */
    .page-break { page-break-after: always; break-after: page; height: 0; }
    /* ── Pied de page ── */
    .ebook-footer {
      margin-top: 3rem;
      text-align: center;
      font-size: 0.8rem;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 1rem;
    }
    @media print {
      body { padding: 0; max-width: none; }
      .cover { border-radius: 0; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover-logo">📘</div>
    <h1 class="cover-title">${titre || 'Ebook PedaClic'}</h1>
    ${description ? `<p class="cover-desc">${description}</p>` : ''}
    <p class="cover-meta">
      Généré par PedaClic &nbsp;·&nbsp;
      ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
    </p>
  </div>

  <div class="toc">
    <h2>📋 Table des matières</h2>
    <ol>
      ${selection
        .map(
          item =>
            `<li>${item.chapitre} <span>— ${item.discipline} · ${item.classe}</span></li>`,
        )
        .join('')}
    </ol>
  </div>

  ${sectionsHtml}

  <div class="ebook-footer">
    PedaClic — L'école en un clic &nbsp;·&nbsp; www.pedaclic.sn
  </div>

  ${forPrint ? '<script>window.onload = () => window.print();<\/script>' : ''}
</body>
</html>`;
    },
    [selection, titre, description, markdownToHtml],
  );

  // ─────────────────────────────────────────────────────────
  // Téléchargements
  // ─────────────────────────────────────────────────────────

  function handleDownloadPDF() {
    const win = window.open('', '_blank', 'width=920,height=720');
    if (!win) return;
    win.document.write(buildEbookHtml(true));
    win.document.close();
  }

  function handleDownloadWord() {
    const html = buildEbookHtml(false);
    const wordHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${titre}</title></head>
<body>${html}</body></html>`;
    const blob = new Blob(['\ufeff', wordHtml], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = (titre || 'ebook_pedaclic')
      .replace(/[^\w\u00C0-\u017E\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    a.download = `${safe}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────────────
  // Sauvegarde Firestore
  // ─────────────────────────────────────────────────────────

  async function handleSave() {
    if (!titre.trim()) { setError('Veuillez donner un titre à l\'ebook.'); return; }
    setSaving(true);
    setError('');
    try {
      const sections: CompiledSection[] = selection.map(item => ({
        contenuId:  item.id!,
        type:       item.type,
        discipline: item.discipline,
        classe:     item.classe,
        chapitre:   item.chapitre,
        content:    item.content,
      }));
      await saveCompiledEbook(userId, titre, description, sections);
      setSaved(true);
      onSaved();
    } catch {
      setError('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // RENDU — Étape 1 : Sélection des chapitres
  // ─────────────────────────────────────────────────────────

  if (etape === 'select') {
    return (
      <div className="ai-generator__modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="ai-generator__modal ai-generator__modal--wide" onClick={e => e.stopPropagation()}>
          <div className="ai-generator__modal-header">
            <div className="ai-generator__modal-title-block">
              <h2>📘 Compiler un Ebook</h2>
              <span className="ai-generator__modal-subtitle">
                Étape 1 / 3 — Sélectionner les chapitres à inclure
              </span>
            </div>
            <button className="ai-generator__modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="ai-generator__modal-body">
            {items.length === 0 ? (
              <p className="ai-generator__empty">
                Aucun contenu textuel sauvegardé. Générez d'abord des cours, exercices ou sujets.
              </p>
            ) : (
              <>
                <p className="ebook-compiler__hint">
                  Cochez les chapitres à inclure dans l'ebook. Vous pourrez les réordonner ensuite.
                </p>
                <div className="ebook-compiler__list">
                  {items.map(item => {
                    const selected = selection.some(s => s.id === item.id);
                    return (
                      <label key={item.id} className={`ebook-compiler__item ${selected ? 'ebook-compiler__item--selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleItem(item)}
                          className="ebook-compiler__checkbox"
                        />
                        <div className="ebook-compiler__item-icon">
                          {GENERATION_TYPE_ICONS[item.type]}
                        </div>
                        <div className="ebook-compiler__item-info">
                          <div className="ebook-compiler__item-title">{item.chapitre}</div>
                          <div className="ebook-compiler__item-meta">
                            {GENERATION_TYPE_LABELS[item.type]} · {item.discipline} · {item.classe}
                          </div>
                        </div>
                        {selected && <span className="ebook-compiler__badge">✓</span>}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div className="ai-generator__modal-footer">
            <button className="btn btn--outline" onClick={onClose}>Annuler</button>
            <button
              className="btn btn--primary"
              onClick={() => setEtape('configure')}
              disabled={selection.length === 0}
            >
              {selection.length === 0
                ? 'Sélectionnez au moins 1 chapitre'
                : `Suivant → (${selection.length} chapitre${selection.length > 1 ? 's' : ''})`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDU — Étape 2 : Configuration (titre, ordre)
  // ─────────────────────────────────────────────────────────

  if (etape === 'configure') {
    return (
      <div className="ai-generator__modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="ai-generator__modal ai-generator__modal--wide" onClick={e => e.stopPropagation()}>
          <div className="ai-generator__modal-header">
            <div className="ai-generator__modal-title-block">
              <h2>📘 Compiler un Ebook</h2>
              <span className="ai-generator__modal-subtitle">
                Étape 2 / 3 — Titre et ordre des chapitres
              </span>
            </div>
            <button className="ai-generator__modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="ai-generator__modal-body">
            <div className="ebook-compiler__field">
              <label className="ebook-compiler__label">Titre de l'ebook *</label>
              <input
                className="ebook-compiler__input"
                type="text"
                placeholder="Ex : Cours de Mathématiques — 3ème"
                value={titre}
                onChange={e => setTitre(e.target.value)}
                autoFocus
              />
            </div>
            <div className="ebook-compiler__field">
              <label className="ebook-compiler__label">Description (optionnel)</label>
              <textarea
                className="ebook-compiler__textarea"
                rows={2}
                placeholder="Ex : Recueil de cours et exercices pour la classe de 3ème…"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="ebook-compiler__order-label">
              Ordre des chapitres <span>(glisser les flèches pour réordonner)</span>
            </div>
            <div className="ebook-compiler__order-list">
              {selection.map((item, idx) => (
                <div key={item.id} className="ebook-compiler__order-item">
                  <span className="ebook-compiler__order-num">{idx + 1}</span>
                  <span className="ebook-compiler__order-icon">{GENERATION_TYPE_ICONS[item.type]}</span>
                  <div className="ebook-compiler__order-info">
                    <div className="ebook-compiler__order-title">{item.chapitre}</div>
                    <div className="ebook-compiler__order-meta">{item.discipline} · {item.classe}</div>
                  </div>
                  <div className="ebook-compiler__order-btns">
                    <button type="button" onClick={() => moveUp(idx)} disabled={idx === 0} title="Monter">↑</button>
                    <button type="button" onClick={() => moveDown(idx)} disabled={idx === selection.length - 1} title="Descendre">↓</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ai-generator__modal-footer">
            <button className="btn btn--outline" onClick={() => setEtape('select')}>← Retour</button>
            <button
              className="btn btn--primary"
              onClick={() => { if (!titre.trim()) { setError('Titre requis.'); return; } setError(''); setEtape('preview'); }}
            >
              Aperçu →
            </button>
          </div>
          {error && <p className="ebook-compiler__error">{error}</p>}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDU — Étape 3 : Aperçu + Actions
  // ─────────────────────────────────────────────────────────

  return (
    <div className="ai-generator__modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ai-generator__modal ai-generator__modal--wide" onClick={e => e.stopPropagation()}>
        <div className="ai-generator__modal-header">
          <div className="ai-generator__modal-title-block">
            <h2>📘 {titre}</h2>
            <span className="ai-generator__modal-subtitle">
              Étape 3 / 3 — Aperçu et téléchargement
            </span>
          </div>
          <div className="ai-generator__modal-header-actions">
            <button className="btn btn--outline btn--sm" onClick={handleDownloadPDF} title="Enregistrer en PDF">📄 PDF</button>
            <button className="btn btn--outline btn--sm" onClick={handleDownloadWord} title="Télécharger en Word">📝 Word</button>
            <button className="ai-generator__modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="ai-generator__modal-body">
          {/* Couverture miniature */}
          <div className="ebook-compiler__cover-preview">
            <span>📘</span>
            <div>
              <div className="ebook-compiler__cover-title">{titre}</div>
              {description && <div className="ebook-compiler__cover-desc">{description}</div>}
              <div className="ebook-compiler__cover-meta">
                {selection.length} chapitre{selection.length > 1 ? 's' : ''} · PedaClic
              </div>
            </div>
          </div>

          {/* Sommaire */}
          <div className="ebook-compiler__toc">
            <div className="ebook-compiler__toc-title">📋 Sommaire</div>
            <ol>
              {selection.map((item, i) => (
                <li key={item.id}>
                  <span>{i + 1}. {item.chapitre}</span>
                  <span className="ebook-compiler__toc-meta">{item.discipline} · {item.classe}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Sauvegarde */}
          {saved ? (
            <div className="ebook-compiler__success">
              ✅ Ebook sauvegardé avec succès dans votre bibliothèque IA !
            </div>
          ) : (
            <div className="ebook-compiler__save-row">
              <button
                className="btn btn--primary btn--lg"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <><span className="spinner spinner--sm"></span> Sauvegarde…</>
                ) : (
                  '💾 Sauvegarder dans PedaClic'
                )}
              </button>
              <p className="ebook-compiler__save-hint">
                L'ebook sera accessible depuis votre Bibliothèque.
              </p>
            </div>
          )}
          {error && <p className="ebook-compiler__error">{error}</p>}
        </div>

        <div className="ai-generator__modal-footer">
          <button className="btn btn--outline" onClick={() => setEtape('configure')}>← Modifier</button>
          <button className="btn btn--outline" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default EbookCompiler;

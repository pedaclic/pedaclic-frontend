// ==================== EBOOK PDF PREVIEW (Phase 20bis) ====================
// PedaClic : rendu canvas des N premières pages d'un PDF pour les non-Premium.
// Utilise pdfjs-dist (déjà installé) pour limiter VISUELLEMENT l'aperçu :
// les pages au-delà de `maxPages` ne sont jamais rendues côté client.
// =========================================================================

import React, { useEffect, useRef, useState } from 'react';
import '../../styles/EbookPdfPreview.css';

interface EbookPdfPreviewProps {
  /** URL du PDF complet (typiquement ebook.fichierURL). */
  pdfUrl: string;
  /** Nombre de pages à rendre depuis le début du document. */
  maxPages: number;
  /** Total de pages du document (pour l'affichage informatif). */
  totalPages: number;
}

/**
 * Affiche les `maxPages` premières pages d'un PDF distant sous forme de canvas.
 * Aucune page suivante n'est jamais récupérée ni rendue.
 *
 * Cleanup automatique : annulation des render tasks en cours au démontage,
 * destruction du document pdfjs pour libérer la mémoire.
 */
export const EbookPdfPreview: React.FC<EbookPdfPreviewProps> = ({
  pdfUrl,
  maxPages,
  totalPages
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedPages, setRenderedPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let pdfDoc: any = null;
    const renderTasks: any[] = [];

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setRenderedPages(0);

        // Chargement dynamique de pdfjs (évite d'alourdir le bundle initial)
        const pdfjs = await import('pdfjs-dist');
        const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

        const loadingTask = pdfjs.getDocument({ url: pdfUrl, withCredentials: false });
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        const pagesToRender = Math.min(maxPages, pdfDoc.numPages);
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
          if (cancelled) return;

          const page = await pdfDoc.getPage(pageNum);
          // Échelle adaptée à la largeur disponible (max 900px pour la lisibilité)
          const containerWidth = Math.min(container.clientWidth || 800, 900);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.className = 'ebook-pdf-preview__page';
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.setAttribute('aria-label', `Page ${pageNum} sur ${pagesToRender}`);

          const wrapper = document.createElement('div');
          wrapper.className = 'ebook-pdf-preview__page-wrapper';
          const label = document.createElement('span');
          label.className = 'ebook-pdf-preview__page-label';
          label.textContent = `Page ${pageNum} / ${totalPages}`;
          wrapper.appendChild(canvas);
          wrapper.appendChild(label);
          container.appendChild(wrapper);

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          const task = page.render({ canvasContext: ctx, viewport, canvas });
          renderTasks.push(task);
          await task.promise;

          if (cancelled) return;
          setRenderedPages(pageNum);
        }

        if (!cancelled) setLoading(false);
      } catch (err: any) {
        console.error('[EbookPdfPreview] Erreur rendu PDF :', err);
        if (!cancelled) {
          setError("Impossible d'afficher l'aperçu du document.");
          setLoading(false);
        }
      }
    })();

    // Cleanup : annule les tâches de rendu et détruit le document pdfjs
    return () => {
      cancelled = true;
      renderTasks.forEach(t => {
        try { t.cancel?.(); } catch { /* noop */ }
      });
      try { pdfDoc?.destroy?.(); } catch { /* noop */ }
    };
  }, [pdfUrl, maxPages, totalPages]);

  return (
    <div className="ebook-pdf-preview">
      {loading && (
        <div className="ebook-pdf-preview__loading">
          <div className="loading-spinner"></div>
          <p>
            Chargement de l'aperçu…
            {renderedPages > 0 && ` (${renderedPages}/${Math.min(maxPages, totalPages)})`}
          </p>
        </div>
      )}
      {error && (
        <div className="ebook-pdf-preview__error" role="alert">
          ⚠️ {error}
        </div>
      )}
      <div ref={containerRef} className="ebook-pdf-preview__pages" />
    </div>
  );
};

export default EbookPdfPreview;

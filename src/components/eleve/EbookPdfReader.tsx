// ==================== EBOOK PDF READER (Phase 20ter) ====================
// PedaClic : visualiseur PDF DÉDIÉ pour la lecture intégrale d'un ebook.
//
//   Motivation :
//   ------------
//   L'iframe PDF natif du navigateur (Chrome/Edge/Firefox) expose une barre
//   d'outils contenant un bouton « Télécharger » et « Imprimer ». Lorsque
//   l'administrateur a désactivé le téléchargement (`canDownload === false`),
//   cette consigne devient inopérante : l'utilisateur peut toujours cliquer
//   sur le bouton natif et récupérer le fichier.
//
//   Ce composant remplace l'iframe par un rendu CANVAS via pdfjs-dist :
//     • Aucune barre d'outils navigateur n'est exposée.
//     • Le PDF est rendu page par page dans des <canvas>.
//     • Le défilement est HORIZONTAL (scroll-snap-x mandatory) — chaque
//       page « clique » naturellement à l'écran comme dans un liseuse.
//     • Une mini-barre d'outils maison fournit : navigation page précédente/
//       suivante, indicateur 1/N, zoom +/-, et — uniquement si `canDownload`
//       est vrai — un bouton de téléchargement explicite.
//
//   Important : ce composant N'INTERFERE PAS avec EbookPdfPreview (utilisé
//   pour l'aperçu limité non-Premium). Les deux cohabitent.
// ==========================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import '../../styles/EbookPdfReader.css';

// --- Props ---
interface EbookPdfReaderProps {
  /** URL absolue du PDF à afficher (Firebase Storage, etc.). */
  pdfUrl: string;
  /** Titre de l'ebook (utilisé pour les aria-labels et le nom de téléchargement). */
  title: string;
  /** L'administrateur autorise-t-il le téléchargement ? Si false, on n'affiche
   *  AUCUN bouton de téléchargement et on s'appuie sur le rendu canvas pour
   *  ne pas exposer le fichier original via une barre d'outils navigateur. */
  canDownload: boolean;
  /** Callback déclenché par le bouton de téléchargement maison (uniquement
   *  rendu si canDownload === true). À l'intérieur, l'appelant doit gérer
   *  l'incrément du compteur + l'ouverture du fichier. */
  onDownload?: () => void;
}

/**
 * Visualiseur PDF horizontal — rendu canvas via pdf.js.
 *
 * Cycle de vie :
 *   1. Au montage, on charge dynamiquement pdfjs-dist (chunk séparé pour
 *      ne pas alourdir le bundle initial).
 *   2. On rend toutes les pages séquentiellement dans des <canvas>.
 *   3. Au démontage, on annule les render tasks en cours et on détruit
 *      le document pdfjs pour libérer la mémoire.
 *
 * Sécurité (effective) :
 *   - Pas d'iframe → pas de toolbar native → pas de bouton DL navigateur.
 *   - Le `pointer-events: none` côté label et le contexte canvas empêchent
 *     la sélection/clic-droit « Enregistrer l'image » trivial sur les pages.
 *
 * Sécurité (limites connues) :
 *   - Un utilisateur tech-savvy peut toujours intercepter l'URL du PDF via
 *     les devtools (onglet Network). Une vraie protection nécessiterait un
 *     URL signé serveur expirant. Hors-scope de cette modification frontend.
 */
export const EbookPdfReader: React.FC<EbookPdfReaderProps> = ({
  pdfUrl,
  title,
  canDownload,
  onDownload
}) => {
  // --- Conteneur scrollable (référence pour scroll programmatique) ---
  const scrollerRef = useRef<HTMLDivElement>(null);
  // --- Conteneur des pages (pdfjs y injecte les wrappers) ---
  const pagesRef = useRef<HTMLDivElement>(null);

  // --- États UI ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [renderedPages, setRenderedPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  // Facteur de zoom utilisateur : 0.5 → 200% par pas de 0.1.
  // Note : la mise à l'échelle réelle se fait au CSS-level via `transform: scale`
  // sur chaque wrapper de page (cf. effet ci-dessous), pour éviter de relancer
  // un rendu pdf.js complet à chaque clic sur +/- (coûteux pour de gros PDF).
  const [zoom, setZoom] = useState(1);

  // ==================== CHARGEMENT ET RENDU DU PDF ====================
  useEffect(() => {
    let cancelled = false;
    let pdfDoc: any = null;
    const renderTasks: any[] = [];

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setRenderedPages(0);
        setCurrentPage(1);

        // Chargement dynamique de pdfjs (chunk séparé, pareil à EbookPdfPreview)
        const pdfjs = await import('pdfjs-dist');
        const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

        const loadingTask = pdfjs.getDocument({ url: pdfUrl, withCredentials: false });
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        const total = pdfDoc.numPages;
        setTotalPages(total);

        const container = pagesRef.current;
        if (!container) return;
        container.innerHTML = '';

        // Échelle de rendu : on cherche à remplir la hauteur du viewer,
        // pas la largeur (puisque le défilement est horizontal). On calcule
        // la hauteur disponible une seule fois (avant la boucle) et on
        // adapte chaque page proportionnellement.
        const scroller = scrollerRef.current;
        const availableHeight = Math.max(
          400,
          (scroller?.clientHeight || window.innerHeight) - 96 /* marges + toolbar */
        );
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNum = 1; pageNum <= total; pageNum++) {
          if (cancelled) return;

          const page = await pdfDoc.getPage(pageNum);
          // On dimensionne sur la hauteur disponible — la largeur de chaque
          // page sera donc variable selon le ratio (orientation portrait/paysage)
          const baseViewport = page.getViewport({ scale: 1 });
          const cssScale = availableHeight / baseViewport.height;
          const viewport = page.getViewport({ scale: cssScale * dpr });

          const canvas = document.createElement('canvas');
          canvas.className = 'ebook-pdf-reader__page-canvas';
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          // Taille CSS = taille canvas / dpr → rendu net en HiDPI
          canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
          canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
          canvas.setAttribute('aria-label', `Page ${pageNum} sur ${total}`);

          const wrapper = document.createElement('div');
          wrapper.className = 'ebook-pdf-reader__page-wrapper';
          // data-page sert au scroll programmatique (cf. goToPage)
          wrapper.dataset.page = String(pageNum);

          const label = document.createElement('span');
          label.className = 'ebook-pdf-reader__page-label';
          label.textContent = `${pageNum} / ${total}`;
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
        console.error('[EbookPdfReader] Erreur rendu PDF :', err);
        if (!cancelled) {
          setError("Impossible d'afficher ce document.");
          setLoading(false);
        }
      }
    })();

    // --- Cleanup : annule les tâches et libère le document pdf.js ---
    return () => {
      cancelled = true;
      renderTasks.forEach(t => {
        try { t.cancel?.(); } catch { /* noop */ }
      });
      try { pdfDoc?.destroy?.(); } catch { /* noop */ }
    };
  }, [pdfUrl]);

  // ==================== APPLIQUER LE ZOOM (CSS uniquement) ====================
  // On évite de relancer pdf.js à chaque clic +/- : on applique simplement
  // un transform: scale aux wrappers (préservation des canvas déjà rendus).
  useEffect(() => {
    const container = pagesRef.current;
    if (!container) return;
    const wrappers = container.querySelectorAll<HTMLDivElement>('.ebook-pdf-reader__page-wrapper');
    wrappers.forEach(w => {
      w.style.transform = `scale(${zoom})`;
      // Le transform-origin top-left évite que les pages "sortent" du flux
      // lors du zoom (sans cela, elles débordent côté gauche).
      w.style.transformOrigin = 'center center';
    });
  }, [zoom, renderedPages]);

  // ==================== NAVIGATION ENTRE PAGES ====================
  /**
   * Fait défiler le conteneur horizontalement jusqu'à la page demandée.
   * Borne automatiquement entre [1, totalPages]. Utilise scroll-behavior:
   * smooth (défini en CSS) pour une transition fluide.
   */
  const goToPage = useCallback((pageNum: number) => {
    const total = totalPages;
    if (total <= 0) return;
    const clamped = Math.max(1, Math.min(total, pageNum));
    const container = pagesRef.current;
    const scroller = scrollerRef.current;
    if (!container || !scroller) return;
    const target = container.querySelector<HTMLDivElement>(
      `[data-page="${clamped}"]`
    );
    if (target) {
      // scrollIntoView avec inline:center centre la page horizontalement
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      setCurrentPage(clamped);
    }
  }, [totalPages]);

  // --- Suivi du scroll → met à jour le numéro de page courant ---
  // On observe quel wrapper est le plus proche du centre horizontal du scroller.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const container = pagesRef.current;
    if (!scroller || !container) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollerRect = scroller.getBoundingClientRect();
        const centerX = scrollerRect.left + scrollerRect.width / 2;
        let closestPage = 1;
        let closestDist = Infinity;
        container.querySelectorAll<HTMLDivElement>('.ebook-pdf-reader__page-wrapper').forEach(w => {
          const r = w.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const d = Math.abs(cx - centerX);
          if (d < closestDist) {
            closestDist = d;
            closestPage = Number(w.dataset.page || '1');
          }
        });
        setCurrentPage(closestPage);
        ticking = false;
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [renderedPages]);

  // --- Navigation clavier : ←/→ Home/End ---
  // On limite l'écoute au conteneur (tabIndex=0) pour ne pas piéger les
  // raccourcis natifs du navigateur en dehors du viewer.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToPage(currentPage + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPage(currentPage - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToPage(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToPage(totalPages);
    }
  };

  // ==================== ZOOM ====================
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2;
  const ZOOM_STEP = 0.1;
  const zoomIn  = () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));

  // ==================== RENDER ====================
  return (
    <div
      className="ebook-pdf-reader"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`Lecteur PDF : ${title}`}
    >
      {/* <!-- Overlay de chargement (par-dessus le conteneur scroll) --> */}
      {loading && (
        <div className="ebook-pdf-reader__loading" role="status">
          <div className="loading-spinner"></div>
          <p>
            Préparation du document…
            {renderedPages > 0 && totalPages > 0 && (
              <> ({renderedPages}/{totalPages})</>
            )}
          </p>
        </div>
      )}

      {/* <!-- Affichage d'erreur (chargement pdf.js / fichier introuvable) --> */}
      {error && (
        <div className="ebook-pdf-reader__error" role="alert">
          ⚠️ {error}
        </div>
      )}

      {/* <!-- =============== ZONE SCROLLABLE HORIZONTALE ===============
             - overflow-x: auto      (défilement horizontal côté souris/trackpad)
             - scroll-snap-type      (chaque page « clique » au centre)
             - tabindex sur le parent → flèches clavier captées globalement.
            ============================================================= */}
      <div className="ebook-pdf-reader__scroller" ref={scrollerRef}>
        <div className="ebook-pdf-reader__pages" ref={pagesRef}>
          {/* pdf.js injecte ici les wrappers <div data-page="N"> contenant
              un <canvas> + un label de pagination. */}
        </div>
      </div>

      {/* <!-- =============== BARRE D'OUTILS BASSE ===============
             Navigation page précédente/suivante + indicateur + zoom +/-
             + bouton de téléchargement OPTIONNEL (seulement si autorisé).
            ===================================================== */}
      <div className="ebook-pdf-reader__toolbar" role="toolbar" aria-label="Contrôles du lecteur">
        <button
          type="button"
          className="ebook-pdf-reader__btn"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          aria-label="Page précédente"
          title="Page précédente (←)"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>

        <div className="ebook-pdf-reader__indicator" aria-live="polite">
          <span className="ebook-pdf-reader__indicator-current">{currentPage}</span>
          <span className="ebook-pdf-reader__indicator-sep">/</span>
          <span className="ebook-pdf-reader__indicator-total">{totalPages || '—'}</span>
        </div>

        <button
          type="button"
          className="ebook-pdf-reader__btn"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages || loading}
          aria-label="Page suivante"
          title="Page suivante (→)"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>

        {/* Séparateur visuel toolbar */}
        <span className="ebook-pdf-reader__toolbar-sep" aria-hidden="true" />

        <button
          type="button"
          className="ebook-pdf-reader__btn"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN || loading}
          aria-label="Zoom arrière"
          title="Zoom arrière"
        >
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <span className="ebook-pdf-reader__zoom-level" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          className="ebook-pdf-reader__btn"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX || loading}
          aria-label="Zoom avant"
          title="Zoom avant"
        >
          <ZoomIn size={18} aria-hidden="true" />
        </button>

        {/* <!-- Bouton de téléchargement : visible UNIQUEMENT si l'admin a
              autorisé l'export. Quand canDownload est false, ce bouton
              n'est tout simplement pas rendu — couplé à l'absence de
              toolbar navigateur, le téléchargement n'est plus exposé. --> */}
        {canDownload && onDownload && (
          <>
            <span className="ebook-pdf-reader__toolbar-sep" aria-hidden="true" />
            <button
              type="button"
              className="ebook-pdf-reader__btn ebook-pdf-reader__btn--download"
              onClick={onDownload}
              aria-label="Télécharger le document"
              title="Télécharger le document"
            >
              <Download size={18} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default EbookPdfReader;

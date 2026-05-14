// ==================== EBOOK PDF READER (Phase 20ter — itération 3) ====================
// PedaClic : visualiseur PDF DÉDIÉ pour la lecture intégrale d'un ebook.
//
//   Évolutions itération 3 :
//   ------------------------
//   • Pages voisines NON VISIBLES sur les côtés. La précédente architecture
//     en flex-row + scroll-snap laissait apparaître des bouts des pages
//     adjacentes — supprimées. Désormais, seule la page active (ou la paire
//     active en mode spread) est affichée à l'écran.
//   • Animation de FEUILLETAGE entre les pages, à la manière du tournage
//     d'une page de livre physique (rotation 3D + translation, perspective
//     parente). L'animation est différente selon le sens (next/prev) et
//     respecte `prefers-reduced-motion: reduce`.
//
//   Conséquences architecturales :
//   ------------------------------
//   • La barre de défilement horizontale disparaît : la navigation se fait
//     exclusivement via les boutons prev/next, le clavier (← →) ou les
//     touches Home/End.
//   • Les pages restent rendues dans le DOM par pdf.js (canvas), mais elles
//     sont positionnées en `position: absolute` et masquées par défaut.
//     Une classe utilitaire (`.is-current`, `.is-leaving-*`, `.is-entering-*`)
//     gère leur visibilité et déclenche les animations CSS.
//   • Les pages voisines hors animation ne consomment ni espace visuel ni
//     opacité — elles sont strictement invisibles (visibility: hidden).
//
//   Sécurité (rappel) : pas d'iframe → pas de toolbar navigateur →
//   aucun bouton « Télécharger » natif n'est exposé.
// ======================================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download,
  Book, BookOpen
} from 'lucide-react';
import '../../styles/EbookPdfReader.css';

// --- Mode d'affichage ---
type DisplayMode = 'single' | 'spread';

// Direction du feuilletage en cours, null = aucune animation.
type FlipDirection = 'next' | 'prev' | null;

// Clé localStorage pour la persistance de la préférence utilisateur.
const LS_KEY_DISPLAY_MODE = 'pedaclic_ebook_reader_display_mode';

/**
 * Lit la préférence utilisateur avec fallback robuste.
 * Défaut : 'spread' (rend l'expérience plus proche d'un livre).
 */
const readPreferredMode = (): DisplayMode => {
  try {
    const v = localStorage.getItem(LS_KEY_DISPLAY_MODE);
    return v === 'single' || v === 'spread' ? v : 'spread';
  } catch {
    return 'spread';
  }
};

// Détecte si l'utilisateur a réclamé "reduce motion" (a11y).
// Si oui, on saute l'animation et on permute instantanément.
const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// Durée totale de l'animation de feuilletage en ms. DOIT correspondre au
// `animation-duration` défini dans EbookPdfReader.css (cf. les @keyframes
// `page-flip-leave-*` et `page-flip-enter-*`).
const FLIP_DURATION_MS = 620;

// --- Props ---
interface EbookPdfReaderProps {
  /** URL absolue du PDF à afficher. */
  pdfUrl: string;
  /** Titre de l'ebook (pour aria-labels). */
  title: string;
  /** Téléchargement autorisé par l'admin ? Si false, aucun bouton DL. */
  canDownload: boolean;
  /** Callback déclenché par le bouton de téléchargement maison. */
  onDownload?: () => void;
}

export const EbookPdfReader: React.FC<EbookPdfReaderProps> = ({
  pdfUrl,
  title,
  canDownload,
  onDownload
}) => {
  // --- Références DOM ---
  const stageRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  // Aspect ratios (width/height) de chaque page — utilisés par applyLayout.
  const pageAspectsRef = useRef<number[]>([]);

  // --- États UI ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [renderedPages, setRenderedPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(readPreferredMode());

  // --- Machine à états du feuilletage ---
  // `flipDir`     : sens de l'animation en cours (null = idle)
  // `pendingPage` : page cible une fois l'animation terminée
  const [flipDir, setFlipDir] = useState<FlipDirection>(null);
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  // Bornes de zoom
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2;
  const ZOOM_STEP = 0.1;

  // ==================== PERSISTENCE PRÉFÉRENCE ====================
  useEffect(() => {
    try { localStorage.setItem(LS_KEY_DISPLAY_MODE, displayMode); }
    catch { /* navigation privée : la préf restera RAM-only */ }
  }, [displayMode]);

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
        setFlipDir(null);
        setPendingPage(null);
        pageAspectsRef.current = [];

        const pdfjs = await import('pdfjs-dist');
        const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

        const loadingTask = pdfjs.getDocument({ url: pdfUrl, withCredentials: false });
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        const total = pdfDoc.numPages;
        setTotalPages(total);

        const container = pagesRef.current;
        const stage = stageRef.current;
        if (!container || !stage) return;
        container.innerHTML = '';

        // Résolution de rendu (équilibre qualité/RAM, cf. itération 2)
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const RENDER_BUFFER = 1.5;
        const RENDER_HEIGHT_CAP = 1800;
        const baseAvailableHeight = Math.max(400, stage.clientHeight - 32);
        const targetRenderHeight = Math.min(
          baseAvailableHeight * RENDER_BUFFER * dpr,
          RENDER_HEIGHT_CAP
        );

        for (let pageNum = 1; pageNum <= total; pageNum++) {
          if (cancelled) return;

          const page = await pdfDoc.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          pageAspectsRef.current[pageNum - 1] =
            baseViewport.width / baseViewport.height;

          const renderScale = targetRenderHeight / baseViewport.height;
          const viewport = page.getViewport({ scale: renderScale });

          const canvas = document.createElement('canvas');
          canvas.className = 'ebook-pdf-reader__page-canvas';
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.setAttribute('aria-label', `Page ${pageNum} sur ${total}`);

          const wrapper = document.createElement('div');
          wrapper.className = 'ebook-pdf-reader__page-wrapper';
          wrapper.dataset.page = String(pageNum);
          wrapper.dataset.parity = pageNum % 2 === 1 ? 'odd' : 'even';

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

    return () => {
      cancelled = true;
      renderTasks.forEach(t => {
        try { t.cancel?.(); } catch { /* noop */ }
      });
      try { pdfDoc?.destroy?.(); } catch { /* noop */ }
    };
  }, [pdfUrl]);

  // ==================== APPLY LAYOUT (mode + zoom → CSS canvas) ====================
  /**
   * Calcule et applique la TAILLE CSS de chaque canvas selon mode + zoom.
   * Inchangé en principe par rapport à l'itération 2 : ce sont toujours
   * les dimensions CSS du <canvas> qui pilotent la taille visible des
   * pages (et donc résolvent le bug de chevauchement au zoom).
   */
  const applyLayout = useCallback(() => {
    const stage = stageRef.current;
    const container = pagesRef.current;
    if (!stage || !container) return;
    const aspects = pageAspectsRef.current;
    if (aspects.length === 0) return;

    const availH = Math.max(300, stage.clientHeight - 32);
    const availW = Math.max(300, stage.clientWidth);
    const primaryAspect = aspects[0];

    // Cadrage : la page (ou la paire) doit tenir DANS le stage en largeur
    // ET en hauteur. On laisse un petit chrome (≈5%) pour respirer.
    const SINGLE_WIDTH_RATIO = 0.92;
    const SPREAD_WIDTH_RATIO = 0.96;
    const SPREAD_SPINE_GAP = 4;
    let baseHeight: number;
    if (displayMode === 'single') {
      const maxW = availW * SINGLE_WIDTH_RATIO;
      baseHeight = Math.min(availH, maxW / primaryAspect);
    } else {
      const maxWPerPage = (availW * SPREAD_WIDTH_RATIO - SPREAD_SPINE_GAP) / 2;
      baseHeight = Math.min(availH, maxWPerPage / primaryAspect);
    }

    const finalHeight = baseHeight * zoom;

    container
      .querySelectorAll<HTMLDivElement>('.ebook-pdf-reader__page-wrapper')
      .forEach(wrapper => {
        const idx = Number(wrapper.dataset.page || '1') - 1;
        const aspect = aspects[idx] ?? primaryAspect;
        const canvas = wrapper.querySelector<HTMLCanvasElement>(
          '.ebook-pdf-reader__page-canvas'
        );
        if (!canvas) return;
        const w = finalHeight * aspect;
        canvas.style.height = `${finalHeight}px`;
        canvas.style.width = `${w}px`;
      });
  }, [displayMode, zoom]);

  useEffect(() => { applyLayout(); }, [applyLayout, renderedPages]);
  useEffect(() => {
    const onResize = () => applyLayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyLayout]);

  // ==================== GESTION DES CLASSES DE PAGE ====================
  /**
   * Pour chaque wrapper de page dans le DOM, applique l'une des classes :
   *   - `is-current`        : page (ou page de la paire) actuellement
   *                           affichée, hors animation.
   *   - `is-leaving-next`   : page qui sort vers la GAUCHE (animation
   *                           de tournage avant).
   *   - `is-leaving-prev`   : page qui sort vers la DROITE (avant).
   *   - `is-entering-next`  : page qui arrive depuis la droite (next).
   *   - `is-entering-prev`  : page qui arrive depuis la gauche (prev).
   *   - aucune              : page invisible (visibility: hidden via CSS).
   *
   * Les pages qui composent une PAIRE en mode spread reçoivent toutes
   * la même classe d'état (les deux sortent ensemble, les deux arrivent
   * ensemble) — l'effet visuel rappelle le tournage d'un diptyque.
   */
  useEffect(() => {
    const container = pagesRef.current;
    if (!container) return;

    // Pages actives (avant ou pendant animation, peu importe → c'est la base).
    const activePages =
      displayMode === 'spread'
        ? [currentPage, currentPage + 1]
        : [currentPage];
    const filteredActive = activePages.filter(p => p >= 1 && p <= totalPages);

    // Pages entrantes (cible du flip), uniquement quand on anime.
    let enteringPages: number[] = [];
    if (flipDir && pendingPage !== null) {
      enteringPages =
        displayMode === 'spread'
          ? [pendingPage, pendingPage + 1]
          : [pendingPage];
      enteringPages = enteringPages.filter(p => p >= 1 && p <= totalPages);
    }

    const allClasses = [
      'is-current',
      'is-leaving-next', 'is-leaving-prev',
      'is-entering-next', 'is-entering-prev'
    ];

    container
      .querySelectorAll<HTMLDivElement>('.ebook-pdf-reader__page-wrapper')
      .forEach(w => {
        const pageNum = Number(w.dataset.page || '0');
        // Reset toutes les classes d'état d'abord.
        w.classList.remove(...allClasses);

        if (flipDir === null) {
          // Repos : seules les pages actives sont visibles.
          if (filteredActive.includes(pageNum)) w.classList.add('is-current');
          return;
        }
        // Animation en cours.
        if (filteredActive.includes(pageNum)) {
          w.classList.add(flipDir === 'next' ? 'is-leaving-next' : 'is-leaving-prev');
        } else if (enteringPages.includes(pageNum)) {
          w.classList.add(flipDir === 'next' ? 'is-entering-next' : 'is-entering-prev');
        }
      });
  }, [currentPage, displayMode, totalPages, flipDir, pendingPage, renderedPages]);

  // ==================== COMMIT FIN D'ANIMATION ====================
  // Après FLIP_DURATION_MS, on bascule officiellement sur la page cible
  // et on remet le système en idle.
  useEffect(() => {
    if (flipDir === null) return;
    const t = window.setTimeout(() => {
      if (pendingPage !== null) setCurrentPage(pendingPage);
      setFlipDir(null);
      setPendingPage(null);
    }, FLIP_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [flipDir, pendingPage]);

  // ==================== NAVIGATION ====================
  /**
   * Déclenche le feuilletage vers `pageNum`. Normalise la cible :
   *  - bornée dans [1, totalPages]
   *  - en mode spread, ramène à l'impair (début de la paire).
   * Si une animation est déjà en cours, l'appel est ignoré (anti-spam clic).
   * Si l'utilisateur a `prefers-reduced-motion: reduce`, on bascule
   * immédiatement (pas d'animation).
   */
  const goToPage = useCallback((pageNum: number) => {
    if (flipDir !== null) return;
    if (totalPages <= 0) return;

    let target = Math.max(1, Math.min(totalPages, pageNum));
    if (displayMode === 'spread' && target % 2 === 0) target -= 1;
    if (target === currentPage) return;

    const direction: FlipDirection = target > currentPage ? 'next' : 'prev';

    if (prefersReducedMotion()) {
      // Pas d'animation : bascule directe.
      setCurrentPage(target);
      return;
    }

    setPendingPage(target);
    setFlipDir(direction);
  }, [currentPage, displayMode, totalPages, flipDir]);

  // Pas/step de navigation selon le mode (single = 1 page, spread = 2)
  const navStep = displayMode === 'spread' ? 2 : 1;
  const goPrev = () => goToPage(currentPage - navStep);
  const goNext = () => goToPage(currentPage + navStep);
  const zoomIn  = () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));

  // --- Navigation clavier (← → Home End) ---
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Pendant une animation, on ignore les touches pour éviter les conflits.
    if (flipDir !== null) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
      }
      return;
    }
    const step = navStep;
    if (e.key === 'ArrowRight') { e.preventDefault(); goToPage(currentPage + step); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goToPage(currentPage - step); }
    else if (e.key === 'Home') { e.preventDefault(); goToPage(1); }
    else if (e.key === 'End')  { e.preventDefault(); goToPage(totalPages); }
  };

  // --- Indicateur de page ---
  const renderIndicator = (): React.ReactNode => {
    if (totalPages <= 0) return <>—</>;
    if (displayMode === 'single') {
      return (
        <>
          <span className="ebook-pdf-reader__indicator-current">{currentPage}</span>
          <span className="ebook-pdf-reader__indicator-sep">/</span>
          <span className="ebook-pdf-reader__indicator-total">{totalPages}</span>
        </>
      );
    }
    const left = currentPage;
    const right = left + 1 <= totalPages ? left + 1 : null;
    return (
      <>
        <span className="ebook-pdf-reader__indicator-current">
          {right ? `${left}–${right}` : `${left}`}
        </span>
        <span className="ebook-pdf-reader__indicator-sep">/</span>
        <span className="ebook-pdf-reader__indicator-total">{totalPages}</span>
      </>
    );
  };

  // ==================== RENDER ====================
  // Les boutons sont désactivés pendant l'animation (anti-spam) et quand on
  // est en bordure du document.
  const isAnimating = flipDir !== null;
  const cannotGoPrev = isAnimating || loading || currentPage <= 1;
  const cannotGoNext = isAnimating || loading || currentPage + navStep > totalPages;

  return (
    <div
      className={`ebook-pdf-reader mode-${displayMode}${isAnimating ? ' is-flipping' : ''}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`Lecteur PDF : ${title}`}
    >
      {/* <!-- Overlay de chargement --> */}
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

      {/* <!-- Affichage d'erreur --> */}
      {error && (
        <div className="ebook-pdf-reader__error" role="alert">
          ⚠️ {error}
        </div>
      )}

      {/* <!-- =============== STAGE D'ANIMATION ===============
             - position: relative, overflow: hidden, perspective.
             - Les wrappers de page sont positionnés en absolu, centrés.
             - Seuls les wrappers porteurs d'une classe `.is-*` sont
               visibles ; les autres restent en visibility: hidden.
             ===================================================== */}
      <div className="ebook-pdf-reader__scroller" ref={stageRef}>
        <div className="ebook-pdf-reader__pages" ref={pagesRef}>
          {/* pdf.js injecte ici les wrappers <div data-page="N" data-parity="odd|even">
              contenant un <canvas> + un label de pagination. */}
        </div>
      </div>

      {/* <!-- =============== TOOLBAR (inchangée) =============== --> */}
      <div className="ebook-pdf-reader__toolbar" role="toolbar" aria-label="Contrôles du lecteur">

        {/* Toggle 1 page / 2 pages */}
        <div className="ebook-pdf-reader__mode-group" role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            className={`ebook-pdf-reader__btn ebook-pdf-reader__btn--mode ${displayMode === 'single' ? 'is-active' : ''}`}
            onClick={() => setDisplayMode('single')}
            disabled={isAnimating}
            aria-pressed={displayMode === 'single'}
            aria-label="Affichage 1 page"
            title="Affichage 1 page"
          >
            <Book size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`ebook-pdf-reader__btn ebook-pdf-reader__btn--mode ${displayMode === 'spread' ? 'is-active' : ''}`}
            onClick={() => setDisplayMode('spread')}
            disabled={isAnimating}
            aria-pressed={displayMode === 'spread'}
            aria-label="Affichage 2 pages (livre)"
            title="Affichage 2 pages (livre ouvert)"
          >
            <BookOpen size={18} aria-hidden="true" />
          </button>
        </div>

        <span className="ebook-pdf-reader__toolbar-sep" aria-hidden="true" />

        {/* Navigation page précédente / suivante */}
        <button
          type="button"
          className="ebook-pdf-reader__btn"
          onClick={goPrev}
          disabled={cannotGoPrev}
          aria-label={displayMode === 'spread' ? 'Paire précédente' : 'Page précédente'}
          title={displayMode === 'spread' ? 'Paire précédente (←)' : 'Page précédente (←)'}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>

        <div className="ebook-pdf-reader__indicator" aria-live="polite">
          {renderIndicator()}
        </div>

        <button
          type="button"
          className="ebook-pdf-reader__btn"
          onClick={goNext}
          disabled={cannotGoNext}
          aria-label={displayMode === 'spread' ? 'Paire suivante' : 'Page suivante'}
          title={displayMode === 'spread' ? 'Paire suivante (→)' : 'Page suivante (→)'}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>

        <span className="ebook-pdf-reader__toolbar-sep" aria-hidden="true" />

        {/* Zoom +/- */}
        <button
          type="button"
          className="ebook-pdf-reader__btn"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN || loading || isAnimating}
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
          disabled={zoom >= ZOOM_MAX || loading || isAnimating}
          aria-label="Zoom avant"
          title="Zoom avant"
        >
          <ZoomIn size={18} aria-hidden="true" />
        </button>

        {/* Téléchargement conditionnel (canDownload + onDownload fournis) */}
        {canDownload && onDownload && (
          <>
            <span className="ebook-pdf-reader__toolbar-sep" aria-hidden="true" />
            <button
              type="button"
              className="ebook-pdf-reader__btn ebook-pdf-reader__btn--download"
              onClick={onDownload}
              disabled={isAnimating}
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

// ==================== EBOOK PDF READER (Phase 20ter) ====================
// PedaClic : visualiseur PDF DÉDIÉ pour la lecture intégrale d'un ebook.
//
//   Évolutions phase 20ter — itération 2 :
//   --------------------------------------
//   • Mode d'affichage utilisateur : 1 page ou 2 pages côte à côte
//     (mode « livre ouvert »). Le choix est persistant via localStorage.
//   • Correction du zoom : on n'utilise plus `transform: scale()` (qui
//     n'allouait pas d'espace de mise en page et causait le chevauchement
//     visible dans la capture utilisateur). À la place, on redimensionne
//     directement la TAILLE CSS du <canvas> — le flex container réalloue
//     alors correctement l'espace, plus aucun chevauchement.
//   • Le rendu pdf.js se fait UNE FOIS à haute résolution (supporte jusqu'à
//     2× de zoom sans pixellisation). Les changements de mode/zoom ne
//     déclenchent plus de re-rendu, seulement une ré-application CSS.
//   • En mode spread : scroll-snap aligné sur les paires, navigation
//     prev/next par incréments de 2, indicateur « X-Y / total ».
//
//   Motivation (rappel) :
//   ---------------------
//   L'iframe PDF natif (Chrome/Edge/Firefox) exposait une toolbar avec un
//   bouton « Télécharger » qui contournait la consigne d'admin canDownload.
//   En rendant via canvas, plus aucune toolbar navigateur n'est exposée.
// ==========================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download,
  Book, BookOpen
} from 'lucide-react';
import '../../styles/EbookPdfReader.css';

// --- Mode d'affichage ---
type DisplayMode = 'single' | 'spread';

// Clé localStorage pour la persistance de la préférence utilisateur.
// Préfixe « pedaclic_ » pour éviter tout conflit avec d'autres clés.
const LS_KEY_DISPLAY_MODE = 'pedaclic_ebook_reader_display_mode';

/**
 * Lit la préférence utilisateur dans localStorage avec fallback robuste :
 *   - 'spread' par défaut (rend l'expérience plus proche d'un livre)
 *   - retourne 'spread' aussi en cas d'erreur (navigation privée stricte, etc.)
 */
const readPreferredMode = (): DisplayMode => {
  try {
    const v = localStorage.getItem(LS_KEY_DISPLAY_MODE);
    return v === 'single' || v === 'spread' ? v : 'spread';
  } catch {
    return 'spread';
  }
};

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
 * Architecture interne :
 *   1. Chargement dynamique de pdfjs-dist au montage.
 *   2. Rendu de chaque page dans un <canvas> à une résolution « max »
 *      (suffisante pour un zoom 2×). Les dimensions PIXEL du canvas sont
 *      figées après ce rendu ; seules ses dimensions CSS varient ensuite.
 *   3. Une fonction `applyLayout` calcule la taille CSS de chaque canvas
 *      selon le mode (single/spread) et le zoom, puis l'applique.
 *      Elle s'exécute quand mode/zoom/nb de pages rendues changent.
 *
 * Sécurité (effective) : pas d'iframe → pas de toolbar navigateur → pas
 * de bouton de téléchargement natif. La règle admin `canDownload` est
 * réellement respectée.
 *
 * Sécurité (limite) : un utilisateur tech-savvy peut toujours intercepter
 * l'URL via les devtools (onglet Network). Une vraie protection nécessite
 * un URL signé côté serveur — hors-scope de cette modification frontend.
 */
export const EbookPdfReader: React.FC<EbookPdfReaderProps> = ({
  pdfUrl,
  title,
  canDownload,
  onDownload
}) => {
  // --- Références DOM ---
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  // Aspect ratios (width/height) de chaque page — utilisés par applyLayout
  // pour recalculer les dimensions CSS sans relire pdf.js.
  const pageAspectsRef = useRef<number[]>([]);

  // --- États UI ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [renderedPages, setRenderedPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(readPreferredMode());

  // Bornes de zoom — exposées en haut pour relecture rapide
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2;
  const ZOOM_STEP = 0.1;

  // ==================== PERSISTENCE DE LA PRÉFÉRENCE ====================
  // À chaque changement de mode, on enregistre. Try/catch pour navigation
  // privée stricte où localStorage peut lancer.
  useEffect(() => {
    try { localStorage.setItem(LS_KEY_DISPLAY_MODE, displayMode); }
    catch { /* navigation privée — pas grave, la préf restera RAM-only */ }
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
        pageAspectsRef.current = [];

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
        const scroller = scrollerRef.current;
        if (!container || !scroller) return;
        container.innerHTML = '';

        // Résolution de rendu (canvas pixels) — équilibre qualité/mémoire :
        //   • dpr plafonné à 1.5 (au-delà, gain visuel marginal mais coût en
        //     RAM quadratique → risque d'OOM sur PDF de 30+ pages).
        //   • RENDER_BUFFER = 1.5 : le zoom utilisateur reste net jusqu'à
        //     ~1.5× ; au-delà (jusqu'à 2× max) l'image est très légèrement
        //     adoucie mais reste tout à fait lisible.
        //   • Plafond dur sur la hauteur de canvas pour éviter les pics
        //     mémoire sur très grand écran (4K, écrans verticaux).
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const RENDER_BUFFER = 1.5;
        const RENDER_HEIGHT_CAP = 1800; // pixels
        const baseAvailableHeight = Math.max(
          400,
          scroller.clientHeight - 96
        );
        const targetRenderHeight = Math.min(
          baseAvailableHeight * RENDER_BUFFER * dpr,
          RENDER_HEIGHT_CAP
        );

        for (let pageNum = 1; pageNum <= total; pageNum++) {
          if (cancelled) return;

          const page = await pdfDoc.getPage(pageNum);
          const baseViewport = page.getViewport({ scale: 1 });
          // Stockage du ratio aspect pour applyLayout
          pageAspectsRef.current[pageNum - 1] =
            baseViewport.width / baseViewport.height;

          // Échelle de rendu suffisante pour 2× zoom
          const renderScale = targetRenderHeight / baseViewport.height;
          const viewport = page.getViewport({ scale: renderScale });

          const canvas = document.createElement('canvas');
          canvas.className = 'ebook-pdf-reader__page-canvas';
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          // Note : on N'AFFECTE PLUS style.width/height ici. C'est applyLayout
          // qui pilotera la taille CSS selon le mode et le zoom.
          canvas.setAttribute('aria-label', `Page ${pageNum} sur ${total}`);

          const wrapper = document.createElement('div');
          wrapper.className = 'ebook-pdf-reader__page-wrapper';
          // data-page sert au scroll programmatique et à la détection visuelle.
          wrapper.dataset.page = String(pageNum);
          // parity : impair (odd) ou pair (even) — utilisé par le CSS en mode
          // spread pour mettre une ombre « reliure » du bon côté.
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

    // --- Cleanup : annule les tâches et libère le document pdf.js ---
    return () => {
      cancelled = true;
      renderTasks.forEach(t => {
        try { t.cancel?.(); } catch { /* noop */ }
      });
      try { pdfDoc?.destroy?.(); } catch { /* noop */ }
    };
  }, [pdfUrl]);

  // ==================== APPLY LAYOUT (mode + zoom → CSS) ====================
  /**
   * Calcule et applique la TAILLE CSS de chaque canvas selon :
   *  - le mode d'affichage (1 ou 2 pages visibles à la fois)
   *  - le facteur de zoom utilisateur
   *  - la taille réelle du viewer (clientWidth / clientHeight)
   *
   * Cette approche remplace l'ancien `transform: scale(zoom)` sur le wrapper
   * — qui ne réservait pas d'espace dans le flex container et provoquait le
   * chevauchement visible des pages au zoom. En passant par width/height CSS,
   * le flex layout réalloue l'espace correctement et les pages restent
   * strictement disjointes quel que soit le zoom.
   */
  const applyLayout = useCallback(() => {
    const scroller = scrollerRef.current;
    const container = pagesRef.current;
    if (!scroller || !container) return;
    const aspects = pageAspectsRef.current;
    if (aspects.length === 0) return;

    const availH = Math.max(300, scroller.clientHeight - 48);
    const availW = Math.max(300, scroller.clientWidth);

    // On se base sur l'aspect de la 1ʳᵉ page (PDF homogènes en pratique).
    // Pour les rares documents à pages mixtes, chaque canvas est redimensionné
    // avec son propre aspect (voir boucle finale).
    const primaryAspect = aspects[0];

    // Hauteur CSS de base à zoom = 1, selon le mode :
    //   - single : 1 page tient en largeur (≤ 90% de availW) ET en hauteur.
    //   - spread : 2 pages tiennent côte à côte (≤ availW/2 - pli chacune).
    //     Le « pli » effectif entre les deux pages d'un diptyque est de
    //     4 px (gap CSS 24 px corrigé par margin-left: -20 px sur la page
    //     paire) → on en tient compte ici pour dimensionner correctement.
    const SINGLE_WIDTH_RATIO = 0.9;
    const SPREAD_WIDTH_RATIO = 0.95;
    const SPREAD_SPINE_GAP = 4; // = 24 (gap CSS) - 20 (margin-left négative)
    let baseHeight: number;
    if (displayMode === 'single') {
      const maxW = availW * SINGLE_WIDTH_RATIO;
      baseHeight = Math.min(availH, maxW / primaryAspect);
    } else {
      const maxWPerPage = (availW * SPREAD_WIDTH_RATIO - SPREAD_SPINE_GAP) / 2;
      baseHeight = Math.min(availH, maxWPerPage / primaryAspect);
    }

    const finalHeight = baseHeight * zoom;

    // Application aux canvases déjà rendus.
    // Pour chaque page, on respecte son propre aspect (pas seulement primary).
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

  // Recalcul du layout quand mode/zoom changent OU qu'une nouvelle page
  // est rendue (renderedPages). Aussi sur resize de la fenêtre.
  useEffect(() => {
    applyLayout();
  }, [applyLayout, renderedPages]);

  useEffect(() => {
    const onResize = () => applyLayout();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyLayout]);

  // ==================== NAVIGATION ENTRE PAGES ====================
  /**
   * Fait défiler le conteneur horizontalement jusqu'à la page demandée.
   * Deux logiques distinctes selon le mode :
   *   • single : on centre la page demandée dans le viewer.
   *   • spread : on aligne le BORD DROIT de la page impaire (= le pli
   *     central du livre) sur le centre du viewer. Le diptyque entier
   *     se retrouve ainsi parfaitement centré dans le scroller.
   */
  const goToPage = useCallback((pageNum: number) => {
    const total = totalPages;
    if (total <= 0) return;
    let target = Math.max(1, Math.min(total, pageNum));
    if (displayMode === 'spread' && target % 2 === 0) target -= 1;

    const scroller = scrollerRef.current;
    const container = pagesRef.current;
    if (!scroller || !container) return;
    const wrapper = container.querySelector<HTMLDivElement>(
      `[data-page="${target}"]`
    );
    if (!wrapper) return;

    if (displayMode === 'spread') {
      // Le pli (bord droit de la page impaire) doit atterrir au centre.
      // offsetLeft + offsetWidth donne la position absolue du bord droit
      // dans le repère du conteneur de pages.
      const wrapperRight = wrapper.offsetLeft + wrapper.offsetWidth;
      const targetScrollLeft = wrapperRight - scroller.clientWidth / 2;
      scroller.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    } else {
      // Mode single : centrage classique.
      wrapper.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
    setCurrentPage(target);
  }, [totalPages, displayMode]);

  // --- Suivi du scroll → met à jour le numéro de page courant ---
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
        container
          .querySelectorAll<HTMLDivElement>('.ebook-pdf-reader__page-wrapper')
          .forEach(w => {
            const r = w.getBoundingClientRect();
            // En spread, on mesure la proximité du BORD DROIT (= pli)
            // de la page impaire au centre du viewport. En single, on
            // mesure le centre de la page (comportement classique).
            const parity = w.dataset.parity;
            const probeX =
              displayMode === 'spread' && parity === 'odd'
                ? r.right
                : r.left + r.width / 2;
            const d = Math.abs(probeX - centerX);
            if (d < closestDist) {
              closestDist = d;
              closestPage = Number(w.dataset.page || '1');
            }
          });
        // En spread, l'état courant doit pointer sur l'impaire de la paire.
        if (displayMode === 'spread' && closestPage % 2 === 0) closestPage -= 1;
        setCurrentPage(closestPage);
        ticking = false;
      });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [renderedPages, displayMode]);

  // --- Navigation clavier : ←/→ Home/End, pas adapté au mode ---
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = displayMode === 'spread' ? 2 : 1;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToPage(currentPage + step);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPage(currentPage - step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goToPage(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      goToPage(totalPages);
    }
  };

  // ==================== ACTIONS TOOLBAR ====================
  const navStep = displayMode === 'spread' ? 2 : 1;
  const goPrev = () => goToPage(currentPage - navStep);
  const goNext = () => goToPage(currentPage + navStep);
  const zoomIn  = () => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));

  // --- Indicateur de page ---
  // En spread, on affiche « 1-2 / 6 » (ou « 5 / 6 » pour la dernière page
  // impaire orpheline). En single, simplement « 3 / 6 ».
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
  return (
    <div
      className={`ebook-pdf-reader mode-${displayMode}`}
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
          {/* pdf.js injecte ici les wrappers <div data-page="N" data-parity="odd|even">
              contenant un <canvas> + un label de pagination. */}
        </div>
      </div>

      {/* <!-- =============== BARRE D'OUTILS BASSE ===============
             Toggle mode 1/2 pages + navigation page précédente/suivante +
             indicateur + zoom +/- + bouton de téléchargement OPTIONNEL.
            ===================================================== */}
      <div className="ebook-pdf-reader__toolbar" role="toolbar" aria-label="Contrôles du lecteur">

        {/* --- Toggle MODE : 1 page / 2 pages ---
              Pattern segmented : le bouton actif est mis en évidence.
              L'utilisateur clique sur celui qu'il SOUHAITE (pas sur l'opposé)
              — c'est plus prévisible que le pattern « bouton montre l'autre mode ». */}
        <div className="ebook-pdf-reader__mode-group" role="group" aria-label="Mode d'affichage">
          <button
            type="button"
            className={`ebook-pdf-reader__btn ebook-pdf-reader__btn--mode ${displayMode === 'single' ? 'is-active' : ''}`}
            onClick={() => setDisplayMode('single')}
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
            aria-pressed={displayMode === 'spread'}
            aria-label="Affichage 2 pages (livre)"
            title="Affichage 2 pages (livre ouvert)"
          >
            <BookOpen size={18} aria-hidden="true" />
          </button>
        </div>

        <span className="ebook-pdf-reader__toolbar-sep" aria-hidden="true" />

        {/* --- Navigation entre pages --- */}
        <button
          type="button"
          className="ebook-pdf-reader__btn"
          onClick={goPrev}
          disabled={currentPage <= 1 || loading}
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
          disabled={currentPage + navStep > totalPages || loading}
          aria-label={displayMode === 'spread' ? 'Paire suivante' : 'Page suivante'}
          title={displayMode === 'spread' ? 'Paire suivante (→)' : 'Page suivante (→)'}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>

        <span className="ebook-pdf-reader__toolbar-sep" aria-hidden="true" />

        {/* --- Zoom +/- --- */}
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

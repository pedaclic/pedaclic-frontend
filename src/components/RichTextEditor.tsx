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
//   - Retrait : Augmenter / Diminuer (Tab / Shift+Tab) hors tableau
//   - Couleur du texte
//   - Insertion de tableau configurable
//   - Historique : Annuler / Rétablir
// ------------------------------------------------------------
// Phase 38 — Améliorations Tableau :
//   - Poignées de redimensionnement (drag) sur les bordures de colonne
//   - Navigation cellule à cellule par Tabulation (Tab / Shift+Tab)
//   - Tab sur la dernière cellule crée automatiquement une nouvelle ligne
//   - Bouton dédié « + Colonne fin » dans la barre contextuelle
//     (en plus des actions « avant / après » existantes)
//   - Raccourcis clavier : Ctrl+Alt+→ ajoute une colonne à droite,
//     Ctrl+Alt+↓ ajoute une ligne en-dessous
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

/** Polices disponibles (PedaClic — lisibles et professionnelles) */
const POLICES_DISPONIBLES: { valeur: string; label: string }[] = [
  { valeur: 'inherit', label: 'Par défaut' },
  { valeur: 'Georgia', label: 'Georgia' },
  { valeur: 'Times New Roman', label: 'Times New Roman' },
  { valeur: 'Arial', label: 'Arial' },
  { valeur: 'Helvetica', label: 'Helvetica' },
  { valeur: 'Verdana', label: 'Verdana' },
  { valeur: 'Trebuchet MS', label: 'Trebuchet MS' },
  { valeur: 'Courier New', label: 'Courier New' },
];

/** Teintes de surlignage (arrière-plan du texte) */
const HIGHLIGHT_COLORS = [
  '#fef08a', '#fde68a', '#fef3c7', '#bbf7d0', '#d1fae5',
  '#bfdbfe', '#dbeafe', '#fecaca', '#fee2e2', '#e9d5ff',
  '#f3e8ff', '#fed7aa', '#ffedd5', 'transparent',
];

/** Tailles de police disponibles (valeurs 1-7 pour execCommand fontSize) */
const TAILLES_POLICE: { valeur: string; label: string }[] = [
  { valeur: '1', label: 'Très petit' },
  { valeur: '2', label: 'Petit' },
  { valeur: '3', label: 'Normal' },
  { valeur: '4', label: 'Moyen' },
  { valeur: '5', label: 'Grand' },
  { valeur: '6', label: 'Très grand' },
  { valeur: '7', label: 'Énorme' },
];

// ─────────────────────────────────────────────────────────────
// ICÔNES SVG INLINE (16×16, stroke-based, cohérentes)
// ─────────────────────────────────────────────────────────────

const s = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const Ico = {
  undo:       <svg {...s}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
  redo:       <svg {...s}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>,
  bold:       <svg {...s}><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>,
  italic:     <svg {...s}><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>,
  underline:  <svg {...s}><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>,
  strike:     <svg {...s}><path d="M16 4c-.5-1.5-2.2-2-4-2-3 0-4 1.5-4 3 0 .7.2 1.3.5 1.8"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M17.5 14.5C17.5 17 15.5 19 12 19c-2 0-3.5-.8-4-2"/></svg>,
  sub:        <svg {...s}><path d="M4 5l8 10"/><path d="M12 5L4 15"/><path d="M20 19h-4c0-1.5.4-2 1.2-2.7.8-.6 1.8-1 1.8-2.3a1.7 1.7 0 0 0-3.3-.4"/></svg>,
  sup:        <svg {...s}><path d="M4 19l8-10"/><path d="M12 19L4 9"/><path d="M20 9h-4c0-1.5.4-2 1.2-2.7C18 5.6 19 5 19 3.7a1.7 1.7 0 0 0-3.3-.4"/></svg>,
  alLeft:     <svg {...s}><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>,
  alCenter:   <svg {...s}><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="18" y1="14" x2="6" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>,
  alRight:    <svg {...s}><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="7" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>,
  alJustify:  <svg {...s}><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>,
  indentPlus: <svg {...s}><line x1="21" y1="14" x2="11" y2="14"/><line x1="21" y1="18" x2="11" y2="18"/><line x1="21" y1="10" x2="11" y2="10"/><line x1="21" y1="6" x2="11" y2="6"/><polyline points="3 8 7 12 3 16"/></svg>,
  indentMinus:<svg {...s}><line x1="21" y1="14" x2="11" y2="14"/><line x1="21" y1="18" x2="11" y2="18"/><line x1="21" y1="10" x2="11" y2="10"/><line x1="21" y1="6" x2="11" y2="6"/><polyline points="7 8 3 12 7 16"/></svg>,
  link:       <svg {...s}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>,
  unlink:     <svg {...s}><path d="M18.8 13l1.7-1.7a5 5 0 0 0-7-7L11.8 6"/><path d="M5.2 11l-1.7 1.7a5 5 0 0 0 7 7L12.2 18"/><line x1="2" y1="2" x2="22" y2="22"/></svg>,
  hr:         <svg {...s}><line x1="2" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>,
  clearFmt:   <svg {...s}><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><line x1="18" y1="4" x2="22" y2="8" stroke="#ef4444"/><line x1="22" y1="4" x2="18" y2="8" stroke="#ef4444"/></svg>,
  table:      <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>,
  listUl:     <svg {...s}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>,
  listOl:     <svg {...s}><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="4" y="8" fill="currentColor" fontSize="7" fontWeight="700" fontFamily="system-ui" stroke="none">1</text><text x="4" y="14" fill="currentColor" fontSize="7" fontWeight="700" fontFamily="system-ui" stroke="none">2</text><text x="4" y="20" fill="currentColor" fontSize="7" fontWeight="700" fontFamily="system-ui" stroke="none">3</text></svg>,
  quote:      <svg {...s}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.8-2-2-2H5c-1.2 0-2 .75-2 2v4c0 1.25.8 2 2 2h2c.5 0 1 .2 1.3.4"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.8-2-2-2h-3c-1.2 0-2 .75-2 2v4c0 1.25.8 2 2 2h2c.5 0 1 .2 1.3.4"/></svg>,
};

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
  /** Palette couleur de fond (surlignage) visible ? */
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  /** Modale d'insertion de lien ouverte ? */
  const [modaleLienOuverte, setModaleLienOuverte] = useState(false);
  /** URL du lien à insérer */
  const [lienUrl, setLienUrl] = useState('');
  /** Texte du lien à insérer */
  const [lienTexte, setLienTexte] = useState('');
  /** Cellule <td>/<th> actuellement sous le curseur (active la barre d'édition de tableau) */
  const [celluleActive, setCelluleActive] = useState<HTMLElement | null>(null);

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
  //   Phase 38 — On nettoie les éléments « visuels uniquement »
  //   ajoutés par l'éditeur (poignées de redimensionnement) avant
  //   d'envoyer le HTML au parent. Cela garde le contenu stocké
  //   en base léger et propre (les poignées seront re-greffées
  //   automatiquement via l'observer au prochain rendu).
  const emettrChangement = useCallback(() => {
    if (!zoneRef.current) return;
    const clone = zoneRef.current.cloneNode(true) as HTMLElement;
    // Strip toutes les poignées (.rte-col-resizer) du DOM cloné
    clone.querySelectorAll('.rte-col-resizer').forEach((n) => n.remove());
    onChange(clone.innerHTML);
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

  // ── Helpers pour la navigation/création dans les tableaux ────
  //
  //   Phase 38 :
  //     • Tab dans un tableau = passe à la cellule suivante
  //     • Shift+Tab = passe à la cellule précédente
  //     • Tab sur la dernière cellule = crée une nouvelle ligne
  //     • Hors tableau, Tab garde le comportement « indent » existant
  //
  //   On encapsule ici la logique pour que `handleKeyDown` reste lisible.

  /** Place le curseur dans une cellule (au début de son contenu). */
  const placerCurseurDansCellule = useCallback((cell: HTMLTableCellElement) => {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    // Si la cellule est vide, range au début. Sinon, sélection collapsed
    // sur le 1er enfant texte (pour que le prof voie le curseur clignoter).
    range.selectNodeContents(cell);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    // Pour iOS / accessibilité : scroll into view si la cellule sort du cadre
    cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);

  /** Récupère la cellule d'un nœud (td|th) ou null si hors tableau. */
  const trouverCellule = useCallback((noeud: Node | null): HTMLTableCellElement | null => {
    return (
      (trouverAncetre(noeud, 'td') as HTMLTableCellElement | null) ||
      (trouverAncetre(noeud, 'th') as HTMLTableCellElement | null)
    );
  }, []);

  /**
   * Insère une nouvelle ligne en bas du tableau et place le curseur
   * dans sa première cellule. Utilisé par Tab sur la dernière cellule.
   */
  const ajouterLigneEnBas = useCallback((table: HTMLTableElement): HTMLTableCellElement | null => {
    const nbCols = table.rows[0]?.cells.length ?? 0;
    if (nbCols === 0) return null;
    // On insère TOUJOURS dans <tbody> (jamais en <thead>) pour préserver l'en-tête.
    let tbody = table.tBodies[0];
    if (!tbody) {
      tbody = document.createElement('tbody');
      table.appendChild(tbody);
    }
    const tr = tbody.insertRow();
    for (let i = 0; i < nbCols; i++) {
      const td = tr.insertCell(i);
      td.innerHTML = '&#8203;'; // zero-width space = curseur posable
    }
    return tr.cells[0] as HTMLTableCellElement;
  }, []);

  /**
   * Calcule la prochaine cellule (sens = +1 ou -1).
   * Retourne null si on est respectivement après la dernière / avant la première.
   */
  const cellulesAdjacente = useCallback(
    (cell: HTMLTableCellElement, sens: 1 | -1): HTMLTableCellElement | null => {
      const tr = cell.parentElement as HTMLTableRowElement | null;
      const table = trouverAncetre(cell, 'table') as HTMLTableElement | null;
      if (!tr || !table) return null;
      const colIdx = cell.cellIndex;
      // Cellule suivante / précédente sur la même ligne ?
      const suivanteMemeLigne = tr.cells[colIdx + sens] as HTMLTableCellElement | undefined;
      if (suivanteMemeLigne) return suivanteMemeLigne;
      // Sinon, on saute à la ligne suivante / précédente
      const allRows = Array.from(table.rows);
      const rowIdx = allRows.indexOf(tr);
      const ligneSuivante = allRows[rowIdx + sens] as HTMLTableRowElement | undefined;
      if (!ligneSuivante) return null;
      // En passant à la ligne suivante : 1ère cellule (sens=1) ou dernière (sens=-1)
      return (sens === 1
        ? ligneSuivante.cells[0]
        : ligneSuivante.cells[ligneSuivante.cells.length - 1]
      ) as HTMLTableCellElement | undefined ?? null;
    },
    []
  );

  /**
   * Insère une colonne directement (utilisé par les raccourcis clavier
   * dans handleKeyDown — défini ici en `cellule` plutôt qu'en captant
   * la callback `tableauInsererColonne` pour éviter une référence
   * forward avant déclaration).
   */
  const ajouterColonneAdjacente = useCallback(
    (cell: HTMLTableCellElement, position: 'avant' | 'apres') => {
      const table = trouverAncetre(cell, 'table') as HTMLTableElement | null;
      if (!table) return;
      const colIdx = cell.cellIndex + (position === 'avant' ? 0 : 1);
      Array.from(table.rows).forEach((tr) => {
        const isHeader =
          tr.parentElement?.tagName.toLowerCase() === 'thead' ||
          tr.cells[0]?.tagName.toLowerCase() === 'th';
        const idxClamp = Math.min(colIdx, tr.cells.length);
        const nouvelle = tr.insertCell(idxClamp);
        if (isHeader) {
          const th = document.createElement('th');
          th.innerHTML = 'Colonne';
          tr.replaceChild(th, nouvelle);
        } else {
          nouvelle.innerHTML = '&#8203;';
        }
      });
      emettrChangement();
    },
    [emettrChangement]
  );

  /** Insère une ligne adjacente à la cellule (avant/après). */
  const ajouterLigneAdjacente = useCallback(
    (cell: HTMLTableCellElement, position: 'avant' | 'apres') => {
      const ligne = trouverAncetre(cell, 'tr') as HTMLTableRowElement | null;
      const table = trouverAncetre(cell, 'table') as HTMLTableElement | null;
      if (!ligne || !table) return;
      const nbCols = ligne.cells.length;
      const nouvelle = table.insertRow(ligne.rowIndex + (position === 'avant' ? 0 : 1));
      for (let i = 0; i < nbCols; i++) {
        const td = nouvelle.insertCell(i);
        td.innerHTML = '&#8203;';
      }
      emettrChangement();
    },
    [emettrChangement]
  );

  // ── Gestion du clavier (Tab dans/hors tableau, raccourcis tableau) ─
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const sel = window.getSelection();
      const noeud = sel?.anchorNode ?? null;
      const cell = trouverCellule(noeud);

      // ── Raccourcis tableau (Ctrl+Alt+→ / Ctrl+Alt+↓) ─────────
      // Permet d'ajouter rapidement colonne / ligne sans passer par la souris.
      if (cell && (e.ctrlKey || e.metaKey) && e.altKey) {
        if (e.key === 'ArrowRight' || e.key === 'Right') {
          e.preventDefault();
          ajouterColonneAdjacente(cell, 'apres');
          return;
        }
        if (e.key === 'ArrowDown' || e.key === 'Down') {
          e.preventDefault();
          ajouterLigneAdjacente(cell, 'apres');
          return;
        }
      }

      // ── Tabulation ────────────────────────────────────────────
      if (e.key === 'Tab') {
        if (cell) {
          // ── Dans un tableau : navigation / création ──
          e.preventDefault();
          const sens: 1 | -1 = e.shiftKey ? -1 : 1;
          const suivante = cellulesAdjacente(cell, sens);
          if (suivante) {
            placerCurseurDansCellule(suivante);
          } else if (sens === 1) {
            // Tab sur la dernière cellule du tableau → créer une nouvelle ligne
            const table = trouverAncetre(cell, 'table') as HTMLTableElement | null;
            if (table) {
              const premiere = ajouterLigneEnBas(table);
              if (premiere) {
                placerCurseurDansCellule(premiere);
                emettrChangement();
              }
            }
          }
          // Shift+Tab sur la 1re cellule : on ne fait rien (déjà au début)
          return;
        }
        // ── Hors tableau : comportement historique (indent / outdent) ──
        e.preventDefault();
        zoneRef.current?.focus();
        execCmd(e.shiftKey ? 'outdent' : 'indent');
        emettrChangement();
      }
    },
    [
      emettrChangement,
      trouverCellule,
      cellulesAdjacente,
      placerCurseurDansCellule,
      ajouterLigneEnBas,
      ajouterColonneAdjacente,
      ajouterLigneAdjacente,
    ]
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

  // ── Insertion d'un lien hypertexte ──────────────────────────
  const insererLien = useCallback(() => {
    if (!lienUrl.trim()) return;
    zoneRef.current?.focus();
    restaurerSelection();
    const texte = lienTexte.trim() || lienUrl.trim();
    const html = `<a href="${lienUrl.trim()}" target="_blank" rel="noopener noreferrer">${texte}</a>`;
    execCmd('insertHTML', html);
    setModaleLienOuverte(false);
    setLienUrl('');
    setLienTexte('');
    emettrChangement();
  }, [lienUrl, lienTexte, emettrChangement, restaurerSelection]);

  // ── Insertion d'une ligne horizontale ──────────────────────
  const insererLigneHorizontale = useCallback(() => {
    zoneRef.current?.focus();
    execCmd('insertHTML', '<hr><p><br></p>');
    emettrChangement();
  }, [emettrChangement]);

  // ══════════════════════════════════════════════════════════════
  // PHASE 34 — Édition contextuelle de tableau
  //   La barre d'édition de tableau apparaît quand le curseur se trouve
  //   dans une cellule <td> ou <th>. On track la cellule active pour
  //   manipuler sa ligne/colonne sans se baser sur execCommand.
  // ══════════════════════════════════════════════════════════════

  /** Détecte quand le curseur entre/sort d'un tableau pour afficher la barre */
  const detecterCelluleActive = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setCelluleActive(null); return; }
    const cellule = trouverAncetre(sel.anchorNode, 'td') || trouverAncetre(sel.anchorNode, 'th');
    setCelluleActive(cellule);
  }, []);

  /** Retourne le <tr> parent de la cellule active, ou null */
  const getLigneActive = useCallback((): HTMLTableRowElement | null => {
    if (!celluleActive) return null;
    return (trouverAncetre(celluleActive, 'tr') as HTMLTableRowElement | null);
  }, [celluleActive]);

  /** Retourne le <table> parent, ou null */
  const getTableActif = useCallback((): HTMLTableElement | null => {
    if (!celluleActive) return null;
    return (trouverAncetre(celluleActive, 'table') as HTMLTableElement | null);
  }, [celluleActive]);

  /** Insère une ligne au-dessus ou en-dessous de la ligne active */
  const tableauInsererLigne = useCallback((position: 'avant' | 'apres') => {
    const ligne = getLigneActive();
    const table = getTableActif();
    if (!ligne || !table) return;
    const nbCols = ligne.cells.length;
    const nouvelle = table.insertRow(ligne.rowIndex + (position === 'avant' ? 0 : 1));
    for (let i = 0; i < nbCols; i++) {
      const td = nouvelle.insertCell(i);
      td.innerHTML = '&#8203;'; // zero-width space → permet de placer le curseur
    }
    emettrChangement();
  }, [getLigneActive, getTableActif, emettrChangement]);

  /** Insère une colonne à gauche ou à droite de la cellule active */
  const tableauInsererColonne = useCallback((position: 'avant' | 'apres') => {
    const table = getTableActif();
    if (!table || !celluleActive) return;
    const colIdx = (celluleActive as HTMLTableCellElement).cellIndex + (position === 'avant' ? 0 : 1);
    // Parcourt toutes les lignes (thead + tbody)
    Array.from(table.rows).forEach(tr => {
      const nouvelleCellule = tr.insertCell(Math.min(colIdx, tr.cells.length));
      // Si la ligne est dans <thead>, c'est une en-tête → mettre à jour tagName
      const isHeader = tr.parentElement?.tagName.toLowerCase() === 'thead' || tr.cells[0]?.tagName.toLowerCase() === 'th';
      if (isHeader) {
        const th = document.createElement('th');
        th.innerHTML = 'Colonne';
        tr.replaceChild(th, nouvelleCellule);
      } else {
        nouvelleCellule.innerHTML = '&#8203;';
      }
    });
    emettrChangement();
  }, [getTableActif, celluleActive, emettrChangement]);

  /** Supprime la ligne active (préserve la ligne d'en-tête si c'est la seule restante) */
  const tableauSupprimerLigne = useCallback(() => {
    const ligne = getLigneActive();
    const table = getTableActif();
    if (!ligne || !table) return;
    if (table.rows.length <= 1) return; // Ne pas vider le tableau
    ligne.remove();
    setCelluleActive(null);
    emettrChangement();
  }, [getLigneActive, getTableActif, emettrChangement]);

  /** Supprime la colonne dans laquelle se trouve la cellule active */
  const tableauSupprimerColonne = useCallback(() => {
    const table = getTableActif();
    if (!table || !celluleActive) return;
    const colIdx = (celluleActive as HTMLTableCellElement).cellIndex;
    // Si c'est la dernière colonne → ne pas la supprimer (sinon tableau vide)
    const nbCols = table.rows[0]?.cells.length ?? 0;
    if (nbCols <= 1) return;
    Array.from(table.rows).forEach(tr => {
      if (tr.cells[colIdx]) tr.deleteCell(colIdx);
    });
    setCelluleActive(null);
    emettrChangement();
  }, [getTableActif, celluleActive, emettrChangement]);

  /** Supprime entièrement le tableau sous le curseur */
  const tableauSupprimer = useCallback(() => {
    const table = getTableActif();
    if (!table) return;
    table.remove();
    setCelluleActive(null);
    emettrChangement();
  }, [getTableActif, emettrChangement]);

  /** Redimensionne la largeur d'une colonne (incrément / décrément) */
  const tableauRedimensionnerColonne = useCallback((delta: number) => {
    const table = getTableActif();
    if (!table || !celluleActive) return;
    const colIdx = (celluleActive as HTMLTableCellElement).cellIndex;
    // Applique à toutes les cellules de la même colonne (première ligne sert de référence)
    Array.from(table.rows).forEach(tr => {
      const c = tr.cells[colIdx] as HTMLElement | undefined;
      if (!c) return;
      const largeurActuelle = c.offsetWidth || 100;
      const nouvelle = Math.max(40, largeurActuelle + delta);
      c.style.width = `${nouvelle}px`;
      c.style.minWidth = `${nouvelle}px`;
    });
    emettrChangement();
  }, [getTableActif, celluleActive, emettrChangement]);

  // ── Fermeture des dropdowns au clic extérieur ──────────────────
  useEffect(() => {
    const fermer = () => {
      setDropdownOuvert(false);
      setShowHighlightPicker(false);
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);

  // ══════════════════════════════════════════════════════════════
  //  Phase 38 — Poignées de redimensionnement de colonnes
  // ══════════════════════════════════════════════════════════════
  //   Approche :
  //     1. Au clic sur le bord droit d'une cellule (ressenti visuellement
  //        comme une poignée verticale via .rte-col-resizer), on saisit
  //        la largeur initiale et la position X.
  //     2. Pendant le mousemove, on calcule delta = current - startX et
  //        applique cette largeur à TOUTES les cellules de la colonne
  //        (style.width + style.minWidth).
  //     3. Au mouseup, on émet le changement vers le parent.
  //
  //   La poignée est ajoutée dynamiquement dans chaque cellule via un
  //   effet qui scrute la zone d'édition. On évite ainsi de modifier
  //   le HTML stocké (les poignées sont des span purement visuels,
  //   contentEditable=false, et sont supprimées avant lecture si besoin).
  //
  //   Avantage : fonctionne sur tableaux insérés à n'importe quel moment
  //   (même collés depuis Word) et n'altère pas la sortie HTML stockée.

  /** Applique une largeur (en px) à une colonne entière du tableau */
  const appliquerLargeurColonne = useCallback(
    (table: HTMLTableElement, colIdx: number, largeurPx: number) => {
      const w = Math.max(40, Math.round(largeurPx));
      Array.from(table.rows).forEach((tr) => {
        const c = tr.cells[colIdx] as HTMLElement | undefined;
        if (!c) return;
        c.style.width = `${w}px`;
        c.style.minWidth = `${w}px`;
      });
    },
    []
  );

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;

    /** Ajoute (ou réutilise) une poignée à la fin de chaque cellule */
    const ajouterPoignees = () => {
      const cellules = zone.querySelectorAll('table td, table th');
      cellules.forEach((td) => {
        const cell = td as HTMLTableCellElement;
        // S'assurer que la cellule est positionnée pour l'absolute child
        const computed = getComputedStyle(cell);
        if (computed.position === 'static') {
          cell.style.position = 'relative';
        }
        // Vérifier si une poignée existe déjà
        if (cell.querySelector(':scope > .rte-col-resizer')) return;
        const handle = document.createElement('span');
        handle.className = 'rte-col-resizer';
        handle.setAttribute('contenteditable', 'false');
        handle.setAttribute('aria-hidden', 'true');
        handle.title = 'Redimensionner la colonne — glissez pour ajuster';
        cell.appendChild(handle);
      });
    };

    /** Gestion du drag : on capture mousedown sur la poignée. */
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.classList.contains('rte-col-resizer')) return;
      const cell = target.parentElement as HTMLTableCellElement | null;
      const table = cell ? (trouverAncetre(cell, 'table') as HTMLTableElement | null) : null;
      if (!cell || !table) return;

      e.preventDefault();
      e.stopPropagation();

      const colIdx = cell.cellIndex;
      const startX = e.clientX;
      const startWidth = cell.offsetWidth;

      // Indique visuellement le drag (curseur sur tout le document)
      document.body.classList.add('rte-col-resizing');

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        appliquerLargeurColonne(table, colIdx, startWidth + delta);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.classList.remove('rte-col-resizing');
        emettrChangement();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };

    // Observer pour ajouter des poignées aux NOUVEAUX tableaux (insertion,
    // collage, undo/redo). On lance aussi un premier passage immédiat.
    const observer = new MutationObserver(() => ajouterPoignees());
    observer.observe(zone, { childList: true, subtree: true });
    ajouterPoignees();

    zone.addEventListener('mousedown', onMouseDown);
    return () => {
      observer.disconnect();
      zone.removeEventListener('mousedown', onMouseDown);
    };
  }, [appliquerLargeurColonne, emettrChangement]);

  // ─────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────

  /** Icône du type de liste actuellement sélectionné */
  const iconeTypeActuel =
    TYPES_LISTE_ORDONNEE.find(t => t.valeur === typeListeActuel)?.icone ?? '①';

  return (
    <div className={`rte-wrapper ${className}`} aria-disabled={disabled}>

      {/* ══════════════════════════════════════════════════════
          BARRE D'OUTILS — Design professionnel avec icônes SVG
          ══════════════════════════════════════════════════════ */}
      <div
        className="rte-toolbar"
        role="toolbar"
        aria-label="Barre d'outils de mise en forme"
      >
        {/* ── Rangée 1 : Historique · Formatage · Style/Police/Taille ── */}
        <div className="rte-toolbar__row">
          <div className="rte-toolbar__group" aria-label="Historique">
            <button type="button" className="rte-btn" onClick={() => formater('undo')} title="Annuler (Ctrl+Z)" aria-label="Annuler">{Ico.undo}</button>
            <button type="button" className="rte-btn" onClick={() => formater('redo')} title="Rétablir (Ctrl+Y)" aria-label="Rétablir">{Ico.redo}</button>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Formatage texte">
            <button type="button" className="rte-btn" onClick={() => formater('bold')} title="Gras (Ctrl+B)" aria-label="Gras">{Ico.bold}</button>
            <button type="button" className="rte-btn" onClick={() => formater('italic')} title="Italique (Ctrl+I)" aria-label="Italique">{Ico.italic}</button>
            <button type="button" className="rte-btn" onClick={() => formater('underline')} title="Souligné (Ctrl+U)" aria-label="Souligné">{Ico.underline}</button>
            <button type="button" className="rte-btn" onClick={() => formater('strikeThrough')} title="Barré" aria-label="Barré">{Ico.strike}</button>
            <button type="button" className="rte-btn" onClick={() => formater('subscript')} title="Indice (x₂)" aria-label="Indice">{Ico.sub}</button>
            <button type="button" className="rte-btn" onClick={() => formater('superscript')} title="Exposant (x²)" aria-label="Exposant">{Ico.sup}</button>
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
              {/* Phase 39 — Niveau de titre supplémentaire (h4) :
                  utile pour les sous-sections de leçons et les
                  hiérarchies à 4 niveaux (ex. F.O.R.C.E. → analyses). */}
              <option value="h4">Titre 4</option>
              <option value="blockquote">Citation</option>
            </select>
          </div>
          <div className="rte-toolbar__group" aria-label="Police">
            <select
              className="rte-select rte-select--font"
              onChange={e => { const v = e.target.value; if (v && v !== 'inherit') formater('fontName', v); e.target.value = 'inherit'; }}
              value="inherit"
              title="Police de caractères"
              aria-label="Police de caractères"
            >
              {POLICES_DISPONIBLES.map(p => (
                <option key={p.valeur} value={p.valeur}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="rte-toolbar__group" aria-label="Taille">
            <select
              className="rte-select rte-select--size"
              onChange={e => { const v = e.target.value; if (v) formater('fontSize', v); e.target.value = ''; }}
              value=""
              title="Taille du texte"
              aria-label="Taille du texte"
            >
              <option value="" disabled>Taille…</option>
              {TAILLES_POLICE.map(t => (
                <option key={t.valeur} value={t.valeur}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Rangée 2 : Listes · Alignement · Retrait · Couleur · Insertion ── */}
        <div className="rte-toolbar__row">
          <div className="rte-toolbar__group" aria-label="Listes">
            <button type="button" className="rte-btn" onClick={() => formater('insertUnorderedList')} title="Liste à puces" aria-label="Liste à puces">{Ico.listUl}</button>
            <div className="rte-dropdown-wrapper" onMouseDown={e => e.stopPropagation()}>
              <button
                type="button"
                className="rte-btn rte-btn--avec-caret"
                onClick={() => { sauvegarderSelection(); setDropdownOuvert(o => !o); }}
                title="Liste numérotée — cliquer pour choisir le style"
                aria-label="Liste numérotée"
                aria-expanded={dropdownOuvert}
                aria-haspopup="listbox"
              >
                {Ico.listOl}
                <span className="rte-btn__caret" aria-hidden="true">▾</span>
              </button>
              {dropdownOuvert && (
                <div className="rte-dropdown" role="listbox" aria-label="Types de numérotation">
                  <div className="rte-dropdown__titre">Style de numérotation</div>
                  {TYPES_LISTE_ORDONNEE.map(t => (
                    <button
                      key={t.valeur}
                      type="button"
                      role="option"
                      aria-selected={typeListeActuel === t.valeur}
                      className={`rte-dropdown__item${typeListeActuel === t.valeur ? ' actif' : ''}`}
                      onMouseDown={e => { e.preventDefault(); insererListeOrdonnee(t.valeur); }}
                    >
                      <span className="rte-dropdown__exemple" aria-hidden="true">{t.exemple}</span>
                      <span className="rte-dropdown__label">{t.label}</span>
                      {typeListeActuel === t.valeur && <span className="rte-dropdown__coche" aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="rte-btn" onClick={() => formater('formatBlock', 'blockquote')} title="Citation" aria-label="Citation">{Ico.quote}</button>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Alignement">
            <button type="button" className="rte-btn" onClick={() => formater('justifyLeft')} title="Aligner à gauche" aria-label="Aligner à gauche">{Ico.alLeft}</button>
            <button type="button" className="rte-btn" onClick={() => formater('justifyCenter')} title="Centrer" aria-label="Centrer">{Ico.alCenter}</button>
            <button type="button" className="rte-btn" onClick={() => formater('justifyRight')} title="Aligner à droite" aria-label="Aligner à droite">{Ico.alRight}</button>
            <button type="button" className="rte-btn" onClick={() => formater('justifyFull')} title="Justifier" aria-label="Justifier">{Ico.alJustify}</button>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Retrait">
            <button type="button" className="rte-btn" onClick={() => formater('outdent')} title="Diminuer le retrait (Shift+Tab)" aria-label="Diminuer le retrait">{Ico.indentMinus}</button>
            <button type="button" className="rte-btn" onClick={() => formater('indent')} title="Augmenter le retrait (Tab)" aria-label="Augmenter le retrait">{Ico.indentPlus}</button>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Couleur">
            <label className="rte-btn rte-btn--couleur" title="Couleur du texte" aria-label="Couleur du texte">
              <span className="rte-btn--couleur-preview" aria-hidden="true">A</span>
              <input
                type="color"
                className="rte-color-input"
                defaultValue="#111827"
                onChange={e => formater('foreColor', e.target.value)}
                aria-label="Choisir la couleur du texte"
              />
            </label>
            <div className="rte-dropdown-wrapper" onMouseDown={e => e.stopPropagation()}>
              <button
                type="button"
                className="rte-btn"
                onClick={() => setShowHighlightPicker(p => !p)}
                title="Surlignage"
                aria-label="Surlignage"
              >
                <span className="rte-btn--highlight-icon">A</span>
              </button>
              {showHighlightPicker && (
                <div className="rte-color-picker rte-color-picker--grid">
                  {HIGHLIGHT_COLORS.map((color, i) => (
                    <button
                      key={i}
                      type="button"
                      className="rte-color-swatch"
                      style={{ backgroundColor: color === 'transparent' ? '#fff' : color, border: '1px solid #d1d5db' }}
                      title={color === 'transparent' ? 'Aucun surlignage' : color}
                      onMouseDown={e => { e.preventDefault(); formater('hiliteColor', color === 'transparent' ? 'transparent' : color); setShowHighlightPicker(false); }}
                    >
                      {color === 'transparent' ? <span style={{ fontSize: 10, color: '#6b7280' }}>✕</span> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Insertion">
            <button type="button" className="rte-btn" onClick={() => { sauvegarderSelection(); setModaleLienOuverte(true); setLienTexte(''); setLienUrl(''); }} title="Insérer un lien" aria-label="Insérer un lien" aria-haspopup="dialog">{Ico.link}</button>
            <button type="button" className="rte-btn" onClick={() => formater('unlink')} title="Supprimer le lien" aria-label="Supprimer le lien">{Ico.unlink}</button>
            <button type="button" className="rte-btn" onClick={insererLigneHorizontale} title="Ligne horizontale" aria-label="Ligne horizontale">{Ico.hr}</button>
            <button type="button" className="rte-btn" onClick={() => { sauvegarderSelection(); setModaleTableauOuverte(true); }} title="Insérer un tableau" aria-label="Insérer un tableau" aria-haspopup="dialog">{Ico.table}</button>
          </div>
          <div className="rte-toolbar__sep" aria-hidden="true" />
          <div className="rte-toolbar__group" aria-label="Nettoyage">
            <button type="button" className="rte-btn rte-btn--danger" onClick={() => formater('removeFormat')} title="Supprimer la mise en forme" aria-label="Supprimer la mise en forme">{Ico.clearFmt}</button>
          </div>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════
          Barre contextuelle d'édition de tableau
          S'affiche quand le curseur est positionné dans une cellule
          (<td>/<th>) et permet : ajout/suppression ligne/colonne,
          redimensionnement, suppression du tableau.
          ══════════════════════════════════════════════════════ */}
      {celluleActive && (
        <div
          className="rte-table-toolbar"
          role="toolbar"
          aria-label="Édition du tableau"
          onMouseDown={e => e.preventDefault() /* évite la perte de sélection */}
        >
          <span className="rte-table-toolbar__label">⊞&nbsp;Tableau</span>

          {/* ── Groupe : Lignes ── */}
          <div className="rte-table-toolbar__group" aria-label="Lignes">
            <button type="button" className="rte-btn" title="Insérer une ligne au-dessus" onClick={() => tableauInsererLigne('avant')}>
              + Ligne ↑
            </button>
            <button type="button" className="rte-btn" title="Insérer une ligne en-dessous (Ctrl+Alt+↓)" onClick={() => tableauInsererLigne('apres')}>
              + Ligne ↓
            </button>
            <button type="button" className="rte-btn rte-btn--danger" title="Supprimer la ligne courante" onClick={tableauSupprimerLigne}>
              − Ligne
            </button>
          </div>

          <div className="rte-toolbar__sep" aria-hidden="true" />

          {/* ── Groupe : Colonnes ── */}
          <div className="rte-table-toolbar__group" aria-label="Colonnes">
            <button type="button" className="rte-btn" title="Insérer une colonne à gauche (Ctrl+Alt+←)" onClick={() => tableauInsererColonne('avant')}>
              + Col. ←
            </button>
            <button type="button" className="rte-btn" title="Insérer une colonne à droite (Ctrl+Alt+→)" onClick={() => tableauInsererColonne('apres')}>
              + Col. →
            </button>
            {/* Phase 38 — Bouton dédié « ajouter en bout de tableau ».
                Pratique pour étendre le tableau sans devoir cliquer
                d'abord dans la dernière colonne. */}
            <button
              type="button"
              className="rte-btn"
              title="Ajouter une nouvelle colonne en bout de tableau"
              onClick={() => {
                const table = getTableActif();
                if (!table) return;
                const lastIdx = (table.rows[0]?.cells.length ?? 1) - 1;
                Array.from(table.rows).forEach((tr) => {
                  const isHeader =
                    tr.parentElement?.tagName.toLowerCase() === 'thead' ||
                    tr.cells[0]?.tagName.toLowerCase() === 'th';
                  const cell = tr.insertCell(lastIdx + 1);
                  if (isHeader) {
                    const th = document.createElement('th');
                    th.innerHTML = 'Colonne';
                    tr.replaceChild(th, cell);
                  } else {
                    cell.innerHTML = '&#8203;';
                  }
                });
                emettrChangement();
              }}
            >
              + Col. fin
            </button>
            <button type="button" className="rte-btn rte-btn--danger" title="Supprimer la colonne courante" onClick={tableauSupprimerColonne}>
              − Col.
            </button>
          </div>

          <div className="rte-toolbar__sep" aria-hidden="true" />

          {/* ── Groupe : Largeur de colonne ── */}
          <div className="rte-table-toolbar__group" aria-label="Largeur de la colonne">
            <button type="button" className="rte-btn" title="Diminuer la largeur (−20 px)" onClick={() => tableauRedimensionnerColonne(-20)}>
              ⇠ −20
            </button>
            <button type="button" className="rte-btn" title="Augmenter la largeur (+20 px)" onClick={() => tableauRedimensionnerColonne(20)}>
              +20 ⇢
            </button>
          </div>

          <div className="rte-toolbar__sep" aria-hidden="true" />

          {/* ── Bouton : Supprimer le tableau ── */}
          <button
            type="button"
            className="rte-btn rte-btn--danger"
            title="Supprimer le tableau en entier"
            onClick={tableauSupprimer}
          >
            ✕ Supprimer
          </button>
        </div>
      )}

      <div
        ref={zoneRef}
        className="rte-content"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => { emettrChangement(); detecterCelluleActive(); }}
        onKeyDown={handleKeyDown}
        onKeyUp={detecterCelluleActive}
        onMouseUp={detecterCelluleActive}
        onFocus={detecterCelluleActive}
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

      {modaleLienOuverte && (
        <div
          className="rte-modale-overlay"
          onClick={() => setModaleLienOuverte(false)}
          role="presentation"
        >
          <div
            className="rte-modale rte-modale--lien"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Insérer un lien"
          >
            <div className="rte-modale__header">
              <h3 className="rte-modale__titre">🔗 Insérer un lien</h3>
              <button
                type="button"
                className="rte-modale__fermer"
                onClick={() => setModaleLienOuverte(false)}
                aria-label="Fermer"
              >✕</button>
            </div>
            <div className="rte-modale__body">
              <div className="rte-modale__field">
                <label className="rte-modale__label" htmlFor="rte-lien-url">URL *</label>
                <input
                  id="rte-lien-url"
                  type="url"
                  className="rte-modale__input"
                  placeholder="https://…"
                  value={lienUrl}
                  onChange={e => setLienUrl(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="rte-modale__field">
                <label className="rte-modale__label" htmlFor="rte-lien-texte">Texte affiché</label>
                <input
                  id="rte-lien-texte"
                  type="text"
                  className="rte-modale__input"
                  placeholder="Texte du lien (optionnel)"
                  value={lienTexte}
                  onChange={e => setLienTexte(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); insererLien(); } }}
                />
              </div>
            </div>
            <div className="rte-modale__footer">
              <button type="button" className="btn-secondary" onClick={() => setModaleLienOuverte(false)}>Annuler</button>
              <button type="button" className="btn-pedaclic" onClick={insererLien} disabled={!lienUrl.trim()}>🔗 Insérer le lien</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RichTextEditor;

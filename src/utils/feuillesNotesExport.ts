/**
 * Export feuilles de notes — Excel, PDF, Word (HTML)
 * PedaClic — Charte graphique respectée
 */

import type {
  FeuilleDeNotes,
  LigneNotes,
  EvaluationNote,
  TypeEvaluation,
} from '../types/feuillesNotes.types';
// ✨ Formatage canonique "Prénoms NOM" — cohérence entre écran et exports
import { formatEleveNom } from './formatNom';

/**
 * Étiquette de colonne enrichie : inclut le type (D/C) et le coef. éventuel
 * pour que les exports soient lisibles seuls (sans le contexte écran).
 */
function labelEvalExport(e: EvaluationNote): string {
  const t: TypeEvaluation = e.type ?? 'devoir';
  const marqueur = t === 'composition' ? ' [Compo]' : '';
  const coef = e.coefficient && e.coefficient !== 1 ? ` (coef. ${e.coefficient})` : '';
  return `${e.libelle}${marqueur}${coef}`;
}

/**
 * 🆕 Renvoie la cellule à afficher dans les exports pour un couple
 *    (ligne, évaluation) en tenant compte du statut d'absence :
 *
 *    - absence justifiée     → 'Abs. J'  (l'évaluation est ignorée dans la moyenne)
 *    - absence non justifiée → 'Abs. NJ' (compte 0/20 dans la moyenne)
 *    - sinon                 → la note saisie ou '-' / ''
 *
 *    `placeholderVide` permet d'utiliser '' (Excel = cellule vide) ou '-'
 *    (PDF/Word = tiret visible) selon le contexte.
 */
function celluleNoteExport(
  l: LigneNotes,
  evalId: string,
  placeholderVide: string,
): string | number {
  const st = l.absences?.[evalId];
  if (st === 'absent_justifie') return 'Abs. J';
  if (st === 'absent_non_justifie') return 'Abs. NJ';
  const n = l.notes[evalId];
  if (n === undefined || n === null) return placeholderVide;
  return n;
}

function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  return new Date(String(val));
}

/** Export Excel via SheetJS */
export async function exportFeuilleExcel(
  feuille: FeuilleDeNotes,
  lignes: LigneNotes[],
  filename: string
): Promise<void> {
  const XLSX = await import('xlsx');
  const evals = feuille.evaluations || [];
  // Colonnes de synthèse : devoir, composition, moyenne générale, rang
  // + 2 nouvelles colonnes « Abs. J » et « Abs. NJ » (compteurs d'absences).
  const headers = [
    'Élève',
    ...evals.map(labelEvalExport),
    'Moy. Devoirs',
    'Composition',
    'Moy. Générale',
    'Rang',
    'Abs. J',   // Nombre d'absences justifiées sur la feuille
    'Abs. NJ',  // Nombre d'absences non justifiées (comptent 0/20)
  ];
  const rows = lignes.map((l) => {
    // Nom canonique "Prénoms NOM" pour l'export
    const r: (string | number)[] = [formatEleveNom(l.eleveNom)];
    // ⚠️ Pour chaque évaluation, on consulte d'abord le statut d'absence :
    //    cela garantit que les exports reflètent EXACTEMENT ce que voit
    //    le prof à l'écran, y compris les badges 'Abs. J' / 'Abs. NJ'.
    evals.forEach((e) => r.push(celluleNoteExport(l, e.id, '')));
    r.push(l.moyenneDevoirs || '');
    r.push(l.noteComposition || '');
    r.push(l.moyenneGenerale || '');
    r.push(l.rang || '');
    r.push(l.nbAbsencesJustifiees || '');
    r.push(l.nbAbsencesNonJustifiees || '');
    return r;
  });
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 25 : 12 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, feuille.periodeLabel.slice(0, 31));
  XLSX.writeFile(wb, `${filename || 'feuille_notes'}.xlsx`);
}

/** Export PDF via jsPDF */
export async function exportFeuillePDF(
  feuille: FeuilleDeNotes,
  lignes: LigneNotes[],
  filename: string
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm' });
  const evals = feuille.evaluations || [];
  // Mêmes colonnes que l'export Excel + 2 colonnes absences en fin.
  const headers = [
    'Élève',
    ...evals.map(labelEvalExport),
    'Moy. Dev.',
    'Compo',
    'Moy. Gén.',
    'Rang',
    'Abs. J',
    'Abs. NJ',
  ];
  const rows = lignes.map((l) => {
    // Nom canonique "Prénoms NOM" pour l'export PDF
    const r: (string | number)[] = [formatEleveNom(l.eleveNom)];
    // Cellule = note OU « Abs. J » / « Abs. NJ » selon le statut.
    evals.forEach((e) => r.push(String(celluleNoteExport(l, e.id, '-'))));
    r.push(l.moyenneDevoirs > 0 ? l.moyenneDevoirs.toFixed(2) : '-');
    r.push(l.noteComposition > 0 ? l.noteComposition.toFixed(2) : '-');
    r.push(l.moyenneGenerale > 0 ? l.moyenneGenerale.toFixed(2) : '-');
    r.push(l.rang > 0 ? String(l.rang) : '-');
    r.push(l.nbAbsencesJustifiees > 0 ? String(l.nbAbsencesJustifiees) : '-');
    r.push(l.nbAbsencesNonJustifiees > 0 ? String(l.nbAbsencesNonJustifiees) : '-');
    return r;
  });

  doc.setFontSize(14);
  doc.setTextColor(37, 99, 235); // --color-primary
  doc.text(`Feuille de notes — ${feuille.groupeNom}`, 14, 12);
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(
    `${feuille.matiereNom} • ${feuille.periodeLabel} • ${feuille.anneeScolaire}`,
    14,
    18
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 24,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  doc.save(`${filename || 'feuille_notes'}.pdf`);
}

/** Export Word (HTML ouvert dans nouveau contexte) */
export function exportFeuilleWord(
  feuille: FeuilleDeNotes,
  lignes: LigneNotes[],
  filename: string
): void {
  const evals = feuille.evaluations || [];
  const headers = [
    'Élève',
    ...evals.map(labelEvalExport),
    'Moy. Devoirs',
    'Composition',
    'Moy. Générale',
    'Rang',
    'Abs. J',
    'Abs. NJ',
  ];
  const rows = lignes.map((l) => {
    // Nom canonique "Prénoms NOM" pour l'export Word/HTML
    const r: (string | number)[] = [formatEleveNom(l.eleveNom)];
    // Statut absence prioritaire sur la note saisie (cf. helper).
    evals.forEach((e) => r.push(celluleNoteExport(l, e.id, '-')));
    r.push(l.moyenneDevoirs > 0 ? l.moyenneDevoirs.toFixed(2) : '-');
    r.push(l.noteComposition > 0 ? l.noteComposition.toFixed(2) : '-');
    r.push(l.moyenneGenerale > 0 ? l.moyenneGenerale.toFixed(2) : '-');
    r.push(l.rang > 0 ? String(l.rang) : '-');
    r.push(l.nbAbsencesJustifiees > 0 ? String(l.nbAbsencesJustifiees) : '-');
    r.push(l.nbAbsencesNonJustifiees > 0 ? String(l.nbAbsencesNonJustifiees) : '-');
    return r;
  });

  const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
  <meta charset="utf-8"/>
  <title>Feuille de notes - ${feuille.groupeNom}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2cm; color: #1f2937; }
    h1 { color: #2563eb; font-size: 18pt; margin-bottom: 4px; }
    .meta { color: #6b7280; font-size: 10pt; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 10px; text-align: left; }
    th { background: #2563eb; color: white; font-weight: 600; }
    tr:nth-child(even) { background: #f9fafb; }
    .moyenne { font-weight: 700; background: #eff6ff; }
    .synthese { background: #f3f4f6; }
    /* Absences : orange informatif (justifiée) vs rouge pénalisant (non justifiée).
       Couleurs alignées sur STATUT_ABSENCE_COLORS côté écran. */
    .absence-justifiee { background: #fef3c7; color: #b45309; font-style: italic; font-weight: 700; }
    .absence-non-justifiee { background: #fee2e2; color: #b91c1c; font-style: italic; font-weight: 700; }
  </style>
</head>
<body>
  <h1>Feuille de notes — ${feuille.groupeNom}</h1>
  <p class="meta">${feuille.matiereNom} • ${feuille.periodeLabel} • ${feuille.anneeScolaire} • PedaClic</p>
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            // Les 6 dernières cellules (Moy. Dev. / Compo / Moy. Gén. / Rang
            // / Abs. J / Abs. NJ) sont mises en valeur pour être facilement
            // lisibles dans Word. La cellule « Moy. Générale » (index -4 par
            // rapport à la fin) garde la mise en valeur la plus forte.
            `<tr>${row
              .map((cell, j) => {
                const isSynthese = j >= row.length - 6;
                const isMoyGenerale = j === row.length - 4;
                // Cellules absences : on les colore selon le sens
                // pédagogique (orange = informatif, rouge = pénalisant).
                const isAbsJ = j === row.length - 2;
                const isAbsNJ = j === row.length - 1;
                let cls = '';
                if (isMoyGenerale) cls = 'moyenne';
                else if (isAbsJ) cls = 'absence-justifiee';
                else if (isAbsNJ) cls = 'absence-non-justifiee';
                else if (isSynthese) cls = 'synthese';
                // On colore aussi les cellules de note en cas d'absence
                // (libellé 'Abs. J' / 'Abs. NJ' déjà inséré par le helper).
                const txt = String(cell);
                let cellCls = cls;
                if (txt === 'Abs. J') cellCls = (cellCls + ' absence-justifiee').trim();
                if (txt === 'Abs. NJ') cellCls = (cellCls + ' absence-non-justifiee').trim();
                return `<td class="${cellCls}">${cell}</td>`;
              })
              .join('')}</tr>`,
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(
    ['\ufeff' + html],
    { type: 'application/msword' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename || 'feuille_notes'}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export feuilles de notes — Excel, PDF, Word (HTML)
 * PedaClic — Charte graphique respectée
 */

import type { FeuilleDeNotes, LigneNotes, EvaluationNote, TypeEvaluation } from '../types/feuillesNotes.types';
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
  const headers = [
    'Élève',
    ...evals.map(labelEvalExport),
    'Moy. Devoirs',
    'Composition',
    'Moy. Générale',
    'Rang',
  ];
  const rows = lignes.map((l) => {
    // Nom canonique "Prénoms NOM" pour l'export
    const r: (string | number)[] = [formatEleveNom(l.eleveNom)];
    evals.forEach((e) => r.push(l.notes[e.id] ?? ''));
    r.push(l.moyenneDevoirs || '');
    r.push(l.noteComposition || '');
    r.push(l.moyenneGenerale || '');
    r.push(l.rang || '');
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
  const headers = [
    'Élève',
    ...evals.map(labelEvalExport),
    'Moy. Dev.',
    'Compo',
    'Moy. Gén.',
    'Rang',
  ];
  const rows = lignes.map((l) => {
    // Nom canonique "Prénoms NOM" pour l'export PDF
    const r: (string | number)[] = [formatEleveNom(l.eleveNom)];
    evals.forEach((e) => r.push(String(l.notes[e.id] ?? '-')));
    r.push(l.moyenneDevoirs > 0 ? l.moyenneDevoirs.toFixed(2) : '-');
    r.push(l.noteComposition > 0 ? l.noteComposition.toFixed(2) : '-');
    r.push(l.moyenneGenerale > 0 ? l.moyenneGenerale.toFixed(2) : '-');
    r.push(l.rang > 0 ? String(l.rang) : '-');
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
  ];
  const rows = lignes.map((l) => {
    // Nom canonique "Prénoms NOM" pour l'export Word/HTML
    const r: (string | number)[] = [formatEleveNom(l.eleveNom)];
    evals.forEach((e) => r.push(l.notes[e.id] ?? '-'));
    r.push(l.moyenneDevoirs > 0 ? l.moyenneDevoirs.toFixed(2) : '-');
    r.push(l.noteComposition > 0 ? l.noteComposition.toFixed(2) : '-');
    r.push(l.moyenneGenerale > 0 ? l.moyenneGenerale.toFixed(2) : '-');
    r.push(l.rang > 0 ? String(l.rang) : '-');
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
            // Les 4 dernières cellules (Moy. Dev. / Compo / Moy. Gén. / Rang)
            // sont mises en valeur pour être facilement lisibles dans Word.
            `<tr>${row
              .map((cell, j) => {
                const isSynthese = j >= row.length - 4;
                const isMoyGenerale = j === row.length - 2;
                const cls = isMoyGenerale ? 'moyenne' : isSynthese ? 'synthese' : '';
                return `<td class="${cls}">${cell}</td>`;
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

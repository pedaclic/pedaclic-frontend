/**
 * Export Cahier de Textes en PDF — PedaClic
 * Choix de période : mois, trimestre, semestre ou tout le cahier
 * Charte graphique respectée (bleu #2563eb)
 */

import type { CahierTextes, EntreeCahier } from '../types/cahierTextes.types';
import { TYPE_CONTENU_CONFIG, STATUT_CONFIG } from '../types/cahierTextes.types';

export type PeriodeExport = 'tout' | 'mois' | 'trimestre' | 'semestre';

function toDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  return new Date(String(val));
}

function stripHtml(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/** Filtre les entrées selon la période choisie */
export function filtrerEntreesParPeriode(
  entrees: EntreeCahier[],
  periode: PeriodeExport,
  moisKey?: string
): EntreeCahier[] {
  if (periode === 'tout') return [...entrees];

  const now = new Date();
  let debut: Date;
  let fin: Date;

  if (periode === 'mois' && moisKey) {
    const [annee, mois] = moisKey.split('-').map(Number);
    debut = new Date(annee, mois - 1, 1);
    fin = new Date(annee, mois, 0, 23, 59, 59);
  } else if (periode === 'trimestre') {
    const trimestre = Math.floor(now.getMonth() / 3) + 1;
    const annee = now.getFullYear();
    debut = new Date(annee, (trimestre - 1) * 3, 1);
    fin = new Date(annee, trimestre * 3, 0, 23, 59, 59);
  } else if (periode === 'semestre') {
    const semestre = now.getMonth() < 6 ? 1 : 2;
    const annee = now.getFullYear();
    debut = new Date(annee, (semestre - 1) * 6, 1);
    fin = new Date(annee, semestre * 6, 0, 23, 59, 59);
  } else {
    return [...entrees];
  }

  return entrees.filter((e) => {
    const d = toDate(e.date);
    return d >= debut && d <= fin;
  });
}

/** Export PDF du cahier via jsPDF */
export async function exportCahierPDF(
  cahier: CahierTextes,
  entrees: EntreeCahier[],
  filename: string,
  periodeLabel?: string
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm' });

  // En-tête
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235);
  doc.text(cahier.titre, 14, 14);

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(
    `${cahier.matiere} • ${cahier.classe} • ${cahier.anneeScolaire}${periodeLabel ? ` • ${periodeLabel}` : ''}`,
    14,
    20
  );

  if (entrees.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text('Aucune séance à afficher pour cette période.', 14, 35);
    doc.save(`${filename}.pdf`);
    return;
  }

  const rows = entrees
    .sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime())
    .map((e) => {
      const cfg = TYPE_CONTENU_CONFIG[e.typeContenu as keyof typeof TYPE_CONTENU_CONFIG] || { label: e.typeContenu };
      const statutCfg = STATUT_CONFIG[e.statut as keyof typeof STATUT_CONFIG] || { label: e.statut };
      return [
        toDate(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        e.heureDebut && e.heureFin ? `${e.heureDebut}-${e.heureFin}` : '-',
        e.chapitre || '-',
        cfg?.label ?? e.typeContenu,
        e.rubrique || '-',
        statutCfg?.label ?? e.statut,
        stripHtml(e.contenu || '').slice(0, 80) + (stripHtml(e.contenu || '').length > 80 ? '…' : ''),
      ];
    });

  autoTable(doc, {
    head: [['Date', 'Horaire', 'Chapitre', 'Type', 'Rubrique', 'Statut', 'Contenu (extrait)']],
    body: rows,
    startY: 26,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 20 },
      2: { cellWidth: 38 },
      3: { cellWidth: 24 },
      4: { cellWidth: 22 },
      5: { cellWidth: 22 },
      6: { cellWidth: 'auto' },
    },
  });

  doc.save(`${filename}.pdf`);
}

// ============================================================
// PedaClic — Phase 50 : exports des cellules
// ------------------------------------------------------------
// 1. telechargerIcs()   : événement → fichier .ics (agenda du
//    téléphone, Google Agenda, Outlook…), sans serveur.
// 2. exporterCompteRenduPDF() : compte rendu → PDF à la charte
//    PedaClic (bleu marine #1F3864, rouge #C00000, en-tête et
//    pied de page institutionnels). Police Times : la plus proche
//    de Garamond parmi les polices intégrées à jsPDF.
// ============================================================

import type { Cellule, CompteRenduCellule, EvenementCellule } from '../types/cellule.types';
import { TYPE_EVENEMENT_CONFIG, dateLongue } from '../types/cellule.types';

// ─────────────────────────────────────────────────────────────
// 1. AGENDA (.ics — RFC 5545)
// ─────────────────────────────────────────────────────────────

/** Échappe les caractères spéciaux d'un texte iCalendar */
function echapperIcs(texte: string): string {
  return texte.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** « 2026-11-12 » + « 08:30 » → « 20261112T083000 » (heure locale flottante) */
function horodatage(date: string, heure: string): string {
  return `${date.replace(/-/g, '')}T${heure.replace(':', '')}00`;
}

/** Ajoute des minutes à « HH:mm » ; renvoie [date, heure] (passage de minuit géré) */
function ajouterMinutes(date: string, heure: string, minutes: number): [string, string] {
  const [a, m, j] = date.split('-').map(Number);
  const [h, mi] = heure.split(':').map(Number);
  const d = new Date(a, m - 1, j, h, mi + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, `${pad(d.getHours())}:${pad(d.getMinutes())}`];
}

export function telechargerIcs(evenement: EvenementCellule, cellule: Pick<Cellule, 'nom'>): void {
  const cfg = TYPE_EVENEMENT_CONFIG[evenement.type];
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PedaClic//Cellules pedagogiques//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${evenement.id}@pedaclic.sn`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
  ];
  if (evenement.heure) {
    // Événement horaire (durée par défaut : 1 h)
    const [dateFin, heureFin] = ajouterMinutes(evenement.date, evenement.heure, evenement.duree || 60);
    lignes.push(`DTSTART:${horodatage(evenement.date, evenement.heure)}`, `DTEND:${horodatage(dateFin, heureFin)}`);
  } else {
    // Journée entière : DTEND = lendemain (exclusif)
    const [lendemain] = ajouterMinutes(evenement.date, '00:00', 24 * 60);
    lignes.push(`DTSTART;VALUE=DATE:${evenement.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${lendemain.replace(/-/g, '')}`);
  }
  lignes.push(
    `SUMMARY:${echapperIcs(`${cfg.label} — ${evenement.titre}`)}`,
    `DESCRIPTION:${echapperIcs([cellule.nom, evenement.classe && `Classe : ${evenement.classe}`, evenement.description].filter(Boolean).join('\n'))}`,
    ...(evenement.lieu ? [`LOCATION:${echapperIcs(evenement.lieu)}`] : []),
    // Rappel la veille à la même heure
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${echapperIcs(evenement.titre)}`, 'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  );

  const blob = new Blob([lignes.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${evenement.date}-${evenement.titre.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// 2. COMPTE RENDU EN PDF (charte PedaClic)
// ─────────────────────────────────────────────────────────────
const MARINE: [number, number, number] = [31, 56, 100];   // #1F3864
const ROUGE:  [number, number, number] = [192, 0, 0];     // #C00000
const GRIS:   [number, number, number] = [90, 90, 90];

/** Lignes non vides d'un texte saisi « un élément par ligne » */
const lignesDe = (texte: string) => texte.split('\n').map(s => s.trim()).filter(Boolean);

export async function exporterCompteRenduPDF(cr: CompteRenduCellule, cellule: Cellule): Promise<void> {
  // Import dynamique (chargé seulement à l'export) ; compatible ESM / CJS
  const mod = await import('jspdf');
  const jsPDF = mod.jsPDF ?? (mod as unknown as { default: typeof mod.jsPDF }).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const L = 210, MARGE = 18, LARGEUR = L - 2 * MARGE, BAS = 297 - 22;
  let y = 0;

  // ── En-tête institutionnel (répété sur chaque page) ──
  const entete = () => {
    doc.setFillColor(...MARINE);
    doc.rect(0, 0, L, 16, 'F');
    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
    doc.text('PedaClic', MARGE, 10.5);
    doc.setFont('times', 'italic'); doc.setFontSize(9);
    doc.text('L\'école en un clic — www.pedaclic.sn', L - MARGE, 10.5, { align: 'right' });
    doc.setDrawColor(...ROUGE); doc.setLineWidth(0.8);
    doc.line(0, 16.4, L, 16.4);
    y = 26;
  };
  const nouvellePageSiBesoin = (hauteur: number) => {
    if (y + hauteur > BAS) { doc.addPage(); entete(); }
  };

  /** Paragraphe avec retour à la ligne automatique */
  const paragraphe = (texte: string, opts: { taille?: number; style?: string; couleur?: [number, number, number]; retrait?: number } = {}) => {
    doc.setFont('times', opts.style ?? 'normal');
    doc.setFontSize(opts.taille ?? 11);
    doc.setTextColor(...(opts.couleur ?? [30, 30, 30]));
    const lignes = doc.splitTextToSize(texte, LARGEUR - (opts.retrait ?? 0)) as string[];
    for (const l of lignes) {
      nouvellePageSiBesoin(6);
      doc.text(l, MARGE + (opts.retrait ?? 0), y);
      y += (opts.taille ?? 11) * 0.48;
    }
  };

  /** Titre de section (bleu marine, filet rouge) */
  const section = (titre: string) => {
    nouvellePageSiBesoin(14);
    y += 3;
    doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...MARINE);
    doc.text(titre.toUpperCase(), MARGE, y);
    doc.setDrawColor(...ROUGE); doc.setLineWidth(0.4);
    doc.line(MARGE, y + 1.5, MARGE + 30, y + 1.5);
    y += 8;
  };

  /** Liste à puces (ou numérotée) */
  const liste = (elements: string[], numerotee = false) => {
    elements.forEach((el, i) => paragraphe(`${numerotee ? `${i + 1}.` : '•'}  ${el}`, { retrait: 3 }));
  };

  // ── Page 1 : titre ──
  entete();
  doc.setFont('times', 'bold'); doc.setFontSize(18); doc.setTextColor(...MARINE);
  doc.text('COMPTE RENDU DE RÉUNION', L / 2, y + 4, { align: 'center' });
  y += 12;
  paragraphe(cellule.nom, { taille: 13, style: 'bold', couleur: ROUGE });
  paragraphe([cellule.discipline, cellule.anneeScolaire, cellule.etablissementNom, cellule.ief].filter(Boolean).join(' · '), { taille: 10, couleur: GRIS });
  y += 2;
  paragraphe(cr.titre, { taille: 12, style: 'bold' });
  paragraphe(`Réunion du ${dateLongue(cr.dateReunion)}${cr.lieu ? ` — ${cr.lieu}` : ''}`, { style: 'italic' });

  section(`Présents (${cr.presentsNoms.length})`);
  paragraphe(cr.presentsNoms.length ? cr.presentsNoms.join(', ') : 'Non renseigné.');

  if (lignesDe(cr.ordreDuJour).length) { section('Ordre du jour'); liste(lignesDe(cr.ordreDuJour), true); }
  if (cr.deliberations) { section('Déroulement et échanges'); cr.deliberations.split(/\n{2,}/).forEach(p => { paragraphe(p.trim()); y += 2; }); }
  if (lignesDe(cr.decisions).length) { section('Décisions et recommandations'); liste(lignesDe(cr.decisions)); }
  if (cr.prochaineReunion) { section('Prochaine réunion'); paragraphe(dateLongue(cr.prochaineReunion)); }

  y += 8;
  nouvellePageSiBesoin(16);
  paragraphe(`Rédigé par ${cr.auteurNom}, animateur de la cellule.`, { style: 'italic', couleur: GRIS, taille: 10 });

  // ── Pied de page institutionnel + pagination ──
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...MARINE); doc.setLineWidth(0.3);
    doc.line(MARGE, 297 - 14, L - MARGE, 297 - 14);
    doc.setFont('times', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
    doc.text(`PedaClic — ${cellule.nom}`, MARGE, 297 - 9);
    doc.text(`Page ${p} / ${total}`, L - MARGE, 297 - 9, { align: 'right' });
  }

  doc.save(`CR-${cr.dateReunion}-${cellule.nom.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}.pdf`);
}

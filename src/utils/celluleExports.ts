// ============================================================
// PedaClic — Phase 50 : exports des cellules
// ------------------------------------------------------------
// 1. telechargerIcs()   : événement → fichier .ics (agenda du
//    téléphone, Google Agenda, Outlook…), sans serveur.
// 2. exporterCompteRenduPDF() / exporterEpreuvePDF() (Phase 51) :
//    compte rendu ou épreuve commune → PDF à la charte
//    PedaClic (bleu marine #1F3864, rouge #C00000, en-tête et
//    pied de page institutionnels). Police Times : la plus proche
//    de Garamond parmi les polices intégrées à jsPDF.
// ============================================================

import type { Cellule, CompteRenduCellule, EvenementCellule, EpreuveCommune } from '../types/cellule.types';
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
// 2. PDF À LA CHARTE PEDACLIC (mise en page commune)
// ─────────────────────────────────────────────────────────────
const MARINE: [number, number, number] = [31, 56, 100];   // #1F3864
const ROUGE:  [number, number, number] = [192, 0, 0];     // #C00000
const GRIS:   [number, number, number] = [90, 90, 90];

/** Lignes non vides d'un texte saisi « un élément par ligne » */
const lignesDe = (texte: string) => texte.split('\n').map(s => s.trim()).filter(Boolean);

/** Nom de fichier sûr */
const slug = (t: string) => t.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40);

/**
 * Crée un document A4 avec en-tête institutionnel et renvoie des
 * outils de mise en page (paragraphe, section, liste, tableau simple).
 * `finaliser()` ajoute le pied de page paginé puis enregistre le fichier.
 */
async function documentCharte(piedGauche: string) {
  // Import dynamique (chargé seulement à l'export) ; compatible ESM / CJS
  const mod = await import('jspdf');
  const jsPDF = mod.jsPDF ?? (mod as unknown as { default: typeof mod.jsPDF }).default;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const L = 210, MARGE = 18, LARGEUR = L - 2 * MARGE, BAS = 297 - 22;
  const etat = { y: 0 };

  // ── En-tête (répété sur chaque page) ──
  const entete = () => {
    doc.setFillColor(...MARINE);
    doc.rect(0, 0, L, 16, 'F');
    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
    doc.text('PedaClic', MARGE, 10.5);
    doc.setFont('times', 'italic'); doc.setFontSize(9);
    doc.text('L\'école en un clic — www.pedaclic.sn', L - MARGE, 10.5, { align: 'right' });
    doc.setDrawColor(...ROUGE); doc.setLineWidth(0.8);
    doc.line(0, 16.4, L, 16.4);
    etat.y = 26;
  };
  const place = (hauteur: number) => { if (etat.y + hauteur > BAS) { doc.addPage(); entete(); } };

  /** Paragraphe avec retour à la ligne automatique */
  const paragraphe = (texte: string, o: { taille?: number; style?: string; couleur?: [number, number, number]; retrait?: number; centre?: boolean } = {}) => {
    const taille = o.taille ?? 11;
    doc.setFont('times', o.style ?? 'normal');
    doc.setFontSize(taille);
    doc.setTextColor(...(o.couleur ?? [30, 30, 30]));
    for (const l of doc.splitTextToSize(texte, LARGEUR - (o.retrait ?? 0)) as string[]) {
      place(6);
      if (o.centre) doc.text(l, L / 2, etat.y, { align: 'center' });
      else doc.text(l, MARGE + (o.retrait ?? 0), etat.y);
      etat.y += taille * 0.48;
    }
  };

  /** Texte libre : les lignes vides séparent les paragraphes */
  const texteLibre = (texte: string) =>
    texte.split(/\n{2,}/).forEach(p => { if (p.trim()) { paragraphe(p.trim()); etat.y += 2; } });

  /** Titre de section (bleu marine, filet rouge) */
  const section = (titre: string) => {
    place(14);
    etat.y += 3;
    doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...MARINE);
    doc.text(titre.toUpperCase(), MARGE, etat.y);
    doc.setDrawColor(...ROUGE); doc.setLineWidth(0.4);
    doc.line(MARGE, etat.y + 1.5, MARGE + 30, etat.y + 1.5);
    etat.y += 8;
  };

  const liste = (elements: string[], numerotee = false) =>
    elements.forEach((el, i) => paragraphe(`${numerotee ? `${i + 1}.` : '•'}  ${el}`, { retrait: 3 }));

  /** Ligne « intitulé ........ valeur » (barème) */
  const ligneValeur = (intitule: string, valeur: string, gras = false) => {
    place(7);
    doc.setFont('times', gras ? 'bold' : 'normal'); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
    const lignes = doc.splitTextToSize(intitule, LARGEUR - 30) as string[];
    lignes.forEach((l, i) => { place(6); doc.text(l, MARGE + 3, etat.y); if (i < lignes.length - 1) etat.y += 5.3; });
    doc.text(valeur, L - MARGE, etat.y, { align: 'right' });
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2);
    doc.line(MARGE, etat.y + 2, L - MARGE, etat.y + 2);
    etat.y += 7;
  };

  const sautDePage = () => { doc.addPage(); entete(); };

  const finaliser = (nomFichier: string) => {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setDrawColor(...MARINE); doc.setLineWidth(0.3);
      doc.line(MARGE, 297 - 14, L - MARGE, 297 - 14);
      doc.setFont('times', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS);
      doc.text(piedGauche, MARGE, 297 - 9);
      doc.text(`Page ${p} / ${total}`, L - MARGE, 297 - 9, { align: 'right' });
    }
    doc.save(nomFichier);
  };

  entete();
  return { doc, etat, paragraphe, texteLibre, section, liste, ligneValeur, sautDePage, finaliser };
}

// ─────────────────────────────────────────────────────────────
// 2a. COMPTE RENDU DE RÉUNION
// ─────────────────────────────────────────────────────────────
export async function exporterCompteRenduPDF(cr: CompteRenduCellule, cellule: Cellule): Promise<void> {
  const d = await documentCharte(`PedaClic — ${cellule.nom}`);
  d.paragraphe('COMPTE RENDU DE RÉUNION', { taille: 18, style: 'bold', couleur: MARINE, centre: true });
  d.etat.y += 3;
  d.paragraphe(cellule.nom, { taille: 13, style: 'bold', couleur: ROUGE });
  d.paragraphe([cellule.discipline, cellule.anneeScolaire, cellule.etablissementNom, cellule.ief].filter(Boolean).join(' · '), { taille: 10, couleur: GRIS });
  d.etat.y += 2;
  d.paragraphe(cr.titre, { taille: 12, style: 'bold' });
  d.paragraphe(`Réunion du ${dateLongue(cr.dateReunion)}${cr.lieu ? ` — ${cr.lieu}` : ''}`, { style: 'italic' });

  d.section(`Présents (${cr.presentsNoms.length})`);
  d.paragraphe(cr.presentsNoms.length ? cr.presentsNoms.join(', ') : 'Non renseigné.');
  if (lignesDe(cr.ordreDuJour).length) { d.section('Ordre du jour'); d.liste(lignesDe(cr.ordreDuJour), true); }
  if (cr.deliberations) { d.section('Déroulement et échanges'); d.texteLibre(cr.deliberations); }
  if (lignesDe(cr.decisions).length) { d.section('Décisions et recommandations'); d.liste(lignesDe(cr.decisions)); }
  if (cr.prochaineReunion) { d.section('Prochaine réunion'); d.paragraphe(dateLongue(cr.prochaineReunion)); }

  d.etat.y += 8;
  d.paragraphe(`Rédigé par ${cr.auteurNom}, animateur de la cellule.`, { style: 'italic', couleur: GRIS, taille: 10 });
  d.finaliser(`CR-${cr.dateReunion}-${slug(cellule.nom)}.pdf`);
}

// ─────────────────────────────────────────────────────────────
// 2b. ÉPREUVE COMMUNE (Phase 51) — sujet + barème [+ corrigé]
// ─────────────────────────────────────────────────────────────
export async function exporterEpreuvePDF(
  epreuve: EpreuveCommune,
  cellule: Cellule,
  avecCorrige: boolean
): Promise<void> {
  const d = await documentCharte(`PedaClic — ${cellule.nom} — ${epreuve.titre}`);
  const typeLibelle = epreuve.type === 'composition' ? 'COMPOSITION' : 'DEVOIR HARMONISÉ';

  // Bloc d'identification de l'épreuve
  d.paragraphe(cellule.etablissementNom || cellule.nom, { taille: 10, couleur: GRIS, centre: true });
  d.etat.y += 4;   // espace avant le grand titre (police plus haute)
  d.paragraphe(`${typeLibelle} — ${cellule.discipline.toUpperCase()}`, { taille: 16, style: 'bold', couleur: MARINE, centre: true });
  d.paragraphe(epreuve.titre, { taille: 12.5, style: 'bold', couleur: ROUGE, centre: true });
  d.paragraphe(
    [`Classe : ${epreuve.classe}`, epreuve.duree && `Durée : ${epreuve.duree}`, epreuve.date && dateLongue(epreuve.date), `Noté sur ${epreuve.noteSur}`]
      .filter(Boolean).join('   •   '),
    { taille: 10.5, centre: true }
  );
  d.etat.y += 3;

  d.section('Sujet');
  d.texteLibre(epreuve.sujet || '—');

  if (epreuve.bareme.length) {
    d.section('Barème');
    epreuve.bareme.forEach(l => d.ligneValeur(l.intitule, `${l.points} pt${l.points > 1 ? 's' : ''}`));
    const total = epreuve.bareme.reduce((s, l) => s + l.points, 0);
    d.ligneValeur('TOTAL', `${total} / ${epreuve.noteSur}`, true);
  }

  if (avecCorrige && epreuve.corrige.trim()) {
    d.sautDePage();
    d.paragraphe('CORRIGÉ — DOCUMENT RÉSERVÉ AUX ENSEIGNANTS', { taille: 13, style: 'bold', couleur: ROUGE, centre: true });
    d.etat.y += 2;
    d.texteLibre(epreuve.corrige);
  }

  d.etat.y += 6;
  d.paragraphe(`Épreuve commune de la cellule — version ${epreuve.version}${epreuve.statut === 'validee' ? ' (validée)' : ' (brouillon)'}.`, { style: 'italic', couleur: GRIS, taille: 9.5 });
  d.finaliser(`${avecCorrige ? 'Corrige' : 'Sujet'}-${slug(epreuve.titre)}.pdf`);
}

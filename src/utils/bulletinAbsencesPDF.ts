/**
 * ============================================================
 * PedaClic — Bulletin de suivi des absences & retards (PDF)
 * Phase 38
 * ============================================================
 *
 * Génère un document PDF récapitulant pour un groupe-classe :
 *   • Le total des absences et retards par élève sur la période
 *     demandée (jour / semaine / mois / scolaire / personnalisé).
 *   • Le détail journalier (date, séance, statut, motif, minutes).
 *   • Une synthèse globale du groupe (cumul, top élèves).
 *
 * Le bulletin peut être :
 *   - Pour un seul élève (mode "individuel") → un PDF par élève.
 *   - Pour tout le groupe (mode "groupe")    → un PDF unique avec
 *     une page par élève + une page de synthèse.
 *
 * Charte graphique PedaClic : bleu primaire #2563eb, accents rouge
 * (absent) / orange (retard) / vert (présent OK).
 *
 * Dépendances : jsPDF + jspdf-autotable (déjà dans package.json)
 * ============================================================
 */

import type { AbsenceGroupe } from '../types/groupeAbsences.types';
import { getEntreeTitres } from '../types/groupeAbsences.types';
import { formatEleveNom, compareParNomFamille } from './formatNom';

// ─────────────────────────────────────────────────────────────
// TYPES PUBLICS
// ─────────────────────────────────────────────────────────────

export interface BulletinEleveInfo {
  /** ID de l'élève (clé Firestore) */
  eleveId: string;
  /** Nom complet brut (sera formatté à l'affichage) */
  eleveNom: string;
  /** Email (optionnel) — affiché en sous-titre */
  eleveEmail?: string;
}

export interface BulletinGroupeInfo {
  /** Nom du groupe-classe (ex. "3ème A — Maths") */
  nom: string;
  /** Matière principale */
  matiere?: string;
  /** Niveau / classe */
  classe?: string;
  /** Année scolaire */
  anneeScolaire?: string;
  /** Nom du professeur (en pied de page) */
  profNom?: string;
}

export interface BulletinPeriode {
  /** Date début (incluse), format YYYY-MM-DD */
  debut: string;
  /** Date fin (incluse), format YYYY-MM-DD */
  fin: string;
  /** Libellé court pour l'en-tête (ex. "Septembre 2025", "Trimestre 1"…) */
  label: string;
}

export interface BulletinOptions {
  groupe: BulletinGroupeInfo;
  /** Élèves à inclure dans le bulletin */
  eleves: BulletinEleveInfo[];
  /** Tous les appels de la période (déjà filtrés côté appelant) */
  absences: AbsenceGroupe[];
  /** Période couverte */
  periode: BulletinPeriode;
  /**
   * "individuel" = 1 page par élève (pas de page de synthèse).
   * "groupe"    = page de synthèse + 1 page par élève.
   */
  mode?: 'individuel' | 'groupe';
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Couleurs PedaClic (RGB) — alignées sur la charte du dashboard prof */
const COULEURS = {
  bleu: [37, 99, 235] as const,        // #2563eb
  bleuFonce: [30, 58, 138] as const,   // #1e3a8a
  rouge: [220, 38, 38] as const,       // #dc2626
  orange: [217, 119, 6] as const,      // #d97706
  vert: [5, 150, 105] as const,        // #059669
  gris: [107, 114, 128] as const,      // #6b7280
  grisClair: [229, 231, 235] as const, // #e5e7eb
};

/** Format jolie d'une date YYYY-MM-DD → "12 sept. 2025" */
function formatDateFR(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Récap par élève sur la période. */
interface RecapEleve {
  eleve: BulletinEleveInfo;
  /** Nb total d'enregistrements d'absence sur la période */
  nbAbsences: number;
  /** Nb total d'enregistrements de retard sur la période */
  nbRetards: number;
  /** Cumul des minutes de retard */
  minutesRetardCumul: number;
  /** Détail jour par jour : (date, statut, séance(s), minutes, motif, commentaire) */
  details: Array<{
    date: string;
    statut: 'absent' | 'retard';
    seances: string[];
    minutes?: number;
    motif?: 'justifie' | 'non_justifie';
    commentaire?: string;
  }>;
}

/** Calcule le récap d'un élève à partir des appels de la période. */
function calculerRecapEleve(
  eleve: BulletinEleveInfo,
  absences: AbsenceGroupe[],
): RecapEleve {
  const details: RecapEleve['details'] = [];
  let nbAbsences = 0;
  let nbRetards = 0;
  let minutesRetardCumul = 0;

  // On parcourt chronologiquement
  const tries = [...absences].sort((a, b) => a.date.localeCompare(b.date));

  for (const a of tries) {
    const seances = getEntreeTitres(a);
    if (a.eleveIdsAbsents?.includes(eleve.eleveId)) {
      nbAbsences++;
      details.push({
        date: a.date,
        statut: 'absent',
        seances,
      });
    }
    if (a.eleveIdsRetards?.includes(eleve.eleveId)) {
      nbRetards++;
      const d = a.retardsDetails?.[eleve.eleveId];
      if (d?.minutes) minutesRetardCumul += d.minutes;
      details.push({
        date: a.date,
        statut: 'retard',
        seances,
        minutes: d?.minutes,
        motif: d?.motif,
        commentaire: d?.commentaire,
      });
    }
  }

  return { eleve, nbAbsences, nbRetards, minutesRetardCumul, details };
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION DU PDF
// ─────────────────────────────────────────────────────────────

/**
 * Génère et télécharge le bulletin de suivi des absences/retards.
 * Renvoie une Promise qui se résout quand le téléchargement est lancé.
 */
export async function genererBulletinAbsencesPDF(
  options: BulletinOptions,
): Promise<void> {
  const { groupe, eleves, absences, periode, mode = 'groupe' } = options;
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Calcul des récaps ──
  const recaps: RecapEleve[] = eleves
    .map((e) => calculerRecapEleve(e, absences))
    .sort((a, b) => compareParNomFamille(a.eleve.eleveNom, b.eleve.eleveNom));

  // ============================================================
  //  PAGE DE GARDE / SYNTHÈSE (mode "groupe")
  // ============================================================
  if (mode === 'groupe') {
    dessinerEnTeteBulletin(doc, groupe, periode);

    // ── Synthèse globale ──
    const totalAbsences = recaps.reduce((s, r) => s + r.nbAbsences, 0);
    const totalRetards = recaps.reduce((s, r) => s + r.nbRetards, 0);
    const totalMinutes = recaps.reduce((s, r) => s + r.minutesRetardCumul, 0);

    doc.setFontSize(13);
    doc.setTextColor(...COULEURS.bleuFonce);
    doc.text('Synthèse du groupe', 14, 50);

    doc.setFontSize(10);
    doc.setTextColor(...COULEURS.gris);
    doc.text(
      `Période du ${formatDateFR(periode.debut)} au ${formatDateFR(periode.fin)} — ${eleves.length} élève(s) suivi(s)`,
      14,
      57,
    );

    autoTable(doc, {
      startY: 62,
      head: [['Indicateur', 'Total']],
      body: [
        ['Absences cumulées (groupe)', String(totalAbsences)],
        ['Retards cumulés (groupe)', String(totalRetards)],
        ['Minutes de retard cumulées', `${totalMinutes} min`],
        ['Élèves avec ≥1 absence', String(recaps.filter((r) => r.nbAbsences > 0).length)],
        ['Élèves avec ≥1 retard', String(recaps.filter((r) => r.nbRetards > 0).length)],
      ],
      headStyles: { fillColor: [...COULEURS.bleu], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 40, halign: 'right' } },
      theme: 'grid',
    });

    // ── Tableau récap par élève ──
    const yApresSyn = (doc as any).lastAutoTable?.finalY ?? 90;
    doc.setFontSize(13);
    doc.setTextColor(...COULEURS.bleuFonce);
    doc.text('Tableau récapitulatif par élève', 14, yApresSyn + 12);

    autoTable(doc, {
      startY: yApresSyn + 16,
      head: [['Élève', 'Absences', 'Retards', 'Minutes cumulées']],
      body: recaps.map((r) => [
        formatEleveNom(r.eleve.eleveNom),
        String(r.nbAbsences),
        String(r.nbRetards),
        `${r.minutesRetardCumul} min`,
      ]),
      headStyles: { fillColor: [...COULEURS.bleu], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right' },
      },
      // Met en surbrillance les élèves « à risque »
      didParseCell: (data) => {
        if (data.section === 'body') {
          const r = recaps[data.row.index];
          if (data.column.index === 1 && r.nbAbsences >= 3) {
            data.cell.styles.textColor = [...COULEURS.rouge];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 2 && r.nbRetards >= 3) {
            data.cell.styles.textColor = [...COULEURS.orange];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      theme: 'striped',
    });

    dessinerPiedDePage(doc, groupe);
  }

  // ============================================================
  //  UNE PAGE PAR ÉLÈVE — DÉTAIL CHRONOLOGIQUE
  // ============================================================
  for (let i = 0; i < recaps.length; i++) {
    const r = recaps[i];
    if (mode === 'groupe' || i > 0) {
      doc.addPage();
    }

    dessinerEnTeteBulletin(doc, groupe, periode);

    // ── En-tête élève ──
    doc.setFontSize(14);
    doc.setTextColor(...COULEURS.bleuFonce);
    doc.text(formatEleveNom(r.eleve.eleveNom), 14, 50);

    if (r.eleve.eleveEmail) {
      doc.setFontSize(9);
      doc.setTextColor(...COULEURS.gris);
      doc.text(r.eleve.eleveEmail, 14, 56);
    }

    // ── Cadre de chiffres clés ──
    const yChiffres = 64;
    dessinerCarteChiffre(doc, 14, yChiffres, 55, 'Absences', String(r.nbAbsences), COULEURS.rouge);
    dessinerCarteChiffre(doc, 75, yChiffres, 55, 'Retards', String(r.nbRetards), COULEURS.orange);
    dessinerCarteChiffre(doc, 136, yChiffres, 55, 'Minutes cumulées', `${r.minutesRetardCumul} min`, COULEURS.bleu);

    // ── Tableau détaillé ──
    const yTable = yChiffres + 30;
    doc.setFontSize(11);
    doc.setTextColor(...COULEURS.bleuFonce);
    doc.text('Détail chronologique', 14, yTable);

    if (r.details.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(...COULEURS.vert);
      doc.text('Aucune absence ni retard sur la période. Continuez ainsi !', 14, yTable + 8);
    } else {
      autoTable(doc, {
        startY: yTable + 4,
        head: [['Date', 'Statut', 'Séance(s)', 'Minutes', 'Motif', 'Commentaire']],
        body: r.details.map((d) => [
          formatDateFR(d.date),
          d.statut === 'absent' ? '🔴 Absent' : '🟠 Retard',
          d.seances.length > 0 ? d.seances.join(' · ') : '—',
          d.statut === 'retard' && d.minutes ? `${d.minutes} min` : '—',
          d.motif === 'justifie'
            ? '✅ Justifié'
            : d.motif === 'non_justifie'
            ? '❌ Non justifié'
            : '—',
          d.commentaire || '—',
        ]),
        headStyles: { fillColor: [...COULEURS.bleu], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 22 },
          2: { cellWidth: 50 },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 28 },
          5: { cellWidth: 'auto' },
        },
        // Couleurs selon statut
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const det = r.details[data.row.index];
            if (det.statut === 'absent') {
              data.cell.styles.textColor = [...COULEURS.rouge];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [...COULEURS.orange];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        theme: 'striped',
      });
    }

    // ── Zone signature ──
    const yFinal = (doc as any).lastAutoTable?.finalY ?? yTable + 30;
    if (yFinal < 250) {
      doc.setDrawColor(...COULEURS.grisClair);
      doc.setFontSize(9);
      doc.setTextColor(...COULEURS.gris);
      doc.text('Signature du professeur', 14, yFinal + 25);
      doc.line(14, yFinal + 30, 80, yFinal + 30);
      doc.text('Signature du parent / responsable', pageWidth - 80, yFinal + 25);
      doc.line(pageWidth - 80, yFinal + 30, pageWidth - 14, yFinal + 30);
    }

    dessinerPiedDePage(doc, groupe);
  }

  // ── Téléchargement ──
  const safeNom = groupe.nom.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const safePeriode = periode.label.replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`PedaClic_Bulletin_${safeNom}_${safePeriode}.pdf`);
}

// ─────────────────────────────────────────────────────────────
// HELPERS DE DESSIN
// ─────────────────────────────────────────────────────────────

/** En-tête PedaClic en haut de chaque page. */
function dessinerEnTeteBulletin(
  doc: any,
  groupe: BulletinGroupeInfo,
  periode: BulletinPeriode,
) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Bandeau bleu PedaClic
  doc.setFillColor(...COULEURS.bleu);
  doc.rect(0, 0, pageWidth, 18, 'F');

  // Titre
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Bulletin de suivi — Absences & retards', 14, 11);

  // Sous-titre
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PedaClic', pageWidth - 14, 11, { align: 'right' });

  // Infos groupe
  doc.setFontSize(11);
  doc.setTextColor(...COULEURS.bleuFonce);
  doc.setFont('helvetica', 'bold');
  doc.text(groupe.nom, 14, 28);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COULEURS.gris);
  const meta: string[] = [];
  if (groupe.matiere) meta.push(groupe.matiere);
  if (groupe.classe) meta.push(groupe.classe);
  if (groupe.anneeScolaire) meta.push(groupe.anneeScolaire);
  if (meta.length > 0) {
    doc.text(meta.join(' • '), 14, 34);
  }
  doc.text(
    `Période : ${periode.label} (${formatDateFR(periode.debut)} → ${formatDateFR(periode.fin)})`,
    14,
    40,
  );
}

/** Pied de page : prof + date d'édition + numéro de page. */
function dessinerPiedDePage(doc: any, groupe: BulletinGroupeInfo) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(8);
  doc.setTextColor(...COULEURS.gris);
  const dateEdition = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  if (groupe.profNom) {
    doc.text(`Édité par ${groupe.profNom} — ${dateEdition}`, 14, pageHeight - 8);
  } else {
    doc.text(`Édité le ${dateEdition}`, 14, pageHeight - 8);
  }
  // Numéro de page (à droite)
  const pageNum = (doc as any).internal.getNumberOfPages
    ? (doc as any).internal.getNumberOfPages()
    : (doc as any).getNumberOfPages?.();
  if (pageNum) {
    doc.text(`Page ${pageNum}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

/** Carte « chiffre clé » : label + grand nombre + bordure de couleur. */
function dessinerCarteChiffre(
  doc: any,
  x: number,
  y: number,
  largeur: number,
  label: string,
  valeur: string,
  couleur: readonly [number, number, number],
) {
  // Cadre
  doc.setDrawColor(...couleur);
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, largeur, 22, 2, 2, 'S');

  // Label
  doc.setFontSize(8);
  doc.setTextColor(...COULEURS.gris);
  doc.setFont('helvetica', 'normal');
  doc.text(label.toUpperCase(), x + 4, y + 7);

  // Valeur
  doc.setFontSize(16);
  doc.setTextColor(...couleur);
  doc.setFont('helvetica', 'bold');
  doc.text(valeur, x + 4, y + 17);
}

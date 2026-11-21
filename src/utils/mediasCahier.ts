// ============================================================
// PedaClic — Phase 58 : index des « Médias partagés » d'un cahier
// ------------------------------------------------------------
// Logique PURE (aucun appel Firestore, aucune donnée stockée).
// L'index est recalculé à partir des séances DÉJÀ chargées :
//   • côté prof  : toutes les séances du cahier ;
//   • côté élève : uniquement les séances réalisées et partagées
//                  (celles que l'élève voit déjà).
// Sources lues dans chaque séance :
//   piecesJointes (fichiers Storage), liens (liens externes),
//   ebooksLies (ebooks PedaClic).
// Une même ressource utilisée dans plusieurs séances n'apparaît
// qu'une fois, avec la liste de ses séances.
// ============================================================

import type { EntreeCahier } from '../types/cahierTextes.types';

/** Familles affichées dans l'onglet Médias */
export type FamilleMedia = 'pdf' | 'image' | 'audio' | 'video' | 'document' | 'lien' | 'ebook';

export const FAMILLES_MEDIA: { id: FamilleMedia; label: string; code: string }[] = [
  { id: 'pdf',      label: 'Documents PDF',  code: 'PDF' },
  { id: 'document', label: 'Autres fichiers', code: 'DOC' },
  { id: 'image',    label: 'Images',          code: 'IMG' },
  { id: 'audio',    label: 'Audio',           code: 'AUD' },
  { id: 'video',    label: 'Vidéos',          code: 'VID' },
  { id: 'lien',     label: 'Liens externes',  code: 'URL' },
  { id: 'ebook',    label: 'Ebooks',          code: 'LIV' },
];

/** Séance de rattachement (résumé suffisant pour l'affichage) */
export interface SeanceRef {
  id: string;
  date: Date;
  chapitre: string;
}

/** Ressource indexée */
export interface RessourceCahier {
  /** Clé de dédoublonnage (url ou ebook:<id>) */
  cle: string;
  famille: FamilleMedia;
  nom: string;
  /** Adresse d'ouverture : url du fichier / du lien, ou page ebooks */
  url: string;
  /** Lien externe (true) ou fichier/ebook interne (false) */
  externe: boolean;
  taille?: number;
  seances: SeanceRef[];
  /** Date de la séance la plus récente (tri « plus récent ») */
  derniereDate: Date;
}

// ─────────────────────────────────────────────────────────────
// Détection du type d'un fichier (MIME Phase 21 ou MediaType Phase 22)
// ─────────────────────────────────────────────────────────────
function familleFichier(type: string | undefined, mime: string | undefined, nom: string): FamilleMedia {
  const t = `${type ?? ''} ${mime ?? ''}`.toLowerCase();
  if (t.includes('pdf')) return 'pdf';
  if (t.includes('image')) return 'image';
  if (t.includes('audio')) return 'audio';
  if (t.includes('video')) return 'video';
  const ext = nom.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video';
  return 'document';
}

/** Taille lisible : 312 Ko, 2,1 Mo… */
export function formaterTaille(octets?: number): string {
  if (!octets || octets <= 0) return '';
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/**
 * Construit l'index des ressources partagées d'un cahier.
 * @returns ressources triées de la plus récente à la plus ancienne
 */
export function indexerMediasCahier(entrees: EntreeCahier[]): RessourceCahier[] {
  const index = new Map<string, RessourceCahier>();

  // Ajoute (ou complète) une ressource, en rattachant la séance
  const ajouter = (r: Omit<RessourceCahier, 'seances' | 'derniereDate'>, s: SeanceRef) => {
    const exist = index.get(r.cle);
    if (exist) {
      if (!exist.seances.some(x => x.id === s.id)) exist.seances.push(s);
      if (s.date > exist.derniereDate) exist.derniereDate = s.date;
      return;
    }
    index.set(r.cle, { ...r, seances: [s], derniereDate: s.date });
  };

  for (const e of entrees) {
    const date = e.date?.toDate?.() ?? new Date(0);
    const s: SeanceRef = { id: e.id, date, chapitre: e.chapitre || 'Séance' };

    // 1. Fichiers déposés (Firebase Storage)
    for (const pj of e.piecesJointes ?? []) {
      if (!pj?.url) continue;
      ajouter({
        cle: pj.url,
        famille: familleFichier(pj.type, pj.mimeType, pj.nom ?? ''),
        nom: pj.nom || 'Fichier',
        url: pj.url,
        externe: false,
        taille: pj.taille,
      }, s);
    }

    // 2. Liens externes (vidéos en ligne, articles, exercices…)
    for (const l of e.liens ?? []) {
      if (!l?.url) continue;
      ajouter({
        cle: l.url,
        famille: 'lien',
        nom: l.titre || l.url,
        url: l.url,
        externe: true,
      }, s);
    }

    // 3. Ebooks de la bibliothèque PedaClic
    for (const b of e.ebooksLies ?? []) {
      if (!b?.ebookId) continue;
      ajouter({
        cle: `ebook:${b.ebookId}`,
        famille: 'ebook',
        nom: b.auteur ? `${b.titre} — ${b.auteur}` : b.titre,
        url: '/ebooks',
        externe: false,
      }, s);
    }
  }

  // Séances de chaque ressource : plus récente d'abord
  const liste = [...index.values()];
  liste.forEach(r => r.seances.sort((a, b) => b.date.getTime() - a.date.getTime()));
  return liste.sort((a, b) => b.derniereDate.getTime() - a.derniereDate.getTime());
}

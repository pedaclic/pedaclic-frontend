/**
 * ============================================================================
 * UTILITAIRES FICHIERS DES RESSOURCES - PedaClic
 * ============================================================================
 * [FIX ressources] Fonctions partagées entre :
 *   - la page élève  : src/pages/ResourceView.tsx
 *   - l'aperçu admin : src/components/admin/ResourceManager.tsx
 *
 * Pourquoi ? Les URL Firebase Storage ont la forme
 *   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/ressources%2F<id>%2Ffichier_123.pdf?alt=media&token=…
 * Un test du type /\.pdf$/ échoue donc (l'URL finit par le token) : le PDF
 * n'était ni affiché ni correctement proposé au téléchargement.
 * ============================================================================
 */

/** Catégorie d'affichage d'un fichier joint */
export type TypeFichier = 'pdf' | 'video' | 'image' | 'other';

/**
 * Détermine le type d'un fichier joint.
 * On teste le nom d'origine (fichierNom) puis le chemin de l'URL,
 * débarrassé de sa query string et décodé.
 */
export const getFileType = (url: string, nom?: string): TypeFichier => {
  let chemin = (url || '').split('?')[0];
  try { chemin = decodeURIComponent(chemin); } catch { /* URL non décodable : on garde brut */ }
  const cible = `${nom || ''} ${chemin}`.toLowerCase();
  if (/\.pdf\b/.test(cible)) return 'pdf';
  if (/\.(mp4|webm|ogg|mov)\b/.test(cible)) return 'video';
  if (/\.(jpe?g|png|gif|webp|svg)\b/.test(cible)) return 'image';
  return 'other';
};

/** Le contenu contient-il des balises HTML ? (sinon : texte brut saisi au clavier) */
export const estHtml = (texte: string): boolean => /<\/?[a-z][\s\S]*?>/i.test(texte);

/** URL d'intégration YouTube à partir d'une URL « watch », « shorts » ou « youtu.be » */
export const toEmbedUrl = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
};

/**
 * Télécharge un fichier distant sous son nom d'origine.
 * L'attribut HTML `download` est ignoré pour une URL d'un autre domaine
 * (Firebase Storage) : on récupère donc le fichier en Blob (le bucket
 * autorise GET depuis pedaclic.sn — voir cors.json). En cas d'échec
 * (CORS, réseau), on ouvre le fichier dans un nouvel onglet.
 */
export const telechargerFichier = async (url: string, nom?: string): Promise<void> => {
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const blob = await reponse.blob();
    const lienLocal = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = lienLocal;
    a.download = nom || 'fichier';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(lienLocal), 1000);
  } catch (err) {
    console.warn('Téléchargement direct impossible, ouverture du fichier :', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

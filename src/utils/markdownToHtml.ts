// ============================================================
// PedaClic — Utilitaire markdownToHtml
// ------------------------------------------------------------
// Convertisseur Markdown → HTML léger, sans dépendance externe.
//
// Pourquoi ce module est partagé :
//   - Le générateur IA (AIGenerator) a historiquement défini sa
//     propre fonction `markdownToHtml` en interne.
//   - Le viewer d'ebook a besoin du MÊME convertisseur pour
//     afficher les ebooks compilés (qui stockent les sections
//     au format Markdown directement dans Firestore).
//   - Avoir une seule source garantit que le rendu côté
//     compilation (preview, export PDF/Word) et côté lecture
//     en bibliothèque est strictement identique.
//
// NB : ce parseur reste volontairement minimal — il couvre les
// éléments produits par notre générateur IA (titres, gras,
// italiques, listes, code, hr). Pour des cas plus avancés on
// pourrait passer à `marked` ou `markdown-it`.
// ============================================================

/**
 * Convertit un texte Markdown simple en HTML.
 *
 * Couvre :
 *   - Titres H1/H2/H3 (`#`, `##`, `###`)
 *   - Gras (`**texte**`) et italique (`*texte*`)
 *   - Listes à puces (`- item`) et numérotées (`1. item`)
 *   - Séparateurs horizontaux (`---`)
 *   - Blocs de code (``` ```) et code inline (``)
 *   - Paragraphes (lignes vides) et retours à la ligne
 *
 * @param md  texte Markdown à convertir
 * @returns   HTML prêt à être injecté dans dangerouslySetInnerHTML
 */
export function markdownToHtml(md: string): string {
  if (!md) return '';

  let html = md
    // Titres (ordre important : ### avant ## avant #)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Gras et italique
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Listes à puces
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Listes numérotées
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Séparateurs
    .replace(/^---$/gm, '<hr />')
    // Blocs de code (multilignes)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Code inline
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Paragraphes (lignes vides)
    .replace(/\n\n/g, '</p><p>')
    // Retours à la ligne simples
    .replace(/\n/g, '<br />');

  // Entoure les séquences de <li> consécutifs dans des <ul>
  html = html.replace(/(<li>.*?<\/li>(\s*<br \/>)?)+/g, (match) => {
    return '<ul>' + match.replace(/<br \/>/g, '') + '</ul>';
  });

  return `<p>${html}</p>`;
}

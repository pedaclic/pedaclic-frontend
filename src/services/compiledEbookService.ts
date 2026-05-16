// ============================================================
// PedaClic — Phase 23 : compiledEbookService
// Service Firestore pour les ebooks compilés depuis le
// Générateur IA (collection : compiled_ebooks)
//
// ─── Évolution ─────────────────────────────────────────────
// À partir de cette version, la sauvegarde d'un ebook compilé
// déclenche aussi une PUBLICATION automatique dans la collection
// `ebooks` (via `publishCompiledEbookToLibrary` du ebookService),
// avec `isActive=false` pour modération admin.
// Cela garantit que les ebooks compilés par les profs apparaissent
// immédiatement :
//   • dans la bibliothèque privée du prof (avec badge "en attente")
//   • dans le panneau Admin pour activation/diffusion publique
// ============================================================

import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { GenerationType } from './aiGeneratorService';
import { publishCompiledEbookToLibrary } from './ebookService';

// ==================== TYPES ====================

export interface CompiledSection {
  contenuId:  string;         // ID du generated_content source
  type:       GenerationType;
  discipline: string;
  classe:     string;
  chapitre:   string;
  content:    string;         // Texte Markdown
}

export interface CompiledEbook {
  id?:         string;
  userId:      string;
  titre:       string;
  description: string;
  sections:    CompiledSection[];
  createdAt:   Timestamp;
}

const COL = 'compiled_ebooks';

// ==================== SERVICE ====================

/**
 * Résultat retourné par saveCompiledEbook.
 *
 * On expose volontairement le détail des deux écritures pour que l'UI
 * puisse afficher un message précis :
 *   - succès complet : "Archivé + publié pour modération"
 *   - publication échouée : "Archivé, mais publication impossible"
 *
 * Sans ce contrat, le composant appelant ne pouvait pas distinguer
 * les deux cas et affichait le même message de succès trompeur même
 * quand la publication dans la bibliothèque avait été rejetée par
 * les règles Firestore (ce qui était le bug observé en prod).
 */
export interface SaveCompiledEbookResult {
  /** ID du document créé dans `compiled_ebooks` (archive personnelle). */
  archiveId: string;
  /** ID du document créé dans `ebooks` (publication), ou null si échec. */
  publishedId: string | null;
  /** Erreur de publication éventuelle (ex. PERMISSION_DENIED). */
  publishError?: string;
}

/**
 * Sauvegarde un ebook compilé dans Firestore.
 *
 * Cette fonction enchaîne DEUX écritures :
 *   1. La collection historique `compiled_ebooks` (archive personnelle
 *      du prof, accessible depuis le générateur IA → "Mes ebooks compilés").
 *   2. La collection publique `ebooks` via `publishCompiledEbookToLibrary`
 *      en mode `isActive=false` (en attente d'activation par l'admin).
 *
 * Pourquoi deux écritures plutôt qu'une seule ?
 *   - On préserve l'archive personnelle existante (les profs peuvent
 *     déjà avoir des dizaines de compilations privées qu'on ne veut pas
 *     migrer).
 *   - On surface immédiatement la compilation dans le panneau Admin
 *     pour modération, sans modifier la sémantique de `compiled_ebooks`.
 *   - L'échec de la publication publique n'empêche pas la sauvegarde
 *     privée (le prof ne perd jamais son travail) — mais on REMONTE
 *     l'erreur au composant UI au lieu de l'avaler silencieusement.
 *
 * Politique d'erreur :
 *   - Échec étape 1 (archive) → exception propagée (l'utilisateur doit
 *     savoir que rien n'a été sauvegardé).
 *   - Échec étape 2 (publication) → résultat avec `publishedId=null`
 *     et `publishError` renseigné. L'archive est intacte, l'UI peut
 *     proposer un message dégradé sans bloquer l'utilisateur.
 *
 * @param userId       uid Firebase du prof Premium
 * @param titre        titre choisi par le prof
 * @param description  description (optionnelle)
 * @param sections     sections compilées (Markdown)
 * @param auteur       nom affiché du prof (utilisé pour la publication)
 */
export async function saveCompiledEbook(
  userId: string,
  titre: string,
  description: string,
  sections: CompiledSection[],
  auteur?: string
): Promise<SaveCompiledEbookResult> {
  // --- 1. Archive personnelle (comportement historique) ---
  // Si cette étape échoue, on propage l'exception car rien n'a pu
  // être enregistré et l'utilisateur doit le savoir.
  const ref = await addDoc(collection(db, COL), {
    userId,
    titre,
    description,
    sections,
    createdAt: Timestamp.now(),
  });

  // --- 2. Publication dans la bibliothèque (modération admin) ---
  let publishedId: string | null = null;
  let publishError: string | undefined;
  try {
    publishedId = await publishCompiledEbookToLibrary({
      userId,
      titre,
      description,
      auteur: auteur || 'Prof Premium',
      // CompiledSection (local) et EbookCompiledSection (types) ont la même
      // shape — `as any` évite de dupliquer la conversion. Si les deux
      // types divergent un jour, le compilateur TS le signalera.
      sections: sections as any,
    });
  } catch (err: any) {
    // Non-bloquant : on signale en console ET on remonte un message
    // exploitable pour l'UI. Causes les plus fréquentes :
    //   - Règles Firestore (permission-denied) → mise à jour du déploiement
    //     `firebase deploy --only firestore:rules` requise.
    //   - Connexion réseau perdue avant la 2e écriture.
    const code = err?.code || '';
    const msg  = err?.message || String(err);
    console.error(
      '[compiledEbookService] Échec de la publication dans la bibliothèque ' +
      '(l\'archive privée a néanmoins été sauvegardée) :',
      { code, msg, err }
    );
    if (code === 'permission-denied' || /permission/i.test(msg)) {
      publishError = "Publication refusée par les règles de sécurité Firestore. "
        + "Demandez à l'admin de déployer les dernières règles "
        + "(firebase deploy --only firestore:rules).";
    } else if (/network|offline|unavailable/i.test(msg)) {
      publishError = "Réseau indisponible : l'ebook est archivé localement, "
        + "mais sa publication a échoué. Réessayez plus tard depuis 'Mes ebooks compilés'.";
    } else {
      publishError = `Publication dans la bibliothèque échouée : ${msg}`;
    }
  }

  return { archiveId: ref.id, publishedId, publishError };
}

/**
 * Récupère tous les ebooks compilés d'un utilisateur,
 * triés du plus récent au plus ancien.
 */
export async function getCompiledEbooks(
  userId: string,
  limitCount = 30
): Promise<CompiledEbook[]> {
  const q = query(
    collection(db, COL),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  const results: CompiledEbook[] = [];
  snap.forEach(d => {
    if (results.length < limitCount) {
      results.push({ id: d.id, ...d.data() } as CompiledEbook);
    }
  });
  return results;
}

/**
 * Supprime un ebook compilé.
 */
export async function deleteCompiledEbook(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

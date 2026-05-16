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
 *     privée (le prof ne perd jamais son travail) — on log la tentative
 *     ratée mais on retourne quand même l'ID privé.
 *
 * @param userId       uid Firebase du prof Premium
 * @param titre        titre choisi par le prof
 * @param description  description (optionnelle)
 * @param sections     sections compilées (Markdown)
 * @param auteur       nom affiché du prof (utilisé pour la publication)
 * @returns l'ID du document créé dans `compiled_ebooks` (jamais celui d'`ebooks`)
 */
export async function saveCompiledEbook(
  userId: string,
  titre: string,
  description: string,
  sections: CompiledSection[],
  auteur?: string
): Promise<string> {
  // --- 1. Archive personnelle (comportement historique) ---
  const ref = await addDoc(collection(db, COL), {
    userId,
    titre,
    description,
    sections,
    createdAt: Timestamp.now(),
  });

  // --- 2. Publication dans la bibliothèque (modération admin) ---
  // Fire-and-forget contrôlé : on `await` pour pouvoir logger l'erreur
  // mais on n'interrompt PAS le flux : la sauvegarde privée est déjà
  // réussie, le prof verrait sinon une erreur trompeuse "Échec de la
  // sauvegarde" alors que son archive est intacte.
  try {
    await publishCompiledEbookToLibrary({
      userId,
      titre,
      description,
      auteur: auteur || 'Prof Premium',
      // CompiledSection (local) et EbookCompiledSection (types) ont la même
      // shape — `as any` évite de dupliquer la conversion. Si les deux
      // types divergent un jour, le compilateur TS le signalera.
      sections: sections as any,
    });
  } catch (err) {
    // Non-bloquant : on signale en console mais l'archive privée
    // est intacte → le prof peut retenter via "Republier" plus tard.
    console.warn(
      '[compiledEbookService] Échec de la publication dans la bibliothèque ' +
      '(l\'archive privée a néanmoins été sauvegardée) :',
      err
    );
  }

  return ref.id;
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

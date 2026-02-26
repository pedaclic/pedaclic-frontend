// ============================================================
// PedaClic — Phase 23 : compiledEbookService
// Service Firestore pour les ebooks compilés depuis le
// Générateur IA (collection : compiled_ebooks)
// ============================================================

import {
  collection, addDoc, getDocs, deleteDoc,
  doc, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { GenerationType } from './aiGeneratorService';

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
 * Retourne l'ID du document créé.
 */
export async function saveCompiledEbook(
  userId: string,
  titre: string,
  description: string,
  sections: CompiledSection[]
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    userId,
    titre,
    description,
    sections,
    createdAt: Timestamp.now(),
  });
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

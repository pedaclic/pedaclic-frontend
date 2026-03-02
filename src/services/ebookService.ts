// ==================== SERVICE EBOOKS - PHASE 20 ====================
// PedaClic : CRUD Firestore pour la bibliothèque Ebooks
// Gestion complète : ajout, modification, suppression, filtrage
// ===============================================================

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { db, storage } from '../firebase';
import {
  Ebook,
  EbookFormData,
  EbookFilters,
  EbookStats,
  CategorieEbook,
  CATEGORIE_LABELS
} from '../types/ebook.types';
import { normaliserClassePourComparaison } from '../types/cahierTextes.types';

// --- Référence à la collection Firestore ---
const EBOOKS_COLLECTION = 'ebooks';

// ==================== LECTURE ====================

/**
 * Récupère tous les ebooks actifs
 * Triés par ordre puis par date de création (récent en premier)
 */
export async function getAllEbooks(): Promise<Ebook[]> {
  try {
    const q = query(
      collection(db, EBOOKS_COLLECTION),
      where('isActive', '==', true),
      orderBy('ordre', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || null
    })) as Ebook[];
  } catch (error) {
    console.error('❌ Erreur récupération ebooks:', error);
    throw error;
  }
}

/**
 * Récupère tous les ebooks (y compris inactifs) pour l'admin
 */
export async function getAllEbooksAdmin(): Promise<Ebook[]> {
  try {
    const q = query(
      collection(db, EBOOKS_COLLECTION),
      orderBy('ordre', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || null
    })) as Ebook[];
  } catch (error) {
    console.error('❌ Erreur récupération ebooks admin:', error);
    throw error;
  }
}

/**
 * Récupère un ebook par son ID
 */
export async function getEbookById(id: string): Promise<Ebook | null> {
  try {
    const docSnap = await getDoc(doc(db, EBOOKS_COLLECTION, id));
    if (!docSnap.exists()) return null;
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate() || new Date(),
      updatedAt: docSnap.data().updatedAt?.toDate() || null
    } as Ebook;
  } catch (error) {
    console.error('❌ Erreur récupération ebook:', error);
    throw error;
  }
}

/**
 * Filtre les ebooks selon les critères
 * Le filtrage se fait côté client pour éviter les index composites complexes
 */
export function filterEbooks(ebooks: Ebook[], filters: EbookFilters): Ebook[] {
  let result = [...ebooks];

  // --- Filtre par catégorie ---
  if (filters.categorie && filters.categorie !== 'all') {
    result = result.filter(e => e.categorie === filters.categorie);
  }

  // --- Filtre par niveau ---
  if (filters.niveau && filters.niveau !== 'all') {
    result = result.filter(e => e.niveau === filters.niveau);
  }

  // --- Filtre par classe (normalisation pour rétrocompat 6eme/6ème) ---
  if (filters.classe && filters.classe !== 'all') {
    const fNorm = normaliserClassePourComparaison(filters.classe);
    result = result.filter((e) => {
      if (e.classe === 'all') return true;
      return normaliserClassePourComparaison(e.classe as string) === fNorm;
    });
  }

  // --- Filtre par matière ---
  if (filters.matiere) {
    result = result.filter(e =>
      e.matiere?.toLowerCase().includes(filters.matiere!.toLowerCase())
    );
  }

  // --- Recherche textuelle ---
  if (filters.recherche) {
    const search = filters.recherche.toLowerCase();
    result = result.filter(e =>
      e.titre.toLowerCase().includes(search) ||
      e.auteur.toLowerCase().includes(search) ||
      e.description.toLowerCase().includes(search) ||
      e.tags?.some(t => t.toLowerCase().includes(search))
    );
  }

  return result;
}

// ==================== ÉCRITURE (Admin) ====================

/**
 * Ajoute un nouvel ebook
 * Upload le PDF + la couverture dans Firebase Storage
 * Crée le document dans Firestore
 * 
 * @param formData - Métadonnées de l'ebook
 * @param pdfFile - Fichier PDF complet
 * @param coverFile - Image de couverture (optionnel)
 * @param previewFile - PDF aperçu (optionnel, premières pages)
 * @param adminId - ID de l'admin qui upload
 */
export async function addEbook(
  formData: EbookFormData,
  pdfFile: File,
  coverFile?: File | null,
  previewFile?: File | null,
  adminId?: string
): Promise<string> {
  try {
    // --- 1. Upload du PDF complet dans Firebase Storage ---
    const pdfRef = ref(storage, `ebooks/pdf/${Date.now()}_${pdfFile.name}`);
    await uploadBytes(pdfRef, pdfFile);
    const fichierURL = await getDownloadURL(pdfRef);

    // --- 2. Upload de la couverture (si fournie) ---
    let couvertureURL = '';
    if (coverFile) {
      const coverRef = ref(storage, `ebooks/covers/${Date.now()}_${coverFile.name}`);
      await uploadBytes(coverRef, coverFile);
      couvertureURL = await getDownloadURL(coverRef);
    }

    // --- 3. Upload de l'aperçu (si fourni) ---
    let aperçuURL = '';
    if (previewFile) {
      const previewRef = ref(storage, `ebooks/previews/${Date.now()}_${previewFile.name}`);
      await uploadBytes(previewRef, previewFile);
      aperçuURL = await getDownloadURL(previewRef);
    }

    // --- 4. Création du document Firestore ---
    const ebookData = {
      ...formData,
      fichierURL,
      couvertureURL,
      aperçuURL,
      tailleFichier: pdfFile.size,
      nombreTelechargements: 0,
      nombreVues: 0,
      uploadedBy: adminId || 'admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, EBOOKS_COLLECTION), ebookData);
    console.log(`✅ Ebook ajouté : ${formData.titre} (ID: ${docRef.id})`);
    return docRef.id;

  } catch (error) {
    console.error('❌ Erreur ajout ebook:', error);
    throw error;
  }
}

/**
 * Met à jour un ebook existant
 * Si un nouveau PDF ou couverture est fourni, remplace l'ancien dans Storage
 */
export async function updateEbook(
  id: string,
  formData: Partial<EbookFormData>,
  pdfFile?: File | null,
  coverFile?: File | null,
  previewFile?: File | null
): Promise<void> {
  try {
    const updateData: Record<string, any> = {
      ...formData,
      updatedAt: serverTimestamp()
    };

    // --- Remplacement du PDF si nouveau fichier ---
    if (pdfFile) {
      const pdfRef = ref(storage, `ebooks/pdf/${Date.now()}_${pdfFile.name}`);
      await uploadBytes(pdfRef, pdfFile);
      updateData.fichierURL = await getDownloadURL(pdfRef);
      updateData.tailleFichier = pdfFile.size;
    }

    // --- Remplacement de la couverture si nouvelle image ---
    if (coverFile) {
      const coverRef = ref(storage, `ebooks/covers/${Date.now()}_${coverFile.name}`);
      await uploadBytes(coverRef, coverFile);
      updateData.couvertureURL = await getDownloadURL(coverRef);
    }

    // --- Remplacement de l'aperçu si nouveau fichier ---
    if (previewFile) {
      const previewRef = ref(storage, `ebooks/previews/${Date.now()}_${previewFile.name}`);
      await uploadBytes(previewRef, previewFile);
      updateData.aperçuURL = await getDownloadURL(previewRef);
    }

    await updateDoc(doc(db, EBOOKS_COLLECTION, id), updateData);
    console.log(`✅ Ebook mis à jour : ${id}`);

  } catch (error) {
    console.error('❌ Erreur mise à jour ebook:', error);
    throw error;
  }
}

/**
 * Supprime un ebook (document Firestore + fichiers Storage)
 */
export async function deleteEbook(id: string): Promise<void> {
  try {
    // --- Récupérer l'ebook pour avoir les URLs des fichiers ---
    const ebook = await getEbookById(id);
    if (!ebook) throw new Error('Ebook introuvable');

    // --- Supprimer les fichiers dans Storage ---
    try {
      if (ebook.fichierURL) {
        const pdfRef = ref(storage, ebook.fichierURL);
        await deleteObject(pdfRef);
      }
      if (ebook.couvertureURL) {
        const coverRef = ref(storage, ebook.couvertureURL);
        await deleteObject(coverRef);
      }
      if (ebook.aperçuURL) {
        const previewRef = ref(storage, ebook.aperçuURL);
        await deleteObject(previewRef);
      }
    } catch (storageError) {
      console.warn('⚠️ Fichiers Storage non supprimés (peut-être déjà supprimés)');
    }

    // --- Supprimer le document Firestore ---
    await deleteDoc(doc(db, EBOOKS_COLLECTION, id));
    console.log(`✅ Ebook supprimé : ${id}`);

  } catch (error) {
    console.error('❌ Erreur suppression ebook:', error);
    throw error;
  }
}

/**
 * Active/désactive un ebook
 */
export async function toggleEbookActive(id: string, isActive: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, EBOOKS_COLLECTION, id), {
      isActive,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('❌ Erreur toggle ebook:', error);
    throw error;
  }
}

// ==================== COMPTEURS ====================

/**
 * Incrémente le compteur de vues d'un ebook
 */
export async function incrementVues(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, EBOOKS_COLLECTION, id), {
      nombreVues: increment(1)
    });
  } catch (error) {
    console.error('⚠️ Erreur incrément vues:', error);
  }
}

/**
 * Incrémente le compteur de téléchargements d'un ebook
 */
export async function incrementTelechargements(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, EBOOKS_COLLECTION, id), {
      nombreTelechargements: increment(1)
    });
  } catch (error) {
    console.error('⚠️ Erreur incrément téléchargements:', error);
  }
}

// ==================== STATISTIQUES (Admin) ====================

/**
 * Calcule les statistiques de la bibliothèque
 */
export function calculateEbookStats(ebooks: Ebook[]): EbookStats {
  const stats: EbookStats = {
    totalEbooks: ebooks.length,
    totalTelechargements: 0,
    totalVues: 0,
    parCategorie: {
      manuel: 0,
      annale: 0,
      guide: 0,
      litterature: 0,
      fiche: 0
    },
    ebooksActifs: 0
  };

  ebooks.forEach(ebook => {
    stats.totalTelechargements += ebook.nombreTelechargements || 0;
    stats.totalVues += ebook.nombreVues || 0;
    stats.parCategorie[ebook.categorie] = (stats.parCategorie[ebook.categorie] || 0) + 1;
    if (ebook.isActive) stats.ebooksActifs++;
  });

  return stats;
}

// ==================== UTILITAIRES ====================

/**
 * Formate la taille d'un fichier en Mo/Ko lisible
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Liste de repli (fallback) quand Firestore disciplines est indisponible.
 * La source canonique est /admin/Disciplines (collection disciplines).
 */
export const MATIERES_DISPONIBLES_FALLBACK = [
  'Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Anglais',
  'Histoire-Géographie', 'Philosophie', 'Économie', 'Comptabilité',
  'Éducation civique', 'Arabe', 'Espagnol', 'Informatique',
];

/** @deprecated Utiliser useDisciplinesOptions ou MATIERES_DISPONIBLES_FALLBACK */
export const MATIERES_DISPONIBLES = MATIERES_DISPONIBLES_FALLBACK;

// ==================== SERVICE EBOOKS - PHASE 20 ====================
// PedaClic : CRUD Firestore pour la bibliothèque Ebooks
// Gestion complète : ajout, modification, suppression, filtrage
// ===============================================================

import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
  Timestamp,
  type QuerySnapshot,
  type DocumentData,
  type Unsubscribe
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
  FormatEbook,
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
 * Mappe un QuerySnapshot Firestore vers un tableau d'Ebook[].
 * Centralise la conversion Timestamp → Date pour éviter la duplication.
 */
function mapSnapshotToEbooks(snapshot: QuerySnapshot<DocumentData>): Ebook[] {
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate() || new Date(),
    updatedAt: d.data().updatedAt?.toDate() || null
  })) as Ebook[];
}

/**
 * Récupère tous les ebooks (y compris inactifs) pour l'admin.
 * @param forceServer - si true, contourne le cache IndexedDB et force une lecture serveur
 */
export async function getAllEbooksAdmin(forceServer = false): Promise<Ebook[]> {
  try {
    const q = query(
      collection(db, EBOOKS_COLLECTION),
      orderBy('ordre', 'asc')
    );
    const snapshot = forceServer ? await getDocsFromServer(q) : await getDocs(q);
    return mapSnapshotToEbooks(snapshot);
  } catch (error) {
    console.error('❌ Erreur récupération ebooks admin:', error);
    throw error;
  }
}

/**
 * S'abonne en temps réel à la collection ebooks (admin).
 * Toute modification serveur (incrément vues/téléchargements, ajout, édition,
 * suppression) déclenche `onUpdate` immédiatement.
 *
 * @param onUpdate - callback invoqué à chaque changement avec la liste à jour
 * @param onError  - callback invoqué en cas d'erreur du listener
 * @returns la fonction `unsubscribe` à appeler au démontage du composant
 */
export function subscribeToAllEbooksAdmin(
  onUpdate: (ebooks: Ebook[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, EBOOKS_COLLECTION),
    orderBy('ordre', 'asc')
  );
  return onSnapshot(
    q,
    (snapshot) => onUpdate(mapSnapshotToEbooks(snapshot)),
    (error) => {
      console.error('❌ Erreur listener ebooks admin:', error);
      onError?.(error);
    }
  );
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
 * Sanitise un nom de fichier pour éviter les caractères problématiques
 * dans Firebase Storage (slashs, accents, espaces multiples).
 * Conserve les lettres ASCII, chiffres, point, tiret et underscore.
 */
function sanitizeStorageFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les diacritiques (marques combinantes unicode)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'fichier';
}

/**
 * Construit un Blob HTML à partir d'un fichier .html OU d'un code source collé.
 * Le contentType est forcé à 'text/html; charset=utf-8' pour que le navigateur
 * affiche correctement le document depuis Firebase Storage (sinon Storage
 * sert le fichier en `application/octet-stream` et l'iframe ne le rendra pas).
 *
 * @param htmlFile  fichier .html sélectionné par l'admin (prioritaire)
 * @param htmlCode  code HTML brut collé dans le formulaire (fallback)
 * @returns un Blob prêt à être uploadé, ou null si aucune source n'est fournie
 */
function buildHtmlBlob(
  htmlFile?: File | null,
  htmlCode?: string | null
): { blob: Blob; fileName: string } | null {
  // Priorité 1 : un fichier .html a été uploadé par l'admin
  if (htmlFile) {
    // On reconstruit un Blob avec le bon contentType (un File a hérité de
    // celui détecté par le navigateur, parfois vide ou mauvais).
    const blob = new Blob([htmlFile], { type: 'text/html; charset=utf-8' });
    return { blob, fileName: sanitizeStorageFileName(htmlFile.name) };
  }
  // Priorité 2 : du code HTML collé directement dans la textarea
  const trimmed = (htmlCode || '').trim();
  if (trimmed.length > 0) {
    const blob = new Blob([trimmed], { type: 'text/html; charset=utf-8' });
    return { blob, fileName: 'contenu.html' };
  }
  return null;
}

/**
 * Ajoute un nouvel ebook
 * Upload le PDF (ou HTML) + la couverture dans Firebase Storage
 * Crée le document dans Firestore
 *
 * Le format est détecté à partir de `formData.format`.
 *  - format 'pdf'  → `pdfFile` est obligatoire (comportement historique)
 *  - format 'html' → fournir SOIT `htmlFile`, SOIT `htmlCode` ; les autres
 *                    fichiers PDF/aperçu sont ignorés (mais la couverture
 *                    reste possible).
 *
 * @param formData     - Métadonnées de l'ebook
 * @param pdfFile      - Fichier PDF complet (requis si format 'pdf')
 * @param coverFile    - Image de couverture (optionnel)
 * @param previewFile  - PDF aperçu (optionnel, premières pages — PDF uniquement)
 * @param adminId      - ID de l'admin qui upload
 * @param htmlFile     - Fichier .html (requis si format 'html' et pas de code collé)
 * @param htmlCode     - Code HTML collé (alternative à htmlFile en format 'html')
 */
export async function addEbook(
  formData: EbookFormData,
  pdfFile: File | null,
  coverFile?: File | null,
  previewFile?: File | null,
  adminId?: string,
  htmlFile?: File | null,
  htmlCode?: string | null
): Promise<string> {
  try {
    const format: FormatEbook = formData.format || 'pdf';

    // --- 1. Upload du contenu principal (PDF ou HTML) ---
    let fichierURL = '';
    let tailleFichier = 0;

    if (format === 'html') {
      // -- Format HTML : on emballe le code/fichier dans un Blob `text/html` --
      const built = buildHtmlBlob(htmlFile, htmlCode);
      if (!built) {
        throw new Error("Aucun contenu HTML fourni : sélectionnez un fichier .html ou collez le code source.");
      }
      // Stocké dans un sous-dossier dédié → règles Storage faciles à scoper.
      const htmlRef = ref(storage, `ebooks/html/${Date.now()}_${built.fileName}`);
      await uploadBytes(htmlRef, built.blob, { contentType: 'text/html; charset=utf-8' });
      fichierURL = await getDownloadURL(htmlRef);
      tailleFichier = built.blob.size;
    } else {
      // -- Format PDF : flux historique inchangé --
      if (!pdfFile) {
        throw new Error("Le fichier PDF est obligatoire pour un ebook au format PDF.");
      }
      const pdfRef = ref(storage, `ebooks/pdf/${Date.now()}_${sanitizeStorageFileName(pdfFile.name)}`);
      await uploadBytes(pdfRef, pdfFile);
      fichierURL = await getDownloadURL(pdfRef);
      tailleFichier = pdfFile.size;
    }

    // --- 2. Upload de la couverture (si fournie) ---
    let couvertureURL = '';
    if (coverFile) {
      const coverRef = ref(storage, `ebooks/covers/${Date.now()}_${sanitizeStorageFileName(coverFile.name)}`);
      await uploadBytes(coverRef, coverFile);
      couvertureURL = await getDownloadURL(coverRef);
    }

    // --- 3. Upload de l'aperçu (PDF uniquement — un aperçu HTML n'a pas de sens) ---
    let aperçuURL = '';
    if (format === 'pdf' && previewFile) {
      const previewRef = ref(storage, `ebooks/previews/${Date.now()}_${sanitizeStorageFileName(previewFile.name)}`);
      await uploadBytes(previewRef, previewFile);
      aperçuURL = await getDownloadURL(previewRef);
    }

    // --- 4. Création du document Firestore ---
    // On stocke `format` explicitement pour distinguer côté lecteur, et on
    // garde `aperçuURL` même vide pour homogénéiser les documents.
    const ebookData = {
      ...formData,
      format,
      fichierURL,
      couvertureURL,
      aperçuURL,
      tailleFichier,
      nombreTelechargements: 0,
      nombreVues: 0,
      uploadedBy: adminId || 'admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, EBOOKS_COLLECTION), ebookData);
    console.log(`✅ Ebook ajouté (${format}) : ${formData.titre} (ID: ${docRef.id})`);
    return docRef.id;

  } catch (error) {
    console.error('❌ Erreur ajout ebook:', error);
    throw error;
  }
}

/**
 * Met à jour un ebook existant
 * Si un nouveau PDF, HTML ou couverture est fourni, remplace l'ancien dans Storage.
 *
 * En cas de basculement de format (PDF → HTML ou inverse), il appartient à
 * l'admin de fournir la nouvelle source ; le contenu précédent reste en
 * Storage (pas supprimé) pour ne pas risquer de casser un autre document
 * pointant vers la même URL.
 *
 * @param htmlFile  - Nouveau fichier .html (format 'html')
 * @param htmlCode  - Nouveau code HTML collé (format 'html', alternative)
 */
export async function updateEbook(
  id: string,
  formData: Partial<EbookFormData>,
  pdfFile?: File | null,
  coverFile?: File | null,
  previewFile?: File | null,
  htmlFile?: File | null,
  htmlCode?: string | null
): Promise<void> {
  try {
    const updateData: Record<string, any> = {
      ...formData,
      updatedAt: serverTimestamp()
    };

    const targetFormat: FormatEbook | undefined = formData.format;

    // --- Remplacement du contenu HTML si nouveau fichier OU code ---
    // Important : on traite ce cas AVANT la branche PDF pour qu'un admin qui
    // bascule un ebook vers HTML puisse simplement coller du code sans avoir
    // à fournir un PDF factice.
    if (targetFormat === 'html') {
      const built = buildHtmlBlob(htmlFile, htmlCode);
      if (built) {
        const htmlRef = ref(storage, `ebooks/html/${Date.now()}_${built.fileName}`);
        await uploadBytes(htmlRef, built.blob, { contentType: 'text/html; charset=utf-8' });
        updateData.fichierURL = await getDownloadURL(htmlRef);
        updateData.tailleFichier = built.blob.size;
      }
      // L'aperçuURL n'a pas de sens pour le HTML : on l'efface si présent
      // (rétrocompat pour un ebook précédemment PDF basculé en HTML).
      updateData.aperçuURL = '';
    } else if (pdfFile) {
      // --- Remplacement du PDF si nouveau fichier (format 'pdf' explicite ou conservé) ---
      const pdfRef = ref(storage, `ebooks/pdf/${Date.now()}_${sanitizeStorageFileName(pdfFile.name)}`);
      await uploadBytes(pdfRef, pdfFile);
      updateData.fichierURL = await getDownloadURL(pdfRef);
      updateData.tailleFichier = pdfFile.size;
    }

    // --- Remplacement de la couverture si nouvelle image (commun aux deux formats) ---
    if (coverFile) {
      const coverRef = ref(storage, `ebooks/covers/${Date.now()}_${sanitizeStorageFileName(coverFile.name)}`);
      await uploadBytes(coverRef, coverFile);
      updateData.couvertureURL = await getDownloadURL(coverRef);
    }

    // --- Remplacement de l'aperçu si nouveau fichier (PDF uniquement) ---
    if (previewFile && (targetFormat === 'pdf' || !targetFormat)) {
      const previewRef = ref(storage, `ebooks/previews/${Date.now()}_${sanitizeStorageFileName(previewFile.name)}`);
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

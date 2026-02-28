// ============================================================
// PedaClic — Phase 27 : Service Médiathèque
// ============================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase';

import type {
  MediaItem,
  MediaVue,
  MediaFormData,
  FiltresMediatheque,
  TypeMedia,
  StatutMedia,
} from '../types/mediatheque_types';

const COL_MEDIA = 'mediatheque';
const COL_VUES  = 'mediatheque_vues';

export async function getMediatheque(
  filtres: Partial<FiltresMediatheque> = {},
  limitMax = 50
): Promise<MediaItem[]> {
  let q = query(
    collection(db, COL_MEDIA),
    where('statut', '==', 'publie'),
    orderBy('createdAt', 'desc'),
    limit(limitMax)
  );

  if (filtres.type && filtres.type !== 'all') {
    q = query(
      collection(db, COL_MEDIA),
      where('statut', '==', 'publie'),
      where('type', '==', filtres.type),
      orderBy('createdAt', 'desc'),
      limit(limitMax)
    );
  }

  const snap = await getDocs(q);
  let medias = snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaItem));

  if (filtres.discipline) {
    medias = medias.filter(m => m.discipline === filtres.discipline);
  }
  if (filtres.niveau) {
    medias = medias.filter(m => m.niveau === filtres.niveau);
  }
  if (filtres.acces === 'gratuit') {
    medias = medias.filter(m => !m.isPremium);
  } else if (filtres.acces === 'premium') {
    medias = medias.filter(m => m.isPremium);
  }
  if (filtres.recherche?.trim()) {
    const terme = filtres.recherche.toLowerCase().trim();
    medias = medias.filter(
      m =>
        m.titre.toLowerCase().includes(terme) ||
        m.description.toLowerCase().includes(terme) ||
        (m.tags ?? []).some(t => t.toLowerCase().includes(terme))
    );
  }

  return medias;
}

export async function getMediasProf(profId: string): Promise<MediaItem[]> {
  const q = query(
    collection(db, COL_MEDIA),
    where('auteurId', '==', profId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaItem));
}

export async function getAllMediasAdmin(): Promise<MediaItem[]> {
  const q = query(
    collection(db, COL_MEDIA),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaItem));
}

export async function getMediaById(mediaId: string): Promise<MediaItem | null> {
  const snap = await getDoc(doc(db, COL_MEDIA, mediaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MediaItem;
}

export async function getMediasSimilaires(
  mediaId: string,
  discipline: string,
  limitMax = 4
): Promise<MediaItem[]> {
  const q = query(
    collection(db, COL_MEDIA),
    where('statut', '==', 'publie'),
    where('discipline', '==', discipline),
    orderBy('vues', 'desc'),
    limit(limitMax + 1)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as MediaItem))
    .filter(m => m.id !== mediaId)
    .slice(0, limitMax);
}

export async function createMedia(
  data: MediaFormData,
  auteurId: string,
  auteurNom: string
): Promise<string> {
  const now = Timestamp.now();
  const docRef = await addDoc(collection(db, COL_MEDIA), {
    ...data,
    auteurId,
    auteurNom,
    vues: 0,
    tags: data.tags ?? [],
    statut: data.statut ?? 'brouillon',
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

export async function updateMedia(
  mediaId: string,
  data: Partial<Omit<MediaItem, 'id' | 'auteurId' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, COL_MEDIA, mediaId), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function setStatutMedia(
  mediaId: string,
  statut: StatutMedia
): Promise<void> {
  await updateDoc(doc(db, COL_MEDIA, mediaId), {
    statut,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteMedia(mediaId: string): Promise<void> {
  await deleteDoc(doc(db, COL_MEDIA, mediaId));
}

export async function deleteMediaComplet(media: MediaItem): Promise<void> {
  await deleteDoc(doc(db, COL_MEDIA, media.id));

  if (media.url.includes('firebasestorage')) {
    try {
      const storageRef = ref(storage, _extraireCheminStorage(media.url));
      await deleteObject(storageRef);
    } catch {
      console.warn('[Médiathèque] Fichier principal introuvable en Storage, ignoré.');
    }
  }

  if (media.thumbnailUrl?.includes('firebasestorage')) {
    try {
      const thumbRef = ref(storage, _extraireCheminStorage(media.thumbnailUrl));
      await deleteObject(thumbRef);
    } catch {
      console.warn('[Médiathèque] Vignette introuvable en Storage, ignorée.');
    }
  }
}

export type ProgressCallback = (progress: number) => void;

export async function uploadMediaFichier(
  fichier: File,
  mediaId: string,
  type: TypeMedia,
  disciplineId: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const annee = new Date().getFullYear();
  let cheminDossier: string;
  let nomFichier: string;

  switch (type) {
    case 'video':
      cheminDossier = `mediatheque/videos/${disciplineId}/${mediaId}`;
      nomFichier    = 'video.mp4';
      break;
    case 'audio':
      cheminDossier = `mediatheque/audios/${disciplineId}/${mediaId}`;
      nomFichier    = 'audio.mp3';
      break;
    case 'podcast':
      cheminDossier = `mediatheque/audios/${disciplineId}/${mediaId}`;
      nomFichier    = 'podcast.mp3';
      break;
    case 'webinaire':
      cheminDossier = `mediatheque/webinaires/${annee}/${mediaId}`;
      nomFichier    = 'enregistrement.mp4';
      break;
  }

  const storageRef = ref(storage, `${cheminDossier}/${nomFichier}`);
  const uploadTask = uploadBytesResumable(storageRef, fichier, {
    contentType: fichier.type,
    customMetadata: { mediaId, discipline: disciplineId },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      snapshot => {
        const pct = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress?.(pct);
      },
      error => {
        console.error('[Médiathèque] Erreur upload :', error);
        reject(new Error(`Échec de l'upload : ${error.message}`));
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export async function uploadThumbnail(
  fichier: File,
  mediaId: string
): Promise<string> {
  const ext = fichier.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const storageRef = ref(
    storage,
    `mediatheque/thumbnails/${mediaId}/thumb.${ext}`
  );
  const uploadTask = uploadBytesResumable(storageRef, fichier, {
    contentType: fichier.type,
  });
  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      () => {},
      reject,
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export async function incrementerVues(mediaId: string): Promise<void> {
  await updateDoc(doc(db, COL_MEDIA, mediaId), {
    vues: increment(1),
  });
}

export async function sauvegarderProgression(
  userId: string,
  mediaId: string,
  dureeVisionnee: number,
  positionReprise: number,
  dureeTotal: number
): Promise<void> {
  const docId = `${userId}_${mediaId}`;
  const estTermine = dureeTotal > 0 && dureeVisionnee / dureeTotal >= 0.8;

  await setDoc(
    doc(db, COL_VUES, docId),
    {
      mediaId,
      userId,
      dureeVisionnee,
      positionReprise,
      estTermine,
      vueAt: Timestamp.now(),
    },
    { merge: true }
  );
}

export async function getProgression(
  userId: string,
  mediaId: string
): Promise<MediaVue | null> {
  const docId = `${userId}_${mediaId}`;
  const snap = await getDoc(doc(db, COL_VUES, docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MediaVue;
}

export async function getHistoriqueUtilisateur(
  userId: string,
  limitMax = 20
): Promise<MediaVue[]> {
  const q = query(
    collection(db, COL_VUES),
    where('userId', '==', userId),
    orderBy('vueAt', 'desc'),
    limit(limitMax)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaVue));
}

export async function getStatsMedia(
  mediaId: string
): Promise<{ vuesUniques: number; dureeMoyenne: number }> {
  const q = query(
    collection(db, COL_VUES),
    where('mediaId', '==', mediaId)
  );
  const snap = await getDocs(q);
  const vues = snap.docs.map(d => d.data() as MediaVue);

  const vuesUniques = vues.length;
  const dureeMoyenne =
    vuesUniques > 0
      ? vues.reduce((acc, v) => acc + v.dureeVisionnee, 0) / vuesUniques
      : 0;

  return { vuesUniques, dureeMoyenne: Math.round(dureeMoyenne) };
}

function _extraireCheminStorage(url: string): string {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/o\/(.+)$/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // URL invalide
  }
  return '';
}

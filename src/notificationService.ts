// ============================================================
// PedaClic — notificationService.ts
// Phase 26 : Service Firestore + API Railway pour les notifications
//
// Fonctions disponibles :
//   • creerNotification()         — créer + sauvegarder in-app
//   • envoyerEmail()              — appeler Railway/Resend
//   • envoyerNotification()       — créer in-app + email en une fois
//   • getNotificationsUser()      — charger les notifs d'un utilisateur
//   • marquerCommeLue()           — marquer une notif lue
//   • marquerToutesCommeLues()    — tout marquer lu
//   • archiverNotification()      — archiver
//   • supprimerNotification()     — supprimer
//   • compterNonLues()            — badge compteur
//   • envoyerNotificationGroupe() — diffusion à un groupe-classe
//   • envoyerNotificationRole()   — diffusion à tous les users d'un rôle
// ============================================================

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Notification,
  CreateNotificationPayload,
  EmailPayload,
  EmailApiResponse,
  NotificationCounts,
} from './notification_types';

// ─── Configuration Railway ───────────────────────────────────
// L'URL de ton backend Railway (variable d'environnement)
const RAILWAY_API_URL = import.meta.env.VITE_RAILWAY_API_URL || 'http://localhost:3001';

// ─── Nom de la collection Firestore ─────────────────────────
const COLLECTION_NOTIFS = 'notifications';

// ============================================================
// HELPERS INTERNES
// ============================================================

/**
 * Convertit un document Firestore en objet Notification typé
 */
function docToNotification(id: string, data: Record<string, unknown>): Notification {
  return {
    id,
    destinataireId:   data.destinataireId as string,
    destinataireRole: data.destinataireRole as Notification['destinataireRole'],
    type:             data.type as Notification['type'],
    titre:            data.titre as string,
    message:          data.message as string,
    lienAction:       data.lienAction as string | undefined,
    labelAction:      data.labelAction as string | undefined,
    emetteurId:       data.emetteurId as string | undefined,
    emetteurNom:      data.emetteurNom as string | undefined,
    entiteId:         data.entiteId as string | undefined,
    entiteType:       data.entiteType as Notification['entiteType'],
    statut:           data.statut as Notification['statut'],
    canal:            data.canal as Notification['canal'],
    emailEnvoye:      data.emailEnvoye as boolean | undefined,
    emailErreur:      data.emailErreur as string | undefined,
    createdAt:        (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    luAt:             (data.luAt as Timestamp)?.toDate() ?? undefined,
  };
}

// ============================================================
// CRÉER UNE NOTIFICATION IN-APP (Firestore)
// ============================================================

/**
 * Crée une notification dans Firestore pour un destinataire unique.
 * Retourne l'ID du document créé.
 */
export async function creerNotification(
  payload: Omit<CreateNotificationPayload, 'destinataireRole' | 'groupeId'>
    & { destinataireId: string; destinataireRole: Notification['destinataireRole'] }
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NOTIFS), {
    destinataireId:   payload.destinataireId,
    destinataireRole: payload.destinataireRole,
    type:             payload.type,
    titre:            payload.titre,
    message:          payload.message,
    lienAction:       payload.lienAction ?? null,
    labelAction:      payload.labelAction ?? null,
    emetteurId:       payload.emetteurId ?? null,
    emetteurNom:      payload.emetteurNom ?? null,
    entiteId:         payload.entiteId ?? null,
    entiteType:       payload.entiteType ?? null,
    statut:           'non_lue',
    canal:            payload.canal,
    emailEnvoye:      false,
    createdAt:        Timestamp.now(),
  });
  return docRef.id;
}

// ============================================================
// ENVOYER UN EMAIL VIA RAILWAY (Resend)
// ============================================================

/**
 * Appelle l'endpoint Railway POST /api/notifications/send-email
 * Railway utilise Resend pour envoyer l'email transactionnel.
 */
export async function envoyerEmail(payload: EmailPayload): Promise<EmailApiResponse> {
  try {
    const response = await fetch(`${RAILWAY_API_URL}/api/notifications/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json() as EmailApiResponse;
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur réseau inconnue',
    };
  }
}

// ============================================================
// ENVOYER UNE NOTIFICATION COMPLÈTE (in-app + email)
// ============================================================

/**
 * Crée la notification Firestore et envoie l'email si canal = 'email' | 'les_deux'.
 * Retourne l'ID de la notification créée.
 */
export async function envoyerNotification(
  payload: CreateNotificationPayload & {
    destinataireId: string;
    destinataireRole: Notification['destinataireRole'];
  }
): Promise<{ notifId: string; emailEnvoye: boolean; emailErreur?: string }> {

  // 1. Créer la notification in-app
  const notifId = await creerNotification(payload);

  // 2. Envoyer l'email si canal le prévoit
  let emailEnvoye = false;
  let emailErreur: string | undefined;

  if (
    (payload.canal === 'email' || payload.canal === 'les_deux') &&
    payload.emailDestinataire
  ) {
    const emailResult = await envoyerEmail({
      to:          payload.emailDestinataire,
      toName:      payload.emailDestinatairNom,
      type:        payload.type,
      titre:       payload.titre,
      message:     payload.message,
      lienAction:  payload.lienAction,
      labelAction: payload.labelAction,
      emetteurNom: payload.emetteurNom,
    });

    emailEnvoye = emailResult.success;
    emailErreur = emailResult.error;

    // Mettre à jour la notif Firestore avec le statut email
    await updateDoc(doc(db, COLLECTION_NOTIFS, notifId), {
      emailEnvoye,
      emailErreur: emailErreur ?? null,
    });
  }

  return { notifId, emailEnvoye, emailErreur };
}

// ============================================================
// DIFFUSION À UN GROUPE-CLASSE
// ============================================================

/**
 * Envoie une notification à tous les élèves d'un groupe-classe.
 * Récupère la liste des élèves depuis `inscriptions_groupe`.
 */
export async function envoyerNotificationGroupe(
  groupeId: string,
  payload: Omit<CreateNotificationPayload, 'destinataireId' | 'groupeId'>
): Promise<number> {
  // Récupérer les élèves inscrits au groupe
  const q = query(
    collection(db, 'inscriptions_groupe'),
    where('groupeId', '==', groupeId),
    where('statut', '==', 'actif')
  );
  const snap = await getDocs(q);

  let count = 0;
  const batch = writeBatch(db);

  snap.docs.forEach((inscriptionDoc) => {
    const eleveId = inscriptionDoc.data().eleveId as string;
    const notifRef = doc(collection(db, COLLECTION_NOTIFS));
    batch.set(notifRef, {
      destinataireId:   eleveId,
      destinataireRole: 'eleve',
      type:             payload.type,
      titre:            payload.titre,
      message:          payload.message,
      lienAction:       payload.lienAction ?? null,
      labelAction:      payload.labelAction ?? null,
      emetteurId:       payload.emetteurId ?? null,
      emetteurNom:      payload.emetteurNom ?? null,
      entiteId:         payload.entiteId ?? null,
      entiteType:       payload.entiteType ?? null,
      statut:           'non_lue',
      canal:            payload.canal,
      emailEnvoye:      false,
      createdAt:        Timestamp.now(),
    });
    count++;
  });

  await batch.commit();
  return count;
}

// ============================================================
// DIFFUSION PAR RÔLE
// ============================================================

/**
 * Envoie une notification à tous les utilisateurs d'un rôle donné.
 * Utilise un batch Firestore pour performance.
 * Limité à 500 utilisateurs par batch (limite Firestore).
 */
export async function envoyerNotificationRole(
  role: 'eleve' | 'parent' | 'prof' | 'admin' | 'tous',
  payload: Omit<CreateNotificationPayload, 'destinataireId' | 'destinataireRole'>
): Promise<number> {
  // Construire la requête selon le rôle
  const usersQuery = role === 'tous'
    ? query(collection(db, 'users'), limit(500))
    : query(collection(db, 'users'), where('role', '==', role), limit(500));

  const usersSnap = await getDocs(usersQuery);
  let count = 0;
  const batch = writeBatch(db);

  usersSnap.docs.forEach((userDoc) => {
    const userData = userDoc.data();
    const notifRef = doc(collection(db, COLLECTION_NOTIFS));
    batch.set(notifRef, {
      destinataireId:   userDoc.id,
      destinataireRole: userData.role ?? role,
      type:             payload.type,
      titre:            payload.titre,
      message:          payload.message,
      lienAction:       payload.lienAction ?? null,
      labelAction:      payload.labelAction ?? null,
      emetteurId:       payload.emetteurId ?? null,
      emetteurNom:      payload.emetteurNom ?? null,
      entiteId:         payload.entiteId ?? null,
      entiteType:       payload.entiteType ?? null,
      statut:           'non_lue',
      canal:            payload.canal,
      emailEnvoye:      false,
      createdAt:        Timestamp.now(),
    });
    count++;
  });

  await batch.commit();
  return count;
}

// ============================================================
// LECTURE DES NOTIFICATIONS
// ============================================================

/**
 * Charge les notifications d'un utilisateur (one-shot)
 */
export async function getNotificationsUser(
  userId: string,
  options: { includeArchived?: boolean; limitCount?: number } = {}
): Promise<Notification[]> {
  const { includeArchived = false, limitCount = 50 } = options;

  const constraints = [
    where('destinataireId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  ];

  if (!includeArchived) {
    constraints.splice(1, 0, where('statut', '!=', 'archivee'));
  }

  const q = query(collection(db, COLLECTION_NOTIFS), ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map(d => docToNotification(d.id, d.data() as Record<string, unknown>));
}

/**
 * Écoute en temps réel les notifications non lues d'un utilisateur.
 * Retourne la fonction d'unsubscribe.
 */
export function ecouterNotificationsNonLues(
  userId: string,
  callback: (notifications: Notification[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTION_NOTIFS),
    where('destinataireId', '==', userId),
    where('statut', '==', 'non_lue'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(d =>
      docToNotification(d.id, d.data() as Record<string, unknown>)
    );
    callback(notifs);
  });
}

// ============================================================
// ACTIONS SUR LES NOTIFICATIONS
// ============================================================

/**
 * Marque une notification comme lue
 */
export async function marquerCommeLue(notifId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NOTIFS, notifId), {
    statut: 'lue',
    luAt:   Timestamp.now(),
  });
}

/**
 * Marque toutes les notifications non lues d'un utilisateur comme lues
 */
export async function marquerToutesCommeLues(userId: string): Promise<void> {
  const q = query(
    collection(db, COLLECTION_NOTIFS),
    where('destinataireId', '==', userId),
    where('statut', '==', 'non_lue')
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);

  snap.docs.forEach(d => {
    batch.update(d.ref, { statut: 'lue', luAt: Timestamp.now() });
  });

  await batch.commit();
}

/**
 * Archive une notification (masquée mais conservée)
 */
export async function archiverNotification(notifId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION_NOTIFS, notifId), { statut: 'archivee' });
}

/**
 * Supprime définitivement une notification
 */
export async function supprimerNotification(notifId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NOTIFS, notifId));
}

// ============================================================
// COMPTEUR POUR LE BADGE
// ============================================================

/**
 * Retourne le nombre de notifications non lues pour un utilisateur
 */
export async function compterNonLues(userId: string): Promise<NotificationCounts> {
  const q = query(
    collection(db, COLLECTION_NOTIFS),
    where('destinataireId', '==', userId),
    where('statut', '==', 'non_lue')
  );
  const snap = await getDocs(q);
  return {
    total:   snap.size,
    nonLues: snap.size,
  };
}

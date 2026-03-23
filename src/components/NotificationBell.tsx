// ============================================================
// PedaClic — NotificationBell.tsx
// Phase 26 : Cloche de notifications dans le Header
//
// Fonctionnalités :
//   • Badge rouge avec le nombre de notifications non lues
//   • Dropdown des 5 dernières notifications au clic
//   • Marquer tout comme lu en un clic
//   • Lien "Voir toutes" vers /notifications
//   • Écoute temps réel via Firestore onSnapshot
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ecouterNotificationsEtendues,
  marquerCommeLue,
  marquerToutesCommeLues,
} from '../services/notificationService';
import type { Notification } from '../types/notification_types';
import { TEMPLATES_NOTIFICATION } from '../types/notification_types';

// ─── Utilitaire : formater la date relative ──────────────────

function formatDateRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffJ = Math.floor(diffH / 24);

  if (diffMin < 1)  return 'À l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24)   return `Il y a ${diffH}h`;
  if (diffJ === 1)  return 'Hier';
  if (diffJ < 7)    return `Il y a ${diffJ} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── Composant principal ─────────────────────────────────────

const NotificationBell: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // ── États ──
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [isOpen, setIsOpen]                 = useState(false);
  const [marquageEnCours, setMarquageEnCours] = useState(false);

  // Référence pour fermer le dropdown au clic extérieur
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Écoute temps réel des notifications non lues (requêtes alignées sur les règles Firestore) ──
  useEffect(() => {
    if (!currentUser?.uid || !currentUser?.role) return;

    const unsubscribe = ecouterNotificationsEtendues(
      currentUser.uid,
      currentUser.role,
      (notifs) => setNotifications(notifs)
    );

    return () => unsubscribe();
  }, [currentUser?.uid, currentUser?.role]);

  // ── Fermer le dropdown au clic extérieur ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Nombre de non lues (pour le badge) ──
  const nonLues = notifications.length;

  // ── Clic sur une notification ──
  const handleClickNotif = useCallback(async (notif: Notification) => {
    // Marquer comme lue
    await marquerCommeLue(notif.id);
    setIsOpen(false);
    // Naviguer si lien d'action
    if (notif.lienAction) {
      navigate(notif.lienAction);
    }
  }, [navigate]);

  // ── Tout marquer comme lu ──
  const handleMarquerTout = useCallback(async () => {
    if (!currentUser || marquageEnCours) return;
    setMarquageEnCours(true);
    try {
      await marquerToutesCommeLues(currentUser.uid);
    } finally {
      setMarquageEnCours(false);
    }
  }, [currentUser, marquageEnCours]);

  // ── Voir toutes les notifications ──
  const handleVoirToutes = () => {
    setIsOpen(false);
    navigate('/notifications');
  };

  if (!currentUser) return null;

  return (
    /* Conteneur principal de la cloche */
    <div className="notif-bell" ref={dropdownRef}>

      {/* ── Bouton cloche ── */}
      <button
        className="notif-bell__btn"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={`Notifications${nonLues > 0 ? ` — ${nonLues} non lues` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Icône cloche */}
        <span className="notif-bell__icon" aria-hidden="true">🔔</span>

        {/* Badge compteur (masqué si 0) */}
        {nonLues > 0 && (
          <span className="notif-bell__badge" aria-hidden="true">
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>

      {/* ── Dropdown des notifications ── */}
      {isOpen && (
        <div className="notif-bell__dropdown" role="dialog" aria-label="Notifications récentes">

          {/* En-tête du dropdown */}
          <div className="notif-bell__dropdown-header">
            <h3 className="notif-bell__dropdown-title">
              🔔 Notifications
              {nonLues > 0 && (
                <span className="notif-bell__dropdown-count">{nonLues} nouvelles</span>
              )}
            </h3>
            {/* Bouton "Tout marquer lu" */}
            {nonLues > 0 && (
              <button
                className="notif-bell__mark-all-btn"
                onClick={handleMarquerTout}
                disabled={marquageEnCours}
              >
                {marquageEnCours ? '…' : 'Tout lire'}
              </button>
            )}
          </div>

          {/* Liste des notifications */}
          <div className="notif-bell__list">
            {notifications.length === 0 ? (
              /* État vide */
              <div className="notif-bell__empty">
                <span className="notif-bell__empty-icon">✅</span>
                <p>Tout est à jour !</p>
              </div>
            ) : (
              /* Items de notifications */
              notifications.slice(0, 5).map((notif) => {
                const template = TEMPLATES_NOTIFICATION[notif.type];
                return (
                  <button
                    key={notif.id}
                    className={`notif-bell__item ${notif.statut === 'non_lue' ? 'notif-bell__item--unread' : ''}`}
                    onClick={() => handleClickNotif(notif)}
                  >
                    {/* Icône du type */}
                    <span
                      className="notif-bell__item-icon"
                      style={{ background: template.couleur + '20', color: template.couleur }}
                      aria-hidden="true"
                    >
                      {template.icone}
                    </span>

                    {/* Contenu */}
                    <div className="notif-bell__item-content">
                      <p className="notif-bell__item-titre">{notif.titre}</p>
                      <p className="notif-bell__item-message">{notif.message}</p>
                      <p className="notif-bell__item-date">
                        {formatDateRelative(notif.createdAt)}
                      </p>
                    </div>

                    {/* Point non lue */}
                    {notif.statut === 'non_lue' && (
                      <span className="notif-bell__item-dot" aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer : lien vers toutes les notifications */}
          <div className="notif-bell__dropdown-footer">
            <button className="notif-bell__see-all-btn" onClick={handleVoirToutes}>
              Voir toutes les notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

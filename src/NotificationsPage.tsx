// ============================================================
// PedaClic — NotificationsPage.tsx
// Phase 26 : Page complète des notifications (/notifications)
//
// Accessible à tous les rôles (élève, parent, prof, admin).
// Fonctionnalités :
//   • Liste paginée des notifications avec filtres
//   • Filtrage par statut (toutes / non lues / lues)
//   • Filtrage par type
//   • Actions : lire, archiver, supprimer
//   • Marquer tout comme lu
//   • Affichage de l'état vide et chargement
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import {
  getNotificationsUser,
  marquerCommeLue,
  marquerToutesCommeLues,
  archiverNotification,
  supprimerNotification,
} from './notificationService';
import type { Notification, StatutNotification, TypeNotification } from './notification_types';
import { TEMPLATES_NOTIFICATION, LABELS_TYPE_NOTIFICATION } from './notification_types';

// ─── Utilitaire : formatage de date ─────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day:    'numeric',
    month:  'long',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ─── Composant : Item de notification ───────────────────────

interface NotifItemProps {
  notif: Notification;
  onLire: (id: string) => void;
  onArchiver: (id: string) => void;
  onSupprimer: (id: string) => void;
  onNavigate: (notif: Notification) => void;
}

const NotifItem: React.FC<NotifItemProps> = ({
  notif, onLire, onArchiver, onSupprimer, onNavigate,
}) => {
  const template = TEMPLATES_NOTIFICATION[notif.type];
  const isNonLue = notif.statut === 'non_lue';

  return (
    /* Item de notification */
    <article
      className={`notif-page__item ${isNonLue ? 'notif-page__item--unread' : ''}`}
      aria-label={`Notification : ${notif.titre}`}
    >
      {/* Icône type */}
      <div
        className="notif-page__item-icon"
        style={{ background: template.couleur + '20', color: template.couleur }}
        aria-hidden="true"
      >
        {template.icone}
      </div>

      {/* Contenu principal */}
      <div className="notif-page__item-body">
        <div className="notif-page__item-header">
          {/* Titre */}
          <h3 className="notif-page__item-titre">{notif.titre}</h3>
          {/* Badge non lue */}
          {isNonLue && (
            <span className="notif-page__item-badge">Nouvelle</span>
          )}
        </div>

        {/* Message */}
        <p className="notif-page__item-message">{notif.message}</p>

        {/* Métadonnées */}
        <div className="notif-page__item-meta">
          {notif.emetteurNom && (
            <span className="notif-page__item-emetteur">
              De : {notif.emetteurNom}
            </span>
          )}
          <span className="notif-page__item-date">
            {formatDate(notif.createdAt)}
          </span>
          <span
            className="notif-page__item-type"
            style={{ color: template.couleur }}
          >
            {LABELS_TYPE_NOTIFICATION[notif.type]}
          </span>
        </div>

        {/* Bouton d'action (lien) */}
        {notif.lienAction && (
          <button
            className="notif-page__item-action-btn"
            onClick={() => onNavigate(notif)}
          >
            {notif.labelAction || 'Voir →'}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="notif-page__item-actions">
        {/* Marquer lu/non-lu */}
        {isNonLue && (
          <button
            className="notif-page__action-btn notif-page__action-btn--read"
            onClick={() => onLire(notif.id)}
            title="Marquer comme lu"
            aria-label="Marquer comme lu"
          >
            ✓
          </button>
        )}
        {/* Archiver */}
        {notif.statut !== 'archivee' && (
          <button
            className="notif-page__action-btn notif-page__action-btn--archive"
            onClick={() => onArchiver(notif.id)}
            title="Archiver"
            aria-label="Archiver la notification"
          >
            📁
          </button>
        )}
        {/* Supprimer */}
        <button
          className="notif-page__action-btn notif-page__action-btn--delete"
          onClick={() => onSupprimer(notif.id)}
          title="Supprimer"
          aria-label="Supprimer la notification"
        >
          🗑️
        </button>
      </div>
    </article>
  );
};

// ─── Page principale ─────────────────────────────────────────

const NotificationsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // ── États ──
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut]   = useState<StatutNotification | 'toutes'>('toutes');
  const [filtreType, setFiltreType]       = useState<TypeNotification | 'tous'>('tous');
  const [actionEnCours, setActionEnCours] = useState(false);

  // ── Chargement des notifications ──
  const chargerNotifications = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const notifs = await getNotificationsUser(currentUser.uid, {
        includeArchived: filtreStatut === 'archivee',
        limitCount:      100,
      });
      setNotifications(notifs);
    } catch (err) {
      setError('Impossible de charger les notifications.');
      console.error('[Phase 26] Erreur chargement notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, filtreStatut]);

  useEffect(() => {
    chargerNotifications();
  }, [chargerNotifications]);

  // ── Filtrage côté client ──
  const notifsFiltrees = notifications.filter(n => {
    const okStatut = filtreStatut === 'toutes' || n.statut === filtreStatut;
    const okType   = filtreType === 'tous' || n.type === filtreType;
    return okStatut && okType;
  });

  const nonLuesCount = notifications.filter(n => n.statut === 'non_lue').length;

  // ── Actions ──
  const handleLire = async (id: string) => {
    await marquerCommeLue(id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, statut: 'lue', luAt: new Date() } : n)
    );
  };

  const handleArchiver = async (id: string) => {
    await archiverNotification(id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, statut: 'archivee' } : n)
    );
  };

  const handleSupprimer = async (id: string) => {
    if (!window.confirm('Supprimer cette notification ?')) return;
    await supprimerNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNavigate = async (notif: Notification) => {
    if (notif.statut === 'non_lue') await marquerCommeLue(notif.id);
    if (notif.lienAction) navigate(notif.lienAction);
  };

  const handleMarquerTout = async () => {
    if (!currentUser || actionEnCours) return;
    setActionEnCours(true);
    try {
      await marquerToutesCommeLues(currentUser.uid);
      setNotifications(prev =>
        prev.map(n => n.statut === 'non_lue' ? { ...n, statut: 'lue', luAt: new Date() } : n)
      );
    } finally {
      setActionEnCours(false);
    }
  };

  // ─── Rendu ────────────────────────────────────────────────

  return (
    /* Page notifications */
    <div className="notif-page">

      {/* ── En-tête ── */}
      <div className="notif-page__header">
        <div className="notif-page__header-left">
          <h1 className="notif-page__title">
            🔔 Notifications
          </h1>
          {nonLuesCount > 0 && (
            <span className="notif-page__unread-count">
              {nonLuesCount} non {nonLuesCount > 1 ? 'lues' : 'lue'}
            </span>
          )}
        </div>

        {/* Bouton tout marquer lu */}
        {nonLuesCount > 0 && (
          <button
            className="notif-page__mark-all-btn"
            onClick={handleMarquerTout}
            disabled={actionEnCours}
          >
            {actionEnCours ? 'En cours…' : '✓ Tout marquer comme lu'}
          </button>
        )}
      </div>

      {/* ── Filtres ── */}
      <div className="notif-page__filters">
        {/* Filtre statut */}
        <div className="notif-page__filter-group">
          <label className="notif-page__filter-label">Statut</label>
          <div className="notif-page__filter-tabs">
            {(['toutes', 'non_lue', 'lue', 'archivee'] as const).map(s => (
              <button
                key={s}
                className={`notif-page__filter-tab ${filtreStatut === s ? 'notif-page__filter-tab--active' : ''}`}
                onClick={() => setFiltreStatut(s)}
              >
                {s === 'toutes'    ? 'Toutes'
                : s === 'non_lue'  ? '🔵 Non lues'
                : s === 'lue'      ? '✓ Lues'
                :                    '📁 Archivées'}
              </button>
            ))}
          </div>
        </div>

        {/* Filtre type */}
        <div className="notif-page__filter-group">
          <label className="notif-page__filter-label">Type</label>
          <select
            className="notif-page__filter-select"
            value={filtreType}
            onChange={e => setFiltreType(e.target.value as TypeNotification | 'tous')}
          >
            <option value="tous">Tous les types</option>
            {(Object.entries(LABELS_TYPE_NOTIFICATION) as [TypeNotification, string][]).map(
              ([type, label]) => (
                <option key={type} value={type}>{label}</option>
              )
            )}
          </select>
        </div>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        /* Skeleton de chargement */
        <div className="notif-page__loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="notif-page__skeleton" />
          ))}
        </div>
      ) : error ? (
        /* Message d'erreur */
        <div className="notif-page__error">
          <p>⚠️ {error}</p>
          <button onClick={chargerNotifications} className="notif-page__retry-btn">
            Réessayer
          </button>
        </div>
      ) : notifsFiltrees.length === 0 ? (
        /* État vide */
        <div className="notif-page__empty">
          <span className="notif-page__empty-icon">🎉</span>
          <p className="notif-page__empty-title">Aucune notification</p>
          <p className="notif-page__empty-sub">
            {filtreStatut === 'non_lue'
              ? 'Vous êtes à jour, aucune notification non lue.'
              : 'Aucune notification correspondant à vos filtres.'}
          </p>
        </div>
      ) : (
        /* Liste des notifications */
        <div className="notif-page__list">
          {notifsFiltrees.map(notif => (
            <NotifItem
              key={notif.id}
              notif={notif}
              onLire={handleLire}
              onArchiver={handleArchiver}
              onSupprimer={handleSupprimer}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;

/**
 * ============================================================
 * PedaClic - Phase 6 : UserManager.tsx - CORRIGÉ
 * ============================================================
 * Composant admin pour la gestion des utilisateurs.
 *
 * Corrections :
 * - Types importés depuis userService (pas depuis index)
 *
 * Placement : src/components/admin/UserManager.tsx
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Shield,
  Star,
  UserCheck,
  UserX,
  BarChart3,
  X,
  CheckCircle,
  AlertCircle,
  Eye,
  Crown,
  GraduationCap,
  BookOpen,
  Award,
  Clock,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

/* ── Imports internes (corrigés) ── */
import {
  User,
  getUsers,
  getUserStats,
  updateUserRole,
  updatePremiumStatus,
  toggleUserActive,
  getGlobalUserStats,
  UserFilters,
  UserStats,
} from '../../services/userService';

/* ══════════════════════════════════════════════
   TYPES LOCAUX
   ══════════════════════════════════════════════ */

/** Stats globales pour les compteurs en-tête */
interface GlobalStats {
  total: number;
  admins: number;
  profs: number;
  eleves: number;
  premium: number;
  actifs: number;
}

/* ══════════════════════════════════════════════
   COMPOSANT PRINCIPAL : UserManager
   ══════════════════════════════════════════════ */
const UserManager: React.FC = () => {
  /* ── États de la liste ── */
  const [users, setUsers] = useState<User[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /* ── États des filtres ── */
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterPremium, setFilterPremium] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  /* ── Détail utilisateur ── */
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserStats, setSelectedUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  /* ── Actions en cours ── */
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ── Confirmations ── */
  const [confirmAction, setConfirmAction] = useState<{
    type: 'role' | 'premium' | 'active';
    userId: string;
    value: any;
    label: string;
  } | null>(null);

  /* ══════════════════════════════════════════════
     CHARGEMENT DES DONNÉES
     ══════════════════════════════════════════════ */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, stats] = await Promise.all([
        getUsers(),
        getGlobalUserStats(),
      ]);
      setUsers(usersData);
      setGlobalStats(stats);
    } catch (err) {
      setError('Erreur lors du chargement des utilisateurs.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  /* ══════════════════════════════════════════════
     FILTRAGE (côté client)
     ══════════════════════════════════════════════ */
  const filteredUsers = users.filter((user) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !user.displayName?.toLowerCase().includes(search) &&
        !user.email?.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    if (filterRole && user.role !== filterRole) return false;
    if (filterPremium === 'true' && !user.isPremium) return false;
    if (filterPremium === 'false' && user.isPremium) return false;
    if (filterActive === 'true' && user.isActive === false) return false;
    if (filterActive === 'false' && user.isActive !== false) return false;
    return true;
  });

  /* ══════════════════════════════════════════════
     HANDLERS D'ACTIONS
     ══════════════════════════════════════════════ */

  const handleViewStats = async (user: User) => {
    setSelectedUser(user);
    setLoadingStats(true);
    try {
      const stats = await getUserStats(user.uid);
      setSelectedUserStats(stats);
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques :', err);
      setSelectedUserStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    setActionLoading(confirmAction.userId);

    try {
      switch (confirmAction.type) {
        case 'role':
          await updateUserRole(confirmAction.userId, confirmAction.value);
          setSuccessMessage('Rôle mis à jour avec succès.');
          break;
        case 'premium':
          await updatePremiumStatus(confirmAction.userId, confirmAction.value);
          setSuccessMessage(
            confirmAction.value
              ? 'Statut Premium activé (30 jours).'
              : 'Statut Premium désactivé.'
          );
          break;
        case 'active':
          await toggleUserActive(confirmAction.userId, confirmAction.value);
          setSuccessMessage(
            confirmAction.value ? 'Compte réactivé.' : 'Compte désactivé.'
          );
          break;
      }
      await loadData();
    } catch (err) {
      setError("Erreur lors de l'exécution de l'action.");
      console.error(err);
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  /* ══════════════════════════════════════════════
     UTILITAIRES D'AFFICHAGE
     ══════════════════════════════════════════════ */

  const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
    const config: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
      admin: { icon: <Shield size={12} />, className: 'user-badge-admin', label: 'Admin' },
      prof: { icon: <GraduationCap size={12} />, className: 'user-badge-prof', label: 'Professeur' },
      eleve: { icon: <BookOpen size={12} />, className: 'user-badge-eleve', label: 'Élève' },
    };
    const c = config[role] || config.eleve;
    return (
      <span className={`user-badge ${c.className}`}>
        {c.icon} {c.label}
      </span>
    );
  };

  const formatDate = (date: any): string => {
    if (!date) return 'N/A';
    const d = date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('fr-SN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getInitial = (name?: string): string => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  /* ══════════════════════════════════════════════
     RENDU : MESSAGES
     ══════════════════════════════════════════════ */
  const renderMessages = () => (
    <>
      {error && (
        <div className="admin-message admin-message-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="admin-message-close">
            <X size={16} />
          </button>
        </div>
      )}
      {successMessage && (
        <div className="admin-message admin-message-success">
          <CheckCircle size={18} />
          <span>{successMessage}</span>
        </div>
      )}
    </>
  );

  /* ══════════════════════════════════════════════
     RENDU : COMPTEURS GLOBAUX
     ══════════════════════════════════════════════ */
  const renderGlobalStats = () => {
    if (!globalStats) return null;
    const cards = [
      { label: 'Total', value: globalStats.total, icon: <Users size={20} />, color: 'stat-blue' },
      { label: 'Élèves', value: globalStats.eleves, icon: <BookOpen size={20} />, color: 'stat-green' },
      { label: 'Professeurs', value: globalStats.profs, icon: <GraduationCap size={20} />, color: 'stat-purple' },
      { label: 'Premium', value: globalStats.premium, icon: <Star size={20} />, color: 'stat-gold' },
    ];

    return (
      <div className="user-stats-grid">
        {cards.map((card) => (
          <div key={card.label} className={`user-stat-card ${card.color}`}>
            <div className="user-stat-icon">{card.icon}</div>
            <div className="user-stat-info">
              <span className="user-stat-value">{card.value}</span>
              <span className="user-stat-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     RENDU : MODAL CONFIRMATION
     ══════════════════════════════════════════════ */
  const renderConfirmModal = () => {
    if (!confirmAction) return null;
    return (
      <div className="admin-modal-overlay" onClick={() => setConfirmAction(null)}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-header">
            <h3>Confirmer l'action</h3>
            <button className="admin-modal-close" onClick={() => setConfirmAction(null)}>
              <X size={20} />
            </button>
          </div>
          <div className="admin-modal-body">
            <p>{confirmAction.label}</p>
          </div>
          <div className="admin-modal-footer">
            <button className="admin-btn admin-btn-ghost" onClick={() => setConfirmAction(null)}>
              Annuler
            </button>
            <button
              className="admin-btn admin-btn-primary"
              onClick={executeAction}
              disabled={actionLoading === confirmAction.userId}
            >
              {actionLoading === confirmAction.userId ? 'En cours...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     RENDU : PANNEAU DÉTAIL UTILISATEUR
     ══════════════════════════════════════════════ */
  const renderUserDetail = () => {
    if (!selectedUser) return null;

    return (
      <div className="admin-modal-overlay" onClick={() => setSelectedUser(null)}>
        <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-header">
            <h3>Détail de l'utilisateur</h3>
            <button className="admin-modal-close" onClick={() => setSelectedUser(null)}>
              <X size={20} />
            </button>
          </div>

          <div className="admin-modal-body">
            {/* Profil */}
            <div className="user-detail-profile">
              <div className="user-detail-avatar">
                {getInitial(selectedUser.displayName)}
              </div>
              <div className="user-detail-info">
                <h4>{selectedUser.displayName || 'Sans nom'}</h4>
                <p>{selectedUser.email}</p>
                <div className="user-detail-badges">
                  <RoleBadge role={selectedUser.role} />
                  {selectedUser.isPremium && (
                    <span className="user-badge user-badge-premium">
                      <Star size={12} /> Premium
                    </span>
                  )}
                  <span
                    className={`user-badge ${
                      selectedUser.isActive !== false ? 'user-badge-active' : 'user-badge-inactive'
                    }`}
                  >
                    {selectedUser.isActive !== false ? 'Actif' : 'Désactivé'}
                  </span>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="user-detail-dates">
              <div>
                <span className="user-detail-date-label">Inscription</span>
                <span>{formatDate(selectedUser.createdAt)}</span>
              </div>
              {selectedUser.isPremium && selectedUser.subscriptionEnd && (
                <div>
                  <span className="user-detail-date-label">Premium jusqu'au</span>
                  <span>{formatDate(selectedUser.subscriptionEnd)}</span>
                </div>
              )}
            </div>

            {/* Statistiques */}
            <div className="user-detail-stats-section">
              <h4><BarChart3 size={18} /> Statistiques</h4>
              {loadingStats ? (
                <div className="admin-loading" style={{ padding: '1rem' }}>
                  <div className="admin-spinner" />
                  <p>Chargement des statistiques...</p>
                </div>
              ) : selectedUserStats ? (
                <div className="user-detail-stats-grid">
                  <div className="user-detail-stat">
                    <BookOpen size={20} />
                    <span className="user-detail-stat-value">{selectedUserStats.totalQuizPasses}</span>
                    <span className="user-detail-stat-label">Quiz passés</span>
                  </div>
                  <div className="user-detail-stat">
                    <TrendingUp size={20} />
                    <span className="user-detail-stat-value">{selectedUserStats.scoresMoyens}%</span>
                    <span className="user-detail-stat-label">Score moyen</span>
                  </div>
                  <div className="user-detail-stat">
                    <Award size={20} />
                    <span className="user-detail-stat-value">{selectedUserStats.quizReussis}</span>
                    <span className="user-detail-stat-label">Quiz réussis</span>
                  </div>
                  <div className="user-detail-stat">
                    <Clock size={20} />
                    <span className="user-detail-stat-value">
                      {selectedUserStats.dernierQuiz ? formatDate(selectedUserStats.dernierQuiz) : 'Aucun'}
                    </span>
                    <span className="user-detail-stat-label">Dernier quiz</span>
                  </div>
                </div>
              ) : (
                <p className="user-detail-no-stats">Aucune statistique disponible.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     RENDU PRINCIPAL
     ══════════════════════════════════════════════ */
  return (
    <div className="admin-container">
      {renderMessages()}
      {renderConfirmModal()}
      {renderUserDetail()}

      <div className="user-manager">
        {/* ── En-tête ── */}
        <div className="admin-header">
          <div>
            <h2 className="admin-title">
              <Users size={24} /> Gestion des Utilisateurs
            </h2>
            <p className="admin-subtitle">
              {users.length} utilisateur(s) au total · {filteredUsers.length} affiché(s)
            </p>
          </div>
          <button className="admin-btn admin-btn-outline" onClick={loadData}>
            <RefreshCw size={16} /> Actualiser
          </button>
        </div>

        {renderGlobalStats()}

        {/* ── Recherche et filtres ── */}
        <div className="admin-toolbar">
          <div className="admin-search-wrapper">
            <Search size={18} className="admin-search-icon" />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className={`admin-btn admin-btn-outline ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} /> Filtres
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showFilters && (
          <div className="admin-filters-panel">
            <div className="admin-filter-group">
              <label className="admin-filter-label">Rôle</label>
              <select className="admin-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                <option value="">Tous les rôles</option>
                <option value="admin">Admin</option>
                <option value="prof">Professeur</option>
                <option value="eleve">Élève</option>
              </select>
            </div>
            <div className="admin-filter-group">
              <label className="admin-filter-label">Abonnement</label>
              <select className="admin-select" value={filterPremium} onChange={(e) => setFilterPremium(e.target.value)}>
                <option value="">Tous</option>
                <option value="true">Premium</option>
                <option value="false">Gratuit</option>
              </select>
            </div>
            <div className="admin-filter-group">
              <label className="admin-filter-label">Statut</label>
              <select className="admin-select" value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
                <option value="">Tous</option>
                <option value="true">Actifs</option>
                <option value="false">Désactivés</option>
              </select>
            </div>
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => { setFilterRole(''); setFilterPremium(''); setFilterActive(''); setSearchTerm(''); }}
            >
              Réinitialiser
            </button>
          </div>
        )}

        {/* ── Tableau ── */}
        {loading ? (
          <div className="admin-loading">
            <div className="admin-spinner" />
            <p>Chargement des utilisateurs...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="admin-empty-state">
            <Users size={48} />
            <h3>Aucun utilisateur trouvé</h3>
            <p>
              {users.length === 0
                ? "Aucun utilisateur n'est encore inscrit."
                : 'Aucun utilisateur ne correspond à vos filtres.'}
            </p>
          </div>
        ) : (
          <div className="user-table-wrapper">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Abonnement</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.uid} className={user.isActive === false ? 'user-row-inactive' : ''}>
                    {/* Utilisateur */}
                    <td>
                      <div className="user-cell-info">
                        <div className="user-avatar-sm">{getInitial(user.displayName)}</div>
                        <div>
                          <span className="user-cell-name">{user.displayName || 'Sans nom'}</span>
                          <span className="user-cell-email">{user.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Rôle */}
                    <td>
                      <select
                        className="admin-select admin-select-sm"
                        value={user.role}
                        onChange={(e) =>
                          setConfirmAction({
                            type: 'role',
                            userId: user.uid,
                            value: e.target.value,
                            label: `Changer le rôle de "${user.displayName || user.email}" en "${e.target.value}" ?`,
                          })
                        }
                      >
                        <option value="eleve">Élève</option>
                        <option value="prof">Professeur</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    {/* Premium */}
                    <td>
                      <button
                        className={`user-premium-toggle ${user.isPremium ? 'active' : ''}`}
                        onClick={() =>
                          setConfirmAction({
                            type: 'premium',
                            userId: user.uid,
                            value: !user.isPremium,
                            label: user.isPremium
                              ? `Désactiver le statut Premium de "${user.displayName || user.email}" ?`
                              : `Activer le statut Premium de "${user.displayName || user.email}" pour 30 jours ?`,
                          })
                        }
                        disabled={actionLoading === user.uid}
                      >
                        {user.isPremium ? (
                          <><Crown size={14} /> Premium</>
                        ) : (
                          <><Star size={14} /> Gratuit</>
                        )}
                      </button>
                    </td>

                    {/* Statut */}
                    <td>
                      <button
                        className={`user-status-toggle ${user.isActive !== false ? 'active' : 'inactive'}`}
                        onClick={() =>
                          setConfirmAction({
                            type: 'active',
                            userId: user.uid,
                            value: user.isActive === false,
                            label: user.isActive === false
                              ? `Réactiver le compte de "${user.displayName || user.email}" ?`
                              : `Désactiver le compte de "${user.displayName || user.email}" ?`,
                          })
                        }
                        disabled={actionLoading === user.uid}
                      >
                        {user.isActive !== false ? (
                          <><UserCheck size={14} /> Actif</>
                        ) : (
                          <><UserX size={14} /> Désactivé</>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td>
                      <button
                        className="admin-btn admin-btn-sm admin-btn-outline"
                        onClick={() => handleViewStats(user)}
                        title="Voir les statistiques"
                      >
                        <Eye size={14} /> Détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManager;

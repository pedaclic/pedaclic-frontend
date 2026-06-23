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
import { useSearchParams } from 'react-router-dom';
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
import {
  TOUS_LES_PLANS,
  getDureeJours,
  type FormulePremium,
} from '../../types/premiumPlans';
import { getEffectifsClasses } from '../../services/profGroupeService';

/* ══════════════════════════════════════════════
   TYPES LOCAUX
   ══════════════════════════════════════════════ */

/** Stats globales pour les compteurs en-tête */
interface GlobalStats {
  total: number;
  admins: number;
  profs: number;
  eleves: number;
  /** Élèves dont le compte n'est pas désactivé. */
  elevesActifs: number;
  premium: number;
  actifs: number;
  /**
   * 🆕 Effectif réellement en classe : élèves DISTINCTS issus des inscriptions
   * actives (inclut les élèves « offline » sans compte PedaClic, invisibles
   * dans le décompte basé sur la collection `users`).
   */
  elevesEnClasse: number;
  /** 🆕 Total des lignes d'inscription actives (somme des effectifs de classe). */
  inscriptionsActives: number;
}

/** État de la modale d'octroi Premium (formule + durée configurables). */
interface PremiumGrantState {
  user: User;
  formule: FormulePremium;
  dureeJours: number;
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
  
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'premium') {
      setFilterPremium('true');
    }
  }, [searchParams]);

  /* ── Détail utilisateur ── */
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserStats, setSelectedUserStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  /* ── Actions en cours ── */
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ── Modale d'octroi Premium (formule + durée) ── */
  const [premiumGrant, setPremiumGrant] = useState<PremiumGrantState | null>(null);

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
      const [usersData, stats, effectifs] = await Promise.all([
        getUsers(),
        getGlobalUserStats(),
        // 🆕 Effectif réel (inscriptions_groupe) : inclut les élèves offline.
        getEffectifsClasses(),
      ]);
      setUsers(usersData);
      setGlobalStats({
        ...stats,
        elevesEnClasse: effectifs.elevesDistincts,
        inscriptionsActives: effectifs.inscriptionsActives,
      });
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

  /**
   * Octroi Premium configurable : applique la formule choisie ET la durée
   * (durée de la formule, éventuellement surchargée par le champ « jours »).
   */
  const executeGrant = async () => {
    if (!premiumGrant) return;
    const { user, formule, dureeJours } = premiumGrant;
    setActionLoading(user.uid);
    try {
      await updatePremiumStatus(user.uid, true, { formule, dureeJours });
      const plan = TOUS_LES_PLANS.find((p) => p.id === formule);
      setSuccessMessage(
        `Premium activé (${plan?.nom ?? formule} · ${dureeJours} jours).`
      );
      await loadData();
    } catch (err) {
      setError("Erreur lors de l'octroi du statut Premium.");
      console.error(err);
    } finally {
      setActionLoading(null);
      setPremiumGrant(null);
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
      { label: 'Total comptes', value: globalStats.total, icon: <Users size={20} />, color: 'stat-blue' },
      // 🆕 Effectif RÉEL en classe (inscriptions actives, élèves distincts) :
      //    inclut les élèves « offline » inscrits par le prof sans compte.
      {
        label: 'Élèves en classe',
        value: globalStats.elevesEnClasse,
        icon: <UserCheck size={20} />,
        color: 'stat-green',
        hint: `${globalStats.inscriptionsActives} inscription(s) active(s) · ${globalStats.eleves} compte(s) élève`,
      },
      // Comptes élèves (collection users) — distinct de l'effectif en classe.
      { label: 'Comptes élèves', value: globalStats.eleves, icon: <BookOpen size={20} />, color: 'stat-green' },
      { label: 'Professeurs', value: globalStats.profs, icon: <GraduationCap size={20} />, color: 'stat-purple' },
      // Premium = abonnements réellement actifs (non expirés).
      { label: 'Premium actifs', value: globalStats.premium, icon: <Star size={20} />, color: 'stat-gold' },
    ];

    return (
      <div className="user-stats-grid">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`user-stat-card ${card.color}`}
            title={(card as { hint?: string }).hint}
          >
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
     RENDU : MODAL OCTROI PREMIUM (formule + durée)
     ══════════════════════════════════════════════ */
  const renderPremiumGrantModal = () => {
    if (!premiumGrant) return null;
    const { user, formule, dureeJours } = premiumGrant;
    const plan = TOUS_LES_PLANS.find((p) => p.id === formule);

    return (
      <div className="admin-modal-overlay" onClick={() => setPremiumGrant(null)}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-header">
            <h3><Crown size={18} /> Activer Premium</h3>
            <button className="admin-modal-close" onClick={() => setPremiumGrant(null)}>
              <X size={20} />
            </button>
          </div>

          <div className="admin-modal-body">
            <p style={{ marginBottom: '1rem' }}>
              Octroi du statut Premium à <strong>{user.displayName || user.email}</strong>.
            </p>

            {/* ── Choix de la formule (grille tarifaire) ── */}
            <div className="admin-filter-group" style={{ marginBottom: '0.75rem' }}>
              <label className="admin-filter-label">Formule</label>
              <select
                className="admin-select"
                value={formule}
                onChange={(e) => {
                  const f = e.target.value as FormulePremium;
                  // Changer de formule réinitialise la durée sur celle de la grille.
                  setPremiumGrant({ ...premiumGrant, formule: f, dureeJours: getDureeJours(f) });
                }}
              >
                {TOUS_LES_PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom} — {p.duree} ({p.prix.toLocaleString('fr-SN')} FCFA)
                  </option>
                ))}
              </select>
            </div>

            {/* ── Durée de validité (override en jours) ── */}
            <div className="admin-filter-group">
              <label className="admin-filter-label">Durée de validité (jours)</label>
              <input
                type="number"
                min={1}
                className="admin-search-input"
                style={{ paddingLeft: '0.75rem' }}
                value={dureeJours}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setPremiumGrant({ ...premiumGrant, dureeJours: isNaN(v) ? 0 : v });
                }}
              />
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                Pré-rempli selon la formule ({plan?.duree ?? '—'}). Modifiable.
              </span>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button className="admin-btn admin-btn-ghost" onClick={() => setPremiumGrant(null)}>
              Annuler
            </button>
            <button
              className="admin-btn admin-btn-primary"
              onClick={executeGrant}
              disabled={actionLoading === user.uid || dureeJours < 1}
            >
              {actionLoading === user.uid ? 'En cours...' : 'Activer Premium'}
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
      {renderPremiumGrantModal()}
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
                        onClick={() => {
                          if (user.isPremium) {
                            // Déjà Premium → confirmation de révocation.
                            setConfirmAction({
                              type: 'premium',
                              userId: user.uid,
                              value: false,
                              label: `Désactiver le statut Premium de "${user.displayName || user.email}" ?`,
                            });
                          } else {
                            // Octroi → modale formule + durée configurables.
                            const formuleDefaut: FormulePremium = 'illimite_3m';
                            setPremiumGrant({
                              user,
                              formule: formuleDefaut,
                              dureeJours: getDureeJours(formuleDefaut),
                            });
                          }
                        }}
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

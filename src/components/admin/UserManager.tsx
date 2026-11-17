/**
 * ============================================================
 * PedaClic - Phase 6 : UserManager.tsx - CORRIGÉ
 * ============================================================
 * Composant admin pour la gestion des utilisateurs.
 *
 * Corrections :
 * - Types importés depuis userService (pas depuis index)
 *
 * Phase 57 :
 * - CORRECTIF : les comptes sans `displayName` et les élèves inscrits par un
 *   prof SANS compte PedaClic (inscriptions « offline ») apparaissent
 *   désormais dans la liste (badge « Sans compte » + classe).
 * - Colonnes « Classe(s) » et « Inscription » (date), tri « plus récents ».
 * - Historique dans le panneau Détail (création, dernière connexion,
 *   classes avec date d'inscription).
 * - Inscription (création de compte) et suppression d'un utilisateur.
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
  UserPlus,   // Phase 57 : bouton « Inscrire un utilisateur »
  Trash2,     // Phase 57 : suppression
  Calendar,   // Phase 57 : historique / dates
  School,     // Phase 57 : classes
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
/* ── Phase 57 : inscriptions de classe, création & suppression de comptes ── */
import {
  getInscriptionsPourAdmin,
  creerCompteUtilisateur,
  supprimerCompteUtilisateur,
  supprimerEleveSansCompte,
  type InscriptionsAdmin,
  type EleveSansCompte,
  type NouveauCompteData,
} from '../../services/adminUsersService';
import { useAuth } from '../../contexts/AuthContext';

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

/**
 * Phase 57 : ligne affichée dans le tableau — soit un COMPTE PedaClic,
 * soit un élève SANS compte (inscription offline faite par un prof).
 */
type LigneUtilisateur =
  | { kind: 'compte'; key: string; user: User; nom: string; date: Date | null }
  | { kind: 'sansCompte'; key: string; eleve: EleveSansCompte; nom: string; date: Date | null };

/** Phase 57 : formulaire vide « Inscrire un utilisateur ». */
const NOUVEAU_COMPTE_VIDE: NouveauCompteData = {
  displayName: '',
  email: '',
  motDePasse: '',
  role: 'eleve',
  sexe: undefined,
  groupeId: '',
};

/** Phase 57 : génère un mot de passe provisoire lisible (8 caractères). */
const genererMotDePasse = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let mdp = '';
  for (let i = 0; i < 8; i++) mdp += alphabet[Math.floor(Math.random() * alphabet.length)];
  return mdp;
};

/** Phase 57 : convertit Timestamp / Date / string en Date (ou null). */
const toDateSafe = (v: any): Date | null => {
  if (!v) return null;
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

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

  /* ── Phase 57 : admin connecté (traçabilité, anti-auto-suppression) ── */
  const { currentUser } = useAuth();

  /* ── Phase 57 : inscriptions de classe (comptes + élèves sans compte) ── */
  const [inscriptions, setInscriptions] = useState<InscriptionsAdmin>({
    classesParCompte: new Map(),
    elevesSansCompte: [],
    groupes: [],
  });
  /** '' = tous · 'compte' = comptes PedaClic · 'sansCompte' = élèves sans compte */
  const [filterType, setFilterType] = useState<string>('');
  /** Filtre par classe (groupeId) */
  const [filterClasse, setFilterClasse] = useState<string>('');
  /** Tri : alphabétique ou par date d'inscription (plus récents d'abord) */
  const [sortBy, setSortBy] = useState<'nom' | 'recent'>('nom');

  /* ── Phase 57 : création de compte ── */
  const [showCreate, setShowCreate] = useState(false);
  const [nouveauCompte, setNouveauCompte] = useState<NouveauCompteData>(NOUVEAU_COMPTE_VIDE);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  /** Identifiants à communiquer après création réussie */
  const [compteCree, setCompteCree] = useState<{ email: string; motDePasse: string } | null>(null);

  /* ── Phase 57 : suppression ── */
  const [deleteTarget, setDeleteTarget] = useState<LigneUtilisateur | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ── Phase 57 : détail d'un élève sans compte ── */
  const [selectedOffline, setSelectedOffline] = useState<EleveSansCompte | null>(null);

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
      const [usersData, stats, effectifs, inscriptionsData] = await Promise.all([
        getUsers(),
        getGlobalUserStats(),
        // 🆕 Effectif réel (inscriptions_groupe) : inclut les élèves offline.
        getEffectifsClasses(),
        // Phase 57 : classes par compte + élèves sans compte (fail-safe).
        getInscriptionsPourAdmin(),
      ]);
      setUsers(usersData);
      setInscriptions(inscriptionsData);
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
    // Phase 57 : filtre « type » → masque les comptes si « sans compte »
    if (filterType === 'sansCompte') return false;
    const classesUser = inscriptions.classesParCompte.get(user.uid) ?? [];
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !user.displayName?.toLowerCase().includes(search) &&
        !user.email?.toLowerCase().includes(search) &&
        // Phase 57 : recherche aussi par nom de classe (ex. « 2nde S-B »)
        !classesUser.some((c) => c.groupeNom.toLowerCase().includes(search))
      ) {
        return false;
      }
    }
    // Phase 57 : filtre par classe
    if (filterClasse && !classesUser.some((c) => c.groupeId === filterClasse)) return false;
    if (filterRole && user.role !== filterRole) return false;
    if (filterPremium === 'true' && !user.isPremium) return false;
    if (filterPremium === 'false' && user.isPremium) return false;
    if (filterActive === 'true' && user.isActive === false) return false;
    if (filterActive === 'false' && user.isActive !== false) return false;
    return true;
  });

  /**
   * Phase 57 : élèves SANS compte (inscriptions offline) filtrés.
   * Ils sont par nature : rôle « élève », gratuits, sans statut de compte.
   */
  const filteredOffline = inscriptions.elevesSansCompte.filter((e) => {
    if (filterType === 'compte') return false;
    if (filterRole && filterRole !== 'eleve') return false;
    if (filterPremium === 'true') return false;
    if (filterActive === 'false' && e.statut === 'actif') return false;
    if (filterActive === 'true' && e.statut !== 'actif') return false;
    if (filterClasse && e.groupeId !== filterClasse) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !e.eleveNom.toLowerCase().includes(search) &&
        !e.eleveEmail.toLowerCase().includes(search) &&
        !e.groupeNom.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    return true;
  });

  /** Phase 57 : lignes fusionnées (comptes + sans compte) puis triées. */
  const lignes: LigneUtilisateur[] = [
    ...filteredUsers.map<LigneUtilisateur>((user) => ({
      kind: 'compte',
      key: `u-${user.uid}`,
      user,
      nom: user.displayName || user.email || '',
      date: toDateSafe(user.createdAt),
    })),
    ...filteredOffline.map<LigneUtilisateur>((eleve) => ({
      kind: 'sansCompte',
      key: `o-${eleve.inscriptionId}`,
      eleve,
      nom: eleve.eleveNom,
      date: eleve.dateInscription,
    })),
  ].sort((a, b) =>
    sortBy === 'recent'
      ? (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)
      : a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })
  );

  /** Phase 57 : total général (comptes + élèves sans compte). */
  const totalLignes = users.length + inscriptions.elevesSansCompte.length;

  /* ══════════════════════════════════════════════
     HANDLERS D'ACTIONS
     ══════════════════════════════════════════════ */

  /** Phase 57 : ouverture du formulaire d'inscription (mot de passe pré-généré). */
  const ouvrirCreation = () => {
    setNouveauCompte({ ...NOUVEAU_COMPTE_VIDE, motDePasse: genererMotDePasse() });
    setCreateError(null);
    setCompteCree(null);
    setShowCreate(true);
  };

  /** Phase 57 : création du compte (Auth + profil + classe optionnelle). */
  const executeCreate = async () => {
    if (!currentUser) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      await creerCompteUtilisateur(
        {
          ...nouveauCompte,
          // Classe uniquement pour un élève ; chaîne vide → pas d'inscription
          groupeId: nouveauCompte.role === 'eleve' ? nouveauCompte.groupeId || undefined : undefined,
        },
        currentUser.uid
      );
      setCompteCree({
        email: nouveauCompte.email.trim().toLowerCase(),
        motDePasse: nouveauCompte.motDePasse,
      });
      setSuccessMessage(`Compte créé pour ${nouveauCompte.displayName.trim()}.`);
      await loadData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erreur lors de la création du compte.');
      console.error(err);
    } finally {
      setCreateLoading(false);
    }
  };

  /** Phase 57 : suppression (compte OU élève sans compte). */
  const executeDelete = async () => {
    if (!deleteTarget || !currentUser) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.kind === 'compte') {
        const n = await supprimerCompteUtilisateur(
          deleteTarget.user.uid,
          deleteTarget.user.email,
          currentUser.uid
        );
        setSuccessMessage(
          `Compte supprimé${n > 0 ? ` (retiré de ${n} classe(s))` : ''}.`
        );
      } else {
        await supprimerEleveSansCompte(deleteTarget.eleve.inscriptionId, deleteTarget.eleve.groupeId);
        setSuccessMessage(`${deleteTarget.eleve.eleveNom} a été retiré(e) de ${deleteTarget.eleve.groupeNom}.`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
      console.error(err);
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

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
     PHASE 57 — RENDU : CELLULE « CLASSE(S) »
     ══════════════════════════════════════════════ */
  const renderClasses = (classes: { groupeId: string; groupeNom: string; statut: string }[]) => {
    if (classes.length === 0) return <span className="user-cell-muted">—</span>;
    return (
      <div className="user-classes-cell">
        {/* 2 classes visibles max, le reste en « +n » (liste complète en infobulle) */}
        {classes.slice(0, 2).map((c) => (
          <span
            key={c.groupeId}
            className={`user-classe-chip ${c.statut !== 'actif' ? 'is-suspendu' : ''}`}
            title={c.statut !== 'actif' ? `${c.groupeNom} (suspendu)` : c.groupeNom}
          >
            {c.groupeNom}
          </span>
        ))}
        {classes.length > 2 && (
          <span className="user-classe-chip is-more" title={classes.map((c) => c.groupeNom).join(', ')}>
            +{classes.length - 2}
          </span>
        )}
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     PHASE 57 — RENDU : MODALE « INSCRIRE UN UTILISATEUR »
     ══════════════════════════════════════════════ */
  const renderCreateModal = () => {
    if (!showCreate) return null;
    const fermer = () => { if (!createLoading) setShowCreate(false); };
    const formValide =
      nouveauCompte.displayName.trim().length >= 2 &&
      nouveauCompte.email.includes('@') &&
      nouveauCompte.motDePasse.length >= 6;

    return (
      <div className="admin-modal-overlay" onClick={fermer}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-header">
            <h3><UserPlus size={18} /> Inscrire un utilisateur</h3>
            <button className="admin-modal-close" onClick={fermer}><X size={20} /></button>
          </div>

          {compteCree ? (
            /* ── Étape 2 : identifiants à transmettre ── */
            <>
              <div className="admin-modal-body">
                <div className="user-create-success">
                  <CheckCircle size={20} />
                  <div>
                    <strong>Compte créé.</strong> Transmettez ces identifiants à l'utilisateur
                    (il pourra changer son mot de passe via « Mot de passe oublié »).
                  </div>
                </div>
                <div className="user-create-credentials">
                  <div><span>Email</span><code>{compteCree.email}</code></div>
                  <div><span>Mot de passe provisoire</span><code>{compteCree.motDePasse}</code></div>
                </div>
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-ghost" onClick={ouvrirCreation}>
                  Inscrire un autre utilisateur
                </button>
                <button className="admin-btn admin-btn-primary" onClick={() => setShowCreate(false)}>
                  Terminer
                </button>
              </div>
            </>
          ) : (
            /* ── Étape 1 : formulaire ── */
            <>
              <div className="admin-modal-body user-create-form">
                {createError && (
                  <div className="admin-message admin-message-error" style={{ marginBottom: '0.75rem' }}>
                    <AlertCircle size={16} /> <span>{createError}</span>
                  </div>
                )}

                <div className="admin-filter-group">
                  <label className="admin-filter-label">Prénom et nom *</label>
                  <input
                    type="text"
                    className="admin-search-input user-create-input"
                    placeholder="Ex. Mame Diarra DIAGNE"
                    value={nouveauCompte.displayName}
                    onChange={(e) => setNouveauCompte({ ...nouveauCompte, displayName: e.target.value })}
                  />
                </div>

                <div className="admin-filter-group">
                  <label className="admin-filter-label">Email *</label>
                  <input
                    type="email"
                    className="admin-search-input user-create-input"
                    placeholder="eleve@exemple.com"
                    value={nouveauCompte.email}
                    onChange={(e) => setNouveauCompte({ ...nouveauCompte, email: e.target.value })}
                  />
                </div>

                <div className="admin-filter-group">
                  <label className="admin-filter-label">Mot de passe provisoire *</label>
                  <div className="user-create-password">
                    <input
                      type="text"
                      className="admin-search-input user-create-input"
                      value={nouveauCompte.motDePasse}
                      onChange={(e) => setNouveauCompte({ ...nouveauCompte, motDePasse: e.target.value })}
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-outline"
                      onClick={() => setNouveauCompte({ ...nouveauCompte, motDePasse: genererMotDePasse() })}
                      title="Générer un nouveau mot de passe"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div className="user-create-row">
                  <div className="admin-filter-group">
                    <label className="admin-filter-label">Rôle</label>
                    <select
                      className="admin-select"
                      value={nouveauCompte.role}
                      onChange={(e) =>
                        setNouveauCompte({ ...nouveauCompte, role: e.target.value as NouveauCompteData['role'] })
                      }
                    >
                      <option value="eleve">Élève</option>
                      <option value="prof">Professeur</option>
                      <option value="parent">Parent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="admin-filter-group">
                    <label className="admin-filter-label">Sexe</label>
                    <select
                      className="admin-select"
                      value={nouveauCompte.sexe ?? ''}
                      onChange={(e) =>
                        setNouveauCompte({
                          ...nouveauCompte,
                          sexe: (e.target.value || undefined) as NouveauCompteData['sexe'],
                        })
                      }
                    >
                      <option value="">Non précisé</option>
                      <option value="F">Féminin</option>
                      <option value="M">Masculin</option>
                    </select>
                  </div>
                </div>

                {/* Classe : uniquement pour un élève */}
                {nouveauCompte.role === 'eleve' && (
                  <div className="admin-filter-group">
                    <label className="admin-filter-label">Inscrire dans la classe (optionnel)</label>
                    <select
                      className="admin-select"
                      value={nouveauCompte.groupeId ?? ''}
                      onChange={(e) => setNouveauCompte({ ...nouveauCompte, groupeId: e.target.value })}
                    >
                      <option value="">— Aucune classe —</option>
                      {inscriptions.groupes
                        .slice()
                        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nom}{g.profNom ? ` — ${g.profNom}` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-ghost" onClick={fermer} disabled={createLoading}>
                  Annuler
                </button>
                <button
                  className="admin-btn admin-btn-primary"
                  onClick={executeCreate}
                  disabled={!formValide || createLoading}
                >
                  {createLoading ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     PHASE 57 — RENDU : MODALE DE SUPPRESSION
     ══════════════════════════════════════════════ */
  const renderDeleteModal = () => {
    if (!deleteTarget) return null;
    const fermer = () => { if (!deleteLoading) setDeleteTarget(null); };
    const estCompte = deleteTarget.kind === 'compte';
    const nbClasses = estCompte
      ? (inscriptions.classesParCompte.get(deleteTarget.user.uid) ?? []).length
      : 1;

    return (
      <div className="admin-modal-overlay" onClick={fermer}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <div className="admin-modal-header">
            <h3><Trash2 size={18} /> Supprimer {estCompte ? 'le compte' : "l'élève"}</h3>
            <button className="admin-modal-close" onClick={fermer}><X size={20} /></button>
          </div>
          <div className="admin-modal-body">
            {estCompte ? (
              <>
                <p>
                  Supprimer définitivement le compte de <strong>{deleteTarget.nom}</strong>
                  {deleteTarget.user.email ? <> ({deleteTarget.user.email})</> : null} ?
                </p>
                <ul className="user-delete-list">
                  <li>Le profil PedaClic est supprimé et la reconnexion est bloquée.</li>
                  <li>
                    {nbClasses > 0
                      ? `L'utilisateur est retiré de ${nbClasses} classe(s).`
                      : "L'utilisateur n'est inscrit dans aucune classe."}
                  </li>
                  <li>Les résultats de quiz et les notes déjà saisies sont conservés.</li>
                </ul>
                <p className="user-cell-muted" style={{ fontSize: '0.8rem' }}>
                  Pour libérer l'adresse email, supprimez aussi le compte dans Firebase
                  Console › Authentication.
                </p>
              </>
            ) : (
              <p>
                Retirer <strong>{deleteTarget.eleve.eleveNom}</strong> (élève sans compte) de la
                classe <strong>{deleteTarget.eleve.groupeNom}</strong> ? Ses présences et notes
                saisies par le professeur ne seront plus rattachées à la liste de classe.
              </p>
            )}
          </div>
          <div className="admin-modal-footer">
            <button className="admin-btn admin-btn-ghost" onClick={fermer} disabled={deleteLoading}>
              Annuler
            </button>
            <button className="admin-btn admin-btn-danger" onClick={executeDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════
     PHASE 57 — RENDU : DÉTAIL D'UN ÉLÈVE SANS COMPTE
     ══════════════════════════════════════════════ */
  const renderOfflineDetail = () => {
    if (!selectedOffline) return null;
    const e = selectedOffline;
    return (
      <div className="admin-modal-overlay" onClick={() => setSelectedOffline(null)}>
        <div className="admin-modal" onClick={(ev) => ev.stopPropagation()}>
          <div className="admin-modal-header">
            <h3>Détail de l'élève</h3>
            <button className="admin-modal-close" onClick={() => setSelectedOffline(null)}><X size={20} /></button>
          </div>
          <div className="admin-modal-body">
            <div className="user-detail-profile">
              <div className="user-detail-avatar user-avatar-offline">{getInitial(e.eleveNom)}</div>
              <div className="user-detail-info">
                <h4>{e.eleveNom}</h4>
                <p>{e.eleveEmail || 'Aucun email'}</p>
                <div className="user-detail-badges">
                  <span className="user-badge user-badge-eleve"><BookOpen size={12} /> Élève</span>
                  <span className="user-badge user-badge-offline">Sans compte PedaClic</span>
                </div>
              </div>
            </div>

            {/* Historique */}
            <div className="user-detail-history">
              <h4><Calendar size={18} /> Historique</h4>
              <ul className="user-history-list">
                <li>
                  <span className="user-history-date">{formatDate(e.dateInscription)}</span>
                  <span>
                    Inscrit(e) par le professeur dans <strong>{e.groupeNom}</strong>
                    {e.profNom ? ` (${e.profNom})` : ''}
                    {e.statut !== 'actif' ? ' — suspendu' : ''}
                  </span>
                </li>
              </ul>
              {e.remarque && <p className="user-cell-muted">Remarque : {e.remarque}</p>}
              <p className="user-cell-muted" style={{ fontSize: '0.8rem' }}>
                Pour lui donner accès à PedaClic, utilisez « Inscrire un utilisateur ».
              </p>
            </div>
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

            {/* Phase 57 : Historique (création, connexion, classes) */}
            <div className="user-detail-history">
              <h4><Calendar size={18} /> Historique</h4>
              <ul className="user-history-list">
                <li>
                  <span className="user-history-date">{formatDate(selectedUser.createdAt)}</span>
                  <span>
                    Inscription sur PedaClic
                    {selectedUser.sourceCreation === 'admin' ? " (compte créé par l'administrateur)" : ''}
                  </span>
                </li>
                {selectedUser.lastLogin && (
                  <li>
                    <span className="user-history-date">{formatDate(selectedUser.lastLogin)}</span>
                    <span>Dernière connexion</span>
                  </li>
                )}
                {(inscriptions.classesParCompte.get(selectedUser.uid) ?? []).map((c) => (
                  <li key={c.inscriptionId}>
                    <span className="user-history-date">{formatDate(c.dateInscription)}</span>
                    <span>
                      <School size={13} /> Inscription dans <strong>{c.groupeNom}</strong>
                      {c.profNom ? ` (${c.profNom})` : ''}
                      {c.source === 'code' ? ' — via code' : c.source === 'direct' ? ' — par le professeur' : ''}
                      {c.statut !== 'actif' ? ' — suspendu' : ''}
                    </span>
                  </li>
                ))}
              </ul>
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
      {/* Phase 57 */}
      {renderCreateModal()}
      {renderDeleteModal()}
      {renderOfflineDetail()}

      <div className="user-manager">
        {/* ── En-tête ── */}
        <div className="admin-header">
          <div>
            <h2 className="admin-title">
              <Users size={24} /> Gestion des Utilisateurs
            </h2>
            <p className="admin-subtitle">
              {totalLignes} utilisateur(s) au total
              {inscriptions.elevesSansCompte.length > 0 &&
                ` (dont ${inscriptions.elevesSansCompte.length} élève(s) sans compte)`}
              {' '}· {lignes.length} affiché(s)
            </p>
          </div>
          <div className="user-header-actions">
            {/* Phase 57 : inscription d'un utilisateur par l'admin */}
            <button className="admin-btn admin-btn-primary" onClick={ouvrirCreation}>
              <UserPlus size={16} /> Inscrire un utilisateur
            </button>
            <button className="admin-btn admin-btn-outline" onClick={loadData}>
              <RefreshCw size={16} /> Actualiser
            </button>
          </div>
        </div>

        {renderGlobalStats()}

        {/* ── Recherche et filtres ── */}
        <div className="admin-toolbar">
          <div className="admin-search-wrapper">
            <Search size={18} className="admin-search-icon" />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Rechercher par nom, email ou classe..."
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
            {/* Phase 57 : type de compte, classe, tri */}
            <div className="admin-filter-group">
              <label className="admin-filter-label">Type</label>
              <select className="admin-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">Tous</option>
                <option value="compte">Avec compte PedaClic</option>
                <option value="sansCompte">Élèves sans compte</option>
              </select>
            </div>
            <div className="admin-filter-group">
              <label className="admin-filter-label">Classe</label>
              <select className="admin-select" value={filterClasse} onChange={(e) => setFilterClasse(e.target.value)}>
                <option value="">Toutes les classes</option>
                {inscriptions.groupes
                  .slice()
                  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nom}{g.profNom ? ` — ${g.profNom}` : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div className="admin-filter-group">
              <label className="admin-filter-label">Trier par</label>
              <select
                className="admin-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'nom' | 'recent')}
              >
                <option value="nom">Nom (A → Z)</option>
                <option value="recent">Date d'inscription (récents d'abord)</option>
              </select>
            </div>
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => {
                setFilterRole(''); setFilterPremium(''); setFilterActive(''); setSearchTerm('');
                setFilterType(''); setFilterClasse(''); setSortBy('nom'); // Phase 57
              }}
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
        ) : lignes.length === 0 ? (
          <div className="admin-empty-state">
            <Users size={48} />
            <h3>Aucun utilisateur trouvé</h3>
            <p>
              {totalLignes === 0
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
                  {/* Phase 57 */}
                  <th>Classe(s)</th>
                  <th>Inscription</th>
                  <th>Rôle</th>
                  <th>Abonnement</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => ligne.kind === 'sansCompte' ? (
                  /* ── Phase 57 : élève SANS compte (inscription offline) ── */
                  <tr key={ligne.key} className={`user-row-offline ${ligne.eleve.statut !== 'actif' ? 'user-row-inactive' : ''}`}>
                    <td>
                      <div className="user-cell-info">
                        <div className="user-avatar-sm user-avatar-offline">{getInitial(ligne.eleve.eleveNom)}</div>
                        <div>
                          <span className="user-cell-name">{ligne.eleve.eleveNom}</span>
                          <span className="user-cell-email">
                            {ligne.eleve.eleveEmail || <em>Sans compte PedaClic</em>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{renderClasses([ligne.eleve])}</td>
                    <td className="user-cell-date">{formatDate(ligne.eleve.dateInscription)}</td>
                    <td><span className="user-badge user-badge-eleve"><BookOpen size={12} /> Élève</span></td>
                    <td><span className="user-badge user-badge-offline">Sans compte</span></td>
                    <td>
                      <span className={`user-badge ${ligne.eleve.statut === 'actif' ? 'user-badge-active' : 'user-badge-inactive'}`}>
                        {ligne.eleve.statut === 'actif' ? 'En classe' : 'Suspendu'}
                      </span>
                    </td>
                    <td>
                      <div className="user-actions-cell">
                        <button
                          className="admin-btn admin-btn-sm admin-btn-outline"
                          onClick={() => setSelectedOffline(ligne.eleve)}
                          title="Voir le détail"
                        >
                          <Eye size={14} /> Détail
                        </button>
                        <button
                          className="admin-btn admin-btn-sm admin-btn-danger-outline"
                          onClick={() => setDeleteTarget(ligne)}
                          title="Retirer de la classe"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (() => { const user = ligne.user; return (
                  <tr key={ligne.key} className={user.isActive === false ? 'user-row-inactive' : ''}>
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

                    {/* Phase 57 : classes et date d'inscription */}
                    <td>{renderClasses(inscriptions.classesParCompte.get(user.uid) ?? [])}</td>
                    <td className="user-cell-date">{formatDate(user.createdAt)}</td>

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
                      <div className="user-actions-cell">
                        <button
                          className="admin-btn admin-btn-sm admin-btn-outline"
                          onClick={() => handleViewStats(user)}
                          title="Voir le détail et l'historique"
                        >
                          <Eye size={14} /> Détail
                        </button>
                        {/* Phase 57 : suppression (impossible sur son propre compte) */}
                        {user.uid !== currentUser?.uid && (
                          <button
                            className="admin-btn admin-btn-sm admin-btn-danger-outline"
                            onClick={() => setDeleteTarget(ligne)}
                            title="Supprimer le compte"
                            disabled={actionLoading === user.uid}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ); })())}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManager;

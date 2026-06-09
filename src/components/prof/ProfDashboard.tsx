/**
 * ============================================================
 * PROF DASHBOARD — PedaClic Phase 11
 * ============================================================
 * 
 * Dashboard Analytics principal pour les professeurs.
 * Orchestrateur qui gère la navigation entre :
 * - Vue d'ensemble (résumé rapide)
 * - GroupeManager (création/gestion des groupes)
 * - GroupeDetail (détail d'un groupe sélectionné)
 * 
 * Fichier : src/components/prof/ProfDashboard.tsx
 * Dépendances :
 *   - ./GroupeManager
 *   - ./GroupeDetail
 *   - ../../services/profGroupeService
 *   - ../../hooks/useAuth
 *   - ../../styles/prof.css
 * ============================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
// 🆕 Icônes des passerelles directes posées sur chaque carte de groupe :
//    Appel (registre d'appel), Suivi pédagogique (Notes / Cahier) et
//    Statistiques détaillées des notes.
import { Lock, Star, ClipboardCheck, BookOpen, BarChart2, ChevronDown, FileSpreadsheet, NotebookPen } from 'lucide-react';
import GroupeManager from './GroupeManager';
import GroupeDetail from './GroupeDetail';
import {
  getGroupesProf,
  getGroupeById,
  getStatsGroupe
} from '../../services/profGroupeService';
// 🆕 Récupération des feuilles de notes d'un groupe (passerelle « Statistiques »).
import { getFeuillesByGroupe } from '../../services/feuillesNotesService';
import { useToast } from '../../contexts/ToastContext';
import type { GroupeProf, StatsGroupe } from '../../types/prof';
import { estFormuleALaCarte } from '../../types/premiumPlans';
import '../../styles/prof.css';

/**
 * ──────────────────────────────────────────────────────────────────────
 *  Caches mémoire (scope module) — performance du tableau de bord prof.
 *
 *  Le calcul de StatsGroupe est coûteux (plusieurs requêtes Firestore
 *  par groupe). La navigation overview ↔ groupes ↔ detail déclenchait
 *  systématiquement un rechargement complet en série, d'où la lenteur
 *  perçue. On met donc en cache deux choses :
 *
 *    1. La liste des groupes par profId (rarement modifiée pendant
 *       une session de travail).
 *    2. Les stats par groupeId.
 *
 *  TTL volontairement assez long (5 min) : ces données peuvent évoluer
 *  mais la perte de fraîcheur est compensée par un `force = true` lors
 *  des opérations qui modifient l'état (création de groupe, retour
 *  d'un détail après édition…).
 * ──────────────────────────────────────────────────────────────────────
 */
const STATS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — bon compromis fraîcheur/latence
const statsCache = new Map<string, { stats: StatsGroupe; expire: number }>();
const groupesCache = new Map<string, { groupes: GroupeProf[]; expire: number }>();

async function getStatsGroupeCached(groupeId: string, force = false): Promise<StatsGroupe> {
  const now = Date.now();
  const hit = statsCache.get(groupeId);
  if (!force && hit && hit.expire > now) return hit.stats;
  const stats = await getStatsGroupe(groupeId);
  statsCache.set(groupeId, { stats, expire: now + STATS_CACHE_TTL_MS });
  return stats;
}

async function getGroupesProfCached(profId: string, force = false): Promise<GroupeProf[]> {
  const now = Date.now();
  const hit = groupesCache.get(profId);
  if (!force && hit && hit.expire > now) return hit.groupes;
  const groupes = await getGroupesProf(profId);
  groupesCache.set(profId, { groupes, expire: now + STATS_CACHE_TTL_MS });
  return groupes;
}


// ==================== TYPES LOCAUX ====================

/** Vues disponibles dans le dashboard prof */
type VueDashboard = 'overview' | 'groupes' | 'detail';


// ==================== COMPOSANT PRINCIPAL ====================

const ProfDashboard: React.FC = () => {

  // ===== Hooks =====
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  // useLocation : pour réagir à un retour explicite vers un groupe précis
  // (ex. depuis l'éditeur de feuille de notes → onglet « Notes »).
  const location = useLocation();

  // ===== États : navigation =====
  const [vueActive, setVueActive] = useState<VueDashboard>('overview');
  const [groupeSelectionne, setGroupeSelectionne] = useState<GroupeProf | null>(null);
  // ✨ Onglet à pré-sélectionner dans GroupeDetail quand on l'ouvre via
  //    une navigation programmée (location.state.openTab).
  const [initialOnglet, setInitialOnglet] = useState<string | undefined>(undefined);

  // ===== États : données résumé =====
  const [totalGroupes, setTotalGroupes] = useState<number>(0);
  const [totalEleves, setTotalEleves] = useState<number>(0);
  const [moyenneGenerale, setMoyenneGenerale] = useState<number>(0);
  const [totalAlertes, setTotalAlertes] = useState<number>(0);
  const [groupesRecap, setGroupesRecap] = useState<(GroupeProf & { stats?: StatsGroupe })[]>([]);

  // ===== États : UI =====
  //   `loading`      : blocage initial jusqu'à l'arrivée de la liste des groupes
  //   `loadingStats` : rafraîchissement non bloquant des statistiques
  //   On sépare les deux pour que l'utilisateur voie immédiatement ses
  //   groupes tandis que les stats se calculent en arrière-plan.
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);


  // ==================== CHARGEMENT RÉSUMÉ ====================

  /**
   * Charge les données résumées pour la vue d'ensemble.
   *
   *  Optimisations clés (vs. version précédente) :
   *   - Les groupes sont affichés dès que getGroupesProf() répond : l'UI
   *     ne bloque plus sur le calcul des stats (qui arrivent en second).
   *   - Les stats sont calculées EN PARALLÈLE via Promise.all (N requêtes
   *     concurrentes au lieu de N séquentielles) — principal gain de
   *     latence sur l'Aperçu.
   *   - Un cache mémoire (TTL 5 min) évite de recalculer ces stats lors
   *     d'un simple aller-retour overview ⇄ groupes ⇄ detail. La liste
   *     des groupes elle-même est aussi mise en cache pour rendre le
   *     premier rendu post-navigation quasi instantané.
   *   - `force = true` permet au retour d'un écran de détail de rafraîchir
   *     proprement les données si l'utilisateur a modifié quelque chose.
   */
  const chargerResume = useCallback(
    async (force = false) => {
      if (!currentUser?.uid) return;

      try {
        // ⚡ Si on a déjà un cache pour ce prof, on l'utilise SANS bloquer
        //    l'UI : `loading` reste à false, on reflète juste un
        //    rafraîchissement secondaire via `loadingStats`. Le résultat
        //    est un dashboard qui ré-apparaît instantanément lors d'un
        //    aller-retour, pendant qu'on remet à jour les chiffres en
        //    arrière-plan.
        const hit = !force && groupesCache.get(currentUser.uid);
        if (hit && hit.expire > Date.now()) {
          setLoading(false);
        } else {
          setLoading(true);
        }

        // ===== 1. Récupérer les groupes actifs =====
        //   Cache mémoire : les groupes ne changent pas pendant la
        //   navigation overview ⇄ groupes ⇄ detail. force=true permet
        //   de bypasser le cache après une création/suppression.
        const groupes = await getGroupesProfCached(currentUser.uid, force);
        const groupesActifs = groupes.filter((g) => g.statut === 'actif');

        setTotalGroupes(groupesActifs.length);
        // Affichage immédiat (sans stats) : l'UI paraît bien plus rapide.
        setGroupesRecap(groupesActifs.map((g) => ({ ...g })));
        // Dès que les groupes sont affichés, on lève le blocage principal
        // et on bascule sur un indicateur secondaire pour les stats.
        setLoading(false);
        setLoadingStats(true);

        // ===== 2. Calcul des stats en parallèle (avec cache) =====
        const resultats = await Promise.all(
          groupesActifs.map(async (g) => {
            try {
              return { groupe: g, stats: await getStatsGroupeCached(g.id, force) };
            } catch (err) {
              console.warn('⚠️ Stats indisponibles pour le groupe', g.id, err);
              return { groupe: g, stats: undefined as StatsGroupe | undefined };
            }
          }),
        );

        // ===== 3. Agrégation synchrone (rapide) =====
        let sommeEleves = 0;
        let sommeMoyennes = 0;
        let groupesAvecStats = 0;
        let alertesCount = 0;
        const recap: (GroupeProf & { stats?: StatsGroupe })[] = [];

        for (const { groupe, stats } of resultats) {
          if (stats) {
            sommeEleves += stats.nombreEleves;
            if (stats.nombreEleves > 0) {
              sommeMoyennes += stats.moyenneClasse;
              groupesAvecStats++;
            }
            alertesCount += stats.elevesEnDifficulte;
            recap.push({ ...groupe, stats });
          } else {
            recap.push({ ...groupe });
          }
        }

        setTotalEleves(sommeEleves);
        setMoyenneGenerale(
          groupesAvecStats > 0
            ? Math.round((sommeMoyennes / groupesAvecStats) * 10) / 10
            : 0,
        );
        setTotalAlertes(alertesCount);
        setGroupesRecap(recap);
      } catch (err) {
        console.error('Erreur chargement résumé prof:', err);
      } finally {
        // On coupe les deux indicateurs : protège contre une annulation
        // prématurée (ex. setLoading(false) non appelé à cause d'une erreur
        // avant la bascule vers loadingStats).
        setLoading(false);
        setLoadingStats(false);
      }
    },
    [currentUser?.uid],
  );

  useEffect(() => {
    // Premier chargement : on laisse le cache décider (force = false)
    chargerResume(false);
  }, [chargerResume]);

  /**
   * ✨ Ouverture programmée d'un groupe sur un onglet précis.
   *
   *  Lorsque l'utilisateur revient sur le dashboard via le bouton
   *  « Retour » d'une feuille de notes (ou tout autre lien semblable),
   *  l'appelant pose dans location.state :
   *    { openGroupeId: '...', openTab: 'notes' }
   *  On charge le groupe correspondant, on le sélectionne, et on
   *  bascule sur la vue détail avec l'onglet demandé pré-actif.
   *  On nettoie ensuite le state pour éviter de réouvrir au prochain
   *  remount (replace de l'historique).
   */
  useEffect(() => {
    const state = (location.state ?? {}) as {
      openGroupeId?: string;
      openTab?: string;
    };
    if (!state.openGroupeId) return;

    let annulee = false;
    (async () => {
      try {
        const g = await getGroupeById(state.openGroupeId!);
        if (annulee || !g) return;
        setGroupeSelectionne(g);
        setInitialOnglet(state.openTab || 'apercu');
        setVueActive('detail');
        // Nettoyage du state pour ne pas répéter l'ouverture en cas
        // de re-render ou de retour navigateur.
        navigate(location.pathname, { replace: true });
      } catch (err) {
        console.error('Erreur ouverture groupe via state:', err);
      }
    })();
    return () => {
      annulee = true;
    };
    // On veut bien réagir uniquement au changement de location.state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);


  // ==================== HANDLERS NAVIGATION ====================

  /**
   * Navigue vers le détail d'un groupe
   */
  const handleSelectGroupe = (groupe: GroupeProf) => {
    setGroupeSelectionne(groupe);
    setVueActive('detail');
  };

  // ════════════════════════════════════════════════════════════════
  // 🆕 PASSERELLES DIRECTES SUR LES CARTES DE GROUPE (Vue d'ensemble)
  // ────────────────────────────────────────────────────────────────
  //   Chaque carte propose trois accès rapides :
  //     • Appel        → onglet « appel » du détail du groupe ;
  //     • Suivi péda.  → menu : Notes (onglet « notes ») ou
  //                      Cahier de textes (onglet « cahier ») ;
  //     • Statistiques → fenêtre stats détaillées de la feuille de
  //                      notes la plus récente du groupe.
  //   On réutilise le mécanisme existant (sélection locale + onglet
  //   initial) pour appel/suivi, et la navigation route pour les stats.
  // ════════════════════════════════════════════════════════════════

  /** ID du groupe dont le mini-menu « Suivi » est ouvert (null = aucun). */
  const [menuSuiviGroupeId, setMenuSuiviGroupeId] = useState<string | null>(null);
  /** ID du groupe pour lequel on charge les feuilles (passerelle Stats). */
  const [statsLoadingGroupeId, setStatsLoadingGroupeId] = useState<string | null>(null);
  /** Conteneur des cartes — sert à fermer le menu « Suivi » au clic extérieur. */
  const groupesGridRef = useRef<HTMLDivElement | null>(null);

  /** Ouvre le détail d'un groupe directement sur l'onglet demandé. */
  const ouvrirGroupeOnglet = (groupe: GroupeProf, onglet: string) => {
    setMenuSuiviGroupeId(null);
    setGroupeSelectionne(groupe);
    setInitialOnglet(onglet);
    setVueActive('detail');
  };

  /**
   * Passerelle « Statistiques détaillées » : on récupère les feuilles de
   * notes du groupe, on ouvre l'éditeur de la PLUS RÉCENTE avec la fenêtre
   * de statistiques pré-ouverte (`location.state.openStats`). Si le groupe
   * n'a encore aucune feuille, on guide le prof vers l'onglet « Notes ».
   */
  const ouvrirStatsDetaillees = async (groupe: GroupeProf) => {
    setMenuSuiviGroupeId(null);
    if (statsLoadingGroupeId) return; // anti double-clic
    setStatsLoadingGroupeId(groupe.id);
    try {
      const feuilles = await getFeuillesByGroupe(groupe.id);
      if (!feuilles || feuilles.length === 0) {
        toast.info(
          `Aucune feuille de notes pour « ${groupe.nom} ». Créez-en une depuis l'onglet Notes pour voir les statistiques.`,
        );
        // On ouvre tout de même l'onglet Notes pour faciliter la création.
        ouvrirGroupeOnglet(groupe, 'notes');
        return;
      }
      // Feuille la plus récente : on trie par date de mise à jour puis création.
      const toMs = (d: any): number => {
        if (!d) return 0;
        if (typeof d?.toMillis === 'function') return d.toMillis(); // Firestore Timestamp
        const t = new Date(d).getTime();
        return Number.isFinite(t) ? t : 0;
      };
      const recente = [...feuilles].sort(
        (a, b) => (toMs(b.updatedAt) || toMs(b.createdAt)) - (toMs(a.updatedAt) || toMs(a.createdAt)),
      )[0];
      navigate(`/prof/feuilles/${recente.id}`, {
        state: { openStats: true, groupeId: groupe.id, fromTab: 'notes' },
      });
    } catch (err: any) {
      console.error('Erreur ouverture statistiques détaillées :', err);
      toast.error('Impossible d\'ouvrir les statistiques pour ce groupe.');
    } finally {
      setStatsLoadingGroupeId(null);
    }
  };

  // Fermeture du mini-menu « Suivi » au clic en dehors des cartes.
  useEffect(() => {
    if (!menuSuiviGroupeId) return;
    const onDocMouseDown = (ev: MouseEvent) => {
      if (groupesGridRef.current && !groupesGridRef.current.contains(ev.target as Node)) {
        setMenuSuiviGroupeId(null);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [menuSuiviGroupeId]);

  /**
   * Retour à la vue d'ensemble depuis le détail
   */
  const handleRetourDetail = () => {
    setGroupeSelectionne(null);
    setVueActive('groupes');
    // Force le rafraîchissement : l'utilisateur peut avoir modifié des données
    // dans le détail du groupe, on bypasse donc le cache.
    chargerResume(true);
  };


  // ==================== RENDU : LOADING ====================

  if (loading) {
    return (
      <div className="prof-loading">
        <div className="spinner"></div>
        <p>Chargement de votre espace professeur...</p>
      </div>
    );
  }


  // ==================== RENDU PRINCIPAL ====================

  return (
    <div className="prof-dashboard">

      {/* ===== EN-TÊTE DU DASHBOARD ===== */}
      <header className="prof-dashboard-header" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          <h1 className="prof-dashboard-titre">
            Tableau de bord Professeur
          </h1>
          <p className="prof-dashboard-subtitle">
            Bienvenue, {currentUser?.displayName || 'Professeur'} 👋
            {currentUser?.isPremium && (
              <span style={{ marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Star size={14} style={{ color: '#f59e0b' }} /> Premium
              </span>
            )}
          </p>
        </div>
        {currentUser?.isPremium && estFormuleALaCarte(currentUser.subscriptionPlan) && (
          <button
            className="prof-btn prof-btn-secondary"
            onClick={() => navigate('/premium/mes-cours')}
            style={{ fontSize: '0.875rem' }}
          >
            📚 Choisir mes cours
          </button>
        )}
      </header>

      {/* ===== NAVIGATION PRINCIPALE ===== */}
      {vueActive !== 'detail' && (
        <nav className="prof-nav">
          <button
            className={`prof-nav-btn ${vueActive === 'overview' ? 'active' : ''}`}
            onClick={() => setVueActive('overview')}
          >
            📊 Vue d'ensemble
          </button>
          <button
            className={`prof-nav-btn ${vueActive === 'groupes' ? 'active' : ''}`}
            onClick={() => setVueActive('groupes')}
          >
            📚 Mes groupes-classes
          </button>
          <button
            className="prof-nav-btn"
            onClick={() => navigate('/prof/cahiers')}
          >
            📓 Cahier de textes
          </button>
          <button
            className="prof-nav-btn"
            onClick={() => navigate('/prof/sequences')}
          >
            📚 Séquences pédagogiques
          </button>
          <button
            className="prof-nav-btn"
            onClick={() => navigate('/prof/cours')}
          >
            🎓 Cours en ligne
          </button>
          <button
            className="prof-nav-btn"
            onClick={() => navigate('/prof/quiz')}
          >
            📝 Mes quiz
          </button>
          <button
            className="prof-nav-btn"
            onClick={() => navigate('/prof/live')}
          >
            📺 Sessions Live
          </button>
        </nav>
      )}


      {/* ============================================================ */}
      {/* VUE 1 : OVERVIEW (RÉSUMÉ RAPIDE)                            */}
      {/* ============================================================ */}
      {vueActive === 'overview' && (
        <div className="prof-overview">

          {/* Indicateur discret pendant le recalcul des statistiques.
              Les chiffres restent visibles (dernière valeur connue) pendant
              que l'on rafraîchit — pas d'écran « Chargement » pleine page. */}
          {loadingStats && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.78rem',
                color: '#6b7280',
                marginBottom: 8,
              }}
              aria-live="polite"
            >
              <span className="spinner" style={{ width: 12, height: 12 }} />
              Mise à jour des statistiques…
            </div>
          )}

          {/* Cartes résumé */}
          <div className="prof-overview-cards">
            {/* Total groupes */}
            <div
              className="prof-overview-card prof-overview-card-clickable"
              onClick={() => setVueActive('groupes')}
            >
              <div className="prof-overview-card-icon">📚</div>
              <div className="prof-overview-card-content">
                <span className="prof-overview-card-value">{totalGroupes}</span>
                <span className="prof-overview-card-label">
                  Groupe{totalGroupes !== 1 ? 's' : ''} actif{totalGroupes !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/*
              ── Carte « Élèves inscrits » ────────────────────────────────
              Cliquable depuis le tableau de bord prof :
                - S'il n'existe qu'UN groupe → ouvre directement son détail
                  sur l'onglet "Élèves" (ouverture en un clic).
                - S'il existe plusieurs groupes → bascule sur la vue "groupes"
                  pour laisser le prof choisir le groupe concerné.
                - Aucun groupe → la carte reste informative (non cliquable).
              Comportement clavier équivalent (Enter / Espace) pour
              l'accessibilité.
              ──────────────────────────────────────────────────────────── */}
            <div
              className={`prof-overview-card ${groupesRecap.length > 0 ? 'prof-overview-card-clickable' : ''}`}
              onClick={() => {
                if (groupesRecap.length === 0) return;
                if (groupesRecap.length === 1) {
                  // Un seul groupe → ouverture directe sur l'onglet « Élèves »
                  setGroupeSelectionne(groupesRecap[0]);
                  setInitialOnglet('eleves');
                  setVueActive('detail');
                } else {
                  // Plusieurs groupes → vue de sélection (le prof choisit lequel)
                  setVueActive('groupes');
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && groupesRecap.length > 0) {
                  e.preventDefault();
                  if (groupesRecap.length === 1) {
                    setGroupeSelectionne(groupesRecap[0]);
                    setInitialOnglet('eleves');
                    setVueActive('detail');
                  } else {
                    setVueActive('groupes');
                  }
                }
              }}
              role={groupesRecap.length > 0 ? 'button' : undefined}
              tabIndex={groupesRecap.length > 0 ? 0 : -1}
              title={
                groupesRecap.length === 0
                  ? 'Aucun élève inscrit'
                  : groupesRecap.length === 1
                  ? `Voir les élèves du groupe « ${groupesRecap[0].nom} »`
                  : 'Choisir un groupe pour voir ses élèves'
              }
              aria-label={
                groupesRecap.length === 0
                  ? `${totalEleves} élève inscrit`
                  : `Voir les ${totalEleves} élèves inscrits — cliquez pour ouvrir la liste`
              }
            >
              <div className="prof-overview-card-icon">👥</div>
              <div className="prof-overview-card-content">
                <span className="prof-overview-card-value">{totalEleves}</span>
                <span className="prof-overview-card-label">
                  Élève{totalEleves !== 1 ? 's' : ''} inscrit{totalEleves !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Moyenne générale */}
            <div className="prof-overview-card">
              <div className="prof-overview-card-icon">📊</div>
              <div className="prof-overview-card-content">
                <span className="prof-overview-card-value">{moyenneGenerale}/20</span>
                <span className="prof-overview-card-label">Moyenne générale</span>
              </div>
            </div>

            {/* Alertes */}
            <div className="prof-overview-card">
              <div className="prof-overview-card-icon">⚠️</div>
              <div className="prof-overview-card-content">
                <span className={`prof-overview-card-value ${totalAlertes > 0 ? 'prof-note-critique' : ''}`}>
                  {totalAlertes}
                </span>
                <span className="prof-overview-card-label">
                  Élève{totalAlertes !== 1 ? 's' : ''} en difficulté
                </span>
              </div>
            </div>
          </div>

          {/* Aperçu Premium Pro — visible pour les profs non-premium */}
          {!currentUser?.isPremium && (
            <div className="prof-premium-apercu" style={{
              marginBottom: '2rem', padding: '1.5rem', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              borderRadius: '16px', border: '1px solid #93c5fd',
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.5rem' }}>
                ⭐ Premium Pro — Outils pédagogiques
              </h2>
              <p style={{ color: '#3b82f6', fontSize: '0.9375rem', marginBottom: '1.25rem' }}>
                Cahier de textes, Générateur de contenus IA, Cours en ligne, Médiathèque…
              </p>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '1rem', marginBottom: '1rem',
              }}>
                {[
                  { icone: '📓', titre: 'Cahier de textes', path: '/prof/cahiers' },
                  { icone: '🤖', titre: 'Générateur IA', path: '/generateur' },
                  { icone: '📚', titre: 'Cours en ligne', path: '/prof/cours' },
                  { icone: '🎬', titre: 'Médiathèque', path: '/mediatheque' },
                  { icone: '📖', titre: 'Séquences', path: '/prof/sequences' },
                ].map((item) => (
                  <div
                    key={item.path}
                    onClick={() => navigate('/premium')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate('/premium')}
                    style={{
                      padding: '1rem', background: 'rgba(255,255,255,0.8)', borderRadius: '12px',
                      border: '2px dashed #93c5fd', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{item.icone}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e40af', textAlign: 'center' }}>{item.titre}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#64748b' }}>
                      <Lock size={12} /> Premium Pro
                    </span>
                  </div>
                ))}
              </div>
              <button
                className="prof-btn prof-btn-primary"
                onClick={() => navigate('/premium')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Star size={18} /> Choisir une formule Premium
              </button>
            </div>
          )}

          {/* Récapitulatif des groupes */}
          {groupesRecap.length === 0 ? (
            <div className="prof-empty-state">
              <div className="prof-empty-icon">📚</div>
              <h3>Bienvenue sur votre espace Professeur !</h3>
              <p>Créez votre premier groupe-classe pour commencer à suivre vos élèves.</p>
              <button
                className="prof-btn prof-btn-primary"
                onClick={() => setVueActive('groupes')}
              >
                ➕ Créer un groupe-classe
              </button>
            </div>
          ) : (
            <div className="prof-overview-groupes">
              <h2>Mes groupes</h2>
              <div className="prof-overview-groupes-grid" ref={groupesGridRef}>
                {groupesRecap.map(groupe => (
                  <div
                    key={groupe.id}
                    className="prof-overview-groupe-card"
                    onClick={() => handleSelectGroupe(groupe)}
                  >
                    <div className="prof-overview-groupe-header">
                      <h3>{groupe.nom}</h3>
                      <span className="prof-overview-groupe-matiere">{groupe.matiereNom}</span>
                    </div>
                    {groupe.stats && (
                      <div className="prof-overview-groupe-stats">
                        <div>
                          <span className="prof-overview-groupe-stat-value">
                            {groupe.stats.nombreEleves}
                          </span>
                          <span className="prof-overview-groupe-stat-label">Élèves</span>
                        </div>
                        <div>
                          <span className="prof-overview-groupe-stat-value">
                            {groupe.stats.moyenneClasse}/20
                          </span>
                          <span className="prof-overview-groupe-stat-label">Moyenne</span>
                        </div>
                        <div>
                          <span className="prof-overview-groupe-stat-value">
                            {groupe.stats.tauxReussite}%
                          </span>
                          <span className="prof-overview-groupe-stat-label">Réussite</span>
                        </div>
                      </div>
                    )}

                    {/* ──────────────────────────────────────────────────
                        🆕 PASSERELLES DIRECTES
                        ──────────────────────────────────────────────────
                        Trois accès rapides posés en pied de carte. Chaque
                        bouton fait `stopPropagation()` pour NE PAS déclencher
                        le `onClick` de la carte (qui ouvre l'aperçu).
                        ────────────────────────────────────────────────── */}
                    <div
                      className="prof-groupe-passerelles"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Appel → onglet « appel » */}
                      <button
                        type="button"
                        className="prof-passerelle-btn"
                        title={`Faire l'appel — ${groupe.nom}`}
                        onClick={(e) => { e.stopPropagation(); ouvrirGroupeOnglet(groupe, 'appel'); }}
                      >
                        <ClipboardCheck size={15} /> Appel
                      </button>

                      {/* Suivi pédagogique → menu Notes / Cahier */}
                      <div className="prof-passerelle-menu-wrap">
                        <button
                          type="button"
                          className="prof-passerelle-btn"
                          aria-haspopup="menu"
                          aria-expanded={menuSuiviGroupeId === groupe.id}
                          title="Suivi pédagogique — choisir Notes ou Cahier de textes"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuSuiviGroupeId((cur) => (cur === groupe.id ? null : groupe.id));
                          }}
                        >
                          <BookOpen size={15} /> Suivi <ChevronDown size={13} />
                        </button>
                        {menuSuiviGroupeId === groupe.id && (
                          <div className="prof-passerelle-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              className="prof-passerelle-menu-item"
                              onClick={(e) => { e.stopPropagation(); ouvrirGroupeOnglet(groupe, 'notes'); }}
                            >
                              <FileSpreadsheet size={14} /> Feuilles de notes
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="prof-passerelle-menu-item"
                              onClick={(e) => { e.stopPropagation(); ouvrirGroupeOnglet(groupe, 'cahier'); }}
                            >
                              <NotebookPen size={14} /> Cahier de textes
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Statistiques → fenêtre stats détaillées (feuille récente) */}
                      <button
                        type="button"
                        className="prof-passerelle-btn"
                        title={`Statistiques détaillées des notes — ${groupe.nom}`}
                        disabled={statsLoadingGroupeId === groupe.id}
                        onClick={(e) => { e.stopPropagation(); ouvrirStatsDetaillees(groupe); }}
                      >
                        <BarChart2 size={15} /> {statsLoadingGroupeId === groupe.id ? '…' : 'Stats'}
                      </button>
                    </div>

                    <span className="prof-overview-groupe-arrow">→</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* VUE 2 : GESTION DES GROUPES                                  */}
      {/* ============================================================ */}
      {vueActive === 'groupes' && (
        <GroupeManager onSelectGroupe={handleSelectGroupe} />
      )}


      {/* ============================================================ */}
      {/* VUE 3 : DÉTAIL D'UN GROUPE                                   */}
      {/* ============================================================ */}
      {vueActive === 'detail' && groupeSelectionne && (
        <GroupeDetail
          groupe={groupeSelectionne}
          onRetour={handleRetourDetail}
          /* ✨ Permet à un appelant (ex. retour depuis FeuilleNotesEditorPage)
             de forcer l'onglet d'ouverture (« notes » par défaut dans ce cas). */
          initialOnglet={initialOnglet as any}
        />
      )}
    </div>
  );
};

export default ProfDashboard;

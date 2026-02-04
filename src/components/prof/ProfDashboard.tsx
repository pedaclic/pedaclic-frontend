/**
 * ============================================================
 * PROF DASHBOARD — PedaClic Phase 8
 * ============================================================
 * 
 * Tableau de bord dédié aux professeurs avec 5 onglets :
 *   1. Vue d'ensemble   — Stats globales + graphique progression
 *   2. Par discipline    — Performance par matière
 *   3. Par élève         — Liste d'élèves + détail individuel
 *   4. Par quiz          — Analyse de chaque quiz
 *   5. Alertes           — Élèves en difficulté (< 40%)
 * 
 * Dépendances :
 *   - profService.ts (calculs stats)
 *   - recharts (graphiques)
 *   - lucide-react (icônes)
 *   - AuthContext (currentUser)
 * 
 * Route : /prof/dashboard (protégée par ProfRoute)
 * ============================================================
 */

import React, { useState, useEffect, useMemo } from 'react';

/* ── Recharts (déjà installé) ── */
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

/* ── Lucide-React (icônes) ── */
import {
  LayoutDashboard,    // Onglet Vue d'ensemble
  BookOpen,           // Onglet Disciplines
  Users,              // Onglet Élèves
  ClipboardList,      // Onglet Quiz
  AlertTriangle,      // Onglet Alertes
  TrendingUp,         // Flèche hausse
  TrendingDown,       // Flèche baisse
  Minus,              // Stable
  Search,             // Recherche
  ChevronLeft,        // Retour
  Award,              // Badge/Score
  Clock,              // Temps
  Target,             // Objectif
  BarChart3,          // Graphique
  RefreshCw,          // Rafraîchir
  Eye,                // Voir détail
  Download,           // Export (futur)
} from 'lucide-react';

/* ── Services ── */
import {
  getAllQuizResults,
  getAllEleves,
  calculerStatsGlobales,
  calculerStatsEleves,
  calculerStatsDisciplines,
  analyserQuiz,
  detecterAlertesEleves,
  genererProgressionTemporelle,
  getResultatsEleve,
  getStatsEleveParDiscipline,
  formatPourcentage,
  formatDuree,
  getScoreColor,
  getScoreLabel,
  QuizResultDoc,
  StatsGlobales,
  EleveStats,
  DisciplineStats,
  QuizAnalyse,
  AlerteEleve,
  PointProgression,
} from '../../services/profService';

/* ── Contexte Auth ── */
import { useAuth } from '../../hooks/useAuth';

/* ── Styles ── */
import '../../styles/prof.css';


// ==================== TYPES INTERNES ====================

/** Onglets disponibles */
type OngletActif = 'overview' | 'disciplines' | 'eleves' | 'quiz' | 'alertes';

/** Infos élève pour la lookup */
interface EleveInfo {
  uid: string;
  displayName: string;
  email: string;
}


// ==================== COULEURS GRAPHIQUES ====================

const COULEURS_CAMEMBERT = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];


// ==================== COMPOSANT PRINCIPAL ====================

const ProfDashboard: React.FC = () => {
  // ── État global ──
  const { currentUser } = useAuth();
  const [ongletActif, setOngletActif] = useState<OngletActif>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ── Données brutes ──
  const [resultats, setResultats] = useState<QuizResultDoc[]>([]);
  const [eleves, setEleves] = useState<EleveInfo[]>([]);

  // ── Vue détaillée élève ──
  const [eleveSelectionne, setEleveSelectionne] = useState<string | null>(null);

  // ── Filtres ──
  const [rechercheEleve, setRechercheEleve] = useState<string>('');
  const [filtreDiscipline, setFiltreDiscipline] = useState<string>('all');

  // ── Chargement des données ──
  useEffect(() => {
    chargerDonnees();
  }, []);

  /**
   * Charge toutes les données nécessaires depuis Firestore
   */
  const chargerDonnees = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupération parallèle pour performance
      const [resQuiz, resEleves] = await Promise.all([
        getAllQuizResults(),
        getAllEleves(),
      ]);

      setResultats(resQuiz);
      setEleves(resEleves);
    } catch (err: any) {
      console.error('Erreur chargement dashboard prof:', err);
      setError('Impossible de charger les données. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  // ── Calculs mémorisés (évite les recalculs à chaque render) ──

  const statsGlobales = useMemo<StatsGlobales>(() => {
    return calculerStatsGlobales(resultats, eleves.length);
  }, [resultats, eleves]);

  const statsEleves = useMemo<EleveStats[]>(() => {
    return calculerStatsEleves(resultats, eleves);
  }, [resultats, eleves]);

  const statsDisciplines = useMemo<DisciplineStats[]>(() => {
    return calculerStatsDisciplines(resultats);
  }, [resultats]);

  const analysesQuiz = useMemo<QuizAnalyse[]>(() => {
    return analyserQuiz(resultats);
  }, [resultats]);

  const alertes = useMemo<AlerteEleve[]>(() => {
    return detecterAlertesEleves(resultats, eleves);
  }, [resultats, eleves]);

  const progressionTemporelle = useMemo<PointProgression[]>(() => {
    return genererProgressionTemporelle(resultats);
  }, [resultats]);

  // ── Listes de disciplines uniques (pour filtre select) ──
  const disciplinesUniques = useMemo(() => {
    const noms = new Set(resultats.map(r => r.disciplineNom));
    return Array.from(noms).sort();
  }, [resultats]);

  // ── Filtrage élèves ──
  const elevesFiltres = useMemo(() => {
    let liste = [...statsEleves];

    // Filtre par recherche textuelle
    if (rechercheEleve.trim()) {
      const q = rechercheEleve.toLowerCase();
      liste = liste.filter(
        e => e.displayName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
      );
    }

    // Filtre par discipline
    if (filtreDiscipline !== 'all') {
      liste = liste.filter(e => e.disciplinesActives.includes(filtreDiscipline));
    }

    return liste;
  }, [statsEleves, rechercheEleve, filtreDiscipline]);


  // ==================== RENDU : CHARGEMENT / ERREUR ====================

  if (loading) {
    return (
      <div className="prof-loading">
        {/* Spinner de chargement */}
        <div className="spinner"></div>
        <p>Chargement du tableau de bord...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prof-error">
        {/* Message d'erreur avec bouton retry */}
        <AlertTriangle size={48} color="#ef4444" />
        <h2>Erreur de chargement</h2>
        <p>{error}</p>
        <button className="prof-btn prof-btn-primary" onClick={chargerDonnees}>
          <RefreshCw size={16} />
          Réessayer
        </button>
      </div>
    );
  }


  // ==================== RENDU PRINCIPAL ====================

  return (
    <div className="prof-dashboard">
      {/* ── En-tête du Dashboard ── */}
      <header className="prof-header">
        <div className="prof-header-left">
          <h1 className="prof-title">
            <LayoutDashboard size={28} />
            Tableau de bord Professeur
          </h1>
          <p className="prof-subtitle">
            Bienvenue, {currentUser?.displayName || 'Professeur'}. 
            Suivez la progression de vos élèves.
          </p>
        </div>
        <div className="prof-header-right">
          {/* Bouton rafraîchir */}
          <button className="prof-btn prof-btn-outline" onClick={chargerDonnees} title="Rafraîchir les données">
            <RefreshCw size={16} />
            Actualiser
          </button>
        </div>
      </header>

      {/* ── Navigation par onglets ── */}
      <nav className="prof-tabs">
        {/* Onglet 1 : Vue d'ensemble */}
        <button
          className={`prof-tab ${ongletActif === 'overview' ? 'prof-tab-active' : ''}`}
          onClick={() => { setOngletActif('overview'); setEleveSelectionne(null); }}
        >
          <LayoutDashboard size={18} />
          <span>Vue d'ensemble</span>
        </button>

        {/* Onglet 2 : Par discipline */}
        <button
          className={`prof-tab ${ongletActif === 'disciplines' ? 'prof-tab-active' : ''}`}
          onClick={() => { setOngletActif('disciplines'); setEleveSelectionne(null); }}
        >
          <BookOpen size={18} />
          <span>Par discipline</span>
        </button>

        {/* Onglet 3 : Par élève */}
        <button
          className={`prof-tab ${ongletActif === 'eleves' ? 'prof-tab-active' : ''}`}
          onClick={() => { setOngletActif('eleves'); setEleveSelectionne(null); }}
        >
          <Users size={18} />
          <span>Par élève</span>
          {/* Badge compteur alertes */}
          {alertes.length > 0 && (
            <span className="prof-tab-badge">{alertes.length}</span>
          )}
        </button>

        {/* Onglet 4 : Par quiz */}
        <button
          className={`prof-tab ${ongletActif === 'quiz' ? 'prof-tab-active' : ''}`}
          onClick={() => { setOngletActif('quiz'); setEleveSelectionne(null); }}
        >
          <ClipboardList size={18} />
          <span>Par quiz</span>
        </button>

        {/* Onglet 5 : Alertes */}
        <button
          className={`prof-tab ${ongletActif === 'alertes' ? 'prof-tab-active' : ''}`}
          onClick={() => { setOngletActif('alertes'); setEleveSelectionne(null); }}
        >
          <AlertTriangle size={18} />
          <span>Alertes</span>
          {alertes.length > 0 && (
            <span className="prof-tab-badge prof-tab-badge-danger">{alertes.length}</span>
          )}
        </button>
      </nav>

      {/* ── Contenu de l'onglet actif ── */}
      <main className="prof-content">
        {ongletActif === 'overview' && renderVueEnsemble()}
        {ongletActif === 'disciplines' && renderParDiscipline()}
        {ongletActif === 'eleves' && renderParEleve()}
        {ongletActif === 'quiz' && renderParQuiz()}
        {ongletActif === 'alertes' && renderAlertes()}
      </main>
    </div>
  );


  // ==================== ONGLET 1 : VUE D'ENSEMBLE ====================

  function renderVueEnsemble() {
    return (
      <div className="prof-overview">
        {/* ── Cartes de statistiques globales ── */}
        <div className="prof-stats-grid">
          {/* Carte : Total élèves */}
          <div className="prof-stat-card">
            <div className="prof-stat-icon prof-stat-icon-blue">
              <Users size={24} />
            </div>
            <div className="prof-stat-info">
              <span className="prof-stat-value">{statsGlobales.totalEleves}</span>
              <span className="prof-stat-label">Élèves inscrits</span>
            </div>
          </div>

          {/* Carte : Quiz passés */}
          <div className="prof-stat-card">
            <div className="prof-stat-icon prof-stat-icon-green">
              <ClipboardList size={24} />
            </div>
            <div className="prof-stat-info">
              <span className="prof-stat-value">{statsGlobales.totalQuizPasses}</span>
              <span className="prof-stat-label">Quiz passés</span>
            </div>
          </div>

          {/* Carte : Moyenne générale */}
          <div className="prof-stat-card">
            <div className="prof-stat-icon prof-stat-icon-purple">
              <Award size={24} />
            </div>
            <div className="prof-stat-info">
              <span className="prof-stat-value" style={{ color: getScoreColor(statsGlobales.moyenneGenerale) }}>
                {formatPourcentage(statsGlobales.moyenneGenerale)}
              </span>
              <span className="prof-stat-label">
                Moyenne générale
                {/* Indicateur de tendance */}
                {statsGlobales.tendanceMoyenne === 'hausse' && <TrendingUp size={14} color="#10b981" style={{ marginLeft: 6 }} />}
                {statsGlobales.tendanceMoyenne === 'baisse' && <TrendingDown size={14} color="#ef4444" style={{ marginLeft: 6 }} />}
                {statsGlobales.tendanceMoyenne === 'stable' && <Minus size={14} color="#6b7280" style={{ marginLeft: 6 }} />}
              </span>
            </div>
          </div>

          {/* Carte : Taux de réussite */}
          <div className="prof-stat-card">
            <div className="prof-stat-icon prof-stat-icon-orange">
              <Target size={24} />
            </div>
            <div className="prof-stat-info">
              <span className="prof-stat-value">{formatPourcentage(statsGlobales.tauxReussite)}</span>
              <span className="prof-stat-label">Taux de réussite</span>
            </div>
          </div>

          {/* Carte : Élèves en difficulté */}
          <div className="prof-stat-card">
            <div className={`prof-stat-icon ${statsGlobales.elevesEnDifficulte > 0 ? 'prof-stat-icon-red' : 'prof-stat-icon-green'}`}>
              <AlertTriangle size={24} />
            </div>
            <div className="prof-stat-info">
              <span className="prof-stat-value">{statsGlobales.elevesEnDifficulte}</span>
              <span className="prof-stat-label">Élèves en difficulté</span>
            </div>
          </div>

          {/* Carte : Quiz aujourd'hui */}
          <div className="prof-stat-card">
            <div className="prof-stat-icon prof-stat-icon-blue">
              <Clock size={24} />
            </div>
            <div className="prof-stat-info">
              <span className="prof-stat-value">{statsGlobales.quizAujourdHui}</span>
              <span className="prof-stat-label">Quiz aujourd'hui</span>
            </div>
          </div>
        </div>

        {/* ── Graphique : Progression temporelle (30 jours) ── */}
        <div className="prof-chart-card">
          <h3 className="prof-chart-title">
            <BarChart3 size={20} />
            Progression des 30 derniers jours
          </h3>
          {progressionTemporelle.some(p => p.nombreQuiz > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={progressionTemporelle}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  interval={4}
                />
                <YAxis 
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'moyenne') return [`${value.toFixed(1)}%`, 'Moyenne'];
                    return [value, 'Quiz passés'];
                  }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend />
                {/* Zone colorée pour la moyenne */}
                <Area 
                  type="monotone" 
                  dataKey="moyenne" 
                  name="Moyenne (%)" 
                  stroke="#3b82f6" 
                  fill="#3b82f680" 
                  strokeWidth={2}
                />
                {/* Barres pour le nombre de quiz */}
                <Area 
                  type="monotone" 
                  dataKey="nombreQuiz" 
                  name="Nombre de quiz" 
                  stroke="#10b981" 
                  fill="#10b98140" 
                  strokeWidth={1}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="prof-empty-chart">
              <BarChart3 size={48} color="#d1d5db" />
              <p>Aucune activité sur les 30 derniers jours</p>
            </div>
          )}
        </div>

        {/* ── Répartition par discipline (Camembert) ── */}
        {statsDisciplines.length > 0 && (
          <div className="prof-chart-card">
            <h3 className="prof-chart-title">
              <BookOpen size={20} />
              Répartition des quiz par discipline
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statsDisciplines.map(d => ({
                    name: d.disciplineNom,
                    value: d.totalQuiz,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={true}
                  dataKey="value"
                >
                  {statsDisciplines.map((_, idx) => (
                    <Cell key={idx} fill={COULEURS_CAMEMBERT[idx % COULEURS_CAMEMBERT.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }


  // ==================== ONGLET 2 : PAR DISCIPLINE ====================

  function renderParDiscipline() {
    if (statsDisciplines.length === 0) {
      return (
        <div className="prof-empty">
          <BookOpen size={48} color="#d1d5db" />
          <h3>Aucune donnée disponible</h3>
          <p>Les statistiques par discipline apparaîtront lorsque des élèves auront passé des quiz.</p>
        </div>
      );
    }

    return (
      <div className="prof-disciplines">
        {/* ── Grille de cartes discipline ── */}
        <div className="prof-disc-grid">
          {statsDisciplines.map(disc => (
            <div key={disc.disciplineId} className="prof-disc-card">
              {/* En-tête discipline */}
              <div className="prof-disc-header">
                <h3 className="prof-disc-nom">{disc.disciplineNom}</h3>
                <span 
                  className="prof-disc-badge"
                  style={{ backgroundColor: getScoreColor(disc.moyenne) }}
                >
                  {getScoreLabel(disc.moyenne)}
                </span>
              </div>

              {/* Stats de la discipline */}
              <div className="prof-disc-stats">
                <div className="prof-disc-stat">
                  <span className="prof-disc-stat-val">{disc.nombreEleves}</span>
                  <span className="prof-disc-stat-label">Élèves</span>
                </div>
                <div className="prof-disc-stat">
                  <span className="prof-disc-stat-val">{disc.totalQuiz}</span>
                  <span className="prof-disc-stat-label">Quiz passés</span>
                </div>
                <div className="prof-disc-stat">
                  <span className="prof-disc-stat-val" style={{ color: getScoreColor(disc.moyenne) }}>
                    {formatPourcentage(disc.moyenne)}
                  </span>
                  <span className="prof-disc-stat-label">Moyenne</span>
                </div>
                <div className="prof-disc-stat">
                  <span className="prof-disc-stat-val">{formatPourcentage(disc.tauxReussite)}</span>
                  <span className="prof-disc-stat-label">Réussite</span>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="prof-progress-bar">
                <div 
                  className="prof-progress-fill"
                  style={{ 
                    width: `${Math.min(disc.moyenne, 100)}%`,
                    backgroundColor: getScoreColor(disc.moyenne),
                  }}
                />
              </div>

              {/* Notes min/max */}
              <div className="prof-disc-range">
                <span>Min: {formatPourcentage(disc.pireNote)}</span>
                <span>Max: {formatPourcentage(disc.meilleureNote)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Graphique comparatif (BarChart) ── */}
        <div className="prof-chart-card">
          <h3 className="prof-chart-title">
            <BarChart3 size={20} />
            Comparaison des moyennes par discipline
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statsDisciplines}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="disciplineNom" 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                domain={[0, 100]} 
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)}%`]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="moyenne" name="Moyenne (%)" radius={[4, 4, 0, 0]}>
                {statsDisciplines.map((d, idx) => (
                  <Cell key={idx} fill={getScoreColor(d.moyenne)} />
                ))}
              </Bar>
              <Bar dataKey="tauxReussite" name="Réussite (%)" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }


  // ==================== ONGLET 3 : PAR ÉLÈVE ====================

  function renderParEleve() {
    // Si un élève est sélectionné, afficher le détail
    if (eleveSelectionne) {
      return renderDetailEleve(eleveSelectionne);
    }

    return (
      <div className="prof-eleves">
        {/* ── Barre de recherche et filtres ── */}
        <div className="prof-filters">
          {/* Recherche par nom/email */}
          <div className="prof-search-box">
            <Search size={18} className="prof-search-icon" />
            <input
              type="text"
              className="prof-search-input"
              placeholder="Rechercher un élève (nom ou email)..."
              value={rechercheEleve}
              onChange={(e) => setRechercheEleve(e.target.value)}
            />
          </div>

          {/* Filtre par discipline */}
          <select
            className="prof-select"
            value={filtreDiscipline}
            onChange={(e) => setFiltreDiscipline(e.target.value)}
          >
            <option value="all">Toutes les disciplines</option>
            {disciplinesUniques.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Compteur résultats */}
          <span className="prof-filter-count">
            {elevesFiltres.length} élève{elevesFiltres.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Tableau des élèves ── */}
        {elevesFiltres.length === 0 ? (
          <div className="prof-empty">
            <Users size={48} color="#d1d5db" />
            <h3>Aucun élève trouvé</h3>
            <p>Aucun résultat ne correspond à votre recherche.</p>
          </div>
        ) : (
          <div className="prof-table-wrapper">
            <table className="prof-table">
              {/* En-tête du tableau */}
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Quiz passés</th>
                  <th>Moyenne</th>
                  <th>Réussite</th>
                  <th>Tendance</th>
                  <th>Dernier quiz</th>
                  <th>Action</th>
                </tr>
              </thead>
              {/* Corps du tableau */}
              <tbody>
                {elevesFiltres.map(eleve => (
                  <tr 
                    key={eleve.userId}
                    className={eleve.enDifficulte ? 'prof-row-danger' : ''}
                  >
                    {/* Nom + email */}
                    <td>
                      <div className="prof-eleve-cell">
                        <span className="prof-eleve-name">{eleve.displayName}</span>
                        <span className="prof-eleve-email">{eleve.email}</span>
                      </div>
                    </td>

                    {/* Nombre de quiz */}
                    <td className="prof-td-center">{eleve.totalQuiz}</td>

                    {/* Moyenne avec couleur */}
                    <td className="prof-td-center">
                      <span style={{ color: getScoreColor(eleve.moyenne), fontWeight: 600 }}>
                        {eleve.totalQuiz > 0 ? formatPourcentage(eleve.moyenne) : '—'}
                      </span>
                    </td>

                    {/* Taux de réussite */}
                    <td className="prof-td-center">
                      {eleve.totalQuiz > 0 ? formatPourcentage(eleve.tauxReussite) : '—'}
                    </td>

                    {/* Tendance (icône) */}
                    <td className="prof-td-center">
                      {eleve.progression === 'hausse' && <TrendingUp size={18} color="#10b981" />}
                      {eleve.progression === 'baisse' && <TrendingDown size={18} color="#ef4444" />}
                      {eleve.progression === 'stable' && <Minus size={18} color="#6b7280" />}
                    </td>

                    {/* Dernier quiz */}
                    <td className="prof-td-center">
                      {eleve.dernierQuiz
                        ? eleve.dernierQuiz.toLocaleDateString('fr-FR')
                        : '—'
                      }
                    </td>

                    {/* Bouton détail */}
                    <td className="prof-td-center">
                      <button
                        className="prof-btn prof-btn-sm"
                        onClick={() => setEleveSelectionne(eleve.userId)}
                        title="Voir le détail"
                      >
                        <Eye size={14} />
                        Détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }


  // ==================== VUE DÉTAILLÉE D'UN ÉLÈVE ====================

  function renderDetailEleve(userId: string) {
    const eleve = statsEleves.find(e => e.userId === userId);
    const resEleve = getResultatsEleve(resultats, userId);
    const statsDisc = getStatsEleveParDiscipline(resultats, userId);

    if (!eleve) {
      return (
        <div className="prof-empty">
          <p>Élève introuvable.</p>
          <button className="prof-btn prof-btn-outline" onClick={() => setEleveSelectionne(null)}>
            <ChevronLeft size={16} /> Retour
          </button>
        </div>
      );
    }

    return (
      <div className="prof-detail-eleve">
        {/* ── Bouton retour ── */}
        <button className="prof-btn prof-btn-outline prof-mb-lg" onClick={() => setEleveSelectionne(null)}>
          <ChevronLeft size={16} />
          Retour à la liste
        </button>

        {/* ── En-tête élève ── */}
        <div className="prof-detail-header">
          <div className="prof-detail-avatar">
            {eleve.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="prof-detail-info">
            <h2>{eleve.displayName}</h2>
            <p className="prof-detail-email">{eleve.email}</p>
            {eleve.enDifficulte && (
              <span className="prof-badge-danger">
                <AlertTriangle size={14} />
                En difficulté
              </span>
            )}
          </div>
        </div>

        {/* ── Cartes stats élève ── */}
        <div className="prof-stats-grid prof-stats-grid-4">
          <div className="prof-stat-card">
            <div className="prof-stat-icon prof-stat-icon-blue"><ClipboardList size={20} /></div>
            <div className="prof-stat-info">
              <span className="prof-stat-value">{eleve.totalQuiz}</span>
              <span className="prof-stat-label">Quiz passés</span>
            </div>
          </div>
          <div className="prof-stat-card">
            <div className="prof-stat-icon prof-stat-icon-purple"><Award size={20} /></div>
            <div className="prof-stat-info">
              <span className="prof-stat-value" style={{ color: getScoreColor(eleve.moyenne) }}>
                {formatPourcentage(eleve.moyenne)}
              </span>
              <span className="prof-stat-label">Moyenne</span>
            </div>
          </div>
          <div className="prof-stat-card">
            <div className="prof-stat-icon prof-stat-icon-green"><Target size={20} /></div>
            <div className="prof-stat-info">
              <span className="prof-stat-value">{formatPourcentage(eleve.tauxReussite)}</span>
              <span className="prof-stat-label">Réussite</span>
            </div>
          </div>
          <div className="prof-stat-card">
            <div className="prof-stat-icon prof-stat-icon-orange"><BookOpen size={20} /></div>
            <div className="prof-stat-info">
              <span className="prof-stat-value">{eleve.disciplinesActives.length}</span>
              <span className="prof-stat-label">Disciplines</span>
            </div>
          </div>
        </div>

        {/* ── Graphique par discipline (BarChart) ── */}
        {statsDisc.length > 0 && (
          <div className="prof-chart-card">
            <h3 className="prof-chart-title">
              <BarChart3 size={20} />
              Performance par discipline
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={statsDisc}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="discipline" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Moyenne']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="moyenne" name="Moyenne" radius={[4, 4, 0, 0]}>
                  {statsDisc.map((d, idx) => (
                    <Cell key={idx} fill={getScoreColor(d.moyenne)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Historique des quiz (tableau) ── */}
        <div className="prof-chart-card">
          <h3 className="prof-chart-title">
            <ClipboardList size={20} />
            Historique des quiz ({resEleve.length})
          </h3>
          {resEleve.length === 0 ? (
            <p className="prof-text-muted">Aucun quiz passé.</p>
          ) : (
            <div className="prof-table-wrapper">
              <table className="prof-table">
                <thead>
                  <tr>
                    <th>Quiz</th>
                    <th>Discipline</th>
                    <th>Score</th>
                    <th>Résultat</th>
                    <th>Temps</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {resEleve.map(r => (
                    <tr key={r.id}>
                      <td>{r.quizTitre}</td>
                      <td>{r.disciplineNom}</td>
                      <td>
                        <span style={{ color: getScoreColor(r.pourcentage), fontWeight: 600 }}>
                          {formatPourcentage(r.pourcentage)}
                        </span>
                        <span className="prof-text-small"> ({r.bonnesReponses}/{r.nombreQuestions})</span>
                      </td>
                      <td>
                        <span className={`prof-badge ${r.reussi ? 'prof-badge-success' : 'prof-badge-fail'}`}>
                          {r.reussi ? 'Réussi' : 'Échoué'}
                        </span>
                      </td>
                      <td>{formatDuree(r.tempsEcoule)}</td>
                      <td>{r.datePassage.toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }


  // ==================== ONGLET 4 : PAR QUIZ ====================

  function renderParQuiz() {
    if (analysesQuiz.length === 0) {
      return (
        <div className="prof-empty">
          <ClipboardList size={48} color="#d1d5db" />
          <h3>Aucun quiz analysé</h3>
          <p>Les analyses apparaîtront quand des élèves auront passé des quiz.</p>
        </div>
      );
    }

    return (
      <div className="prof-quiz-section">
        {/* ── Cartes quiz ── */}
        <div className="prof-quiz-grid">
          {analysesQuiz.map(quiz => (
            <div key={quiz.quizId} className="prof-quiz-card">
              {/* En-tête */}
              <div className="prof-quiz-header">
                <h3 className="prof-quiz-titre">{quiz.quizTitre}</h3>
                <span className="prof-quiz-discipline">{quiz.disciplineNom}</span>
              </div>

              {/* Stats */}
              <div className="prof-quiz-stats">
                <div className="prof-quiz-stat">
                  <Users size={16} />
                  <span>{quiz.totalPassages} passage{quiz.totalPassages > 1 ? 's' : ''}</span>
                </div>
                <div className="prof-quiz-stat">
                  <Award size={16} />
                  <span style={{ color: getScoreColor(quiz.moyenneScore) }}>
                    Moy: {formatPourcentage(quiz.moyenneScore)}
                  </span>
                </div>
                <div className="prof-quiz-stat">
                  <Target size={16} />
                  <span>Réussite: {formatPourcentage(quiz.tauxReussite)}</span>
                </div>
                <div className="prof-quiz-stat">
                  <Clock size={16} />
                  <span>Temps moy: {formatDuree(quiz.tempsEcouleMoyen)}</span>
                </div>
              </div>

              {/* Barre de progression */}
              <div className="prof-progress-bar">
                <div 
                  className="prof-progress-fill"
                  style={{ 
                    width: `${Math.min(quiz.tauxReussite, 100)}%`,
                    backgroundColor: getScoreColor(quiz.tauxReussite),
                  }}
                />
              </div>

              {/* Notes min/max */}
              <div className="prof-disc-range">
                <span>Min: {formatPourcentage(quiz.pireNote)}</span>
                <span>Max: {formatPourcentage(quiz.meilleureNote)}</span>
              </div>

              {/* Dernier passage */}
              {quiz.dernierPassage && (
                <p className="prof-quiz-date">
                  Dernier passage : {quiz.dernierPassage.toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ── Graphique comparatif quiz ── */}
        <div className="prof-chart-card">
          <h3 className="prof-chart-title">
            <BarChart3 size={20} />
            Comparaison des quiz
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analysesQuiz.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis 
                type="category" 
                dataKey="quizTitre" 
                width={150} 
                tick={{ fontSize: 11, fill: '#6b7280' }}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)}%`]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar dataKey="moyenneScore" name="Moyenne (%)" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="tauxReussite" name="Réussite (%)" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }


  // ==================== ONGLET 5 : ALERTES ====================

  function renderAlertes() {
    if (alertes.length === 0) {
      return (
        <div className="prof-empty prof-empty-success">
          <Target size={48} color="#10b981" />
          <h3>Aucune alerte !</h3>
          <p>Tous les élèves ont une moyenne supérieure à 40%. Félicitations !</p>
        </div>
      );
    }

    return (
      <div className="prof-alertes">
        {/* ── Bandeau d'alerte ── */}
        <div className="prof-alerte-banner">
          <AlertTriangle size={20} />
          <span>
            <strong>{alertes.length} élève{alertes.length > 1 ? 's' : ''}</strong> en difficulté 
            (moyenne inférieure à 40% sur au moins 2 quiz)
          </span>
        </div>

        {/* ── Liste des alertes ── */}
        <div className="prof-alertes-list">
          {alertes.map(alerte => (
            <div key={alerte.userId} className="prof-alerte-card">
              {/* Avatar + infos */}
              <div className="prof-alerte-left">
                <div className="prof-alerte-avatar">
                  {alerte.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="prof-alerte-info">
                  <h4>{alerte.displayName}</h4>
                  <p className="prof-alerte-email">{alerte.email}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="prof-alerte-stats">
                <div className="prof-alerte-stat">
                  <span className="prof-alerte-stat-label">Moyenne</span>
                  <span className="prof-alerte-stat-val" style={{ color: '#ef4444' }}>
                    {formatPourcentage(alerte.moyenne)}
                  </span>
                </div>
                <div className="prof-alerte-stat">
                  <span className="prof-alerte-stat-label">Quiz passés</span>
                  <span className="prof-alerte-stat-val">{alerte.totalQuiz}</span>
                </div>
              </div>

              {/* Disciplines faibles */}
              <div className="prof-alerte-disciplines">
                <span className="prof-alerte-disc-label">Disciplines en difficulté :</span>
                <div className="prof-alerte-disc-tags">
                  {alerte.disciplinesFaibles.map(d => (
                    <span key={d} className="prof-alerte-disc-tag">{d}</span>
                  ))}
                </div>
              </div>

              {/* Bouton détail */}
              <button
                className="prof-btn prof-btn-sm prof-btn-outline"
                onClick={() => {
                  setEleveSelectionne(alerte.userId);
                  setOngletActif('eleves');
                }}
              >
                <Eye size={14} />
                Voir le détail
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }
};

export default ProfDashboard;

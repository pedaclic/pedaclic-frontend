/**
 * ============================================================
 * PedaClic — Phase 14 : StudentDashboard.tsx (ENRICHI)
 * ============================================================
 * Tableau de bord complet de l'élève :
 *  - Carte de bienvenue avec stats globales
 *  - ★ NOUVEAU : Streak de connexion + ressources consultées
 *  - Graphique d'évolution des scores (recharts)
 *  - ★ NOUVEAU : Progression par discipline avec ProgressBar
 *  - Historique des quiz récents
 *  - ★ NOUVEAU : Badges catégorisés avec filtrage
 *  - Quiz disponibles à passer
 *  - Code Parent + Groupes
 *
 * Placement : src/components/student/StudentDashboard.tsx
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  Award,
  BookOpen,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Target,
  Zap,
  ChevronRight,
  Trophy,
  Play,
  CheckCircle,
  XCircle,
  Lock,
  BarChart3,
  Calendar,
  Flame,
  Eye,
  Filter,
} from 'lucide-react';

/* ── Imports services ── */
import {
  getStudentProgress,
  getDisciplineProgress,
  getProgressionTemporelle,
  getQuizHistory,
  calculateBadges,
  formatTemps,
  getScoreColor,
  getScoreLabel,
  getProgressionGlobale,                    // ★ NOUVEAU Phase 14
  mettreAJourStreak,                         // ★ NOUVEAU Phase 14
  StudentProgress,
  DisciplineProgress,
  ProgressionTemporelle,
  QuizResult,
} from '../../services/progressionService';
import type { BadgeDefinition, ProgressionGlobale } from '../../types'; // ★ Phase 14
import { getQuizzes, Quiz } from '../../services/quizService';
import { useAuth } from '../../contexts/AuthContext';
import { getCodeInvitation } from '../../services/parentService';
import RejoindreGroupe from './RejoindreGroupe';
import ProgressBar from '../shared/ProgressBar';                        // ★ Phase 14

/* ══════════════════════════════════════════════
   TYPES LOCAUX
   ══════════════════════════════════════════════ */

type DashboardTab = 'overview' | 'progression' | 'history' | 'badges';
type BadgeFilter = 'all' | 'ressources' | 'quiz' | 'performance' | 'discipline' | 'streak';

/* ══════════════════════════════════════════════
   COMPOSANT PRINCIPAL : StudentDashboard
   ══════════════════════════════════════════════ */
const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  /* ── États de données (Phase 7) ── */
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [disciplineProgress, setDisciplineProgress] = useState<DisciplineProgress[]>([]);
  const [chartData, setChartData] = useState<ProgressionTemporelle[]>([]);
  const [recentResults, setRecentResults] = useState<QuizResult[]>([]);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);

  /* ── États Phase 14 (NOUVEAU) ── */
  const [progressionGlobale, setProgressionGlobale] = useState<ProgressionGlobale | null>(null);
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [badgeFilter, setBadgeFilter] = useState<BadgeFilter>('all');

  /* ── États UI ── */
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  /* ── États Code Parent ── */
  const [codeParent, setCodeParent] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  /** Génère ou récupère le code d'invitation parent */
  const handleGenererCode = async () => {
    if (!currentUser) return;
    setCodeLoading(true);
    try {
      const code = await getCodeInvitation(currentUser.uid);
      setCodeParent(code);
    } catch (err) {
      console.error('Erreur génération code parent :', err);
    } finally {
      setCodeLoading(false);
    }
  };

  /** Copie le code dans le presse-papiers */
  const handleCopierCode = () => {
    if (!codeParent) return;
    navigator.clipboard.writeText(codeParent);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  /* ══════════════════════════════════════════════
     CHARGEMENT DES DONNÉES
     ══════════════════════════════════════════════ */
  useEffect(() => {
    const loadDashboard = async () => {
      if (!currentUser) return;
      setLoading(true);

      try {
        /* ── Mettre à jour le streak dès l'arrivée sur le dashboard ── */
        await mettreAJourStreak(currentUser.uid);

        /* ── Charger toutes les données en parallèle ── */
        const [
          progressData,
          discProgress,
          temporal,
          history,
          quizzes,
          progGlobale,           // ★ Phase 14
        ] = await Promise.all([
          getStudentProgress(currentUser.uid),
          getDisciplineProgress(currentUser.uid),
          getProgressionTemporelle(currentUser.uid, 20),
          getQuizHistory(currentUser.uid, 10),
          getQuizzes().catch(() => []),
          getProgressionGlobale(currentUser.uid),  // ★ Phase 14
        ]);

        setProgress(progressData);
        setDisciplineProgress(discProgress);
        setChartData(temporal);
        setRecentResults(history);
        setAvailableQuizzes(quizzes);
        setProgressionGlobale(progGlobale);        // ★ Phase 14

        /* ── Calculer les badges (Phase 14 enrichi) ── */
        const badgesList = calculateBadges(progressData, discProgress, progGlobale);
        setBadges(badgesList);
      } catch (error) {
        console.error('Erreur chargement dashboard :', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [currentUser]);

  /* ══════════════════════════════════════════════
     RENDU : CHARGEMENT
     ══════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="sd-loading">
        <div className="admin-spinner" />
        <p>Chargement de votre tableau de bord...</p>
      </div>
    );
  }

  /* ── Raccourcis ── */
  const badgesObtenus = badges.filter((b) => b.obtenu);
  const badgesTotal = badges.length;
  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Élève';

  /* ── Filtrage des badges par catégorie ── */
  const badgesFiltres = badgeFilter === 'all'
    ? badges
    : badges.filter((b) => b.categorie === badgeFilter);

  /* ══════════════════════════════════════════════
     RENDU PRINCIPAL
     ══════════════════════════════════════════════ */
  return (
    <div className="student-dashboard">

      {/* ══════════════════════════════════════════════
          EN-TÊTE DE BIENVENUE
          ══════════════════════════════════════════════ */}
      <div className="sd-welcome">
        <div className="sd-welcome-text">
          <h1>Bienvenue, {displayName} 👋</h1>
          <p>
            {progress && progress.totalQuizPasses > 0
              ? `Vous avez passé ${progress.totalQuizPasses} quiz avec une moyenne de ${progress.moyenneGenerale}%. Continuez !`
              : 'Commencez par consulter une ressource ou passer un quiz !'}
          </p>
        </div>
        <div className="sd-welcome-badges-row">
          {currentUser?.isPremium && (
            <span className="sd-premium-badge"><Star size={14} /> Premium</span>
          )}
          {/* ★ Phase 14 : Streak affiché dans l'en-tête */}
          {progressionGlobale && progressionGlobale.streakActuel > 0 && (
            <span className="sd-streak-badge">
              🔥 {progressionGlobale.streakActuel} jour{progressionGlobale.streakActuel > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          CARTES STATISTIQUES (enrichies Phase 14)
          ══════════════════════════════════════════════ */}
      <div className="sd-stats-grid">
        {/* Quiz passés */}
        <div className="sd-stat-card">
          <div className="sd-stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
            <BookOpen size={22} />
          </div>
          <div className="sd-stat-content">
            <span className="sd-stat-value">{progress?.totalQuizPasses || 0}</span>
            <span className="sd-stat-label">Quiz passés</span>
          </div>
        </div>

        {/* Moyenne générale */}
        <div className="sd-stat-card">
          <div className="sd-stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}>
            <Target size={22} />
          </div>
          <div className="sd-stat-content">
            <span className="sd-stat-value" style={{ color: getScoreColor(progress?.moyenneGenerale || 0) }}>
              {progress?.moyenneGenerale || 0}%
            </span>
            <span className="sd-stat-label">Moyenne générale</span>
          </div>
        </div>

        {/* ★ Phase 14 : Ressources consultées */}
        <div className="sd-stat-card">
          <div className="sd-stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Eye size={22} />
          </div>
          <div className="sd-stat-content">
            <span className="sd-stat-value">{progressionGlobale?.totalRessourcesVues || 0}</span>
            <span className="sd-stat-label">Ressources vues</span>
          </div>
        </div>

        {/* ★ Phase 14 : Streak de connexion */}
        <div className="sd-stat-card">
          <div className="sd-stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
            <Zap size={22} />
          </div>
          <div className="sd-stat-content">
            <span className="sd-stat-value">
              {progressionGlobale?.streakActuel || 0} 🔥
            </span>
            <span className="sd-stat-label">Jours consécutifs</span>
          </div>
        </div>

        {/* Meilleur score */}
        <div className="sd-stat-card">
          <div className="sd-stat-icon" style={{ background: '#fefce8', color: '#f59e0b' }}>
            <Trophy size={22} />
          </div>
          <div className="sd-stat-content">
            <span className="sd-stat-value">{progress?.meilleurScore || 0}%</span>
            <span className="sd-stat-label">Meilleur score</span>
          </div>
        </div>

        {/* ★ Phase 14 : Disciplines complétées */}
        <div className="sd-stat-card">
          <div className="sd-stat-icon" style={{ background: '#f0f9ff', color: '#0ea5e9' }}>
            <Award size={22} />
          </div>
          <div className="sd-stat-content">
            <span className="sd-stat-value">
              {progressionGlobale?.disciplinesCompletees || 0}/{progressionGlobale?.disciplinesCommencees || 0}
            </span>
            <span className="sd-stat-label">Disciplines complétées</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          CODE PARENT
          ══════════════════════════════════════════════ */}
      <div className="sd-chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="sd-section-title">👨‍👩‍👧‍👦 Code Parent</h3>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Partagez ce code avec vos parents pour qu'ils puissent suivre votre progression.
        </p>
        {!codeParent ? (
          <button
            className="sd-btn sd-btn-primary"
            onClick={handleGenererCode}
            disabled={codeLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {codeLoading ? (
              <><span className="admin-spinner" style={{ width: '16px', height: '16px' }} /> Génération...</>
            ) : (
              <>🔑 Générer mon code</>
            )}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700,
              letterSpacing: '0.1em', background: '#eff6ff', color: '#2563eb',
              padding: '0.75rem 1.5rem', borderRadius: '12px',
              border: '2px dashed #93c5fd', userSelect: 'all',
            }}>
              {codeParent}
            </span>
            <button
              className="sd-btn"
              onClick={handleCopierCode}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: codeCopied ? '#10b981' : '#f3f4f6',
                color: codeCopied ? '#fff' : '#374151',
                border: 'none', padding: '0.6rem 1rem', borderRadius: '8px',
                cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s',
              }}
            >
              {codeCopied ? '✅ Copié !' : '📋 Copier'}
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          MES GROUPES-CLASSES (Phase 11)
          ══════════════════════════════════════════════ */}
      <div className="sd-chart-card" style={{ marginBottom: '1.5rem' }}>
        <RejoindreGroupe />
      </div>

      {/* ══════════════════════════════════════════════
          COURS EN LIGNE (Phase 24)
          ══════════════════════════════════════════════ */}
      <div className="sd-chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="sd-section-title">
          <BookOpen size={18} /> Cours en ligne
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Des cours complets du programme sénégalais, accessibles partout.
        </p>
        <button
          className="sd-btn sd-btn-primary"
          onClick={() => navigate('/cours')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Play size={16} /> Accéder aux cours
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          ONGLETS (ajout de "Progression")
          ══════════════════════════════════════════════ */}
      <div className="sd-tabs">
        <button
          className={`sd-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 size={16} /> Vue d'ensemble
        </button>

        {/* ★ Phase 14 : Nouvel onglet Progression */}
        <button
          className={`sd-tab ${activeTab === 'progression' ? 'active' : ''}`}
          onClick={() => setActiveTab('progression')}
        >
          <TrendingUp size={16} /> Progression
        </button>

        <button
          className={`sd-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Calendar size={16} /> Historique
        </button>
        <button
          className={`sd-tab ${activeTab === 'badges' ? 'active' : ''}`}
          onClick={() => setActiveTab('badges')}
        >
          <Award size={16} /> Badges ({badgesObtenus.length}/{badgesTotal})
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          CONTENU PAR ONGLET
          ══════════════════════════════════════════════ */}

      {/* ────────────────────────────────────────────
          Onglet : Vue d'ensemble (Phase 7 conservé)
          ──────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="sd-overview">

          {/* Graphique d'évolution */}
          {chartData.length > 1 && (
            <div className="sd-chart-card">
              <h3 className="sd-section-title">
                <TrendingUp size={18} /> Évolution de vos scores
              </h3>
              <div className="sd-chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} unit="%" />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Score']}
                      labelFormatter={(label: string) => `Date : ${label}`}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2.5}
                      dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Progression par discipline (barres recharts) */}
          {disciplineProgress.length > 0 && (
            <div className="sd-chart-card">
              <h3 className="sd-section-title">
                <BarChart3 size={18} /> Moyennes par discipline
              </h3>
              <div className="sd-chart-container">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={disciplineProgress} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#6b7280' }} unit="%" />
                    <YAxis type="category" dataKey="disciplineNom" width={120} tick={{ fontSize: 12, fill: '#374151' }} />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Moyenne']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.07)' }}
                    />
                    <Bar dataKey="moyenne" radius={[0, 6, 6, 0]} barSize={24}>
                      {disciplineProgress.map((entry, index) => (
                        <Cell key={index} fill={getScoreColor(entry.moyenne)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Quiz disponibles */}
          {availableQuizzes.length > 0 && (
            <div className="sd-chart-card">
              <h3 className="sd-section-title"><Play size={18} /> Quiz disponibles</h3>
              <div className="sd-quiz-grid">
                {availableQuizzes.slice(0, 6).map((quiz) => {
                  const isLocked = quiz.isPremium && !currentUser?.isPremium;
                  return (
                    <div key={quiz.id}
                      className={`sd-quiz-card ${isLocked ? 'locked' : ''}`}
                      onClick={() => !isLocked && navigate(`/quiz/${quiz.id}`)}
                    >
                      {quiz.isPremium && (
                        <span className="sd-quiz-badge-premium">
                          {isLocked ? <Lock size={10} /> : <Star size={10} />} Premium
                        </span>
                      )}
                      <h4 className="sd-quiz-title">{quiz.titre}</h4>
                      <div className="sd-quiz-meta">
                        <span><BookOpen size={12} /> {quiz.questions.length} questions</span>
                        <span><Clock size={12} /> {quiz.duree} min</span>
                      </div>
                      {!isLocked && (
                        <button className="sd-quiz-play-btn"><Play size={14} /> Commencer</button>
                      )}
                      {isLocked && (
                        <button className="sd-quiz-unlock-btn"
                          onClick={(e) => { e.stopPropagation(); navigate('/premium'); }}>
                          <Lock size={14} /> Débloquer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aucune donnée */}
          {progress && progress.totalQuizPasses === 0 && (!progressionGlobale || progressionGlobale.totalRessourcesVues === 0) && (
            <div className="sd-empty-state">
              <Target size={48} />
              <h3>Commencez votre parcours !</h3>
              <p>Consultez une ressource ou passez un quiz pour voir votre progression.</p>
              {availableQuizzes.length > 0 && (
                <button className="sd-btn sd-btn-primary"
                  onClick={() => navigate(`/quiz/${availableQuizzes[0].id}`)}>
                  <Play size={18} /> Passer un quiz
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────
          ★ Onglet : Progression (NOUVEAU Phase 14)
          ──────────────────────────────────────────── */}
      {activeTab === 'progression' && (
        <div className="sd-progression">

          {/* ── Résumé global ── */}
          <div className="sd-chart-card sd-prog-summary">
            <h3 className="sd-section-title">
              <TrendingUp size={18} /> Avancement global
            </h3>

            {/* Barre de progression globale */}
            <ProgressBar
              pourcentage={progressionGlobale?.pourcentageMoyen || 0}
              label="Progression moyenne"
              size="lg"
              showCheck
            />

            {/* Stats en ligne */}
            <div className="sd-prog-stats-row">
              <div className="sd-prog-stat-item">
                <span className="sd-prog-stat-number">{progressionGlobale?.totalRessourcesVues || 0}</span>
                <span className="sd-prog-stat-text">Ressources consultées</span>
              </div>
              <div className="sd-prog-stat-item">
                <span className="sd-prog-stat-number">{progressionGlobale?.totalQuizReussis || 0}</span>
                <span className="sd-prog-stat-text">Quiz réussis</span>
              </div>
              <div className="sd-prog-stat-item">
                <span className="sd-prog-stat-number">{progressionGlobale?.disciplinesCommencees || 0}</span>
                <span className="sd-prog-stat-text">Disciplines</span>
              </div>
              <div className="sd-prog-stat-item">
                <span className="sd-prog-stat-number">
                  🔥 {progressionGlobale?.streakActuel || 0}
                </span>
                <span className="sd-prog-stat-text">Streak (max: {progressionGlobale?.meilleurStreak || 0})</span>
              </div>
            </div>
          </div>

          {/* ── Progression par discipline avec ProgressBar ── */}
          {progressionGlobale && progressionGlobale.parDiscipline.length > 0 ? (
            <div className="sd-chart-card">
              <h3 className="sd-section-title">
                <BarChart3 size={18} /> Par discipline
              </h3>

              <div className="sd-prog-disciplines">
                {progressionGlobale.parDiscipline.map((prog) => (
                  <div key={prog.disciplineId} className="sd-prog-disc-card">
                    {/* En-tête de la discipline */}
                    <div className="sd-prog-disc-header">
                      <span className="sd-prog-disc-name">{prog.disciplineNom}</span>
                      {prog.pourcentage >= 100 && <span className="sd-prog-complete-tag">✅ Complété</span>}
                    </div>

                    {/* Barre de progression */}
                    <ProgressBar
                      pourcentage={prog.pourcentage}
                      size="md"
                      showPercent
                    />

                    {/* Détails */}
                    <div className="sd-prog-disc-details">
                      <span>
                        <Eye size={12} /> {prog.ressourcesVues.length}/{prog.totalRessources} ressources
                      </span>
                      <span>
                        <CheckCircle size={12} /> {prog.quizReussis.length}/{prog.totalQuiz} quiz réussis
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="sd-empty-state">
              <Eye size={48} />
              <h3>Aucune progression enregistrée</h3>
              <p>Consultez des ressources ou passez des quiz pour voir votre avancement ici.</p>
            </div>
          )}

          {/* ── Cartes disciplines existantes (quiz) ── */}
          {disciplineProgress.length > 0 && (
            <div className="sd-chart-card">
              <h3 className="sd-section-title">
                <Target size={18} /> Performance quiz par discipline
              </h3>
              <div className="sd-disc-list">
                {disciplineProgress.map((disc) => (
                  <div key={disc.disciplineId} className="sd-disc-card">
                    <div className="sd-disc-header">
                      <span className="sd-disc-name">{disc.disciplineNom}</span>
                      <span className="sd-disc-tendance">
                        {disc.tendance === 'up' && <TrendingUp size={16} className="tendance-up" />}
                        {disc.tendance === 'down' && <TrendingDown size={16} className="tendance-down" />}
                        {disc.tendance === 'stable' && <Minus size={16} className="tendance-stable" />}
                      </span>
                    </div>
                    <div className="sd-disc-stats">
                      <div className="sd-disc-stat">
                        <span className="sd-disc-stat-value" style={{ color: getScoreColor(disc.moyenne) }}>
                          {disc.moyenne}%
                        </span>
                        <span className="sd-disc-stat-label">Moyenne</span>
                      </div>
                      <div className="sd-disc-stat">
                        <span className="sd-disc-stat-value">{disc.nombreQuiz}</span>
                        <span className="sd-disc-stat-label">Quiz</span>
                      </div>
                      <div className="sd-disc-stat">
                        <span className="sd-disc-stat-value">{disc.meilleurScore}%</span>
                        <span className="sd-disc-stat-label">Meilleur</span>
                      </div>
                      <div className="sd-disc-stat">
                        <span className="sd-disc-stat-value">{disc.quizReussis}/{disc.nombreQuiz}</span>
                        <span className="sd-disc-stat-label">Réussis</span>
                      </div>
                    </div>
                    <div className="sd-disc-bar">
                      <div className="sd-disc-bar-fill"
                        style={{ width: `${disc.moyenne}%`, background: getScoreColor(disc.moyenne) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────
          Onglet : Historique (Phase 7 — inchangé)
          ──────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="sd-history">
          {recentResults.length === 0 ? (
            <div className="sd-empty-state">
              <Calendar size={48} />
              <h3>Aucun quiz passé</h3>
              <p>Votre historique apparaîtra ici après avoir passé des quiz.</p>
            </div>
          ) : (
            <div className="sd-history-list">
              {recentResults.map((result) => {
                const date = result.datePassage?.toDate
                  ? result.datePassage.toDate()
                  : new Date(result.datePassage);

                return (
                  <div key={result.id} className={`sd-history-item ${result.reussi ? 'success' : 'fail'}`}>
                    <div className={`sd-history-icon ${result.reussi ? 'success' : 'fail'}`}>
                      {result.reussi ? <CheckCircle size={20} /> : <XCircle size={20} />}
                    </div>
                    <div className="sd-history-content">
                      <div className="sd-history-top">
                        <span className="sd-history-title">{result.quizTitre}</span>
                        <span className="sd-history-discipline">{result.disciplineNom}</span>
                      </div>
                      <div className="sd-history-meta">
                        <span>
                          <Calendar size={12} />
                          {date.toLocaleDateString('fr-SN', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        <span><Clock size={12} /> {formatTemps(result.tempsEcoule)}</span>
                        <span><CheckCircle size={12} /> {result.bonnesReponses}/{result.nombreQuestions}</span>
                      </div>
                    </div>
                    <div className="sd-history-score" style={{ color: getScoreColor(result.pourcentage) }}>
                      <span className="sd-history-score-value">{result.pourcentage}%</span>
                      <span className="sd-history-score-label">{getScoreLabel(result.pourcentage)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────
          ★ Onglet : Badges (ENRICHI Phase 14)
          ──────────────────────────────────────────── */}
      {activeTab === 'badges' && (
        <div className="sd-badges">

          {/* Résumé badges */}
          <div className="sd-badges-summary">
            <div className="sd-badges-circle">
              <span className="sd-badges-count">{badgesObtenus.length}</span>
              <span className="sd-badges-total">/ {badgesTotal}</span>
            </div>
            <p>badges obtenus</p>
            <div className="sd-badges-progress">
              <div className="sd-badges-progress-fill"
                style={{ width: `${(badgesObtenus.length / badgesTotal) * 100}%` }}
              />
            </div>
          </div>

          {/* ★ Phase 14 : Filtres par catégorie */}
          <div className="sd-badges-filters">
            {([
              { key: 'all', label: 'Tous' },
              { key: 'ressources', label: '📖 Ressources' },
              { key: 'quiz', label: '🧩 Quiz' },
              { key: 'performance', label: '⭐ Performance' },
              { key: 'discipline', label: '🌍 Disciplines' },
              { key: 'streak', label: '🔥 Streak' },
            ] as { key: BadgeFilter; label: string }[]).map((f) => (
              <button
                key={f.key}
                className={`sd-badge-filter-btn ${badgeFilter === f.key ? 'active' : ''}`}
                onClick={() => setBadgeFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Grille de badges filtrée */}
          <div className="sd-badges-grid">
            {badgesFiltres.map((badge) => (
              <div
                key={badge.id}
                className={`sd-badge-card ${badge.obtenu ? 'obtained' : 'locked'}`}
              >
                <span className="sd-badge-icon">{badge.icone}</span>
                <h4 className="sd-badge-name">{badge.nom}</h4>
                <p className="sd-badge-description">{badge.description}</p>
                <span className="sd-badge-condition">{badge.condition}</span>
                {badge.obtenu && (
                  <span className="sd-badge-obtained-tag">✅ Obtenu</span>
                )}
                {/* ★ Phase 14 : Catégorie affichée */}
                <span className="sd-badge-category">{badge.categorie}</span>
              </div>
            ))}
          </div>

          {badgesFiltres.length === 0 && (
            <div className="sd-empty-state" style={{ marginTop: '1rem' }}>
              <Filter size={36} />
              <h3>Aucun badge dans cette catégorie</h3>
              <p>Essayez un autre filtre.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;

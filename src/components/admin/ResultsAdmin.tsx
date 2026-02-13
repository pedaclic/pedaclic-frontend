/**
 * ============================================================================
 * COMPOSANT RESULTS ADMIN - PedaClic
 * ============================================================================
 * Tableau de bord des résultats de quiz (v1 + v2) pour l'administration.
 * Affiche les statistiques globales, les résultats récents et les filtres.
 * 
 * Collections Firestore interrogées :
 *   - quiz_results (quiz classiques Phase 6)
 *   - quiz_results_v2 (quiz avancés Phase 12)
 *   - users (pour résoudre les noms d'élèves)
 *   - quizzes / quizzes_v2 (pour les titres de quiz)
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';

// ==================== INTERFACES ====================

/** Résultat unifié (v1 + v2) pour l'affichage admin */
interface UnifiedResult {
  id: string;
  quizId: string;
  quizTitre: string;
  userId: string;
  userName: string;
  userEmail: string;
  score: number;
  scoreMax: number;
  pourcentage: number;
  reussi: boolean;
  tempsEcoule: number;
  datePassage: Date;
  type: 'classique' | 'avance';
  disciplineNom: string;
}

/** Statistiques globales */
interface GlobalStats {
  totalResultats: number;
  moyenneGenerale: number;
  tauxReussite: number;
  tempsEcouleMoyen: number;
  resultatsAujourdHui: number;
  resultats7Jours: number;
}

// ==================== COMPOSANT PRINCIPAL ====================

const ResultsAdmin: React.FC = () => {
  // ==================== ÉTAT ====================

  const [results, setResults] = useState<UnifiedResult[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Filtres */
  const [filterType, setFilterType] = useState<string>('');
  const [filterReussi, setFilterReussi] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ==================== CHARGEMENT DES DONNÉES ====================

  /**
   * Charge les résultats depuis les deux collections
   * et résout les noms d'utilisateurs et de quiz
   */
  const loadResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      /* ── 1. Charger les utilisateurs (map uid → nom/email) ── */
      const usersSnap = await getDocs(collection(db, 'users'));
      const usersMap = new Map<string, { name: string; email: string }>();
      usersSnap.docs.forEach((doc) => {
        const data = doc.data();
        usersMap.set(doc.id, {
          name: data.displayName || 'Sans nom',
          email: data.email || '',
        });
      });

      /* ── 2. Charger les quiz v1 (map id → titre/discipline) ── */
      const quizzesSnap = await getDocs(collection(db, 'quizzes'));
      const quizzesMap = new Map<string, { titre: string; discipline: string }>();
      quizzesSnap.docs.forEach((doc) => {
        const data = doc.data();
        quizzesMap.set(doc.id, {
          titre: data.titre || data.quizTitre || 'Quiz sans titre',
          discipline: data.disciplineNom || data.matiereNom || '',
        });
      });

      /* ── 3. Charger les quiz v2 (map id → titre/discipline) ── */
      const quizzesV2Snap = await getDocs(collection(db, 'quizzes_v2'));
      const quizzesV2Map = new Map<string, { titre: string; discipline: string }>();
      quizzesV2Snap.docs.forEach((doc) => {
        const data = doc.data();
        quizzesV2Map.set(doc.id, {
          titre: data.titre || 'Quiz avancé sans titre',
          discipline: data.disciplineNom || '',
        });
      });

      /* ── 4. Charger les résultats v1 ── */
      const resultsV1: UnifiedResult[] = [];
      try {
        const v1Snap = await getDocs(
          query(collection(db, 'quiz_results'), orderBy('datePassage', 'desc'), limit(200))
        );
        v1Snap.docs.forEach((doc) => {
          const data = doc.data();
          const user = usersMap.get(data.userId) || { name: 'Inconnu', email: '' };
          const quiz = quizzesMap.get(data.quizId) || { titre: data.quizTitre || 'Quiz', discipline: data.disciplineNom || '' };
          
          /* Calculer le pourcentage selon la structure v1 */
          const pourcentage = data.pourcentage ?? (data.totalPoints > 0
            ? Math.round((data.score / data.totalPoints) * 100)
            : data.score > 0 ? Math.round((data.score / 20) * 100) : 0);

          resultsV1.push({
            id: doc.id,
            quizId: data.quizId || '',
            quizTitre: quiz.titre,
            userId: data.userId || '',
            userName: user.name,
            userEmail: user.email,
            score: data.score || 0,
            scoreMax: data.totalPoints || 20,
            pourcentage,
            reussi: data.reussi ?? pourcentage >= 50,
            tempsEcoule: data.tempsEcoule || 0,
            datePassage: data.datePassage?.toDate?.() || new Date(),
            type: 'classique',
            disciplineNom: quiz.discipline,
          });
        });
      } catch (err) {
        console.warn('Pas de résultats v1 ou index manquant:', err);
      }

      /* ── 5. Charger les résultats v2 ── */
      const resultsV2: UnifiedResult[] = [];
      try {
        const v2Snap = await getDocs(
          query(collection(db, 'quiz_results_v2'), orderBy('datePassage', 'desc'), limit(200))
        );
        v2Snap.docs.forEach((doc) => {
          const data = doc.data();
          const user = usersMap.get(data.userId) || { name: 'Inconnu', email: '' };
          const quiz = quizzesV2Map.get(data.quizId) || { titre: data.quizTitre || 'Quiz avancé', discipline: data.disciplineNom || '' };

          const pourcentage = data.scoreMax > 0
            ? Math.round((data.score / data.scoreMax) * 100)
            : 0;

          resultsV2.push({
            id: doc.id,
            quizId: data.quizId || '',
            quizTitre: quiz.titre,
            userId: data.userId || '',
            userName: user.name,
            userEmail: user.email,
            score: data.score || 0,
            scoreMax: data.scoreMax || 0,
            pourcentage,
            reussi: data.reussi ?? pourcentage >= 50,
            tempsEcoule: data.tempsTotal || data.tempsEcoule || 0,
            datePassage: data.datePassage?.toDate?.() || new Date(),
            type: 'avance',
            disciplineNom: quiz.discipline,
          });
        });
      } catch (err) {
        console.warn('Pas de résultats v2 ou index manquant:', err);
      }

      /* ── 6. Fusionner et trier par date ── */
      const allResults = [...resultsV1, ...resultsV2].sort(
        (a, b) => b.datePassage.getTime() - a.datePassage.getTime()
      );

      setResults(allResults);

      /* ── 7. Calculer les statistiques globales ── */
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const totalResultats = allResults.length;
      const moyenneGenerale = totalResultats > 0
        ? Math.round(allResults.reduce((sum, r) => sum + r.pourcentage, 0) / totalResultats)
        : 0;
      const tauxReussite = totalResultats > 0
        ? Math.round((allResults.filter((r) => r.reussi).length / totalResultats) * 100)
        : 0;
      const tempsEcouleMoyen = totalResultats > 0
        ? Math.round(allResults.reduce((sum, r) => sum + r.tempsEcoule, 0) / totalResultats)
        : 0;
      const resultatsAujourdHui = allResults.filter(
        (r) => r.datePassage >= today
      ).length;
      const resultats7Jours = allResults.filter(
        (r) => r.datePassage >= last7Days
      ).length;

      setStats({
        totalResultats,
        moyenneGenerale,
        tauxReussite,
        tempsEcouleMoyen,
        resultatsAujourdHui,
        resultats7Jours,
      });
    } catch (err) {
      console.error('Erreur chargement résultats:', err);
      setError('Impossible de charger les résultats. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  // ==================== FILTRAGE ====================

  const filteredResults = results.filter((r) => {
    /* Filtre par type de quiz */
    if (filterType && r.type !== filterType) return false;
    /* Filtre par réussite */
    if (filterReussi === 'true' && !r.reussi) return false;
    if (filterReussi === 'false' && r.reussi) return false;
    /* Recherche textuelle */
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !r.userName.toLowerCase().includes(search) &&
        !r.userEmail.toLowerCase().includes(search) &&
        !r.quizTitre.toLowerCase().includes(search) &&
        !r.disciplineNom.toLowerCase().includes(search)
      ) {
        return false;
      }
    }
    return true;
  });

  // ==================== HELPERS ====================

  /** Formate une durée en secondes → "Xmin Ys" */
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return sec > 0 ? `${min}min ${sec}s` : `${min}min`;
  };

  /** Formate une date en français */
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /** Classe CSS pour le badge de pourcentage */
  const getScoreClass = (pct: number): string => {
    if (pct >= 80) return 'results-score--excellent';
    if (pct >= 60) return 'results-score--bien';
    if (pct >= 40) return 'results-score--moyen';
    return 'results-score--faible';
  };

  // ==================== RENDU ====================

  return (
    <div className="results-admin">
      {/* ==================== EN-TÊTE ==================== */}
      <div className="admin-page-header">
        <div className="admin-page-header__info">
          <h1 className="admin-page-header__title">📈 Résultats des Quiz</h1>
          <p className="admin-page-header__subtitle">
            Vue d'ensemble des performances des élèves
          </p>
        </div>
        <div className="admin-page-header__actions">
          <button className="admin-btn admin-btn-secondary" onClick={loadResults}>
            🔄 Actualiser
          </button>
        </div>
      </div>

      {/* ==================== STATISTIQUES GLOBALES ==================== */}
      {stats && (
        <div className="stats-grid">
          {/* Total des résultats */}
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--primary">📋</div>
            <div className="stat-card__content">
              <div className="stat-card__value">{stats.totalResultats}</div>
              <div className="stat-card__label">Résultats totaux</div>
            </div>
          </div>

          {/* Moyenne générale */}
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--secondary">📊</div>
            <div className="stat-card__content">
              <div className="stat-card__value">{stats.moyenneGenerale}%</div>
              <div className="stat-card__label">Moyenne générale</div>
            </div>
          </div>

          {/* Taux de réussite */}
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--warning">🎯</div>
            <div className="stat-card__content">
              <div className="stat-card__value">{stats.tauxReussite}%</div>
              <div className="stat-card__label">Taux de réussite</div>
            </div>
          </div>

          {/* Aujourd'hui */}
          <div className="stat-card">
            <div className="stat-card__icon stat-card__icon--info">📅</div>
            <div className="stat-card__content">
              <div className="stat-card__value">{stats.resultatsAujourdHui}</div>
              <div className="stat-card__label">Aujourd'hui</div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BARRE DE RECHERCHE & FILTRES ==================== */}
      <div className="admin-toolbar">
        {/* Recherche */}
        <div className="admin-search">
          <span className="admin-search-icon">🔍</span>
          <input
            type="text"
            className="admin-search-input"
            placeholder="Rechercher par élève, quiz ou discipline..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Toggle filtres */}
        <button
          className={`admin-btn admin-btn-ghost ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          🎛️ Filtres
        </button>
      </div>

      {/* Panneau de filtres */}
      {showFilters && (
        <div className="admin-filters-panel">
          {/* Type de quiz */}
          <div className="admin-filter-group">
            <label className="admin-filter-label">Type de quiz</label>
            <select
              className="admin-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Tous les types</option>
              <option value="classique">Classique (v1)</option>
              <option value="avance">Avancé (v2)</option>
            </select>
          </div>

          {/* Réussite */}
          <div className="admin-filter-group">
            <label className="admin-filter-label">Résultat</label>
            <select
              className="admin-select"
              value={filterReussi}
              onChange={(e) => setFilterReussi(e.target.value)}
            >
              <option value="">Tous</option>
              <option value="true">Réussis</option>
              <option value="false">Échoués</option>
            </select>
          </div>

          {/* Réinitialiser */}
          <button
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setFilterType('');
              setFilterReussi('');
              setSearchTerm('');
            }}
          >
            Réinitialiser
          </button>
        </div>
      )}

      {/* ==================== TABLEAU DES RÉSULTATS ==================== */}
      {loading ? (
        <div className="admin-loading">
          <div className="admin-spinner" />
          <p>Chargement des résultats...</p>
        </div>
      ) : error ? (
        <div className="admin-error">
          <p>❌ {error}</p>
          <button className="admin-btn admin-btn-primary" onClick={loadResults}>
            Réessayer
          </button>
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="admin-empty-state">
          <span style={{ fontSize: '3rem' }}>📋</span>
          <h3>Aucun résultat trouvé</h3>
          <p>
            {results.length === 0
              ? "Aucun élève n'a encore passé de quiz."
              : 'Aucun résultat ne correspond à vos filtres.'}
          </p>
        </div>
      ) : (
        <div className="results-table-wrapper">
          <table className="results-table">
            <thead>
              <tr>
                <th>Élève</th>
                <th>Quiz</th>
                <th>Type</th>
                <th>Score</th>
                <th>Résultat</th>
                <th>Durée</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((result) => (
                <tr key={`${result.type}-${result.id}`}>
                  {/* Élève */}
                  <td>
                    <div className="results-cell-user">
                      <span className="results-cell-name">{result.userName}</span>
                      <span className="results-cell-email">{result.userEmail}</span>
                    </div>
                  </td>

                  {/* Quiz */}
                  <td>
                    <div className="results-cell-quiz">
                      <span className="results-cell-quiz-title">{result.quizTitre}</span>
                      {result.disciplineNom && (
                        <span className="results-cell-discipline">{result.disciplineNom}</span>
                      )}
                    </div>
                  </td>

                  {/* Type */}
                  <td>
                    <span className={`results-badge results-badge--${result.type}`}>
                      {result.type === 'classique' ? '📝 Classique' : '🧠 Avancé'}
                    </span>
                  </td>

                  {/* Score */}
                  <td>
                    <span className={`results-score ${getScoreClass(result.pourcentage)}`}>
                      {result.pourcentage}%
                    </span>
                    <span className="results-score-detail">
                      {result.score}/{result.scoreMax}
                    </span>
                  </td>

                  {/* Résultat */}
                  <td>
                    <span className={`results-status ${result.reussi ? 'results-status--success' : 'results-status--fail'}`}>
                      {result.reussi ? '✅ Réussi' : '❌ Échoué'}
                    </span>
                  </td>

                  {/* Durée */}
                  <td className="results-cell-duration">
                    {formatDuration(result.tempsEcoule)}
                  </td>

                  {/* Date */}
                  <td className="results-cell-date">
                    {formatDate(result.datePassage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Compteur de résultats */}
          <div className="results-footer">
            <p>
              {filteredResults.length} résultat{filteredResults.length > 1 ? 's' : ''} affiché{filteredResults.length > 1 ? 's' : ''}
              {filteredResults.length !== results.length && ` sur ${results.length} au total`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsAdmin;

/**
 * ==================== STUDENT SUIVI (Phase 9) ====================
 * 
 * Page "Mes points à améliorer" côté élève.
 * Affiche les lacunes détectées, recommandations, streaks et objectifs.
 * 
 * Fichier : src/components/student/StudentSuivi.tsx
 * Dépendances : suiviService.ts, AuthContext, suivi.css
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getSuiviComplet,
  getMessageMotivation,
  getProgressionPourcent,
  getCouleurUrgence,
  getLabelUrgence,
  getEmojiFendance,
} from '../../services/suiviService';
import '../../styles/suivi.css';

// ==================== INTERFACES LOCALES ====================

/**
 * Structure des données de suivi chargées depuis le service
 */
interface SuiviData {
  lacunes: {
    id: string;
    disciplineId: string;
    disciplineNom: string;
    chapitre?: string;
    moyenne: number;
    nombreQuiz: number;
    tendance: 'hausse' | 'baisse' | 'stable';
    niveauUrgence: 'critique' | 'important' | 'modere';
    dernierQuizDate: Date;
    scoreDetails: {
      dernierScore: number;
      meilleurScore: number;
      pireScore: number;
    };
  }[];
  recommandations: {
    id: string;
    lacuneId: string;
    type: string;
    titre: string;
    description: string;
    disciplineNom: string;
    priorite: number;
    completee: boolean;
    dateCreation: Date;
  }[];
  streak: {
    userId: string;
    streakActuel: number;
    meilleurStreak: number;
    dernierJourActif: Date | null;
    totalJoursActifs: number;
    semaineCourante: boolean[];
    historiqueHebdo: { semaine: string; joursActifs: number }[];
  };
  objectifs: {
    id: string;
    userId: string;
    titre: string;
    description: string;
    type: string;
    cible: number;
    progression: number;
    statut: 'en_cours' | 'atteint' | 'echoue' | 'non_commence';
    disciplineId?: string;
    disciplineNom?: string;
    dateDebut: Date;
    dateFin: Date;
    recompense?: string;
  }[];
  scoreGlobal: number;
}

// ==================== COMPOSANT PRINCIPAL ====================

const StudentSuivi: React.FC = () => {
  // ===== Hooks =====
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // ===== États =====
  const [suiviData, setSuiviData] = useState<SuiviData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ===== Labels des jours de la semaine =====
  const joursLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  /**
   * Charge les données de suivi complètes de l'élève
   */
  const chargerSuivi = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getSuiviComplet(currentUser.uid);
      setSuiviData(data);
    } catch (err) {
      console.error('Erreur chargement suivi:', err);
      setError('Impossible de charger ton suivi. Vérifie ta connexion et réessaie.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  // Chargement initial
  useEffect(() => {
    chargerSuivi();
  }, [chargerSuivi]);

  // ===== Détermination du jour actuel (0=Lundi, 6=Dimanche) =====
  const jourActuel = (() => {
    const d = new Date().getDay(); // 0=Dim, 1=Lun
    return d === 0 ? 6 : d - 1; // Convertir en 0=Lun, 6=Dim
  })();

  // ==================== RENDU : CHARGEMENT ====================

  if (loading) {
    return (
      <div className="suivi-page">
        <div className="suivi-container">
          {/* Spinner de chargement */}
          <div className="suivi-loading">
            <div className="spinner"></div>
            <p className="suivi-loading-text">Analyse de ta progression en cours...</p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDU : ERREUR ====================

  if (error) {
    return (
      <div className="suivi-page">
        <div className="suivi-container">
          <div className="suivi-error">
            <p className="suivi-error-title">⚠️ Erreur de chargement</p>
            <p className="suivi-error-text">{error}</p>
            <button className="suivi-btn-retry" onClick={chargerSuivi}>
              🔄 Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== RENDU : DONNÉES NON DISPONIBLES ====================

  if (!suiviData) return null;

  const { lacunes, recommandations, streak, objectifs, scoreGlobal } = suiviData;

  // Paramètres du cercle SVG de score
  const circumference = 2 * Math.PI * 40; // rayon = 40
  const scoreOffset = circumference - (scoreGlobal / 100) * circumference;
  const scoreColor = scoreGlobal >= 60 ? '#10b981' : scoreGlobal >= 30 ? '#f59e0b' : '#ef4444';

  // ==================== RENDU PRINCIPAL ====================

  return (
    <div className="suivi-page">
      <div className="suivi-container">

        {/* ==================== EN-TÊTE AVEC SCORE GLOBAL ==================== */}
        <div className="suivi-header">
          <div className="suivi-header-content">
            {/* Titre + message motivation */}
            <div>
              <h1>📊 Mes points à améliorer</h1>
              <p className="suivi-motivation">
                {getMessageMotivation(scoreGlobal)}
              </p>
            </div>

            {/* Cercle de score global (SVG) */}
            <div className="score-global-circle">
              <svg className="score-circle-svg" viewBox="0 0 100 100">
                {/* Fond du cercle */}
                <circle
                  className="score-circle-bg"
                  cx="50"
                  cy="50"
                  r="40"
                />
                {/* Arc de progression */}
                <circle
                  className="score-circle-progress"
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={scoreColor}
                  strokeDasharray={circumference}
                  strokeDashoffset={scoreOffset}
                />
                {/* Texte central */}
                <text
                  className="score-circle-text"
                  x="50"
                  y="50"
                >
                  {scoreGlobal}
                </text>
              </svg>
              <span className="score-global-label">Score global</span>
            </div>
          </div>
        </div>

        {/* ==================== SECTION STREAK ==================== */}
        <div className="streak-card">
          {/* En-tête streak : flamme + compteur */}
          <div className="streak-header">
            <span className="streak-flamme">
              {streak.streakActuel > 0 ? '🔥' : '❄️'}
            </span>
            <div>
              <div className="streak-nombre">{streak.streakActuel}</div>
              <div className="streak-label">
                {streak.streakActuel <= 1 ? 'jour consécutif' : 'jours consécutifs'}
              </div>
            </div>
          </div>

          {/* Jours de la semaine (Lun-Dim) */}
          <div className="streak-semaine">
            {joursLabels.map((label, index) => (
              <div className="streak-jour" key={index}>
                <span className="streak-jour-label">{label}</span>
                <div
                  className={`streak-jour-indicateur ${
                    streak.semaineCourante[index] ? 'actif' : 'inactif'
                  } ${index === jourActuel ? 'aujourd-hui' : ''}`}
                >
                  {streak.semaineCourante[index] ? '✓' : '·'}
                </div>
              </div>
            ))}
          </div>

          {/* Stats du streak */}
          <div className="streak-stats">
            <div className="streak-stat">
              <span className="streak-stat-icon">🏅</span>
              <span className="streak-stat-value">{streak.meilleurStreak}</span>
              <span className="streak-stat-label">record</span>
            </div>
            <div className="streak-stat">
              <span className="streak-stat-icon">📅</span>
              <span className="streak-stat-value">{streak.totalJoursActifs}</span>
              <span className="streak-stat-label">jours actifs au total</span>
            </div>
            {streak.dernierJourActif && (
              <div className="streak-stat">
                <span className="streak-stat-icon">⏰</span>
                <span className="streak-stat-label">
                  Dernier quiz : {new Date(streak.dernierJourActif).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ==================== SECTION OBJECTIFS HEBDOMADAIRES ==================== */}
        <h2 className="suivi-section-title">
          🎯 Objectifs de la semaine
          <span className="suivi-section-badge">{objectifs.length}</span>
        </h2>

        {objectifs.length > 0 ? (
          <div className="objectifs-grid">
            {objectifs.map(objectif => {
              const pourcent = getProgressionPourcent(objectif as any);
              return (
                <div
                  className={`objectif-card ${objectif.statut === 'atteint' ? 'atteint' : ''}`}
                  key={objectif.id}
                >
                  {/* En-tête : titre + récompense */}
                  <div className="objectif-header">
                    <span className="objectif-titre">{objectif.titre}</span>
                    {objectif.recompense && (
                      <span className="objectif-recompense">{objectif.recompense}</span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="objectif-description">{objectif.description}</p>

                  {/* Barre de progression */}
                  <div className="objectif-progress">
                    <div className="objectif-progress-labels">
                      <span className="objectif-progress-value">
                        {objectif.progression} / {objectif.cible}
                      </span>
                      <span className="objectif-progress-cible">{pourcent}%</span>
                    </div>
                    <div className="objectif-progress-track">
                      <div
                        className={`objectif-progress-fill ${
                          objectif.statut === 'atteint' ? 'atteint' : ''
                        }`}
                        style={{ width: `${pourcent}%` }}
                      />
                    </div>
                  </div>

                  {/* Statut */}
                  <p className={`objectif-statut ${objectif.statut}`}>
                    {objectif.statut === 'atteint' ? '✅ Objectif atteint !'
                      : objectif.statut === 'en_cours' ? '⏳ En cours...'
                      : '🔜 Non commencé'}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="suivi-empty">
            <div className="suivi-empty-icon">🎯</div>
            <p className="suivi-empty-title">Pas encore d'objectifs</p>
            <p className="suivi-empty-text">
              Passe ton premier quiz pour débloquer tes objectifs hebdomadaires !
            </p>
          </div>
        )}

        {/* ==================== SECTION LACUNES ==================== */}
        <h2 className="suivi-section-title">
          ⚠️ Points faibles détectés
          {lacunes.length > 0 && (
            <span className="suivi-section-badge">{lacunes.length}</span>
          )}
        </h2>

        {lacunes.length > 0 ? (
          <div className="lacunes-grid">
            {lacunes.map(lacune => (
              <div
                className={`lacune-card ${lacune.niveauUrgence}`}
                key={lacune.id}
              >
                {/* En-tête : discipline + badge urgence */}
                <div className="lacune-card-header">
                  <span className="lacune-discipline">{lacune.disciplineNom}</span>
                  <span className={`lacune-badge ${lacune.niveauUrgence}`}>
                    {getLabelUrgence(lacune.niveauUrgence)}
                  </span>
                </div>

                {/* Barre de score */}
                <div className="lacune-score-bar">
                  <div className="lacune-score-labels">
                    <span
                      className="lacune-score-value"
                      style={{ color: getCouleurUrgence(lacune.niveauUrgence) }}
                    >
                      {lacune.moyenne}/20
                    </span>
                    <span className="lacune-score-objectif">Objectif : 14/20</span>
                  </div>
                  <div className="lacune-progress-track">
                    <div
                      className={`lacune-progress-fill ${lacune.niveauUrgence}`}
                      style={{ width: `${(lacune.moyenne / 20) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Détails : tendance, nb quiz, scores */}
                <div className="lacune-details">
                  <span className="lacune-detail-tag">
                    {getEmojiFendance(lacune.tendance)} {lacune.tendance}
                  </span>
                  <span className="lacune-detail-tag">
                    📝 {lacune.nombreQuiz} quiz
                  </span>
                  <span className="lacune-detail-tag">
                    Dernier : {lacune.scoreDetails.dernierScore}/20
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="suivi-empty">
            <div className="suivi-empty-icon">🎉</div>
            <p className="suivi-empty-title">Aucune lacune détectée !</p>
            <p className="suivi-empty-text">
              {scoreGlobal > 0
                ? 'Toutes tes moyennes sont au-dessus de 14/20. Bravo, continue !'
                : 'Passe des quiz pour que l\'analyse puisse commencer.'}
            </p>
            <button
              className="suivi-cta-btn"
              onClick={() => navigate('/disciplines')}
              style={{ marginTop: '1rem' }}
            >
              📚 Voir les disciplines
            </button>
          </div>
        )}

        {/* ==================== SECTION RECOMMANDATIONS ==================== */}
        {recommandations.length > 0 && (
          <>
            <h2 className="suivi-section-title">
              💡 Recommandations personnalisées
              <span className="suivi-section-badge">{recommandations.length}</span>
            </h2>

            <div className="recommandations-list">
              {recommandations.map(reco => (
                <div className="recommandation-card" key={reco.id}>
                  {/* Numéro de priorité */}
                  <div className="recommandation-priorite">{reco.priorite}</div>

                  {/* Contenu */}
                  <div className="recommandation-content">
                    <p className="recommandation-titre">{reco.titre}</p>
                    <p className="recommandation-description">{reco.description}</p>
                    <span className="recommandation-discipline-tag">
                      {reco.disciplineNom}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ==================== BOUTON CTA VERS QUIZ ==================== */}
        <div style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '2rem' }}>
          <button
            className="suivi-cta-btn"
            onClick={() => navigate('/disciplines')}
          >
            🚀 Passer un quiz maintenant
          </button>
        </div>

      </div>
    </div>
  );
};

export default StudentSuivi;

/**
 * ==================== DASHBOARD PARENT (Phase 10) ====================
 * 
 * Dashboard principal de l'espace parent.
 * Permet au parent de :
 * - Voir la liste de ses enfants liés
 * - Lier un nouvel enfant via code d'invitation
 * - Consulter le suivi complet d'un enfant (score, lacunes, streaks, etc.)
 * - Recevoir des alertes et le résumé hebdomadaire
 * 
 * Fichier : src/components/parent/ParentDashboard.tsx
 * Styles : src/styles/parent.css
 * Dépendances : parentService.ts, suiviService.ts
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getEnfantsLies,
  lierEnfant,
  revoquerLien,
  getDashboardParent,
  getMessageParent,
  getEmojiEvolution,
  getCouleurAlerteParent,
  getLabelAlerteParent,
  formaterDateRelative
} from '../../services/parentService';
import {
  getCouleurUrgence,
  getLabelUrgence,
  getEmojiFendance
} from '../../services/suiviService';
import FeuillesNotesView from '../shared/FeuillesNotesView';
import { getGroupesEleve } from '../../services/profGroupeService';
import { getTravauxForParent } from '../../services/travauxAFaireService';
import '../../styles/parent.css';
import '../../styles/feuillesNotes.css';

// ==================== IMPORTS TYPES ====================

import type {
  LienParentEnfant,
  DashboardParentData,
  AlerteParent
} from '../../types/parent';

// ==================== COMPOSANT PRINCIPAL ====================

const ParentDashboard: React.FC = () => {
  // ===== AUTH =====
  const { currentUser } = useAuth();
  const parentId = currentUser?.uid || '';
  const parentNom = currentUser?.displayName || 'Parent';

  // ===== STATES =====

  /** Liste des enfants liés au parent */
  const [enfants, setEnfants] = useState<LienParentEnfant[]>([]);
  /** Enfant actuellement sélectionné pour le suivi détaillé */
  const [enfantSelectionne, setEnfantSelectionne] = useState<string | null>(null);
  /** Données du dashboard pour l'enfant sélectionné */
  const [dashboardData, setDashboardData] = useState<DashboardParentData | null>(null);
  /** Chargement de la liste des enfants */
  const [loadingEnfants, setLoadingEnfants] = useState<boolean>(true);
  /** Chargement du dashboard détaillé */
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(false);
  /** Message d'erreur global */
  const [error, setError] = useState<string | null>(null);

  // ===== STATES FORMULAIRE LIAISON =====

  /** Affichage du formulaire de liaison */
  const [showFormLiaison, setShowFormLiaison] = useState<boolean>(false);
  /** Code d'invitation saisi */
  const [codeInvitation, setCodeInvitation] = useState<string>('');
  /** Chargement de la liaison */
  const [loadingLiaison, setLoadingLiaison] = useState<boolean>(false);
  /** Erreur de liaison */
  const [errorLiaison, setErrorLiaison] = useState<string | null>(null);
  /** Succès de liaison */
  const [successLiaison, setSuccessLiaison] = useState<string | null>(null);

  // ===== STATES ONGLETS =====

  /** Onglet actif dans le dashboard détaillé */
  const [ongletActif, setOngletActif] = useState<'apercu' | 'lacunes' | 'alertes' | 'travaux' | 'notes' | 'resume'>('apercu');

  /** Travaux à faire de l'enfant sélectionné */
  const [travauxEnfant, setTravauxEnfant] = useState<Array<{ id: string; titre: string; description?: string; dateEcheance: Date; groupeNom: string }>>([]);

  // ===== EFFECTS =====

  /**
   * Chargement initial des enfants liés au parent
   */
  useEffect(() => {
    chargerEnfants();
  }, [parentId]);

  /**
   * Chargement du dashboard quand un enfant est sélectionné
   */
  useEffect(() => {
    if (enfantSelectionne) {
      chargerDashboard(enfantSelectionne);
    }
  }, [enfantSelectionne]);

  // ===== HANDLERS =====

  /**
   * Charge la liste des enfants liés au parent
   */
  const chargerEnfants = async () => {
    try {
      setLoadingEnfants(true);
      setError(null);
      const liste = await getEnfantsLies(parentId);
      setEnfants(liste);

      // Sélectionner automatiquement le premier enfant si un seul
      if (liste.length === 1) {
        setEnfantSelectionne(liste[0].enfantId);
      }
    } catch (err: any) {
      setError('Erreur lors du chargement des enfants.');
      console.error(err);
    } finally {
      setLoadingEnfants(false);
    }
  };

  /**
   * Charge les données du dashboard pour un enfant donné
   */
  const chargerDashboard = async (enfantId: string) => {
    try {
      setLoadingDashboard(true);
      setError(null);
      const [data, groupes] = await Promise.all([
        getDashboardParent(parentId, enfantId),
        getGroupesEleve(enfantId),
      ]);
      setDashboardData(data);

      const groupeIds = groupes.map(g => g.id);
      const travaux = await getTravauxForParent(groupeIds);
      setTravauxEnfant(travaux.map(t => ({
        id: t.id,
        titre: t.titre,
        description: t.description,
        dateEcheance: t.dateEcheance instanceof Date ? t.dateEcheance : new Date(t.dateEcheance),
        groupeNom: t.groupeNom,
      })));
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du suivi.');
      setDashboardData(null);
      setTravauxEnfant([]);
    } finally {
      setLoadingDashboard(false);
    }
  };

  /**
   * Soumet le formulaire de liaison parent ↔ enfant
   */
  const handleLierEnfant = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLiaison(null);
    setSuccessLiaison(null);

    if (!codeInvitation.trim()) {
      setErrorLiaison('Veuillez saisir le code d\'invitation.');
      return;
    }

    try {
      setLoadingLiaison(true);
      const lien = await lierEnfant(parentId, codeInvitation);
      setSuccessLiaison(`${lien.enfantNom} a été ajouté avec succès !`);
      setCodeInvitation('');
      setShowFormLiaison(false);
      // Recharger la liste des enfants
      await chargerEnfants();
      // Sélectionner le nouvel enfant
      setEnfantSelectionne(lien.enfantId);
    } catch (err: any) {
      setErrorLiaison(err.message || 'Erreur lors de la liaison.');
    } finally {
      setLoadingLiaison(false);
    }
  };

  /**
   * Révoque le lien avec un enfant (après confirmation)
   */
  const handleRevoquerLien = async (lien: LienParentEnfant) => {
    const confirm = window.confirm(
      `Êtes-vous sûr de vouloir retirer ${lien.enfantNom} de votre suivi ? Cette action est irréversible.`
    );
    if (!confirm) return;

    try {
      await revoquerLien(lien.id, parentId);
      // Si l'enfant retiré était sélectionné, déselectionner
      if (enfantSelectionne === lien.enfantId) {
        setEnfantSelectionne(null);
        setDashboardData(null);
      }
      await chargerEnfants();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression.');
    }
  };

  // ==================== RENDU ====================

  // ===== État de chargement initial =====
  if (loadingEnfants) {
    return (
      <div className="parent-loading">
        {/* Spinner de chargement */}
        <div className="parent-spinner"></div>
        <p>Chargement de votre espace parent...</p>
      </div>
    );
  }

  return (
    <div className="parent-dashboard">

      {/* ==================== EN-TÊTE ==================== */}
      <header className="parent-header">
        {/* Titre et bienvenue */}
        <div className="parent-header-info">
          <h1 className="parent-titre">👨‍👩‍👧‍👦 Espace Parent</h1>
          <p className="parent-bienvenue">
            Bienvenue, <strong>{parentNom}</strong> — Suivez la progression de vos enfants
          </p>
        </div>
        {/* Bouton ajouter un enfant */}
        <button
          className="parent-btn parent-btn-primary"
          onClick={() => {
            setShowFormLiaison(!showFormLiaison);
            setErrorLiaison(null);
            setSuccessLiaison(null);
          }}
        >
          ➕ Ajouter un enfant
        </button>
      </header>

      {/* ==================== ERREUR GLOBALE ==================== */}
      {error && (
        <div className="parent-alerte parent-alerte-erreur">
          <span>❌ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* ==================== SUCCÈS LIAISON ==================== */}
      {successLiaison && (
        <div className="parent-alerte parent-alerte-succes">
          <span>✅ {successLiaison}</span>
          <button onClick={() => setSuccessLiaison(null)}>✕</button>
        </div>
      )}

      {/* ==================== FORMULAIRE LIAISON ==================== */}
      {showFormLiaison && (
        <div className="parent-form-liaison">
          <h3>🔗 Lier un enfant à votre compte</h3>
          <p className="parent-form-aide">
            Demandez le code d'invitation à votre enfant. 
            Il peut le trouver dans son profil sur PedaClic (format: PEDA-XXXX-XXXX).
          </p>
          <form onSubmit={handleLierEnfant} className="parent-form">
            {/* Champ code d'invitation */}
            <div className="parent-form-group">
              <label htmlFor="code-invitation">Code d'invitation</label>
              <input
                id="code-invitation"
                type="text"
                placeholder="PEDA-XXXX-XXXX"
                value={codeInvitation}
                onChange={(e) => setCodeInvitation(e.target.value.toUpperCase())}
                maxLength={14}
                disabled={loadingLiaison}
                className="parent-input"
              />
            </div>
            {/* Erreur de liaison */}
            {errorLiaison && (
              <p className="parent-form-erreur">❌ {errorLiaison}</p>
            )}
            {/* Boutons */}
            <div className="parent-form-actions">
              <button
                type="submit"
                className="parent-btn parent-btn-primary"
                disabled={loadingLiaison}
              >
                {loadingLiaison ? 'Vérification...' : '✅ Valider'}
              </button>
              <button
                type="button"
                className="parent-btn parent-btn-secondary"
                onClick={() => setShowFormLiaison(false)}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== LISTE DES ENFANTS ==================== */}
      {enfants.length === 0 ? (
        /* Aucun enfant lié */
        <div className="parent-empty-state">
          <div className="parent-empty-icon">👶</div>
          <h2>Aucun enfant lié</h2>
          <p>
            Cliquez sur « Ajouter un enfant » et saisissez le code d'invitation 
            de votre enfant pour commencer à suivre sa progression.
          </p>
          <button
            className="parent-btn parent-btn-primary"
            onClick={() => setShowFormLiaison(true)}
          >
            ➕ Ajouter mon premier enfant
          </button>
        </div>
      ) : (
        <div className="parent-content">
          {/* ===== SIDEBAR : LISTE DES ENFANTS ===== */}
          <aside className="parent-sidebar">
            <h3 className="parent-sidebar-titre">Mes enfants</h3>
            <ul className="parent-enfants-liste">
              {enfants.map((lien) => (
                <li
                  key={lien.id}
                  className={`parent-enfant-card ${
                    enfantSelectionne === lien.enfantId ? 'parent-enfant-actif' : ''
                  }`}
                  onClick={() => setEnfantSelectionne(lien.enfantId)}
                >
                  {/* Avatar avec initiale */}
                  <div className="parent-enfant-avatar">
                    {lien.enfantNom.charAt(0).toUpperCase()}
                  </div>
                  {/* Infos de l'enfant */}
                  <div className="parent-enfant-info">
                    <span className="parent-enfant-nom">{lien.enfantNom}</span>
                    {lien.enfantClasse && (
                      <span className="parent-enfant-classe">{lien.enfantClasse}</span>
                    )}
                  </div>
                  {/* Bouton suppression */}
                  <button
                    className="parent-enfant-supprimer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRevoquerLien(lien);
                    }}
                    title="Retirer cet enfant"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* ===== ZONE PRINCIPALE : DASHBOARD DÉTAILLÉ ===== */}
          <main className="parent-main">
            {!enfantSelectionne ? (
              /* Aucun enfant sélectionné */
              <div className="parent-select-enfant">
                <p>👈 Sélectionnez un enfant dans la liste pour voir son suivi.</p>
              </div>
            ) : loadingDashboard ? (
              /* Chargement du dashboard */
              <div className="parent-loading">
                <div className="parent-spinner"></div>
                <p>Chargement du suivi...</p>
              </div>
            ) : dashboardData ? (
              /* Dashboard complet */
              <div className="parent-dashboard-detail">

                {/* ===== EN-TÊTE ENFANT ===== */}
                <div className="parent-enfant-header">
                  <div className="parent-enfant-header-info">
                    <h2>{dashboardData.enfant.nom}</h2>
                    {dashboardData.enfant.classe && (
                      <span className="parent-badge">{dashboardData.enfant.classe}</span>
                    )}
                    {dashboardData.enfant.derniereConnexion && (
                      <span className="parent-derniere-connexion">
                        Dernière connexion : {formaterDateRelative(dashboardData.enfant.derniereConnexion)}
                      </span>
                    )}
                  </div>
                  {/* Message parent */}
                  <p className="parent-message-motivation">
                    {getMessageParent(dashboardData.scoreGlobal)}
                  </p>
                </div>

                {/* ===== CARTES INDICATEURS PRINCIPAUX ===== */}
                <div className="parent-indicateurs">
                  {/* Score global */}
                  <div className="parent-card parent-card-score">
                    <div className="parent-card-icon">🎯</div>
                    <div className="parent-card-content">
                      <span className="parent-card-label">Score Global</span>
                      <span className={`parent-card-value parent-score-${
                        dashboardData.scoreGlobal >= 60 ? 'bon' :
                        dashboardData.scoreGlobal >= 40 ? 'moyen' : 'bas'
                      }`}>
                        {dashboardData.scoreGlobal}/100
                      </span>
                    </div>
                  </div>

                  {/* Streak */}
                  <div className="parent-card parent-card-streak">
                    <div className="parent-card-icon">🔥</div>
                    <div className="parent-card-content">
                      <span className="parent-card-label">Streak</span>
                      <span className="parent-card-value">
                        {dashboardData.streak.actuel} jour{dashboardData.streak.actuel > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Lacunes */}
                  <div className="parent-card parent-card-lacunes">
                    <div className="parent-card-icon">⚠️</div>
                    <div className="parent-card-content">
                      <span className="parent-card-label">Lacunes</span>
                      <span className="parent-card-value">
                        {dashboardData.lacunes.length} matière{dashboardData.lacunes.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Objectifs */}
                  <div className="parent-card parent-card-objectifs">
                    <div className="parent-card-icon">✅</div>
                    <div className="parent-card-content">
                      <span className="parent-card-label">Objectifs</span>
                      <span className="parent-card-value">
                        {dashboardData.objectifs.filter(o => o.statut === 'atteint').length}
                        /{dashboardData.objectifs.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ===== SEMAINE EN COURS (Streak visuel) ===== */}
                <div className="parent-section parent-section-semaine">
                  <h3>📅 Activité de la semaine</h3>
                  <div className="parent-semaine-jours">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((jour, i) => (
                      <div
                        key={jour}
                        className={`parent-jour ${
                          dashboardData.streak.semaineCourante[i]
                            ? 'parent-jour-actif'
                            : 'parent-jour-inactif'
                        }`}
                      >
                        <span className="parent-jour-label">{jour}</span>
                        <span className="parent-jour-icon">
                          {dashboardData.streak.semaineCourante[i] ? '🟢' : '⚪'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ===== NAVIGATION ONGLETS ===== */}
                <div className="parent-onglets">
                  <button
                    className={`parent-onglet ${ongletActif === 'apercu' ? 'parent-onglet-actif' : ''}`}
                    onClick={() => setOngletActif('apercu')}
                  >
                    📊 Aperçu
                  </button>
                  <button
                    className={`parent-onglet ${ongletActif === 'lacunes' ? 'parent-onglet-actif' : ''}`}
                    onClick={() => setOngletActif('lacunes')}
                  >
                    ⚠️ Lacunes ({dashboardData.lacunes.length})
                  </button>
                  <button
                    className={`parent-onglet ${ongletActif === 'alertes' ? 'parent-onglet-actif' : ''}`}
                    onClick={() => setOngletActif('alertes')}
                  >
                    🔔 Alertes ({dashboardData.alertes.length})
                  </button>
                  <button
                    className={`parent-onglet ${ongletActif === 'travaux' ? 'parent-onglet-actif' : ''}`}
                    onClick={() => setOngletActif('travaux')}
                  >
                    📋 Travaux ({travauxEnfant.length})
                  </button>
                  <button
                    className={`parent-onglet ${ongletActif === 'notes' ? 'parent-onglet-actif' : ''}`}
                    onClick={() => setOngletActif('notes')}
                  >
                    📝 Notes
                  </button>
                  <button
                    className={`parent-onglet ${ongletActif === 'resume' ? 'parent-onglet-actif' : ''}`}
                    onClick={() => setOngletActif('resume')}
                  >
                    📄 Résumé
                  </button>
                </div>

                {/* ===== CONTENU DES ONGLETS ===== */}
                <div className="parent-onglet-contenu">

                  {/* ---- ONGLET : APERÇU ---- */}
                  {ongletActif === 'apercu' && (
                    <div className="parent-tab-apercu">
                      {/* Derniers quiz */}
                      <div className="parent-section">
                        <h3>📝 Derniers quiz passés</h3>
                        {dashboardData.derniersQuiz.length === 0 ? (
                          <p className="parent-vide">Aucun quiz passé récemment.</p>
                        ) : (
                          <div className="parent-quiz-liste">
                            {dashboardData.derniersQuiz.map((quiz, index) => (
                              <div
                                key={index}
                                className={`parent-quiz-item ${quiz.reussi ? 'parent-quiz-reussi' : 'parent-quiz-echoue'}`}
                              >
                                {/* Discipline et titre */}
                                <div className="parent-quiz-info">
                                  <span className="parent-quiz-discipline">{quiz.disciplineNom}</span>
                                  <span className="parent-quiz-titre">{quiz.quizTitre}</span>
                                </div>
                                {/* Score */}
                                <div className="parent-quiz-score">
                                  <span className={`parent-quiz-note ${quiz.reussi ? 'note-ok' : 'note-ko'}`}>
                                    {quiz.noteSur20}/20
                                  </span>
                                  <span className="parent-quiz-statut">
                                    {quiz.reussi ? '✅ Réussi' : '❌ Échoué'}
                                  </span>
                                </div>
                                {/* Date */}
                                <span className="parent-quiz-date">
                                  {formaterDateRelative(quiz.datePassage)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Objectifs hebdomadaires */}
                      <div className="parent-section">
                        <h3>🎯 Objectifs de la semaine</h3>
                        {dashboardData.objectifs.length === 0 ? (
                          <p className="parent-vide">Aucun objectif cette semaine.</p>
                        ) : (
                          <div className="parent-objectifs-liste">
                            {dashboardData.objectifs.map((obj, index) => (
                              <div key={index} className="parent-objectif-item">
                                {/* Titre et statut */}
                                <div className="parent-objectif-header">
                                  <span className="parent-objectif-titre">{obj.titre}</span>
                                  <span className={`parent-objectif-statut parent-statut-${obj.statut}`}>
                                    {obj.statut === 'atteint' ? '✅ Atteint' :
                                     obj.statut === 'en_cours' ? '🔄 En cours' :
                                     obj.statut === 'echoue' ? '❌ Échoué' : '⏳ Non commencé'}
                                  </span>
                                </div>
                                {/* Barre de progression */}
                                <div className="parent-progress-bar">
                                  <div
                                    className={`parent-progress-fill parent-progress-${obj.statut}`}
                                    style={{
                                      width: `${Math.min((obj.progression / obj.cible) * 100, 100)}%`
                                    }}
                                  ></div>
                                </div>
                                <span className="parent-objectif-detail">
                                  {obj.progression}/{obj.cible}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ---- ONGLET : LACUNES ---- */}
                  {ongletActif === 'lacunes' && (
                    <div className="parent-tab-lacunes">
                      {dashboardData.lacunes.length === 0 ? (
                        <div className="parent-vide-section">
                          <span className="parent-vide-icon">🎉</span>
                          <p>Aucune lacune détectée ! Votre enfant est sur la bonne voie.</p>
                        </div>
                      ) : (
                        <div className="parent-lacunes-liste">
                          {dashboardData.lacunes.map((lacune, index) => (
                            <div
                              key={index}
                              className="parent-lacune-item"
                              style={{ borderLeftColor: getCouleurUrgence(lacune.niveauUrgence) }}
                            >
                              {/* En-tête lacune */}
                              <div className="parent-lacune-header">
                                <span className="parent-lacune-discipline">{lacune.disciplineNom}</span>
                                <span
                                  className="parent-lacune-badge"
                                  style={{
                                    backgroundColor: getCouleurUrgence(lacune.niveauUrgence),
                                    color: '#fff'
                                  }}
                                >
                                  {getLabelUrgence(lacune.niveauUrgence)}
                                </span>
                              </div>
                              {/* Détails */}
                              <div className="parent-lacune-details">
                                <span className="parent-lacune-moyenne">
                                  Moyenne : <strong>{lacune.moyenne}/20</strong>
                                </span>
                                <span className="parent-lacune-tendance">
                                  Tendance : {getEmojiFendance(lacune.tendance)}{' '}
                                  {lacune.tendance === 'hausse' ? 'En hausse' :
                                   lacune.tendance === 'baisse' ? 'En baisse' : 'Stable'}
                                </span>
                              </div>
                              {/* Conseil parent */}
                              <p className="parent-lacune-conseil">
                                {lacune.niveauUrgence === 'critique'
                                  ? '🚨 Intervention recommandée : discutez avec votre enfant et envisagez un soutien scolaire.'
                                  : lacune.niveauUrgence === 'important'
                                  ? '⚡ Encouragez votre enfant à réviser cette matière régulièrement.'
                                  : '📖 Quelques révisions suffiront pour consolider les acquis.'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- ONGLET : ALERTES ---- */}
                  {ongletActif === 'alertes' && (
                    <div className="parent-tab-alertes">
                      {dashboardData.alertes.length === 0 ? (
                        <div className="parent-vide-section">
                          <span className="parent-vide-icon">🔔</span>
                          <p>Aucune alerte pour le moment. Tout va bien !</p>
                        </div>
                      ) : (
                        <div className="parent-alertes-liste">
                          {dashboardData.alertes.map((alerte, index) => (
                            <div
                              key={index}
                              className={`parent-alerte-item parent-alerte-${alerte.niveau}`}
                            >
                              {/* Titre de l'alerte */}
                              <div className="parent-alerte-header">
                                <span className="parent-alerte-titre">{alerte.titre}</span>
                                <span
                                  className="parent-alerte-badge"
                                  style={{
                                    backgroundColor: getCouleurAlerteParent(alerte.niveau),
                                    color: '#fff'
                                  }}
                                >
                                  {getLabelAlerteParent(alerte.type)}
                                </span>
                              </div>
                              {/* Message */}
                              <p className="parent-alerte-message">{alerte.message}</p>
                              {/* Date */}
                              <span className="parent-alerte-date">
                                {formaterDateRelative(alerte.dateCreation)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- ONGLET : TRAVAUX À FAIRE ---- */}
                  {ongletActif === 'travaux' && (
                    <div className="parent-tab-travaux">
                      {travauxEnfant.length === 0 ? (
                        <div className="parent-vide-section">
                          <span className="parent-vide-icon">📋</span>
                          <p>Aucun travail à faire pour le moment.</p>
                        </div>
                      ) : (
                        <div className="parent-travaux-liste">
                          {travauxEnfant.map((t) => (
                            <div key={t.id} className="parent-travaux-item">
                              <strong>{t.titre}</strong>
                              {t.description && (
                                <div
                                  className="parent-travaux-desc parent-travaux-desc--html"
                                  dangerouslySetInnerHTML={{ __html: t.description }}
                                />
                              )}
                              <span className="parent-travaux-echeance">
                                📅 Échéance : {t.dateEcheance.toLocaleDateString('fr-FR')} • {t.groupeNom}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- ONGLET : NOTES ---- */}
                  {ongletActif === 'notes' && enfantSelectionne && (
                    <div className="parent-tab-notes">
                      <FeuillesNotesView
                        eleveIds={[enfantSelectionne]}
                        showGroupeNom={true}
                        filterForEleves={true}
                      />
                    </div>
                  )}

                  {/* ---- ONGLET : RÉSUMÉ HEBDOMADAIRE ---- */}
                  {ongletActif === 'resume' && dashboardData.resume && (
                    <div className="parent-tab-resume">
                      {/* Titre du résumé */}
                      <div className="parent-resume-header">
                        <h3>📋 Résumé : {dashboardData.resume.semaine}</h3>
                        <span className="parent-resume-evolution">
                          Score : {dashboardData.resume.scoreGlobal}/100{' '}
                          {getEmojiEvolution(dashboardData.resume.evolutionScore)}
                        </span>
                      </div>

                      {/* Statistiques clés */}
                      <div className="parent-resume-stats">
                        {/* Quiz passés */}
                        <div className="parent-resume-stat">
                          <span className="parent-resume-stat-value">
                            {dashboardData.resume.nombreQuizSemaine}
                          </span>
                          <span className="parent-resume-stat-label">Quiz passés</span>
                        </div>
                        {/* Jours actifs */}
                        <div className="parent-resume-stat">
                          <span className="parent-resume-stat-value">
                            {dashboardData.resume.joursActifsSemaine}/7
                          </span>
                          <span className="parent-resume-stat-label">Jours actifs</span>
                        </div>
                        {/* Temps d'étude */}
                        <div className="parent-resume-stat">
                          <span className="parent-resume-stat-value">
                            {dashboardData.resume.tempsEstimeMinutes} min
                          </span>
                          <span className="parent-resume-stat-label">Temps d'étude</span>
                        </div>
                        {/* Objectifs */}
                        <div className="parent-resume-stat">
                          <span className="parent-resume-stat-value">
                            {dashboardData.resume.objectifsAtteints}/{dashboardData.resume.objectifsTotal}
                          </span>
                          <span className="parent-resume-stat-label">Objectifs atteints</span>
                        </div>
                      </div>

                      {/* Évolution par discipline */}
                      {dashboardData.resume.evolutionDisciplines.length > 0 && (
                        <div className="parent-section">
                          <h4>📊 Évolution par matière</h4>
                          <div className="parent-evolution-liste">
                            {dashboardData.resume.evolutionDisciplines.map((evo, index) => (
                              <div key={index} className="parent-evolution-item">
                                <span className="parent-evolution-discipline">{evo.disciplineNom}</span>
                                <div className="parent-evolution-scores">
                                  <span className="parent-evolution-prec">
                                    {evo.moyenneSemainePrecedente}/20
                                  </span>
                                  <span className="parent-evolution-fleche">
                                    {getEmojiEvolution(evo.evolution)}
                                  </span>
                                  <span className="parent-evolution-courante">
                                    {evo.moyenneSemaineCourante}/20
                                  </span>
                                  <span className={`parent-evolution-ecart ${
                                    evo.ecart > 0 ? 'ecart-positif' :
                                    evo.ecart < 0 ? 'ecart-negatif' : ''
                                  }`}>
                                    ({evo.ecart > 0 ? '+' : ''}{evo.ecart})
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Disciplines en difficulté */}
                      {dashboardData.resume.disciplinesEnDifficulte.length > 0 && (
                        <div className="parent-section parent-section-warning">
                          <h4>🚨 Matières nécessitant une attention</h4>
                          <ul className="parent-disciplines-difficulte">
                            {dashboardData.resume.disciplinesEnDifficulte.map((disc, index) => (
                              <li key={index}>{disc}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cas où il n'y a pas de résumé */}
                  {ongletActif === 'resume' && !dashboardData.resume && (
                    <div className="parent-vide-section">
                      <span className="parent-vide-icon">📋</span>
                      <p>Le résumé sera disponible une fois que votre enfant aura passé des quiz.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Erreur de chargement du dashboard */
              <div className="parent-erreur-dashboard">
                <p>⚠️ Impossible de charger le suivi. Veuillez réessayer.</p>
                <button
                  className="parent-btn parent-btn-primary"
                  onClick={() => enfantSelectionne && chargerDashboard(enfantSelectionne)}
                >
                  🔄 Réessayer
                </button>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;

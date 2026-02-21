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

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import GroupeManager from './GroupeManager';
import GroupeDetail from './GroupeDetail';
import {
  getGroupesProf,
  getStatsGroupe
} from '../../services/profGroupeService';
import type { GroupeProf, StatsGroupe } from '../../types/prof';
import '../../styles/prof.css';


// ==================== TYPES LOCAUX ====================

/** Vues disponibles dans le dashboard prof */
type VueDashboard = 'overview' | 'groupes' | 'detail';


// ==================== COMPOSANT PRINCIPAL ====================

const ProfDashboard: React.FC = () => {

  // ===== Hooks =====
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // ===== États : navigation =====
  const [vueActive, setVueActive] = useState<VueDashboard>('overview');
  const [groupeSelectionne, setGroupeSelectionne] = useState<GroupeProf | null>(null);

  // ===== États : données résumé =====
  const [totalGroupes, setTotalGroupes] = useState<number>(0);
  const [totalEleves, setTotalEleves] = useState<number>(0);
  const [moyenneGenerale, setMoyenneGenerale] = useState<number>(0);
  const [totalAlertes, setTotalAlertes] = useState<number>(0);
  const [groupesRecap, setGroupesRecap] = useState<(GroupeProf & { stats?: StatsGroupe })[]>([]);

  // ===== États : UI =====
  const [loading, setLoading] = useState<boolean>(true);


  // ==================== CHARGEMENT RÉSUMÉ ====================

  /**
   * Charge les données résumées pour la vue d'ensemble
   */
  const chargerResume = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      setLoading(true);

      // ===== 1. Récupérer les groupes actifs =====
      const groupes = await getGroupesProf(currentUser.uid);
      const groupesActifs = groupes.filter(g => g.statut === 'actif');

      setTotalGroupes(groupesActifs.length);

      // ===== 2. Calculer les stats pour chaque groupe =====
      let sommeEleves = 0;
      let sommeMoyennes = 0;
      let groupesAvecStats = 0;
      let alertesCount = 0;
      const recap: (GroupeProf & { stats?: StatsGroupe })[] = [];

      for (const groupe of groupesActifs) {
        try {
          const stats = await getStatsGroupe(groupe.id);
          sommeEleves += stats.nombreEleves;
          if (stats.nombreEleves > 0) {
            sommeMoyennes += stats.moyenneClasse;
            groupesAvecStats++;
          }
          alertesCount += stats.elevesEnDifficulte;
          recap.push({ ...groupe, stats });
        } catch {
          recap.push({ ...groupe });
        }
      }

      setTotalEleves(sommeEleves);
      setMoyenneGenerale(
        groupesAvecStats > 0
          ? Math.round((sommeMoyennes / groupesAvecStats) * 10) / 10
          : 0
      );
      setTotalAlertes(alertesCount);
      setGroupesRecap(recap);

    } catch (err) {
      console.error('Erreur chargement résumé prof:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    chargerResume();
  }, [chargerResume]);


  // ==================== HANDLERS NAVIGATION ====================

  /**
   * Navigue vers le détail d'un groupe
   */
  const handleSelectGroupe = (groupe: GroupeProf) => {
    setGroupeSelectionne(groupe);
    setVueActive('detail');
  };

  /**
   * Retour à la vue d'ensemble depuis le détail
   */
  const handleRetourDetail = () => {
    setGroupeSelectionne(null);
    setVueActive('groupes');
    chargerResume(); // Rafraîchir les données
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
      <header className="prof-dashboard-header">
        <div>
          <h1 className="prof-dashboard-titre">
            Tableau de bord Professeur
          </h1>
          <p className="prof-dashboard-subtitle">
            Bienvenue, {currentUser?.displayName || 'Professeur'} 👋
          </p>
        </div>
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
        </nav>
      )}


      {/* ============================================================ */}
      {/* VUE 1 : OVERVIEW (RÉSUMÉ RAPIDE)                            */}
      {/* ============================================================ */}
      {vueActive === 'overview' && (
        <div className="prof-overview">

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

            {/* Total élèves */}
            <div className="prof-overview-card">
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
              <div className="prof-overview-groupes-grid">
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
        />
      )}
    </div>
  );
};

export default ProfDashboard;

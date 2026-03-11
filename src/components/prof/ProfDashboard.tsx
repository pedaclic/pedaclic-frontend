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
import { Lock, Star } from 'lucide-react';
import GroupeManager from './GroupeManager';
import GroupeDetail from './GroupeDetail';
import {
  getGroupesProf,
  getStatsGroupe
} from '../../services/profGroupeService';
import type { GroupeProf, StatsGroupe } from '../../types/prof';
import { estFormuleALaCarte } from '../../types/premiumPlans';
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

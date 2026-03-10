/**
 * ============================================================
 * COMPOSANT GROUPE DETAIL — PedaClic Phase 11
 * ============================================================
 * 
 * Vue détaillée d'un groupe-classe sélectionné.
 * Affiche : stats globales, liste des élèves avec tri/filtre,
 * détail par élève, analyse par quiz, alertes, export CSV.
 * 
 * Fichier : src/components/prof/GroupeDetail.tsx
 * Dépendances :
 *   - ../../services/profGroupeService
 *   - ../../types/prof
 *   - ../../styles/prof.css
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  getStatsGroupe,
  getStatsElevesGroupe,
  getStatsQuizGroupe,
  getQuizParMatiere,
  genererAlertesProf,
  genererExportCSV,
  telechargerCSV,
  retirerEleve,
  getElevesGroupe
} from '../../services/profGroupeService';
import {
  marquerAbsences,
  getAbsencesByDate,
  getAbsencesByPeriod,
  sauvegarderObservation,
  getObservationEleve,
} from '../../services/groupeAbsencesService';
import {
  creerTravailAFaire,
  getTravauxByGroupe,
  supprimerTravailAFaire,
} from '../../services/travauxAFaireService';
import { useAuth } from '../../hooks/useAuth';
import FeuillesNotesManager from './FeuillesNotesManager';
import CahierGroupeWidget from './CahierGroupeWidget';
import InscriptionDirecteModal from './InscriptionDirecteModal';
import type {
  GroupeProf,
  StatsGroupe,
  EleveGroupeStats,
  StatsQuizGroupe,
  AlerteProf
} from '../../types/prof';
import type { TravailAFaire } from '../../types/groupeAbsences.types';
import '../../styles/prof.css';
import '../../styles/feuillesNotes.css';


// ==================== TYPES LOCAUX ====================

/** Onglets disponibles dans le détail du groupe */
type OngletActif = 'apercu' | 'eleves' | 'appel' | 'travaux' | 'notes' | 'quiz' | 'cahier' | 'alertes';

/** Options de tri pour la liste des élèves */
type TriEleves = 'moyenne_desc' | 'moyenne_asc' | 'nom' | 'streak' | 'quiz_count';


// ==================== SOUS-COMPOSANT : SUIVI ABSENCES ====================

interface AppelSuiviTableProps {
  groupeId: string;
  statsEleves: EleveGroupeStats[];
  periode: 'jour' | 'semaine' | 'mois';
}

function AppelSuiviTable({ groupeId, statsEleves, periode }: AppelSuiviTableProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    let debut: string, fin: string;
    if (periode === 'jour') {
      debut = fin = today.toISOString().slice(0, 10);
    } else if (periode === 'semaine') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      debut = d.toISOString().slice(0, 10);
      fin = today.toISOString().slice(0, 10);
    } else {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 1);
      debut = d.toISOString().slice(0, 10);
      fin = today.toISOString().slice(0, 10);
    }

    (async () => {
      try {
        const absences = await getAbsencesByPeriod(groupeId, debut, fin);
        const c: Record<string, number> = {};
        statsEleves.forEach(e => { c[e.eleveId] = 0; });
        absences.forEach(a => {
          (a.eleveIdsAbsents || []).forEach((id: string) => {
            if (c[id] !== undefined) c[id]++;
          });
        });
        if (!cancelled) setCounts(c);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [groupeId, statsEleves, periode]);

  if (loading) return <p className="text-muted">Chargement...</p>;

  const sorted = [...statsEleves].sort((a, b) => (counts[b.eleveId] || 0) - (counts[a.eleveId] || 0));

  return (
    <table className="groupe-eleves-table groupe-appel-suivi-table">
      <thead>
        <tr>
          <th>Élève</th>
          <th>Absences ({periode})</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(e => (
          <tr key={e.eleveId}>
            <td>{e.eleveNom}</td>
            <td className={counts[e.eleveId] > 0 ? 'prof-note-critique' : ''}>
              {counts[e.eleveId] || 0}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


// ==================== INTERFACE PROPS ====================

interface GroupeDetailProps {
  /** Le groupe sélectionné à afficher */
  groupe: GroupeProf;
  /** Callback pour revenir à la liste des groupes */
  onRetour: () => void;
}


// ==================== COMPOSANT PRINCIPAL ====================

const GroupeDetail: React.FC<GroupeDetailProps> = ({ groupe, onRetour }) => {
  const { currentUser } = useAuth();

  // ===== États : données =====
  const [statsGroupe, setStatsGroupe] = useState<StatsGroupe | null>(null);
  const [statsEleves, setStatsEleves] = useState<EleveGroupeStats[]>([]);
  const [alertes, setAlertes] = useState<AlerteProf[]>([]);
  const [quizDisponibles, setQuizDisponibles] = useState<{ id: string; titre: string; source?: string }[]>([]);
  const [statsQuiz, setStatsQuiz] = useState<StatsQuizGroupe | null>(null);
  const [travaux, setTravaux] = useState<TravailAFaire[]>([]);
  const [observations, setObservations] = useState<Record<string, string>>({});

  // ===== États : Appel / Absences =====
  const [dateAppel, setDateAppel] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [absentsIds, setAbsentsIds] = useState<string[]>([]);
  const [loadingAppel, setLoadingAppel] = useState(false);
  const [periodeSuivi, setPeriodeSuivi] = useState<'jour' | 'semaine' | 'mois'>('semaine');

  // ===== États : Travaux à faire =====
  const [nouveauTravailTitre, setNouveauTravailTitre] = useState('');
  const [nouveauTravailDesc, setNouveauTravailDesc] = useState('');
  const [nouveauTravailEcheance, setNouveauTravailEcheance] = useState('');
  const [savingTravail, setSavingTravail] = useState(false);

  // ===== États : UI =====
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [ongletActif, setOngletActif] = useState<OngletActif>('apercu');
  const [triEleves, setTriEleves] = useState<TriEleves>('moyenne_desc');
  const [eleveSelectionne, setEleveSelectionne] = useState<string | null>(null);
  const [observationEdit, setObservationEdit] = useState('');
  const [savingObservation, setSavingObservation] = useState<string | null>(null);
  const [quizSelectionne, setQuizSelectionne] = useState<string | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState<boolean>(false);
  const [loadingRetrait, setLoadingRetrait] = useState<string | null>(null);
  const [modalInscriptionOuvert, setModalInscriptionOuvert] = useState(false);


  // ==================== CHARGEMENT DES DONNÉES ====================

  /**
   * Charge toutes les données du groupe :
   * stats globales, stats par élève, alertes, quiz disponibles
   */
  const chargerDonneesGroupe = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ===== Chargement parallèle =====
      const [stats, elevesStats, quiz] = await Promise.all([
        getStatsGroupe(groupe.id),
        getStatsElevesGroupe(groupe.id),
        getQuizParMatiere(groupe.matiereId, groupe.id)
      ]);

      setStatsGroupe(stats);
      setStatsEleves(elevesStats);
      setQuizDisponibles(quiz);

      // ===== Générer les alertes =====
      const alertesGenerees = genererAlertesProf(elevesStats, groupe.nom);
      setAlertes(alertesGenerees);

    } catch (err: any) {
      console.error('Erreur chargement détail groupe:', err);
      setError('Impossible de charger les données du groupe.');
    } finally {
      setLoading(false);
    }
  }, [groupe.id, groupe.matiereId, groupe.nom]);

  useEffect(() => {
    chargerDonneesGroupe();
  }, [chargerDonneesGroupe]);

  /** Charge les absences du jour pour l'appel */
  useEffect(() => {
    if (ongletActif !== 'appel') return;
    getAbsencesByDate(groupe.id, dateAppel).then(setAbsentsIds).catch(() => setAbsentsIds([]));
  }, [ongletActif, groupe.id, dateAppel]);

  /** Charge les travaux à faire */
  useEffect(() => {
    if (ongletActif !== 'travaux') return;
    getTravauxByGroupe(groupe.id).then(setTravaux).catch(() => setTravaux([]));
  }, [ongletActif, groupe.id]);

  /** Charge l'observation de l'élève sélectionné */
  useEffect(() => {
    if (!eleveSelectionne) {
      setObservationEdit('');
      return;
    }
    getObservationEleve(groupe.id, eleveSelectionne).then((t) => {
      setObservationEdit(t);
      setObservations(prev => ({ ...prev, [eleveSelectionne]: t }));
    }).catch(() => setObservationEdit(''));
  }, [groupe.id, eleveSelectionne]);


  // ==================== HANDLERS ====================

  /**
   * Analyse un quiz spécifique
   */
  const handleAnalyserQuiz = async (quizId: string, quizSource?: string) => {
    try {
      setLoadingQuiz(true);
      setQuizSelectionne(quizId);
      const stats = await getStatsQuizGroupe(groupe.id, quizId, quizSource);
      setStatsQuiz(stats);
    } catch (err) {
      console.error('Erreur analyse quiz:', err);
    } finally {
      setLoadingQuiz(false);
    }
  };

  /**
   * Exporte les résultats en CSV
   */
  const handleExportCSV = () => {
    const csv = genererExportCSV(statsEleves, groupe.nom);
    const nomFichier = `PedaClic_${groupe.nom.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    telechargerCSV(csv, nomFichier);
  };

  /**
   * Retire un élève du groupe
   */
  const handleRetirerEleve = async (eleveId: string) => {
    try {
      setLoadingRetrait(eleveId);
      const inscriptions = await getElevesGroupe(groupe.id);
      const inscription = inscriptions.find(i => i.eleveId === eleveId);
      if (inscription) {
        await retirerEleve(inscription.id, groupe.id);
        await chargerDonneesGroupe();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingRetrait(null);
    }
  };

  /** Marque les absences pour la date d'appel */
  const handleMarquerAbsences = async () => {
    if (!currentUser?.uid) return;
    try {
      setLoadingAppel(true);
      await marquerAbsences(groupe.id, dateAppel, absentsIds, currentUser.uid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingAppel(false);
    }
  };

  /** Sauvegarde une observation sur l'élève sélectionné */
  const handleSaveObservation = async () => {
    if (!eleveSelectionne || !currentUser?.uid) return;
    const eleve = statsEleves.find(e => e.eleveId === eleveSelectionne);
    if (!eleve) return;
    try {
      setSavingObservation(eleveSelectionne);
      await sauvegarderObservation(groupe.id, eleveSelectionne, eleve.eleveNom, observationEdit, currentUser.uid);
      setObservations(prev => ({ ...prev, [eleveSelectionne]: observationEdit }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingObservation(null);
    }
  };

  /** Ajoute un travail à faire */
  const handleAjouterTravail = async () => {
    if (!currentUser?.uid || !nouveauTravailTitre.trim()) return;
    const echeance = nouveauTravailEcheance ? new Date(nouveauTravailEcheance) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    try {
      setSavingTravail(true);
      await creerTravailAFaire({
        groupeId: groupe.id,
        groupeNom: groupe.nom,
        titre: nouveauTravailTitre.trim(),
        description: nouveauTravailDesc.trim() || undefined,
        dateEcheance: echeance,
        matiere: groupe.matiereNom,
        profId: currentUser.uid,
      });
      setNouveauTravailTitre('');
      setNouveauTravailDesc('');
      setNouveauTravailEcheance('');
      const liste = await getTravauxByGroupe(groupe.id);
      setTravaux(liste);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingTravail(false);
    }
  };

  /** Supprime un travail à faire */
  const handleSupprimerTravail = async (id: string) => {
    try {
      await supprimerTravailAFaire(id);
      setTravaux(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      setError(err?.message);
    }
  };


  // ==================== TRI DES ÉLÈVES ====================

  const elevesTries = [...statsEleves].sort((a, b) => {
    switch (triEleves) {
      case 'moyenne_desc': return b.moyenne - a.moyenne;
      case 'moyenne_asc': return a.moyenne - b.moyenne;
      case 'nom': return a.eleveNom.localeCompare(b.eleveNom);
      case 'streak': return b.streak.actuel - a.streak.actuel;
      case 'quiz_count': return b.totalQuiz - a.totalQuiz;
      default: return 0;
    }
  });


  // ==================== HELPERS DE RENDU ====================

  /** Retourne la classe CSS selon la moyenne */
  const getClasseMoyenne = (moyenne: number): string => {
    if (moyenne >= 16) return 'prof-note-excellent';
    if (moyenne >= 12) return 'prof-note-bien';
    if (moyenne >= 10) return 'prof-note-passable';
    if (moyenne >= 8) return 'prof-note-insuffisant';
    return 'prof-note-critique';
  };

  /** Emoji pour la tendance */
  const getTendanceEmoji = (tendance: string): string => {
    switch (tendance) {
      case 'hausse': return '📈';
      case 'baisse': return '📉';
      default: return '➡️';
    }
  };

  /** Emoji pour le type d'alerte */
  const getAlerteEmoji = (type: string): string => {
    switch (type) {
      case 'difficulte': return '🔴';
      case 'inactivite': return '💤';
      case 'baisse': return '📉';
      case 'felicitation': return '🌟';
      default: return '⚡';
    }
  };


  // ==================== RENDU : LOADING ====================

  if (loading) {
    return (
      <div className="prof-loading">
        <div className="spinner"></div>
        <p>Chargement des données de "{groupe.nom}"...</p>
      </div>
    );
  }


  // ==================== RENDU PRINCIPAL ====================

  return (
    <div className="groupe-detail">

      {/* ===== NAVIGATION : RETOUR + TITRE ===== */}
      <div className="groupe-detail-header">
        <button className="prof-btn prof-btn-secondary" onClick={onRetour}>
          ← Retour aux groupes
        </button>
        <div className="groupe-detail-titre-section">
          <h2 className="groupe-detail-titre">{groupe.nom}</h2>
          <p className="groupe-detail-subtitle">
            {groupe.matiereNom} • {groupe.classeNiveau} • {groupe.anneeScolaire}
          </p>
        </div>
        <button className="prof-btn prof-btn-secondary" onClick={handleExportCSV}>
          📥 Export CSV
        </button>
      </div>

      {/* ===== MESSAGE D'ERREUR ===== */}
      {error && (
        <div className="prof-alert prof-alert-error">
          ❌ {error}
          <button onClick={() => setError(null)} className="prof-alert-close">✕</button>
        </div>
      )}

      {/* ===== ONGLETS ===== */}
      <div className="groupe-detail-onglets">
        {[
          { id: 'apercu' as OngletActif, label: '📊 Aperçu', count: null },
          { id: 'eleves' as OngletActif, label: '👥 Élèves', count: statsEleves.length },
          { id: 'appel' as OngletActif, label: '✅ Appel', count: null },
          { id: 'travaux' as OngletActif, label: '📋 Travaux', count: travaux.length },
          { id: 'notes' as OngletActif, label: '📝 Notes', count: null },
          { id: 'quiz' as OngletActif, label: '📝 Quiz', count: quizDisponibles.length },
          { id: 'cahier' as OngletActif, label: '📓 Cahier de textes', count: null },
          { id: 'alertes' as OngletActif, label: '🔔 Alertes', count: alertes.length }
        ].map(onglet => (
          <button
            key={onglet.id}
            className={`groupe-onglet ${ongletActif === onglet.id ? 'active' : ''}`}
            onClick={() => setOngletActif(onglet.id)}
          >
            {onglet.label}
            {onglet.count !== null && onglet.count > 0 && (
              <span className="groupe-onglet-badge">{onglet.count}</span>
            )}
          </button>
        ))}
      </div>


      {/* ============================================================ */}
      {/* ONGLET 1 : APERÇU (VUE D'ENSEMBLE)                         */}
      {/* ============================================================ */}
      {ongletActif === 'apercu' && statsGroupe && (
        <div className="groupe-apercu">

          {/* Cartes de statistiques globales */}
          <div className="groupe-stats-grid">
            {/* Moyenne de la classe */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">📊</div>
              <div className="groupe-stat-card-content">
                <span className={`groupe-stat-card-value ${getClasseMoyenne(statsGroupe.moyenneClasse)}`}>
                  {statsGroupe.moyenneClasse}/20
                </span>
                <span className="groupe-stat-card-label">Moyenne classe</span>
              </div>
            </div>

            {/* Taux de réussite */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">✅</div>
              <div className="groupe-stat-card-content">
                <span className="groupe-stat-card-value">{statsGroupe.tauxReussite}%</span>
                <span className="groupe-stat-card-label">Taux de réussite</span>
              </div>
            </div>

            {/* Nombre d'élèves */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">👥</div>
              <div className="groupe-stat-card-content">
                <span className="groupe-stat-card-value">{statsGroupe.nombreEleves}</span>
                <span className="groupe-stat-card-label">Élèves inscrits</span>
              </div>
            </div>

            {/* Quiz passés */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">📝</div>
              <div className="groupe-stat-card-content">
                <span className="groupe-stat-card-value">{statsGroupe.totalQuizPasses}</span>
                <span className="groupe-stat-card-label">Quiz passés</span>
              </div>
            </div>

            {/* Participation */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">📈</div>
              <div className="groupe-stat-card-content">
                <span className="groupe-stat-card-value">{statsGroupe.tauxParticipation}%</span>
                <span className="groupe-stat-card-label">Participation</span>
              </div>
            </div>

            {/* Élèves en difficulté */}
            <div className="groupe-stat-card">
              <div className="groupe-stat-card-icon">⚠️</div>
              <div className="groupe-stat-card-content">
                <span className={`groupe-stat-card-value ${
                  statsGroupe.elevesEnDifficulte > 0 ? 'prof-note-critique' : 'prof-note-excellent'
                }`}>
                  {statsGroupe.elevesEnDifficulte}
                </span>
                <span className="groupe-stat-card-label">En difficulté</span>
              </div>
            </div>
          </div>

          {/* Barre de notes (meilleure / pire) */}
          <div className="groupe-apercu-notes">
            <div className="groupe-note-range">
              <span className="groupe-note-range-label">Plage des notes :</span>
              <span className="prof-note-critique">{statsGroupe.pireNote}/20</span>
              <div className="groupe-note-barre">
                <div
                  className="groupe-note-barre-fill"
                  style={{
                    left: `${(statsGroupe.pireNote / 20) * 100}%`,
                    width: `${((statsGroupe.meilleureNote - statsGroupe.pireNote) / 20) * 100}%`
                  }}
                />
              </div>
              <span className="prof-note-excellent">{statsGroupe.meilleureNote}/20</span>
            </div>
          </div>

          {/* Top 3 et Bottom 3 */}
          {statsEleves.length >= 3 && (
            <div className="groupe-apercu-classement">
              {/* Top 3 */}
              <div className="groupe-classement-section">
                <h4>🏆 Top 3</h4>
                {statsEleves.slice(0, 3).map((eleve, idx) => (
                  <div key={eleve.eleveId} className="groupe-classement-item">
                    <span className="groupe-classement-rang">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                    </span>
                    <span className="groupe-classement-nom">{eleve.eleveNom}</span>
                    <span className={`groupe-classement-note ${getClasseMoyenne(eleve.moyenne)}`}>
                      {eleve.moyenne}/20
                    </span>
                  </div>
                ))}
              </div>

              {/* Élèves en difficulté */}
              <div className="groupe-classement-section">
                <h4>⚠️ À surveiller</h4>
                {statsEleves
                  .filter(e => e.moyenne < 8 && e.totalQuiz > 0)
                  .slice(0, 3)
                  .map(eleve => (
                    <div key={eleve.eleveId} className="groupe-classement-item">
                      <span className="groupe-classement-rang">🔴</span>
                      <span className="groupe-classement-nom">{eleve.eleveNom}</span>
                      <span className={`groupe-classement-note ${getClasseMoyenne(eleve.moyenne)}`}>
                        {eleve.moyenne}/20
                      </span>
                    </div>
                  ))
                }
                {statsEleves.filter(e => e.moyenne < 8 && e.totalQuiz > 0).length === 0 && (
                  <p className="groupe-classement-vide">Aucun élève en difficulté 🎉</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET 2 : LISTE DES ÉLÈVES                                 */}
      {/* ============================================================ */}
      {ongletActif === 'eleves' && (
        <div className="groupe-eleves">

          {/* Barre de tri + Inscription directe */}
          <div className="groupe-eleves-toolbar">
            <label htmlFor="tri-eleves">Trier par :</label>
            <select
              id="tri-eleves"
              value={triEleves}
              onChange={(e) => setTriEleves(e.target.value as TriEleves)}
              className="prof-select prof-select-sm"
            >
              <option value="moyenne_desc">Moyenne (↓)</option>
              <option value="moyenne_asc">Moyenne (↑)</option>
              <option value="nom">Nom (A-Z)</option>
              <option value="streak">Streak (↓)</option>
              <option value="quiz_count">Quiz passés (↓)</option>
            </select>
            <span className="groupe-eleves-count">
              {statsEleves.length} élève{statsEleves.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className="prof-btn prof-btn-primary"
              onClick={() => setModalInscriptionOuvert(true)}
              style={{ marginLeft: 'auto' }}
            >
              👥 Inscrire un élève
            </button>
          </div>

          {/* État vide */}
          {statsEleves.length === 0 ? (
            <div className="prof-empty-state">
              <div className="prof-empty-icon">👥</div>
              <h3>Aucun élève inscrit</h3>
              <p>Partagez le code <strong>{groupe.codeInvitation}</strong> à vos élèves, ou inscrivez directement un élève membre de PedaClic.</p>
              <button
                type="button"
                className="prof-btn prof-btn-primary"
                onClick={() => setModalInscriptionOuvert(true)}
                style={{ marginTop: '1rem' }}
              >
                👥 Inscrire un élève
              </button>
            </div>
          ) : (
            <>
              {/* Tableau des élèves */}
              <div className="groupe-eleves-table-wrapper">
                <table className="groupe-eleves-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Élève</th>
                      <th>Moyenne</th>
                      <th>Quiz</th>
                      <th>Réussite</th>
                      <th>Streak</th>
                      <th>Tendance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elevesTries.map((eleve, idx) => (
                      <tr
                        key={eleve.eleveId}
                        className={`${eleveSelectionne === eleve.eleveId ? 'groupe-eleve-row-active' : ''}`}
                      >
                        <td className="groupe-eleve-rang">{idx + 1}</td>
                        <td className="groupe-eleve-nom-cell">
                          <div>
                            <strong>{eleve.eleveNom}</strong>
                            <span className="groupe-eleve-email">{eleve.eleveEmail}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`groupe-note-badge ${getClasseMoyenne(eleve.moyenne)}`}>
                            {eleve.moyenne}/20
                          </span>
                        </td>
                        <td>{eleve.totalQuiz}</td>
                        <td>{eleve.tauxReussite}%</td>
                        <td>
                          <span className="groupe-streak">
                            🔥 {eleve.streak.actuel}j
                          </span>
                        </td>
                        <td>{getTendanceEmoji(eleve.tendance)} {eleve.tendance}</td>
                        <td className="groupe-eleve-actions">
                          <button
                            className="prof-btn-icon"
                            onClick={() => setEleveSelectionne(
                              eleveSelectionne === eleve.eleveId ? null : eleve.eleveId
                            )}
                            title="Voir détails"
                          >
                            {eleveSelectionne === eleve.eleveId ? '🔽' : '▶️'}
                          </button>
                          <button
                            className="prof-btn-icon prof-btn-icon-danger"
                            onClick={() => handleRetirerEleve(eleve.eleveId)}
                            disabled={loadingRetrait === eleve.eleveId}
                            title="Retirer du groupe"
                          >
                            {loadingRetrait === eleve.eleveId ? '⏳' : '✕'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ===== DÉTAIL D'UN ÉLÈVE (panneau déplié) ===== */}
              {eleveSelectionne && (() => {
                const eleve = statsEleves.find(e => e.eleveId === eleveSelectionne);
                if (!eleve) return null;

                return (
                  <div className="groupe-eleve-detail">
                    <div className="groupe-eleve-detail-header">
                      <h3>📋 Détail — {eleve.eleveNom}</h3>
                      <button
                        className="prof-btn-icon"
                        onClick={() => setEleveSelectionne(null)}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="groupe-eleve-detail-grid">
                      {/* Score global */}
                      <div className="groupe-eleve-detail-card">
                        <h4>Score global</h4>
                        <div className="groupe-eleve-score-circle">
                          <span className={getClasseMoyenne(eleve.scoreGlobal / 5)}>
                            {eleve.scoreGlobal}/100
                          </span>
                        </div>
                      </div>

                      {/* Streak */}
                      <div className="groupe-eleve-detail-card">
                        <h4>🔥 Streak</h4>
                        <p>Actuel : <strong>{eleve.streak.actuel} jour{eleve.streak.actuel !== 1 ? 's' : ''}</strong></p>
                        <p>Meilleur : {eleve.streak.meilleur} jours</p>
                      </div>

                      {/* Lacunes */}
                      <div className="groupe-eleve-detail-card groupe-eleve-detail-card-wide">
                        <h4>⚠️ Lacunes détectées</h4>
                        {eleve.lacunes.length === 0 ? (
                          <p className="text-muted">Aucune lacune détectée 🎉</p>
                        ) : (
                          <ul className="groupe-lacunes-liste">
                            {eleve.lacunes.map((lacune, idx) => (
                              <li key={idx} className={`groupe-lacune-item groupe-lacune-${lacune.niveauUrgence}`}>
                                <span className="groupe-lacune-nom">
                                  {lacune.disciplineNom}
                                  {lacune.chapitre && ` — ${lacune.chapitre}`}
                                </span>
                                <span className="groupe-lacune-moyenne">
                                  {lacune.moyenne}/20
                                </span>
                                <span className={`groupe-lacune-badge groupe-lacune-badge-${lacune.niveauUrgence}`}>
                                  {lacune.niveauUrgence}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Observations */}
                      <div className="groupe-eleve-detail-card groupe-eleve-detail-card-wide">
                        <h4>📝 Observations</h4>
                        <textarea
                          className="prof-textarea"
                          rows={3}
                          placeholder="Notes sur cet élève..."
                          value={observationEdit}
                          onChange={(e) => setObservationEdit(e.target.value)}
                        />
                        <button
                          className="prof-btn prof-btn-primary prof-btn-sm"
                          onClick={handleSaveObservation}
                          disabled={savingObservation === eleve.eleveId}
                        >
                          {savingObservation === eleve.eleveId ? 'Enregistrement...' : '💾 Enregistrer'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET APPEL : PRÉSENCES / ABSENCES                          */}
      {/* ============================================================ */}
      {ongletActif === 'appel' && (
        <div className="groupe-appel">
          <div className="groupe-appel-header">
            <label htmlFor="date-appel">Date de l'appel :</label>
            <input
              id="date-appel"
              type="date"
              value={dateAppel}
              onChange={(e) => setDateAppel(e.target.value)}
              className="prof-input prof-input-sm"
            />
          </div>

          {statsEleves.length === 0 ? (
            <div className="prof-empty-state">
              <p>Aucun élève inscrit. Partagez le code pour inviter des élèves.</p>
            </div>
          ) : (
            <>
              <div className="groupe-appel-liste">
                <h4>☑️ Marquer les absents</h4>
                {statsEleves.map((eleve) => (
                  <label key={eleve.eleveId} className="groupe-appel-item">
                    <input
                      type="checkbox"
                      checked={absentsIds.includes(eleve.eleveId)}
                      onChange={(e) => {
                        if (e.target.checked) setAbsentsIds(prev => [...prev, eleve.eleveId]);
                        else setAbsentsIds(prev => prev.filter(id => id !== eleve.eleveId));
                      }}
                    />
                    <span className={absentsIds.includes(eleve.eleveId) ? 'groupe-appel-absent' : ''}>
                      {eleve.eleveNom}
                    </span>
                  </label>
                ))}
              </div>

              <div className="groupe-appel-actions">
                <button
                  className="prof-btn prof-btn-primary"
                  onClick={handleMarquerAbsences}
                  disabled={loadingAppel}
                >
                  {loadingAppel ? 'Enregistrement...' : '✅ Enregistrer les absences'}
                </button>
              </div>

              {/* Suivi des absences sur une période */}
              <div className="groupe-appel-suivi">
                <h4>📊 Suivi des absences</h4>
                <div className="groupe-appel-suivi-btns">
                  {(['jour', 'semaine', 'mois'] as const).map((p) => (
                    <button
                      key={p}
                      className={`prof-btn prof-btn-sm prof-btn-secondary ${periodeSuivi === p ? 'active' : ''}`}
                      onClick={() => setPeriodeSuivi(p)}
                    >
                      {p === 'jour' ? 'Jour' : p === 'semaine' ? 'Semaine' : 'Mois'}
                    </button>
                  ))}
                </div>
                <AppelSuiviTable groupeId={groupe.id} statsEleves={statsEleves} periode={periodeSuivi} />
              </div>
            </>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET TRAVAUX À FAIRE                                       */}
      {/* ============================================================ */}
      {ongletActif === 'travaux' && (
        <div className="groupe-travaux">
          <div className="groupe-travaux-form">
            <h4>➕ Nouveau travail</h4>
            <input
              type="text"
              className="prof-input"
              placeholder="Titre du travail"
              value={nouveauTravailTitre}
              onChange={(e) => setNouveauTravailTitre(e.target.value)}
            />
            <textarea
              className="prof-textarea"
              rows={2}
              placeholder="Description (optionnel)"
              value={nouveauTravailDesc}
              onChange={(e) => setNouveauTravailDesc(e.target.value)}
            />
            <div className="groupe-travaux-echeance">
              <label>Échéance :</label>
              <input
                type="date"
                className="prof-input prof-input-sm"
                value={nouveauTravailEcheance}
                onChange={(e) => setNouveauTravailEcheance(e.target.value)}
              />
            </div>
            <button
              className="prof-btn prof-btn-primary"
              onClick={handleAjouterTravail}
              disabled={savingTravail || !nouveauTravailTitre.trim()}
            >
              {savingTravail ? 'Ajout...' : 'Ajouter le travail'}
            </button>
          </div>

          <div className="groupe-travaux-liste">
            <h4>📋 Travaux en cours</h4>
            {travaux.length === 0 ? (
              <p className="text-muted">Aucun travail à faire pour l'instant.</p>
            ) : (
              <ul className="groupe-travaux-items">
                {travaux.map((t) => (
                  <li key={t.id} className="groupe-travaux-item">
                    <div>
                      <strong>{t.titre}</strong>
                      {t.description && <p className="groupe-travaux-desc">{t.description}</p>}
                      <span className="groupe-travaux-date">
                        📅 {t.dateEcheance instanceof Date ? t.dateEcheance.toLocaleDateString('fr-FR') : new Date(t.dateEcheance).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <button
                      className="prof-btn-icon prof-btn-icon-danger"
                      onClick={() => handleSupprimerTravail(t.id)}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET FEUILLES DE NOTES                                     */}
      {/* ============================================================ */}
      {ongletActif === 'notes' && currentUser && (
        <div className="groupe-notes">
          <FeuillesNotesManager groupe={groupe} currentUser={currentUser} />
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET 3 : ANALYSE PAR QUIZ                                  */}
      {/* ============================================================ */}
      {ongletActif === 'quiz' && (
        <div className="groupe-quiz">

          {/* Sélection du quiz */}
          <div className="groupe-quiz-selector">
            <label htmlFor="select-quiz">Sélectionner un quiz à analyser :</label>
            <select
              id="select-quiz"
              value={quizSelectionne || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const q = quizDisponibles.find(x => x.id === val);
                  handleAnalyserQuiz(val, q?.source);
                }
              }}
              className="prof-select"
            >
              <option value="">— Choisir un quiz —</option>
              {quizDisponibles.map(q => (
                <option key={q.id} value={q.id}>
                  {q.source === 'quizzes_v2' ? '🧠 ' : ''}{q.titre}
                </option>
              ))}
            </select>
          </div>

          {/* État vide : pas de quiz sélectionné */}
          {!quizSelectionne && (
            <div className="prof-empty-state">
              <div className="prof-empty-icon">📝</div>
              <h3>Analyse par quiz</h3>
              <p>Sélectionnez un quiz pour voir les statistiques détaillées et les questions les plus ratées.</p>
            </div>
          )}

          {/* Loading quiz */}
          {loadingQuiz && (
            <div className="prof-loading">
              <div className="spinner"></div>
              <p>Analyse en cours...</p>
            </div>
          )}

          {/* Résultats de l'analyse quiz */}
          {statsQuiz && !loadingQuiz && (
            <div className="groupe-quiz-resultats">
              {/* Stats globales du quiz */}
              <div className="groupe-quiz-stats-header">
                <h3>{statsQuiz.quizTitre}</h3>
                <div className="groupe-quiz-stats-grid">
                  <div className="groupe-stat-mini">
                    <span className="groupe-stat-mini-value">{statsQuiz.totalPassages}</span>
                    <span className="groupe-stat-mini-label">Passages</span>
                  </div>
                  <div className="groupe-stat-mini">
                    <span className={`groupe-stat-mini-value ${getClasseMoyenne(statsQuiz.moyenneScore)}`}>
                      {statsQuiz.moyenneScore}/20
                    </span>
                    <span className="groupe-stat-mini-label">Moyenne</span>
                  </div>
                  <div className="groupe-stat-mini">
                    <span className="groupe-stat-mini-value">{statsQuiz.tauxReussite}%</span>
                    <span className="groupe-stat-mini-label">Réussite</span>
                  </div>
                  <div className="groupe-stat-mini">
                    <span className="groupe-stat-mini-value">
                      {Math.floor(statsQuiz.tempsEcouleMoyen / 60)}min
                    </span>
                    <span className="groupe-stat-mini-label">Temps moyen</span>
                  </div>
                </div>
              </div>

              {/* Questions les plus ratées */}
              <div className="groupe-quiz-questions">
                <h4>❌ Questions les plus ratées</h4>
                {statsQuiz.questionsRatees
                  .filter(q => q.tauxEchec > 30)
                  .map((question, idx) => (
                    <div key={idx} className="groupe-quiz-question-card">
                      <div className="groupe-quiz-question-header">
                        <span className="groupe-quiz-question-num">
                          Q{question.questionIndex + 1}
                        </span>
                        <span className="groupe-quiz-question-echec">
                          {question.tauxEchec}% d'échec
                        </span>
                      </div>
                      <p className="groupe-quiz-question-texte">{question.questionTexte}</p>
                      <div className="groupe-quiz-question-reponse">
                        <span className="groupe-quiz-bonne-reponse">
                          ✅ Bonne réponse : {question.reponseCorrecte}
                        </span>
                      </div>
                      {question.reponsesFrequentes.length > 0 && (
                        <div className="groupe-quiz-mauvaises-reponses">
                          <span>Erreurs fréquentes :</span>
                          {question.reponsesFrequentes.slice(0, 2).map((rep, rIdx) => (
                            <span key={rIdx} className="groupe-quiz-mauvaise-reponse">
                              ❌ {rep.reponse} ({rep.nombre} élève{rep.nombre > 1 ? 's' : ''})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                }
                {statsQuiz.questionsRatees.filter(q => q.tauxEchec > 30).length === 0 && (
                  <p className="text-muted">Toutes les questions ont un taux de réussite supérieur à 70% 🎉</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET : CAHIER DE TEXTES (lié à ce groupe)                   */}
      {/* ============================================================ */}
      {ongletActif === 'cahier' && (
        <div className="groupe-cahier-onglet">
          <CahierGroupeWidget
            groupe={{
              id: groupe.id,
              profId: groupe.profId,
              nom: groupe.nom,
              classe: groupe.classeNiveau,
              codeInvitation: groupe.codeInvitation,
              nombreInscrits: groupe.nombreInscrits,
              anneeScolaire: groupe.anneeScolaire,
            }}
          />
        </div>
      )}


      {/* ============================================================ */}
      {/* ONGLET ALERTES                                                */}
      {/* ============================================================ */}
      {ongletActif === 'alertes' && (
        <div className="groupe-alertes">
          {alertes.length === 0 ? (
            <div className="prof-empty-state">
              <div className="prof-empty-icon">🔔</div>
              <h3>Aucune alerte</h3>
              <p>Tous vos élèves se portent bien ! Les alertes apparaîtront ici quand un élève aura besoin d'attention.</p>
            </div>
          ) : (
            <div className="groupe-alertes-liste">
              {alertes.map(alerte => (
                <div
                  key={alerte.id}
                  className={`groupe-alerte-card groupe-alerte-${alerte.niveauUrgence}`}
                >
                  <div className="groupe-alerte-header">
                    <span className="groupe-alerte-emoji">
                      {getAlerteEmoji(alerte.type)}
                    </span>
                    <span className="groupe-alerte-eleve">{alerte.eleveNom}</span>
                    <span className={`groupe-alerte-badge groupe-alerte-badge-${alerte.niveauUrgence}`}>
                      {alerte.niveauUrgence}
                    </span>
                  </div>
                  <p className="groupe-alerte-message">{alerte.message}</p>
                  {/* Action rapide : voir détail de l'élève */}
                  <button
                    className="prof-btn prof-btn-secondary prof-btn-sm"
                    onClick={() => {
                      setOngletActif('eleves');
                      setEleveSelectionne(alerte.eleveId);
                    }}
                  >
                    📋 Voir détail
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal inscription directe (élèves membres PedaClic) */}
      {modalInscriptionOuvert && currentUser && (
        <InscriptionDirecteModal
          groupeId={groupe.id}
          groupeNom={groupe.nom}
          profId={currentUser.uid}
          onClose={() => setModalInscriptionOuvert(false)}
          onSuccess={chargerDonneesGroupe}
        />
      )}
    </div>
  );
};

export default GroupeDetail;

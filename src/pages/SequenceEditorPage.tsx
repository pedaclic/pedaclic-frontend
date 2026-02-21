// ============================================================
// PedaClic — Phase 23 : Éditeur — Séquences Pédagogiques
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================
// Gère à la fois la création (/prof/sequences/nouvelle)
// et la modification (/prof/sequences/:id/modifier)
// Inclut le panneau IA et l'éditeur de séances.
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams }                   from 'react-router-dom';
import { Timestamp }                                from 'firebase/firestore';
import { useAuth }                                  from '../hooks/useAuth';
import {
  createSequence,
  updateSequence,
  getSequenceById,
}                                                   from '../services/sequencePedagogiqueService';
import { genererSequenceAvecIA }                    from '../services/sequenceIAService';
import { getCahiersProf, getGroupesProf }           from '../services/cahierTextesService';
import { DisciplineService } from '../services/disciplineService';
import type {
  SequencePedagogique,
  SeancePedagogique,
  SequenceFormData,
  TypeActivite,
  TypeEvaluation,
  NiveauScolaire,
}                                                   from '../types/sequencePedagogique.types';
import type { CahierTextes, GroupeProf }            from '../types/cahierTextes.types';
import {
  LABELS_TYPE_ACTIVITE,
  LABELS_TYPE_EVALUATION,
  NIVEAUX_SCOLAIRES,
  MATIERES_SENEGAL,
  DUREES_SEANCE,
}                                                   from '../types/sequencePedagogique.types';
import '../styles/SequencesPedagogiques.css';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/** Génère un ID local unique pour les séances embarquées */
function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Crée une séance vide avec des valeurs par défaut */
function creerSeanceVide(numero: number): SeancePedagogique {
  return {
    id:                genId(),
    numero,
    titre:             '',
    dureeMinutes:      55,
    objectifSpecifique: '',
    contenu:           '',
    ressources:        [],
    typeActivite:      'cours',
    estEvaluation:     false,
    exporterVersCahier: true,
    entreesCahierIds:  [],
  };
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Carte séance éditable
// ─────────────────────────────────────────────────────────────

interface SeanceCardEditProps {
  seance:    SeancePedagogique;
  onChange:  (seance: SeancePedagogique) => void;
  onDelete:  () => void;
  onMoveUp:  () => void;
  onMoveDown: () => void;
  isFirst:   boolean;
  isLast:    boolean;
}

const SeanceCardEdit: React.FC<SeanceCardEditProps> = ({
  seance,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  // Dépliage/repliage de la carte
  const [isOpen, setIsOpen] = useState(seance.titre === ''); // Ouverte si nouvelle

  // Champ ressource en cours de saisie
  const [newRessource, setNewRessource] = useState('');

  /** Met à jour un champ de la séance */
  const update = (field: Partial<SeancePedagogique>) =>
    onChange({ ...seance, ...field });

  /** Ajoute une ressource */
  const addRessource = () => {
    const val = newRessource.trim();
    if (!val) return;
    update({ ressources: [...seance.ressources, val] });
    setNewRessource('');
  };

  /** Supprime une ressource */
  const removeRessource = (idx: number) =>
    update({ ressources: seance.ressources.filter((_, i) => i !== idx) });

  return (
    <div className="seance-card">

      {/* ── En-tête (toujours visible) ── */}
      <div className="seance-card__header" onClick={() => setIsOpen((o) => !o)}>

        {/* Numéro */}
        <div className={`seance-card__numero${seance.estEvaluation ? ' seance-card__numero--eval' : ''}`}>
          {seance.numero}
        </div>

        {/* Titre (placeholder si vide) */}
        <span className="seance-card__header-title">
          {seance.titre || `Séance ${seance.numero} (sans titre)`}
        </span>

        {/* Badges type + durée */}
        <div className="seance-card__header-badges">
          <span className={`type-activite-badge type-activite-badge--${seance.typeActivite}`}>
            {LABELS_TYPE_ACTIVITE[seance.typeActivite]}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{seance.dureeMinutes}min</span>
        </div>

        {/* Icône dépliage */}
        <span className={`seance-card__toggle-icon${isOpen ? ' seance-card__toggle-icon--open' : ''}`}>
          ▼
        </span>
      </div>

      {/* ── Corps dépliable ── */}
      {isOpen && (
        <div className="seance-card__body">

          {/* ── Ligne 1 : Titre + Type + Durée ── */}
          <div className="editor-form-grid">

            {/* Titre de la séance */}
            <div className="form-group editor-form-grid--full">
              <label>Titre de la séance <span className="required">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex : Introduction aux vecteurs"
                value={seance.titre}
                onChange={(e) => update({ titre: e.target.value })}
              />
            </div>

            {/* Type d'activité */}
            <div className="form-group">
              <label>Type d'activité</label>
              <select
                className="form-control"
                value={seance.typeActivite}
                onChange={(e) => update({
                  typeActivite: e.target.value as TypeActivite,
                  // Si on passe à évaluation, marquer estEvaluation
                  estEvaluation: e.target.value === 'evaluation' ? true : seance.estEvaluation,
                })}
              >
                {Object.entries(LABELS_TYPE_ACTIVITE).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            {/* Durée */}
            <div className="form-group">
              <label>Durée (minutes)</label>
              <select
                className="form-control"
                value={seance.dureeMinutes}
                onChange={(e) => update({ dureeMinutes: Number(e.target.value) })}
              >
                {DUREES_SEANCE.map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
                <option value={seance.dureeMinutes}>
                  {DUREES_SEANCE.includes(seance.dureeMinutes as typeof DUREES_SEANCE[number])
                    ? null
                    : `${seance.dureeMinutes} min (personnalisé)`}
                </option>
              </select>
            </div>
          </div>

          {/* ── Objectif spécifique ── */}
          <div className="form-group">
            <label>Objectif spécifique</label>
            <textarea
              className="form-control form-control--textarea"
              placeholder="Ex : L'élève sera capable de calculer le module d'un vecteur"
              value={seance.objectifSpecifique}
              onChange={(e) => update({ objectifSpecifique: e.target.value })}
              rows={2}
            />
          </div>

          {/* ── Contenu / déroulement ── */}
          <div className="form-group">
            <label>Contenu / Déroulement</label>
            <textarea
              className="form-control form-control--textarea"
              placeholder="Décrivez le déroulement de la séance : activités, étapes, méthodes..."
              value={seance.contenu}
              onChange={(e) => update({ contenu: e.target.value })}
              rows={4}
            />
          </div>

          {/* ── Ressources ── */}
          <div className="form-group">
            <label>Supports / Ressources</label>
            {/* Ressources existantes */}
            {seance.ressources.length > 0 && (
              <div className="timeline-card__ressources" style={{ marginBottom: 6 }}>
                {seance.ressources.map((r, i) => (
                  <span key={i} className="ressource-chip" style={{ cursor: 'pointer' }}
                    onClick={() => removeRessource(i)}
                    title="Cliquer pour supprimer"
                  >
                    {r} ✕
                  </span>
                ))}
              </div>
            )}
            {/* Saisie nouvelle ressource */}
            <div className="competence-input-row">
              <input
                type="text"
                className="form-control"
                placeholder="Ex : Manuel p.42, GeoGebra, Calculatrice..."
                value={newRessource}
                onChange={(e) => setNewRessource(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRessource())}
              />
              <button type="button" className="btn-add-competence" onClick={addRessource}>
                + Ajouter
              </button>
            </div>
          </div>

          {/* ── Évaluation ── */}
          <div className="form-group">
            <label style={{ flexDirection: 'row', alignItems: 'center', display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={seance.estEvaluation}
                onChange={(e) => update({
                  estEvaluation: e.target.checked,
                  typeEvaluation: e.target.checked ? (seance.typeEvaluation ?? 'formative') : undefined,
                })}
                style={{ width: 16, height: 16, accentColor: '#2563eb' }}
              />
              Cette séance est une évaluation
            </label>
          </div>

          {/* ── Détails évaluation (conditionnel) ── */}
          {seance.estEvaluation && (
            <div className="editor-form-grid" style={{ background: '#fef2f2', padding: 12, borderRadius: 8, border: '1px solid #fecaca' }}>
              {/* Type évaluation */}
              <div className="form-group">
                <label>Type d'évaluation</label>
                <select
                  className="form-control"
                  value={seance.typeEvaluation ?? 'formative'}
                  onChange={(e) => update({ typeEvaluation: e.target.value as TypeEvaluation })}
                >
                  {Object.entries(LABELS_TYPE_EVALUATION).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              {/* Note max */}
              <div className="form-group">
                <label>Note maximale</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={100}
                  value={seance.noteMax ?? 20}
                  onChange={(e) => update({ noteMax: Number(e.target.value) })}
                />
              </div>
              {/* Coefficient */}
              <div className="form-group">
                <label>Coefficient</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={10}
                  step={0.5}
                  value={seance.coefficient ?? 1}
                  onChange={(e) => update({ coefficient: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          {/* ── Export vers cahier ── */}
          <div className="form-group">
            <label style={{ flexDirection: 'row', alignItems: 'center', display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={seance.exporterVersCahier}
                onChange={(e) => update({ exporterVersCahier: e.target.checked })}
                style={{ width: 16, height: 16, accentColor: '#2563eb' }}
              />
              Inclure dans l'export vers le Cahier de Textes
            </label>
            {seance.entreesCahierIds && seance.entreesCahierIds.length > 0 && (
              <span className="export-seance-row__exported" style={{ marginTop: 4 }}>
                ✅ Déjà exportée ({seance.entreesCahierIds.length} entrée{seance.entreesCahierIds.length > 1 ? 's' : ''})
              </span>
            )}
          </div>

          {/* ── Actions de la carte ── */}
          <div className="seance-card__actions">
            {/* Réordonner */}
            <button type="button" className="btn-seance-action btn-secondary"
              onClick={onMoveUp} disabled={isFirst} title="Monter">↑</button>
            <button type="button" className="btn-seance-action btn-secondary"
              onClick={onMoveDown} disabled={isLast} title="Descendre">↓</button>
            {/* Supprimer */}
            <button type="button" className="btn-seance-action btn-seance-action--delete"
              onClick={onDelete}>
              🗑️ Supprimer cette séance
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Panneau IA
// ─────────────────────────────────────────────────────────────

interface IAPanelProps {
  matieres: string[];
  onSequenceGeneree: (data: {
    titre: string;
    description: string;
    objectifGeneral: string;
    prerequis: string;
    competences: string[];
    seances: Omit<SeancePedagogique, 'id' | 'exporterVersCahier' | 'entreesCahierIds'>[];
  }) => void;
  defaultMatiere?: string;
  defaultNiveau?:  string;
}

const IAPanel: React.FC<IAPanelProps> = ({ onSequenceGeneree, defaultMatiere, defaultNiveau, matieres }) => {
  const [matiere,    setMatiere]    = useState(defaultMatiere ?? '');
  const [niveau,     setNiveau]     = useState(defaultNiveau ?? '');
  const [theme,      setTheme]      = useState('');
  const [nbSeances,  setNbSeances]  = useState(8);
  const [duree,      setDuree]      = useState(55);
  const [trimestre,  setTrimestre]  = useState<1|2|3>(1);
  const [instructions, setInstructions] = useState('');

  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState<{ type: 'idle'|'loading'|'success'|'error'; message: string }>({ type: 'idle', message: '' });

  const handleGenerer = async () => {
    if (!matiere || !niveau || !theme) {
      setStatus({ type: 'error', message: 'Veuillez remplir la matière, le niveau et le thème.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'loading', message: 'L\'IA génère votre séquence... (30-45 secondes)' });

    try {
      const resultat = await genererSequenceAvecIA({
        matiere,
        niveau:     niveau as NiveauScolaire,
        theme,
        nombreSeances:     nbSeances,
        dureeSeanceMinutes: duree,
        trimestre,
        instructionsSupplementaires: instructions || undefined,
      });

      // Adapter les séances au format complet
      const seancesAdaptees = resultat.seances.map((s) => ({
        ...s,
        ressources: s.ressources ?? [],
      }));

      onSequenceGeneree({
        titre:           resultat.titre,
        description:     resultat.description,
        objectifGeneral: resultat.objectifGeneral,
        prerequis:       resultat.prerequis,
        competences:     resultat.competences,
        seances:         seancesAdaptees,
      });

      setStatus({ type: 'success', message: `✅ Séquence générée avec ${seancesAdaptees.length} séances ! Vérifiez et complétez les informations.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setStatus({ type: 'error', message: `Erreur IA : ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ia-panel">
      {/* Titre */}
      <h3 className="ia-panel__title">✨ Génération assistée par IA</h3>
      <p className="ia-panel__subtitle">
        Décrivez votre séquence et Claude génère la structure complète
      </p>

      {/* Grille de saisie */}
      <div className="ia-panel__form-grid">
        {/* Matière */}
        <div className="form-group">
          <label>Matière <span className="required">*</span></label>
          <select className="form-control" value={matiere} onChange={(e) => setMatiere(e.target.value)}>
            <option value="">Sélectionner...</option>
        
	{matieres.length > 0
        ? matieres.map((m) => <option key={m} value={m}>{m}</option>)
        : MATIERES_SENEGAL.map((m) => <option key={m} value={m}>{m}</option>)
         }
          </select>
        </div>

        {/* Niveau */}
        <div className="form-group">
          <label>Niveau <span className="required">*</span></label>
          <select className="form-control" value={niveau} onChange={(e) => setNiveau(e.target.value)}>
            <option value="">Sélectionner...</option>
            {NIVEAUX_SCOLAIRES.map((n) => <option key={n.valeur} value={n.valeur}>{n.label}</option>)}
          </select>
        </div>

        {/* Thème */}
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>Thème / Chapitre <span className="required">*</span></label>
          <input
            type="text"
            className="form-control"
            placeholder="Ex : Les fonctions affines, La photosynthèse, La Révolution française..."
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
        </div>

        {/* Nombre de séances */}
        <div className="form-group">
          <label>Nombre de séances</label>
          <input
            type="number"
            className="form-control"
            min={2} max={25}
            value={nbSeances}
            onChange={(e) => setNbSeances(Number(e.target.value))}
          />
        </div>

        {/* Durée */}
        <div className="form-group">
          <label>Durée par séance</label>
          <select className="form-control" value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
            {DUREES_SEANCE.map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>

        {/* Trimestre */}
        <div className="form-group">
          <label>Trimestre</label>
          <select className="form-control" value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value) as 1|2|3)}>
            <option value={1}>1er trimestre (Oct–Déc)</option>
            <option value={2}>2ème trimestre (Jan–Mars)</option>
            <option value={3}>3ème trimestre (Avr–Juin)</option>
          </select>
        </div>
      </div>

      {/* Instructions supplémentaires */}
      <div className="form-group">
        <label>Instructions supplémentaires (optionnel)</label>
        <textarea
          className="ia-panel__instructions"
          placeholder="Ex : Insister sur la résolution graphique, Inclure un TP sur GeoGebra, Prévoir une séance de remédiation..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
        />
      </div>

      {/* Bouton générer */}
      <button
        type="button"
        className="ia-panel__btn-generate"
        onClick={handleGenerer}
        disabled={loading}
      >
        {loading ? <span className="spinner" /> : '✨'}
        {loading ? 'Génération en cours...' : 'Générer avec l\'IA'}
      </button>

      {/* Status */}
      {status.type !== 'idle' && (
        <div className={`ia-panel__status ia-panel__status--${status.type}`}>
          {status.type === 'loading' && <span className="spinner spinner--blue" />}
          {status.message}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : SequenceEditorPage
// ─────────────────────────────────────────────────────────────

const SequenceEditorPage: React.FC = () => {
  const navigate        = useNavigate();
  const { id }          = useParams<{ id?: string }>();
  const { currentUser } = useAuth();

  // Mode : création ou édition
  const isEditMode = Boolean(id);

  // ── État du formulaire ──────────────────────────────────────
  const [form, setForm] = useState<Partial<SequenceFormData>>({
    titre:             '',
    description:       '',
    niveau:            '',
    matiere:           '',
    theme:             '',
    competences:       [],
    objectifGeneral:   '',
    prerequis:         '',
    nombreSeances:     6,
    dureeSeanceMinutes: 55,
    seances:           [],
    evaluationsPrevues: [],
    statut:            'brouillon',
    genereeParIA:      false,
    trimestre:         undefined,
    groupeClasseId:    undefined,
    groupeClasseNom:   undefined,
    cahierDeTextesId:  undefined,
    cahierDeTextesNom: undefined,
  });

  // ── Séances (gérées séparément pour facilité) ───────────────
  const [seances, setSeances] = useState<SeancePedagogique[]>([]);

  // ── Ressources externes (cahiers, groupes) ──────────────────
  const [cahiers, setCahiers]   = useState<CahierTextes[]>([]);
  const [groupes, setGroupes]   = useState<GroupeProf[]>([]);
  const [matieres, setMatieres] = useState<string[]>([]);

  // ── État UI ─────────────────────────────────────────────────
  const [loading,       setLoading]       = useState(isEditMode);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [successMsg,    setSuccessMsg]    = useState<string | null>(null);
  const [newCompetence, setNewCompetence] = useState('');
  const [showIAPanel,   setShowIAPanel]   = useState(!isEditMode);

  // ── Chargement initial (mode édition) ──────────────────────
  useEffect(() => {
    const init = async () => {
      if (!currentUser?.uid) return;

      // Charger cahiers et groupes en parallèle
      const [cahiersData, groupesData, disciplinesData] = await Promise.all([
  getCahiersProf(currentUser.uid).catch(() => []),
  getGroupesProf(currentUser.uid).catch(() => []),
  DisciplineService.getAll().catch(() => []),
]);
setCahiers(cahiersData);
setGroupes(groupesData);
const nomsUniques = [...new Set(disciplinesData.map((d: any) => d.nom))].sort() as string[];
setMatieres(nomsUniques);
// Extraire les noms uniques des disciplines, triés alphabétiquement

      // Si mode édition, charger la séquence
      if (isEditMode && id) {
        setLoading(true);
        try {
          const seq = await getSequenceById(id);
          if (!seq) {
            setError('Séquence introuvable.');
            return;
          }
          // Vérification d'appartenance
          if (seq.profId !== currentUser.uid) {
            setError('Accès non autorisé.');
            return;
          }
          setForm({
            titre:             seq.titre,
            description:       seq.description,
            niveau:            seq.niveau,
            matiere:           seq.matiere,
            theme:             seq.theme,
            competences:       seq.competences,
            objectifGeneral:   seq.objectifGeneral,
            prerequis:         seq.prerequis,
            nombreSeances:     seq.nombreSeances,
            dureeSeanceMinutes: seq.dureeSeanceMinutes,
            statut:            seq.statut,
            genereeParIA:      seq.genereeParIA,
            trimestre:         seq.trimestre,
            groupeClasseId:    seq.groupeClasseId,
            groupeClasseNom:   seq.groupeClasseNom,
            cahierDeTextesId:  seq.cahierDeTextesId,
            cahierDeTextesNom: seq.cahierDeTextesNom,
          });
          setSeances(seq.seances);
        } catch (err) {
          setError('Erreur de chargement. Réessayez.');
        } finally {
          setLoading(false);
        }
      }
    };
    init();
  }, [currentUser?.uid, id, isEditMode]);

  // ── Handlers séances ────────────────────────────────────────

  /** Ajoute une séance vide à la fin */
  const addSeance = () => {
    setSeances((prev) => [...prev, creerSeanceVide(prev.length + 1)]);
  };

  /** Met à jour une séance par son index */
  const updateSeance = (idx: number, seance: SeancePedagogique) => {
    setSeances((prev) => prev.map((s, i) => (i === idx ? seance : s)));
  };

  /** Supprime une séance et renuméroté */
  const deleteSeance = (idx: number) => {
    setSeances((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, numero: i + 1 }))
    );
  };

  /** Monte une séance d'un rang */
  const moveSeanceUp = (idx: number) => {
    if (idx === 0) return;
    setSeances((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr.map((s, i) => ({ ...s, numero: i + 1 }));
    });
  };

  /** Descend une séance d'un rang */
  const moveSeanceDown = (idx: number) => {
    setSeances((prev) => {
      if (idx === prev.length - 1) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr.map((s, i) => ({ ...s, numero: i + 1 }));
    });
  };

  // ── Handler compétences ─────────────────────────────────────

  const addCompetence = () => {
    const val = newCompetence.trim();
    if (!val) return;
    setForm((f) => ({ ...f, competences: [...(f.competences ?? []), val] }));
    setNewCompetence('');
  };

  const removeCompetence = (idx: number) => {
    setForm((f) => ({
      ...f,
      competences: (f.competences ?? []).filter((_, i) => i !== idx),
    }));
  };

  // ── Handler injection IA ────────────────────────────────────

  /** Injecte la séquence générée par l'IA dans le formulaire */
  const handleIAResult = (data: {
    titre: string;
    description: string;
    objectifGeneral: string;
    prerequis: string;
    competences: string[];
    seances: Omit<SeancePedagogique, 'id' | 'exporterVersCahier' | 'entreesCahierIds'>[];
  }) => {
    setForm((f) => ({
      ...f,
      titre:           data.titre,
      description:     data.description,
      objectifGeneral: data.objectifGeneral,
      prerequis:       data.prerequis,
      competences:     data.competences,
      genereeParIA:    true,
    }));

    // Convertir les séances IA en séances complètes
    const seancesCompletes: SeancePedagogique[] = data.seances.map((s) => ({
      ...s,
      id:                genId(),
      exporterVersCahier: true,
      entreesCahierIds:   [],
    }));
    setSeances(seancesCompletes);

    // Masquer le panneau IA après génération
    setShowIAPanel(false);

    // Scroll vers le formulaire
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Sauvegarde ──────────────────────────────────────────────

  const handleSave = async () => {
    if (!currentUser?.uid) return;

    // Validation basique
    if (!form.titre?.trim())   { setError('Le titre est obligatoire.'); return; }
    if (!form.matiere?.trim()) { setError('La matière est obligatoire.'); return; }
    if (!form.niveau?.trim())  { setError('Le niveau est obligatoire.'); return; }

    // Vérifier que les séances ont un titre
    const seanceSansTitre = seances.find((s) => !s.titre.trim());
    if (seanceSansTitre) {
      setError(`La séance n°${seanceSansTitre.numero} n'a pas de titre.`);
      return;
    }

    setSaving(true);
    setError(null);

    // Résoudre les noms dénormalisés
    const groupeChoisi  = groupes.find((g) => g.id === form.groupeClasseId);
    const cahierChoisi  = cahiers.find((c) => c.id === form.cahierDeTextesId);

    const dataFinale: SequenceFormData = {
      titre:             form.titre!.trim(),
      description:       form.description?.trim()     ?? '',
      niveau:            form.niveau!,
      matiere:           form.matiere!.trim(),
      theme:             form.theme?.trim()            ?? '',
      competences:       form.competences              ?? [],
      objectifGeneral:   form.objectifGeneral?.trim()  ?? '',
      prerequis:         form.prerequis?.trim()        ?? '',
      nombreSeances:     seances.length,
      dureeSeanceMinutes: form.dureeSeanceMinutes ?? 55,
      statut:            form.statut ?? 'brouillon',
      genereeParIA:      form.genereeParIA ?? false,
      trimestre:         form.trimestre ?? null,
      seances,
      evaluationsPrevues: [], // Recalculé dans le service
      groupeClasseId:    form.groupeClasseId   || null,
      groupeClasseNom:   groupeChoisi?.nom       || form.groupeClasseNom  || null,
      cahierDeTextesId:  form.cahierDeTextesId || null,
      cahierDeTextesNom: cahierChoisi?.titre   || form.cahierDeTextesNom || null,
    };

    try {
      if (isEditMode && id) {
        await updateSequence(id, dataFinale);
        setSuccessMsg('Séquence mise à jour avec succès !');
        setTimeout(() => navigate(`/prof/sequences/${id}`), 1200);
      } else {
        const newId = await createSequence(currentUser.uid, dataFinale);
        setSuccessMsg('Séquence créée avec succès !');
        setTimeout(() => navigate(`/prof/sequences/${newId}`), 1200);
      }
    } catch (err) {
      console.error('[SequenceEditorPage] Sauvegarde:', err);
      setError('Erreur lors de la sauvegarde. Réessayez.');
    } finally {
      setSaving(false);
    }
  };

  // ────────────────────────────────────────────────────────────
  // RENDU
  // ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="sequence-editor">
        <div className="skeleton" style={{ height: 30, width: '50%', marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
      </div>
    );
  }

  return (
    <div className="sequence-editor">

      {/* ── Fil d'Ariane + Titre ── */}
      <div className="sequence-editor__header">
        <p className="sequence-editor__breadcrumb">
          <a onClick={() => navigate('/prof/sequences')} style={{ cursor: 'pointer' }}>
            📚 Séquences
          </a>
          {' / '}
          {isEditMode ? 'Modifier' : 'Nouvelle séquence'}
        </p>
        <h1 className="sequence-editor__title">
          {isEditMode ? '✏️ Modifier la séquence' : '➕ Nouvelle séquence'}
        </h1>
      </div>

      {/* ── Bannières de feedback ── */}
      {error      && <div className="error-banner" role="alert">⚠️ {error}</div>}
      {successMsg && <div className="success-banner" role="status">✅ {successMsg}</div>}

      {/* ── Panneau IA (toggle) ── */}
      <div style={{ marginBottom: 8 }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ marginBottom: 12 }}
          onClick={() => setShowIAPanel((v) => !v)}
        >
          {showIAPanel ? '▲ Masquer' : '✨ Générer avec l\'IA'}
        </button>
      </div>

      {showIAPanel && (
        <IAPanel
          onSequenceGeneree={handleIAResult}
          defaultMatiere={form.matiere}
          defaultNiveau={form.niveau}
          matieres={matieres}
        />
      )}

      {/* ════════════════════════════════════════════════════════
          SECTION 1 — Informations générales
      ════════════════════════════════════════════════════════ */}
      <section className="editor-section">
        <h2 className="editor-section__title">📋 Informations générales</h2>

        <div className="editor-form-grid">

          {/* Titre */}
          <div className="form-group editor-form-grid--full">
            <label>Titre de la séquence <span className="required">*</span></label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex : Les fonctions affines — Terminale S"
              value={form.titre ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              required
            />
          </div>

          {/* Matière */}
          <div className="form-group">
            <label>Matière <span className="required">*</span></label>
            <select
              className="form-control"
              value={form.matiere ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, matiere: e.target.value }))}
            >
              <option value="">Sélectionner...</option>
              {matieres.length > 0
  	    ? matieres.map((m) => <option key={m} value={m}>{m}</option>)
  	    : MATIERES_SENEGAL.map((m) => <option key={m} value={m}>{m}</option>)
	     }
            </select>
          </div>

          {/* Niveau */}
          <div className="form-group">
            <label>Niveau <span className="required">*</span></label>
            <select
              className="form-control"
              value={form.niveau ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, niveau: e.target.value }))}
            >
              <option value="">Sélectionner...</option>
              {NIVEAUX_SCOLAIRES.map((n) => <option key={n.valeur} value={n.valeur}>{n.label}</option>)}
            </select>
          </div>

          {/* Thème */}
          <div className="form-group editor-form-grid--full">
            <label>Thème / Chapitre du programme</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex : Chapitre 4 — Les vecteurs du plan"
              value={form.theme ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
            />
          </div>

          {/* Trimestre */}
          <div className="form-group">
            <label>Trimestre</label>
            <select
              className="form-control"
              value={form.trimestre ?? ''}
              onChange={(e) => setForm((f) => ({
                ...f,
                trimestre: e.target.value ? (Number(e.target.value) as 1|2|3) : undefined,
              }))}
            >
              <option value="">Non précisé</option>
              <option value="1">1er trimestre (Oct–Déc)</option>
              <option value="2">2ème trimestre (Jan–Mars)</option>
              <option value="3">3ème trimestre (Avr–Juin)</option>
            </select>
          </div>

          {/* Durée standard */}
          <div className="form-group">
            <label>Durée standard d'une séance</label>
            <select
              className="form-control"
              value={form.dureeSeanceMinutes ?? 55}
              onChange={(e) => setForm((f) => ({ ...f, dureeSeanceMinutes: Number(e.target.value) }))}
            >
              {DUREES_SEANCE.map((d) => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>

          {/* Description */}
          <div className="form-group editor-form-grid--full">
            <label>Description / Contexte</label>
            <textarea
              className="form-control form-control--textarea"
              placeholder="Contexte de la séquence dans le programme, niveau de la classe, prérequis globaux..."
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Objectif général */}
          <div className="form-group editor-form-grid--full">
            <label>Objectif général</label>
            <textarea
              className="form-control form-control--textarea"
              placeholder="À la fin de cette séquence, les élèves seront capables de..."
              value={form.objectifGeneral ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, objectifGeneral: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Prérequis */}
          <div className="form-group editor-form-grid--full">
            <label>Prérequis</label>
            <textarea
              className="form-control form-control--textarea"
              placeholder="Connaissances nécessaires avant cette séquence..."
              value={form.prerequis ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, prerequis: e.target.value }))}
              rows={2}
            />
          </div>
        </div>

        {/* Compétences visées */}
        <div className="form-group" style={{ marginTop: 14 }}>
          <label>Compétences visées</label>
          <div className="competences-list">
            {(form.competences ?? []).map((c, i) => (
              <span key={i} className="competence-tag">
                {c}
                <button type="button" className="competence-tag__remove"
                  onClick={() => removeCompetence(i)} aria-label="Supprimer la compétence">
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="competence-input-row">
            <input
              type="text"
              className="form-control"
              placeholder="Ex : Résoudre une équation du second degré"
              value={newCompetence}
              onChange={(e) => setNewCompetence(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCompetence())}
            />
            <button type="button" className="btn-add-competence" onClick={addCompetence}>
              + Ajouter
            </button>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 2 — Liens (groupe, cahier)
      ════════════════════════════════════════════════════════ */}
      <section className="editor-section">
        <h2 className="editor-section__title">🔗 Liens optionnels</h2>
        <div className="editor-form-grid">

          {/* Groupe-classe */}
          <div className="form-group">
            <label>Groupe-classe</label>
            <select
              className="form-control"
              value={form.groupeClasseId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, groupeClasseId: e.target.value || undefined }))}
            >
              <option value="">Aucun groupe</option>
              {groupes.map((g) => (
                <option key={g.id} value={g.id}>{g.nom} — {g.classe}</option>
              ))}
            </select>
          </div>

          {/* Cahier de textes — filtré par classe et matière */}
{/* Cahier de textes — filtré par classe et matière */}
<div className="form-group">
  <label>Cahier de Textes</label>
  <select
    className="form-control"
    value={form.cahierDeTextesId ?? ''}
    onChange={(e) => setForm((f) => ({ ...f, cahierDeTextesId: e.target.value || undefined }))}
  >
    <option value="">— Aucun cahier —</option>
    {cahiers
      .filter((c) => {
        if (form.matiere && form.niveau)
          return c.matiere === form.matiere && c.classe === form.niveau;
        if (form.matiere) return c.matiere === form.matiere;
        if (form.niveau)  return c.classe  === form.niveau;
        return true;
      })
      .map((c) => (
        <option key={c.id} value={c.id}>
          {c.titre} · {c.classe} · {c.anneeScolaire}
        </option>
      ))}
  </select>
  {form.niveau && form.matiere &&
    cahiers.filter((c) => c.classe === form.niveau && c.matiere === form.matiere).length === 0 && (
    <p style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: 6 }}>
      ⚠️ Aucun cahier pour {form.matiere} – {form.niveau}.{' '}
      <a href="/prof/cahiers" style={{ color: '#2563eb', textDecoration: 'underline' }}>
        Créer un cahier
      </a>
    </p>
  )}
  {(!form.niveau || !form.matiere) && cahiers.length > 0 && (
    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 6 }}>
      💡 Sélectionnez la matière et le niveau pour filtrer les cahiers.
    </p>
  )}
</div>

          {/* Statut */}
          <div className="form-group">
            <label>Statut</label>
            <select
              className="form-control"
              value={form.statut ?? 'brouillon'}
              onChange={(e) => setForm((f) => ({
                ...f,
                statut: e.target.value as SequencePedagogique['statut'],
              }))}
            >
              <option value="brouillon">Brouillon</option>
              <option value="active">En cours</option>
              <option value="terminee">Terminée</option>
              <option value="archivee">Archivée</option>
            </select>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          SECTION 3 — Séances
      ════════════════════════════════════════════════════════ */}
      <section className="editor-section">
        <div className="seances-editor__header">
          <h2 className="editor-section__title" style={{ margin: 0 }}>
            📅 Séances
          </h2>
          <span className="seances-editor__count">
            {seances.length} séance{seances.length > 1 ? 's' : ''}
            {seances.filter(s => s.estEvaluation).length > 0 &&
              ` · ${seances.filter(s => s.estEvaluation).length} éval.`}
          </span>
        </div>

        {/* Liste des séances */}
        <div className="seances-list">
          {seances.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>
              Aucune séance. Utilisez le bouton ci-dessous ou générez avec l'IA.
            </p>
          ) : (
            seances.map((seance, idx) => (
              <SeanceCardEdit
                key={seance.id}
                seance={seance}
                onChange={(updated) => updateSeance(idx, updated)}
                onDelete={() => deleteSeance(idx)}
                onMoveUp={() => moveSeanceUp(idx)}
                onMoveDown={() => moveSeanceDown(idx)}
                isFirst={idx === 0}
                isLast={idx === seances.length - 1}
              />
            ))
          )}
        </div>

        {/* Bouton ajouter séance */}
        <button
          type="button"
          className="btn-add-seance"
          style={{ marginTop: 14 }}
          onClick={addSeance}
        >
          + Ajouter une séance
        </button>
      </section>

      {/* ── Barre de sauvegarde flottante ── */}
      <div style={{
        position: 'sticky',
        bottom: 16,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 10,
        background: 'rgba(248,250,252,0.95)',
        backdropFilter: 'blur(6px)',
        padding: '12px 0',
        zIndex: 10,
      }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/prof/sequences')}
          disabled={saving}
        >
          Annuler
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <><span className="spinner" /> Enregistrement...</> : (isEditMode ? '💾 Mettre à jour' : '💾 Créer la séquence')}
        </button>
      </div>
    </div>
  );
};

export default SequenceEditorPage;

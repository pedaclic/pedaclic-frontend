/**
 * ============================================================
 * PEDACLIC — Phase 16 : Composant Générateur de Contenu IA
 * ============================================================
 * Fichier : AIGenerator.tsx
 * Emplacement : src/components/generator/AIGenerator.tsx
 * 
 * Interface 5 étapes :
 *   1. Discipline + Classe + Durée de la leçon
 *   2. Saisie du chapitre
 *   3. Choix du type de contenu
 *   4. Options avancées
 *   5. Résultat (prévisualisation + sauvegarde)
 * 
 * Gate Premium : bloque l'accès aux non-abonnés
 * Prévisualisation Markdown → HTML
 * Sauvegarde dans Firestore (generated_content ou quizzes)
 * 
 * v2.1 — Classe et durée comme champs explicites obligatoires
 * ============================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  generateContent,
  saveGeneratedContent,
  saveGeneratedQuiz,
  getGeneratedHistory,
  deleteGeneratedContent,
  GENERATION_TYPE_LABELS,
  GENERATION_TYPE_DESCRIPTIONS,
  GENERATION_TYPE_ICONS,
  GenerationType,
  GenerationOptions,
  GenerationRequest,
  GenerationResponse,
  GeneratedContent,
  QuizQuestion,
} from '../../services/aiGeneratorService';

// ==================== CONSTANTES ====================

/** Classes du système éducatif sénégalais (6ème → Terminale) */
const CLASSES_SENEGAL = [
  '6ème',
  '5ème',
  '4ème',
  '3ème',
  '2nde',
  '1ère',
  'Terminale',
];

/** Options de durée prédéfinies (en minutes) */
const DUREE_OPTIONS = [30, 45, 60, 90, 120];

// ==================== INTERFACES LOCALES ====================

/** Discipline récupérée depuis Firestore */
interface DisciplineOption {
  id: string;
  nom: string;
  classe: string;
  niveau: string;
}

/** Étape courante du wizard */
type WizardStep = 1 | 2 | 3 | 4 | 5;

// ==================== COMPOSANT PRINCIPAL ====================

const AIGenerator: React.FC = () => {
  // ---- Auth context ----
  const { currentUser } = useAuth();

  // ---- États du wizard ----
  const [step, setStep] = useState<WizardStep>(1);
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineOption | null>(null);
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [dureeCours, setDureeCours] = useState<number | ''>('');
  const [chapitre, setChapitre] = useState('');
  const [selectedType, setSelectedType] = useState<GenerationType | null>(null);
  const [options, setOptions] = useState<GenerationOptions>({});

  // ---- États de génération ----
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ---- Historique ----
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<GeneratedContent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ---- Chargement initial ----
  const [loadingDisciplines, setLoadingDisciplines] = useState(true);

  // ==================== DISCIPLINES DÉDUPLIQUÉES ====================

  /**
   * Déduplique les disciplines par nom pour l'affichage.
   * Plusieurs documents Firestore peuvent exister pour une même discipline
   * (ex: "Mathématiques" en 3ème et en Terminale).
   * On ne garde qu'une entrée par nom pour la sélection.
   */
  const uniqueDisciplines = useMemo(() => {
    const seen = new Map<string, DisciplineOption>();
    disciplines.forEach((disc) => {
      if (!seen.has(disc.nom)) {
        seen.set(disc.nom, disc);
      }
    });
    return Array.from(seen.values());
  }, [disciplines]);

  // ==================== EFFETS ====================

  /** Charge les disciplines depuis Firestore au montage */
  useEffect(() => {
    const loadDisciplines = async () => {
      try {
        setLoadingDisciplines(true);
        const q = query(collection(db, 'disciplines'), orderBy('nom'));
        const snapshot = await getDocs(q);
        const disciplineList: DisciplineOption[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Ne garder que les disciplines avec un nom valide
          if (data.nom && data.nom.trim()) {
            disciplineList.push({
              id: docSnap.id,
              nom: data.nom || '',
              classe: data.classe || '',
              niveau: data.niveau || '',
            });
          }
        });

        setDisciplines(disciplineList);
      } catch (err) {
        console.error('[AIGenerator] Erreur chargement disciplines:', err);
        setError('Impossible de charger les disciplines.');
      } finally {
        setLoadingDisciplines(false);
      }
    };

    loadDisciplines();
  }, []);

  // ==================== HANDLERS ====================

  /** Sélection d'une discipline (met en surbrillance, ne change pas d'étape) */
  const handleSelectDiscipline = (disc: DisciplineOption) => {
    setSelectedDiscipline(disc);
    setError(null);
  };

  /** Validation de l'étape 1 : discipline + classe + durée (→ étape 2) */
  const handleStep1Submit = () => {
    // Vérification des champs obligatoires
    const missing: string[] = [];
    if (!selectedDiscipline) missing.push('discipline');
    if (!selectedClasse) missing.push('classe');
    if (!dureeCours || dureeCours < 1) missing.push('durée de la leçon');

    if (missing.length > 0) {
      setError(`Champs requis manquants : ${missing.join(', ')}`);
      return;
    }

    setStep(2);
    setError(null);
  };

  /** Validation du chapitre (étape 2 → 3) */
  const handleChapitreSubmit = () => {
    if (!chapitre.trim()) {
      setError('Veuillez saisir le titre du chapitre.');
      return;
    }
    setStep(3);
    setError(null);
  };

  /** Sélection du type de contenu (étape 3 → 4) */
  const handleSelectType = (type: GenerationType) => {
    setSelectedType(type);
    setStep(4);
    setError(null);
  };

  /** Retour à une étape précédente */
  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as WizardStep);
      setError(null);
      // Reset le résultat si on revient avant l'étape 5
      if (step === 5) {
        setGenerationResult(null);
        setSaveSuccess(false);
        setSavedId(null);
      }
    }
  };

  /** Reset complet du wizard */
  const handleReset = () => {
    setStep(1);
    setSelectedDiscipline(null);
    setSelectedClasse('');
    setDureeCours('');
    setChapitre('');
    setSelectedType(null);
    setOptions({});
    setGenerationResult(null);
    setError(null);
    setSaveSuccess(false);
    setSavedId(null);
  };

  /** Lancement de la génération (étape 4 → 5) */
  const handleGenerate = async () => {
    if (!selectedDiscipline || !selectedType || !chapitre.trim() || !selectedClasse) {
      setError('Paramètres incomplets. Veuillez reprendre depuis le début.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Construire les options avec la durée du cours
      const mergedOptions: GenerationOptions = {
        ...options,
        duree: typeof dureeCours === 'number' ? dureeCours : undefined,
      };

      const request: GenerationRequest = {
        type: selectedType,
        discipline: selectedDiscipline.nom,
        classe: selectedClasse,
        chapitre: chapitre.trim(),
        options: Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined,
      };

      const result = await generateContent(request);
      setGenerationResult(result);
      setStep(5);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  /** Sauvegarde du résultat dans Firestore */
  const handleSave = async () => {
    if (!currentUser || !generationResult || !selectedDiscipline || !selectedType) return;

    setIsSaving(true);
    setError(null);

    try {
      let docId: string;

      // Trouver le bon disciplineId pour la classe sélectionnée
      const matchingDisc = disciplines.find(
        (d) => d.nom === selectedDiscipline.nom && d.classe === selectedClasse
      );
      const disciplineId = matchingDisc?.id || selectedDiscipline.id;

      const requestForSave: GenerationRequest = {
        type: selectedType,
        discipline: selectedDiscipline.nom,
        classe: selectedClasse,
        chapitre: chapitre.trim(),
        options: {
          ...options,
          duree: typeof dureeCours === 'number' ? dureeCours : undefined,
        },
      };

      if (generationResult.type === 'quiz' && generationResult.data.questions) {
        // Sauvegarde comme quiz dans la collection quizzes
        docId = await saveGeneratedQuiz(
          currentUser.uid,
          requestForSave,
          generationResult.data.questions,
          disciplineId
        );
      } else {
        // Sauvegarde comme contenu dans generated_content
        docId = await saveGeneratedContent(
          currentUser.uid,
          requestForSave,
          generationResult.data.content || '',
          disciplineId
        );
      }

      setSavedId(docId);
      setSaveSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de sauvegarde';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  /** Charge l'historique des générations */
  const handleLoadHistory = async () => {
    if (!currentUser) return;

    setLoadingHistory(true);
    try {
      const items = await getGeneratedHistory(currentUser.uid);
      setHistory(items);
      setShowHistory(true);
    } catch (err) {
      console.error('[AIGenerator] Erreur historique:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  /** Supprime un élément de l'historique */
  const handleDeleteHistory = async (contentId: string) => {
    if (!window.confirm('Supprimer ce contenu généré ?')) return;
    try {
      await deleteGeneratedContent(contentId);
      setHistory((prev) => prev.filter((item) => item.id !== contentId));
    } catch (err) {
      console.error('[AIGenerator] Erreur suppression:', err);
    }
  };

  // ==================== UTILITAIRES ====================

  /** Convertit le Markdown basique en HTML pour la prévisualisation */
  const markdownToHtml = useCallback((md: string): string => {
    if (!md) return '';
    
    let html = md
      // Titres
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Gras et italique
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Listes à puces
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Listes numérotées
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Séparateurs
      .replace(/^---$/gm, '<hr />')
      // Blocs de code
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Code inline
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Paragraphes (lignes vides)
      .replace(/\n\n/g, '</p><p>')
      // Retours à la ligne
      .replace(/\n/g, '<br />');

    // Entourer les <li> dans des <ul>
    html = html.replace(/(<li>.*?<\/li>(\s*<br \/>)?)+/g, (match) => {
      return '<ul>' + match.replace(/<br \/>/g, '') + '</ul>';
    });

    return `<p>${html}</p>`;
  }, []);

  // ==================== GATE PREMIUM ====================

  // Vérification : l'utilisateur doit être connecté
  if (!currentUser) {
    return (
      <div className="ai-generator">
        {/* ---- Message non connecté ---- */}
        <div className="ai-generator__gate">
          <div className="ai-generator__gate-icon">🔒</div>
          <h2>Connexion requise</h2>
          <p>Vous devez être connecté pour accéder au générateur de contenu IA.</p>
          <Link to="/connexion" className="btn btn--primary">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  // Vérification : l'utilisateur doit être Premium
  if (!currentUser.isPremium) {
    return (
      <div className="ai-generator">
        {/* ---- Gate Premium ---- */}
        <div className="ai-generator__gate">
          <div className="ai-generator__gate-icon">✨</div>
          <h2>Fonctionnalité Premium</h2>
          <p>
            Le générateur de contenu IA est réservé aux abonnés Premium.
            Générez des cours, des exercices, des quiz et des sujets d'examen 
            adaptés au programme sénégalais en un clic !
          </p>
          <div className="ai-generator__gate-price">
            <span className="price">2 000 FCFA</span>
            <span className="period">/mois</span>
          </div>
          <Link to="/premium" className="btn btn--primary btn--lg">
            Devenir Premium
          </Link>
        </div>
      </div>
    );
  }

  // ==================== RENDU PRINCIPAL ====================

  return (
    <div className="ai-generator">
      {/* ---- En-tête ---- */}
      <div className="ai-generator__header">
        <h1 className="ai-generator__title">
          🤖 Générateur de Contenu IA
        </h1>
        <p className="ai-generator__subtitle">
          Créez des cours, exercices, quiz et sujets d'examen adaptés au programme sénégalais
        </p>

        {/* Boutons en-tête */}
        <div className="ai-generator__header-actions">
          <button
            className="btn btn--outline btn--sm"
            onClick={handleLoadHistory}
            disabled={loadingHistory}
          >
            {loadingHistory ? '⏳ Chargement...' : '📂 Historique'}
          </button>
          {step > 1 && (
            <button className="btn btn--outline btn--sm" onClick={handleReset}>
              🔄 Recommencer
            </button>
          )}
        </div>
      </div>

      {/* ---- Indicateur d'étapes ---- */}
      <div className="ai-generator__steps">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`ai-generator__step-indicator ${
              s === step ? 'ai-generator__step-indicator--active' : ''
            } ${s < step ? 'ai-generator__step-indicator--done' : ''}`}
          >
            <span className="ai-generator__step-number">
              {s < step ? '✓' : s}
            </span>
            <span className="ai-generator__step-label">
              {s === 1 && 'Paramètres'}
              {s === 2 && 'Chapitre'}
              {s === 3 && 'Type'}
              {s === 4 && 'Options'}
              {s === 5 && 'Résultat'}
            </span>
          </div>
        ))}
      </div>

      {/* ---- Message d'erreur ---- */}
      {error && (
        <div className="ai-generator__error">
          <span className="ai-generator__error-icon">⚠️</span>
          {error}
          <button
            className="ai-generator__error-close"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ---- Contenu de l'étape ---- */}
      <div className="ai-generator__content">

        {/* ============ ÉTAPE 1 : Discipline + Classe + Durée ============ */}
        {step === 1 && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              📚 Paramètres de la leçon
            </h2>

            {/* ---- Sélection de la discipline ---- */}
            <div className="ai-generator__field">
              <label className="ai-generator__label">
                Discipline <span className="ai-generator__required">*</span>
              </label>

              {loadingDisciplines ? (
                <div className="ai-generator__loading">
                  <div className="spinner"></div>
                  <p>Chargement des disciplines...</p>
                </div>
              ) : uniqueDisciplines.length === 0 ? (
                <div className="ai-generator__empty">
                  <p>Aucune discipline disponible.</p>
                </div>
              ) : (
                <div className="ai-generator__discipline-grid">
                  {uniqueDisciplines.map((disc) => (
                    <button
                      key={disc.id}
                      className={`ai-generator__discipline-card ${
                        selectedDiscipline?.nom === disc.nom
                          ? 'ai-generator__discipline-card--selected'
                          : ''
                      }`}
                      onClick={() => handleSelectDiscipline(disc)}
                    >
                      <span className="ai-generator__discipline-name">
                        {disc.nom}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ---- Sélection de la classe ---- */}
            <div className="ai-generator__field">
              <label className="ai-generator__label">
                Classe <span className="ai-generator__required">*</span>
              </label>
              <div className="ai-generator__classe-grid">
                {CLASSES_SENEGAL.map((cls) => (
                  <button
                    key={cls}
                    className={`ai-generator__classe-btn ${
                      selectedClasse === cls
                        ? 'ai-generator__classe-btn--selected'
                        : ''
                    }`}
                    onClick={() => {
                      setSelectedClasse(cls);
                      setError(null);
                    }}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- Durée de la leçon ---- */}
            <div className="ai-generator__field">
              <label htmlFor="dureeCours" className="ai-generator__label">
                Durée de la leçon (minutes) <span className="ai-generator__required">*</span>
              </label>
              <div className="ai-generator__duree-group">
                {/* Boutons rapides */}
                <div className="ai-generator__duree-presets">
                  {DUREE_OPTIONS.map((d) => (
                    <button
                      key={d}
                      className={`ai-generator__duree-btn ${
                        dureeCours === d ? 'ai-generator__duree-btn--selected' : ''
                      }`}
                      onClick={() => {
                        setDureeCours(d);
                        setError(null);
                      }}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
                {/* Saisie libre */}
                <input
                  id="dureeCours"
                  type="number"
                  className="ai-generator__input ai-generator__input--small"
                  min="15"
                  max="300"
                  step="5"
                  value={dureeCours}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setDureeCours(isNaN(val) ? '' : val);
                    setError(null);
                  }}
                  placeholder="Autre durée..."
                />
              </div>
            </div>

            {/* ---- Bouton Continuer ---- */}
            <div className="ai-generator__nav">
              <div></div> {/* Spacer pour aligner à droite */}
              <button
                className="btn btn--primary"
                onClick={handleStep1Submit}
                disabled={!selectedDiscipline || !selectedClasse || !dureeCours}
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ============ ÉTAPE 2 : Saisie du chapitre ============ */}
        {step === 2 && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              📖 Précisez le chapitre
            </h2>

            {/* Récapitulatif étape 1 */}
            <div className="ai-generator__recap">
              <span className="ai-generator__recap-label">Discipline :</span>
              <span className="ai-generator__recap-value">
                {selectedDiscipline?.nom}
              </span>
              <span className="ai-generator__recap-label">Classe :</span>
              <span className="ai-generator__recap-value">
                {selectedClasse}
              </span>
              <span className="ai-generator__recap-label">Durée :</span>
              <span className="ai-generator__recap-value">
                {dureeCours} minutes
              </span>
            </div>

            {/* Champ chapitre */}
            <div className="ai-generator__field">
              <label htmlFor="chapitre" className="ai-generator__label">
                Titre du chapitre ou du thème
              </label>
              <input
                id="chapitre"
                type="text"
                className="ai-generator__input"
                placeholder="Ex: Les fonctions affines, Le récit autobiographique, La tectonique des plaques..."
                value={chapitre}
                onChange={(e) => setChapitre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChapitreSubmit()}
                autoFocus
              />
            </div>

            {/* Boutons navigation */}
            <div className="ai-generator__nav">
              <button className="btn btn--outline" onClick={handleBack}>
                ← Retour
              </button>
              <button
                className="btn btn--primary"
                onClick={handleChapitreSubmit}
                disabled={!chapitre.trim()}
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ============ ÉTAPE 3 : Choix du type ============ */}
        {step === 3 && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              🎯 Quel type de contenu ?
            </h2>

            {/* Récapitulatif */}
            <div className="ai-generator__recap">
              <span className="ai-generator__recap-label">Discipline :</span>
              <span className="ai-generator__recap-value">
                {selectedDiscipline?.nom}
              </span>
              <span className="ai-generator__recap-label">Classe :</span>
              <span className="ai-generator__recap-value">
                {selectedClasse}
              </span>
              <span className="ai-generator__recap-label">Durée :</span>
              <span className="ai-generator__recap-value">
                {dureeCours} minutes
              </span>
              <span className="ai-generator__recap-label">Chapitre :</span>
              <span className="ai-generator__recap-value">{chapitre}</span>
            </div>

            {/* Grille des types */}
            <div className="ai-generator__type-grid">
              {(Object.keys(GENERATION_TYPE_LABELS) as GenerationType[]).map(
                (type) => (
                  <button
                    key={type}
                    className="ai-generator__type-card"
                    onClick={() => handleSelectType(type)}
                  >
                    <span className="ai-generator__type-icon">
                      {GENERATION_TYPE_ICONS[type]}
                    </span>
                    <span className="ai-generator__type-name">
                      {GENERATION_TYPE_LABELS[type]}
                    </span>
                    <span className="ai-generator__type-desc">
                      {GENERATION_TYPE_DESCRIPTIONS[type]}
                    </span>
                  </button>
                )
              )}
            </div>

            {/* Bouton retour */}
            <div className="ai-generator__nav">
              <button className="btn btn--outline" onClick={handleBack}>
                ← Retour
              </button>
            </div>
          </div>
        )}

        {/* ============ ÉTAPE 4 : Options avancées ============ */}
        {step === 4 && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              ⚙️ Options de génération
            </h2>

            {/* Récapitulatif complet */}
            <div className="ai-generator__recap">
              <span className="ai-generator__recap-label">Discipline :</span>
              <span className="ai-generator__recap-value">
                {selectedDiscipline?.nom}
              </span>
              <span className="ai-generator__recap-label">Classe :</span>
              <span className="ai-generator__recap-value">
                {selectedClasse}
              </span>
              <span className="ai-generator__recap-label">Durée :</span>
              <span className="ai-generator__recap-value">
                {dureeCours} minutes
              </span>
              <span className="ai-generator__recap-label">Chapitre :</span>
              <span className="ai-generator__recap-value">{chapitre}</span>
              <span className="ai-generator__recap-label">Type :</span>
              <span className="ai-generator__recap-value">
                {selectedType && GENERATION_TYPE_ICONS[selectedType]}{' '}
                {selectedType && GENERATION_TYPE_LABELS[selectedType]}
              </span>
            </div>

            {/* Options selon le type */}
            <div className="ai-generator__options">
              {/* Difficulté (tous types) */}
              <div className="ai-generator__field">
                <label className="ai-generator__label">
                  Niveau de difficulté
                </label>
                <div className="ai-generator__radio-group">
                  {(['facile', 'moyen', 'difficile'] as const).map((level) => (
                    <label key={level} className="ai-generator__radio">
                      <input
                        type="radio"
                        name="difficulte"
                        value={level}
                        checked={options.difficulte === level}
                        onChange={() =>
                          setOptions((prev) => ({ ...prev, difficulte: level }))
                        }
                      />
                      <span className="ai-generator__radio-label">
                        {level === 'facile' && '🟢 Facile'}
                        {level === 'moyen' && '🟡 Moyen'}
                        {level === 'difficile' && '🔴 Difficile'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Type d'examen (sujet_examen uniquement) */}
              {selectedType === 'sujet_examen' && (
                <div className="ai-generator__field">
                  <label className="ai-generator__label">Type d'examen</label>
                  <div className="ai-generator__radio-group">
                    {(['BFEM', 'BAC'] as const).map((exam) => (
                      <label key={exam} className="ai-generator__radio">
                        <input
                          type="radio"
                          name="typeExamen"
                          value={exam}
                          checked={options.typeExamen === exam}
                          onChange={() =>
                            setOptions((prev) => ({ ...prev, typeExamen: exam }))
                          }
                        />
                        <span className="ai-generator__radio-label">
                          {exam}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Objectifs pédagogiques (optionnel) */}
              <div className="ai-generator__field">
                <label htmlFor="objectifs" className="ai-generator__label">
                  Objectifs pédagogiques (optionnel)
                </label>
                <textarea
                  id="objectifs"
                  className="ai-generator__textarea"
                  rows={3}
                  placeholder="Ex: L'élève doit être capable de résoudre une équation du 1er degré..."
                  value={options.objectifs || ''}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      objectifs: e.target.value || undefined,
                    }))
                  }
                />
              </div>

              {/* Consignes spéciales (optionnel) */}
              <div className="ai-generator__field">
                <label htmlFor="consignes" className="ai-generator__label">
                  Consignes spéciales (optionnel)
                </label>
                <textarea
                  id="consignes"
                  className="ai-generator__textarea"
                  rows={2}
                  placeholder="Ex: Inclure un exercice sur les statistiques, utiliser des exemples avec le football..."
                  value={options.consignesSpeciales || ''}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      consignesSpeciales: e.target.value || undefined,
                    }))
                  }
                />
              </div>
            </div>

            {/* Boutons navigation */}
            <div className="ai-generator__nav">
              <button className="btn btn--outline" onClick={handleBack}>
                ← Retour
              </button>
              <button
                className="btn btn--primary btn--lg"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="spinner spinner--sm"></span>
                    Génération en cours...
                  </>
                ) : (
                  '🚀 Générer le contenu'
                )}
              </button>
            </div>

            {/* Message d'attente */}
            {isGenerating && (
              <div className="ai-generator__generating">
                <div className="ai-generator__generating-animation">
                  <span>🤖</span>
                  <span>📝</span>
                  <span>✨</span>
                </div>
                <p>
                  L'IA rédige votre{' '}
                  {selectedType && GENERATION_TYPE_LABELS[selectedType].toLowerCase()}...
                </p>
                <p className="ai-generator__generating-hint">
                  Cela peut prendre 15 à 30 secondes.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============ ÉTAPE 5 : Résultat ============ */}
        {step === 5 && generationResult && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              ✅ Contenu généré
            </h2>

            {/* Récapitulatif final */}
            <div className="ai-generator__recap ai-generator__recap--success">
              <span className="ai-generator__recap-label">Type :</span>
              <span className="ai-generator__recap-value">
                {selectedType && GENERATION_TYPE_ICONS[selectedType]}{' '}
                {selectedType && GENERATION_TYPE_LABELS[selectedType]}
              </span>
              <span className="ai-generator__recap-label">Discipline :</span>
              <span className="ai-generator__recap-value">
                {selectedDiscipline?.nom}
              </span>
              <span className="ai-generator__recap-label">Classe :</span>
              <span className="ai-generator__recap-value">
                {selectedClasse}
              </span>
              <span className="ai-generator__recap-label">Durée :</span>
              <span className="ai-generator__recap-value">
                {dureeCours} minutes
              </span>
              <span className="ai-generator__recap-label">Chapitre :</span>
              <span className="ai-generator__recap-value">{chapitre}</span>
            </div>

            {/* Prévisualisation du contenu */}
            <div className="ai-generator__preview">
              <div className="ai-generator__preview-header">
                <h3>Prévisualisation</h3>
                <button
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    const text =
                      generationResult.type === 'quiz'
                        ? JSON.stringify(generationResult.data.questions, null, 2)
                        : generationResult.data.content || '';
                    navigator.clipboard.writeText(text);
                    alert('Contenu copié dans le presse-papier !');
                  }}
                >
                  📋 Copier
                </button>
              </div>

              <div className="ai-generator__preview-body">
                {generationResult.type === 'quiz' &&
                generationResult.data.questions ? (
                  /* ---- Prévisualisation Quiz ---- */
                  <div className="ai-generator__quiz-preview">
                    <p className="ai-generator__quiz-count">
                      {generationResult.data.questions.length} questions générées
                    </p>
                    {generationResult.data.questions.map(
                      (q: QuizQuestion, i: number) => (
                        <div key={i} className="ai-generator__quiz-item">
                          <div className="ai-generator__quiz-question">
                            <strong>Q{i + 1}.</strong> {q.question}
                            <span
                              className={`ai-generator__quiz-badge ai-generator__quiz-badge--${q.difficulte}`}
                            >
                              {q.difficulte}
                            </span>
                          </div>
                          <div className="ai-generator__quiz-options">
                            {q.options.map((opt: string, j: number) => (
                              <div
                                key={j}
                                className={`ai-generator__quiz-option ${
                                  j === q.reponseCorrecte
                                    ? 'ai-generator__quiz-option--correct'
                                    : ''
                                }`}
                              >
                                <span className="ai-generator__quiz-option-letter">
                                  {String.fromCharCode(65 + j)}
                                </span>
                                {opt}
                                {j === q.reponseCorrecte && ' ✅'}
                              </div>
                            ))}
                          </div>
                          {q.explication && (
                            <div className="ai-generator__quiz-explanation">
                              💡 {q.explication}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  /* ---- Prévisualisation Markdown → HTML ---- */
                  <div
                    className="ai-generator__markdown-preview"
                    dangerouslySetInnerHTML={{
                      __html: markdownToHtml(
                        generationResult.data.content || ''
                      ),
                    }}
                  />
                )}
              </div>
            </div>

            {/* Actions de sauvegarde */}
            <div className="ai-generator__actions">
              {saveSuccess ? (
                <div className="ai-generator__save-success">
                  <span>✅ Sauvegardé avec succès !</span>
                  {generationResult.type === 'quiz' && savedId && (
                    <Link
                      to={`/quiz/${savedId}`}
                      className="btn btn--outline btn--sm"
                    >
                      🎯 Voir le quiz
                    </Link>
                  )}
                </div>
              ) : (
                <button
                  className="btn btn--primary btn--lg"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner spinner--sm"></span>
                      Sauvegarde...
                    </>
                  ) : (
                    <>💾 Sauvegarder dans PedaClic</>
                  )}
                </button>
              )}

              <button className="btn btn--outline" onClick={handleReset}>
                🔄 Nouvelle génération
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== MODAL HISTORIQUE ==================== */}
      {showHistory && (
        <div
          className="ai-generator__modal-overlay"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="ai-generator__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ai-generator__modal-header">
              <h2>📂 Historique des générations</h2>
              <button
                className="ai-generator__modal-close"
                onClick={() => setShowHistory(false)}
              >
                ✕
              </button>
            </div>

            <div className="ai-generator__modal-body">
              {history.length === 0 ? (
                <p className="ai-generator__empty">
                  Aucun contenu généré pour le moment.
                </p>
              ) : (
                <div className="ai-generator__history-list">
                  {history.map((item) => (
                    <div key={item.id} className="ai-generator__history-item">
                      <div className="ai-generator__history-info">
                        <span className="ai-generator__history-type">
                          {GENERATION_TYPE_ICONS[item.type]}{' '}
                          {GENERATION_TYPE_LABELS[item.type]}
                        </span>
                        <span className="ai-generator__history-details">
                          {item.discipline} ({item.classe}) — {item.chapitre}
                        </span>
                        <span className="ai-generator__history-date">
                          {item.createdAt?.toDate
                            ? item.createdAt.toDate().toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Date inconnue'}
                        </span>
                      </div>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => item.id && handleDeleteHistory(item.id)}
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGenerator;

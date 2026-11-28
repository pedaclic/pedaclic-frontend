/**
 * ============================================================================
 * PedaClic — Phase 60 : Éditeur de questions des quiz CLASSIQUES (QCM)
 * ============================================================================
 * Composant partagé par :
 *   - l'admin       : components/admin/QuizManager.tsx      (/admin/quiz)
 *   - le prof Premium : pages/ProfQuizClassicCreatePage.tsx (/prof/quiz/classique/nouveau)
 *                     pages/ProfQuizClassicEditPage.tsx     (/prof/quiz/classique/:id/modifier)
 *
 * Il remplace les blocs « questions » propres à chaque page, qui ne
 * permettaient que d'ajouter / supprimer une question ou de modifier son
 * texte. Il ajoute, SANS changer le format des données (`Question` de
 * quizService) :
 *   • réordonner les questions (boutons ↑ ↓ et glisser-déposer par la poignée) ;
 *   • insérer une question à un endroit précis, dupliquer, supprimer (avec confirmation) ;
 *   • ajouter / retirer des options de réponse (de 2 à 6), réordonner les options ;
 *   • modifier l'explication, la difficulté et les points de chaque question ;
 *   • actions groupées : appliquer une difficulté / un barème à toutes les questions ;
 *   • tout déplier / tout replier, et signalement visuel des questions incomplètes.
 *
 * Compatibilité : les lecteurs de quiz affichent déjà `question.options.map(...)`
 * et corrigent par index (`reponseCorrecte`) → un nombre d'options différent de
 * 4 est pris en charge sans modification des lecteurs.
 *
 * Composant « contrôlé » : l'état des questions appartient à la page parente
 * (props `questions` + `onChange`). Seul l'état d'affichage (questions
 * dépliées, glisser-déposer) est interne.
 *
 * Placement : src/components/quiz/EditeurQuestionsClassiques.tsx
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  CheckCircle,
  AlertTriangle,
  CornerDownRight,
  X,
} from 'lucide-react';
import type { Question } from '../../services/quizService';
import { createEmptyQuestion, generateQuestionId } from '../../services/quizService';
import { useConfirm } from '../../contexts/ConfirmContext';
import '../../styles/EditeurQuestionsClassiques.css';

/* ══════════════════════════════════════════════
   CONSTANTES
   ══════════════════════════════════════════════ */

/** Nombre minimal / maximal d'options de réponse par question. */
export const NB_OPTIONS_MIN = 2;
export const NB_OPTIONS_MAX = 6;

/** Barème autorisé par question (aligné sur l'ancien champ admin, élargi à 20). */
const POINTS_MIN = 1;
const POINTS_MAX = 20;

/** Niveaux de difficulté (valeurs stockées inchangées). */
const DIFFICULTES = [
  { valeur: 'facile', libelle: 'Facile' },
  { valeur: 'moyen', libelle: 'Moyen' },
  { valeur: 'difficile', libelle: 'Difficile' },
] as const;

/* ══════════════════════════════════════════════
   VALIDATION (exportée pour les pages parentes)
   ══════════════════════════════════════════════ */

/**
 * Problèmes d'une question (liste vide = question complète).
 * Utilisé pour l'icône d'alerte ET par `validerQuestionsClassiques`.
 */
export function problemesQuestion(q: Question): string[] {
  const problemes: string[] = [];
  if (!q.question?.trim()) problemes.push("pas d'énoncé");
  const options = q.options || [];
  if (options.length < NB_OPTIONS_MIN) problemes.push(`moins de ${NB_OPTIONS_MIN} options`);
  if (options.some((o) => !o?.trim())) problemes.push('option(s) vide(s)');
  if (q.reponseCorrecte < 0 || q.reponseCorrecte >= options.length) {
    problemes.push('bonne réponse non définie');
  }
  return problemes;
}

/**
 * Valide l'ensemble des questions avant enregistrement définitif / publication.
 * @returns un message d'erreur lisible, ou `null` si tout est correct.
 */
export function validerQuestionsClassiques(questions: Question[]): string | null {
  if (questions.length === 0) return 'Le quiz doit contenir au moins une question.';
  for (let i = 0; i < questions.length; i++) {
    const p = problemesQuestion(questions[i]);
    if (p.length > 0) return `Question ${i + 1} : ${p.join(', ')}.`;
  }
  return null;
}

/* ══════════════════════════════════════════════
   PROPS
   ══════════════════════════════════════════════ */

interface EditeurQuestionsClassiquesProps {
  /** Questions du quiz (état détenu par la page parente). */
  questions: Question[];
  /** Appelé à chaque modification avec la nouvelle liste complète. */
  onChange: (questions: Question[]) => void;
  /** Nombre minimal de questions conservées (suppression bloquée en dessous). Défaut : 1. */
  minQuestions?: number;
  /** Déplier toutes les questions à l'ouverture (vue prof historique). Défaut : false. */
  deplierParDefaut?: boolean;
}

/* ══════════════════════════════════════════════
   COMPOSANT
   ══════════════════════════════════════════════ */

const EditeurQuestionsClassiques: React.FC<EditeurQuestionsClassiquesProps> = ({
  questions,
  onChange,
  minQuestions = 1,
  deplierParDefaut = false,
}) => {
  const confirmer = useConfirm();

  /* ── États d'affichage ── */
  // IDs des questions dépliées
  const [depliees, setDepliees] = useState<Set<string>>(
    () => new Set(deplierParDefaut ? questions.map((q) => q.id) : [])
  );
  // Glisser-déposer : question saisie par la poignée / question survolée
  const [idPoigneeActive, setIdPoigneeActive] = useState<string | null>(null);
  const [indexGlisse, setIndexGlisse] = useState<number | null>(null);
  const [indexSurvol, setIndexSurvol] = useState<number | null>(null);
  // Actions groupées
  const [difficulteGroupee, setDifficulteGroupee] = useState('');
  const [pointsGroupes, setPointsGroupes] = useState('');

  /* ── Statistiques d'en-tête ── */
  const totalPoints = questions.reduce((s, q) => s + (Number(q.points) || 1), 0);
  const nbIncompletes = questions.filter((q) => problemesQuestion(q).length > 0).length;

  /* ══════════════════════════════════════════════
     OUTILS INTERNES
     ══════════════════════════════════════════════ */

  /** Remplace la question d'ID donné par une version modifiée. */
  const majQuestion = (id: string, modif: Partial<Question>) => {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...modif } : q)));
  };

  /** Ouvre / ferme une question. */
  const basculer = (id: string) => {
    setDepliees((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  /** Ouvre une question (utilisé après ajout / duplication). */
  const deplier = (id: string) => setDepliees((prev) => new Set(prev).add(id));

  /** Déplace une question de `de` vers `vers` (indices). */
  const deplacer = (de: number, vers: number) => {
    if (vers < 0 || vers >= questions.length || de === vers) return;
    const liste = [...questions];
    const [element] = liste.splice(de, 1);
    liste.splice(vers, 0, element);
    onChange(liste);
  };

  /* ══════════════════════════════════════════════
     ACTIONS SUR LES QUESTIONS
     ══════════════════════════════════════════════ */

  /** Ajoute une question vide à la fin, ou juste après l'index donné. */
  const ajouter = (apresIndex?: number) => {
    const nouvelle = createEmptyQuestion();
    const liste = [...questions];
    const position = apresIndex === undefined ? liste.length : apresIndex + 1;
    liste.splice(position, 0, nouvelle);
    onChange(liste);
    deplier(nouvelle.id);
  };

  /** Duplique une question (copie insérée juste après l'originale). */
  const dupliquer = (index: number) => {
    const source = questions[index];
    const copie: Question = {
      ...source,
      options: [...(source.options || [])],
      id: generateQuestionId(),
      question: source.question ? `${source.question} (copie)` : '',
    };
    const liste = [...questions];
    liste.splice(index + 1, 0, copie);
    onChange(liste);
    deplier(copie.id);
  };

  /** Supprime une question après confirmation (sauf si elle est vide). */
  const supprimer = async (index: number) => {
    if (questions.length <= minQuestions) return;
    const q = questions[index];
    const estVide = !q.question?.trim() && (q.options || []).every((o) => !o?.trim());
    if (!estVide) {
      const ok = await confirmer({
        title: 'Supprimer la question ?',
        message: `La question ${index + 1} sera retirée du quiz (définitif après enregistrement).`,
        confirmLabel: 'Supprimer',
        variant: 'danger',
      });
      if (!ok) return;
    }
    onChange(questions.filter((_, i) => i !== index));
  };

  /* ══════════════════════════════════════════════
     ACTIONS SUR LES OPTIONS
     ══════════════════════════════════════════════ */

  /** Modifie le texte d'une option. */
  const majOption = (q: Question, iOpt: number, valeur: string) => {
    majQuestion(q.id, { options: q.options.map((o, i) => (i === iOpt ? valeur : o)) });
  };

  /** Ajoute une option vide (dans la limite de NB_OPTIONS_MAX). */
  const ajouterOption = (q: Question) => {
    if (q.options.length >= NB_OPTIONS_MAX) return;
    majQuestion(q.id, { options: [...q.options, ''] });
  };

  /**
   * Retire une option (minimum NB_OPTIONS_MIN) en conservant la bonne réponse :
   *  - option retirée AVANT la bonne réponse → l'index de la bonne réponse recule de 1 ;
   *  - option retirée = la bonne réponse      → la 1re option devient la bonne réponse.
   */
  const retirerOption = (q: Question, iOpt: number) => {
    if (q.options.length <= NB_OPTIONS_MIN) return;
    let bonne = q.reponseCorrecte;
    if (iOpt < bonne) bonne -= 1;
    else if (iOpt === bonne) bonne = 0;
    majQuestion(q.id, {
      options: q.options.filter((_, i) => i !== iOpt),
      reponseCorrecte: bonne,
    });
  };

  /** Échange une option avec sa voisine (la bonne réponse « suit » son texte). */
  const deplacerOption = (q: Question, iOpt: number, sens: -1 | 1) => {
    const cible = iOpt + sens;
    if (cible < 0 || cible >= q.options.length) return;
    const options = [...q.options];
    [options[iOpt], options[cible]] = [options[cible], options[iOpt]];
    let bonne = q.reponseCorrecte;
    if (bonne === iOpt) bonne = cible;
    else if (bonne === cible) bonne = iOpt;
    majQuestion(q.id, { options, reponseCorrecte: bonne });
  };

  /* ══════════════════════════════════════════════
     ACTIONS GROUPÉES
     ══════════════════════════════════════════════ */

  const appliquerDifficulte = () => {
    if (!difficulteGroupee) return;
    onChange(questions.map((q) => ({ ...q, difficulte: difficulteGroupee })));
    setDifficulteGroupee('');
  };

  const appliquerPoints = () => {
    const pts = parseInt(pointsGroupes, 10);
    if (!pts || pts < POINTS_MIN || pts > POINTS_MAX) return;
    onChange(questions.map((q) => ({ ...q, points: pts })));
    setPointsGroupes('');
  };

  /* ══════════════════════════════════════════════
     GLISSER-DÉPOSER (HTML5, souris)
     Le déplacement n'est armé que depuis la poignée ⠿ pour ne pas gêner
     la sélection de texte dans les champs. Sur mobile, utiliser ↑ ↓.
     ══════════════════════════════════════════════ */

  const surDebutGlisse = (e: React.DragEvent, index: number) => {
    setIndexGlisse(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox exige une donnée pour démarrer le glisser
    e.dataTransfer.setData('text/plain', String(index));
  };

  const surSurvol = (e: React.DragEvent, index: number) => {
    if (indexGlisse === null) return;
    e.preventDefault(); // autorise le dépôt
    if (indexSurvol !== index) setIndexSurvol(index);
  };

  const surDepot = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (indexGlisse !== null) deplacer(indexGlisse, index);
    surFinGlisse();
  };

  const surFinGlisse = () => {
    setIndexGlisse(null);
    setIndexSurvol(null);
    setIdPoigneeActive(null);
  };

  /* ══════════════════════════════════════════════
     RENDU
     ══════════════════════════════════════════════ */

  return (
    <div className="eqc">
      {/* ── Barre d'outils ── */}
      <div className="eqc-barre">
        <div className="eqc-barre-infos">
          <strong>{questions.length}</strong> question(s) · <strong>{totalPoints}</strong> pt(s)
          {nbIncompletes > 0 && (
            <span className="eqc-alerte-resume" title="Questions à compléter avant publication">
              <AlertTriangle size={14} /> {nbIncompletes} incomplète(s)
            </span>
          )}
        </div>

        <div className="eqc-barre-actions">
          <button
            type="button"
            className="eqc-btn eqc-btn--leger"
            onClick={() => setDepliees(new Set(questions.map((q) => q.id)))}
          >
            Tout déplier
          </button>
          <button
            type="button"
            className="eqc-btn eqc-btn--leger"
            onClick={() => setDepliees(new Set())}
          >
            Tout replier
          </button>
        </div>
      </div>

      {/* ── Actions groupées (dès 2 questions) ── */}
      {questions.length > 1 && (
        <div className="eqc-groupe">
          <span className="eqc-groupe-titre">Pour toutes les questions :</span>
          <div className="eqc-groupe-champ">
            <select
              value={difficulteGroupee}
              onChange={(e) => setDifficulteGroupee(e.target.value)}
              aria-label="Difficulté à appliquer à toutes les questions"
            >
              <option value="">Difficulté…</option>
              {DIFFICULTES.map((d) => (
                <option key={d.valeur} value={d.valeur}>{d.libelle}</option>
              ))}
            </select>
            <button
              type="button"
              className="eqc-btn eqc-btn--contour"
              disabled={!difficulteGroupee}
              onClick={appliquerDifficulte}
            >
              Appliquer
            </button>
          </div>
          <div className="eqc-groupe-champ">
            <input
              type="number"
              min={POINTS_MIN}
              max={POINTS_MAX}
              placeholder="Points…"
              value={pointsGroupes}
              onChange={(e) => setPointsGroupes(e.target.value)}
              aria-label="Points à appliquer à toutes les questions"
            />
            <button
              type="button"
              className="eqc-btn eqc-btn--contour"
              disabled={!pointsGroupes}
              onClick={appliquerPoints}
            >
              Appliquer
            </button>
          </div>
        </div>
      )}

      {/* ── Liste des questions ── */}
      {questions.length === 0 ? (
        <div className="eqc-vide">Aucune question. Cliquez sur « Ajouter une question ».</div>
      ) : (
        <ol className="eqc-liste">
          {questions.map((q, index) => {
            const ouverte = depliees.has(q.id);
            const problemes = problemesQuestion(q);
            const classes = [
              'eqc-item',
              ouverte ? 'eqc-item--ouvert' : '',
              problemes.length > 0 ? 'eqc-item--incomplet' : '',
              indexGlisse === index ? 'eqc-item--glisse' : '',
              indexSurvol === index && indexGlisse !== index ? 'eqc-item--cible' : '',
            ].join(' ');

            return (
              <li
                key={q.id}
                className={classes}
                draggable={idPoigneeActive === q.id}
                onDragStart={(e) => surDebutGlisse(e, index)}
                onDragOver={(e) => surSurvol(e, index)}
                onDrop={(e) => surDepot(e, index)}
                onDragEnd={surFinGlisse}
              >
                {/* ── En-tête de la question ── */}
                <div className="eqc-entete">
                  {/* Poignée de glisser-déposer */}
                  <span
                    className="eqc-poignee"
                    title="Glisser pour déplacer"
                    onMouseDown={() => setIdPoigneeActive(q.id)}
                    onMouseUp={() => setIdPoigneeActive(null)}
                  >
                    <GripVertical size={16} />
                  </span>

                  {/* Zone cliquable : déplier / replier */}
                  <button
                    type="button"
                    className="eqc-entete-titre"
                    onClick={() => basculer(q.id)}
                    aria-expanded={ouverte}
                  >
                    <span className="eqc-numero">Q{index + 1}</span>
                    <span className="eqc-apercu">{q.question || 'Question sans énoncé…'}</span>
                    {problemes.length > 0 && (
                      <span className="eqc-alerte" title={`À compléter : ${problemes.join(', ')}`}>
                        <AlertTriangle size={14} />
                      </span>
                    )}
                    <span className={`eqc-badge eqc-badge--${q.difficulte || 'moyen'}`}>
                      {DIFFICULTES.find((d) => d.valeur === q.difficulte)?.libelle || 'Moyen'}
                    </span>
                    <span className="eqc-points">{q.points || 1} pt(s)</span>
                    {ouverte ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {/* Boutons d'ordre (toujours visibles, utiles sur mobile) */}
                  <div className="eqc-entete-ordre">
                    <button
                      type="button"
                      className="eqc-icone"
                      onClick={() => deplacer(index, index - 1)}
                      disabled={index === 0}
                      title="Monter"
                      aria-label={`Monter la question ${index + 1}`}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="eqc-icone"
                      onClick={() => deplacer(index, index + 1)}
                      disabled={index === questions.length - 1}
                      title="Descendre"
                      aria-label={`Descendre la question ${index + 1}`}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                </div>

                {/* ── Corps dépliable ── */}
                {ouverte && (
                  <div className="eqc-corps">
                    {/* Énoncé */}
                    <label className="eqc-label" htmlFor={`enonce-${q.id}`}>Énoncé *</label>
                    <textarea
                      id={`enonce-${q.id}`}
                      className="eqc-champ"
                      rows={2}
                      placeholder="Ex : Quelle est l'unité SI de la puissance ?"
                      value={q.question}
                      onChange={(e) => majQuestion(q.id, { question: e.target.value })}
                    />

                    {/* Options de réponse */}
                    <span className="eqc-label">
                      Options de réponse ({q.options.length}/{NB_OPTIONS_MAX}) — cochez la bonne réponse
                    </span>
                    <div className="eqc-options">
                      {q.options.map((opt, iOpt) => {
                        const correcte = q.reponseCorrecte === iOpt;
                        return (
                          <div key={iOpt} className={`eqc-option ${correcte ? 'eqc-option--correcte' : ''}`}>
                            <button
                              type="button"
                              className="eqc-option-radio"
                              onClick={() => majQuestion(q.id, { reponseCorrecte: iOpt })}
                              title={correcte ? 'Bonne réponse' : 'Marquer comme bonne réponse'}
                              aria-pressed={correcte}
                            >
                              {correcte ? <CheckCircle size={16} /> : String.fromCharCode(65 + iOpt)}
                            </button>
                            <input
                              type="text"
                              className="eqc-champ"
                              placeholder={`Option ${String.fromCharCode(65 + iOpt)}`}
                              value={opt}
                              onChange={(e) => majOption(q, iOpt, e.target.value)}
                            />
                            <button
                              type="button"
                              className="eqc-icone"
                              onClick={() => deplacerOption(q, iOpt, -1)}
                              disabled={iOpt === 0}
                              title="Monter l'option"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              className="eqc-icone"
                              onClick={() => deplacerOption(q, iOpt, 1)}
                              disabled={iOpt === q.options.length - 1}
                              title="Descendre l'option"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              className="eqc-icone eqc-icone--danger"
                              onClick={() => retirerOption(q, iOpt)}
                              disabled={q.options.length <= NB_OPTIONS_MIN}
                              title={`Retirer l'option (minimum ${NB_OPTIONS_MIN})`}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {q.options.length < NB_OPTIONS_MAX && (
                      <button
                        type="button"
                        className="eqc-btn eqc-btn--leger eqc-ajout-option"
                        onClick={() => ajouterOption(q)}
                      >
                        <Plus size={14} /> Ajouter une option
                      </button>
                    )}

                    {/* Explication */}
                    <label className="eqc-label" htmlFor={`explication-${q.id}`}>
                      Explication (affichée après la réponse)
                    </label>
                    <textarea
                      id={`explication-${q.id}`}
                      className="eqc-champ"
                      rows={2}
                      placeholder="Ex : P = W / t ; l'unité est le watt (W)."
                      value={q.explication || ''}
                      onChange={(e) => majQuestion(q.id, { explication: e.target.value })}
                    />

                    {/* Difficulté + points */}
                    <div className="eqc-meta">
                      <div>
                        <label className="eqc-label" htmlFor={`diff-${q.id}`}>Difficulté</label>
                        <select
                          id={`diff-${q.id}`}
                          className="eqc-champ"
                          value={q.difficulte || 'moyen'}
                          onChange={(e) => majQuestion(q.id, { difficulte: e.target.value })}
                        >
                          {DIFFICULTES.map((d) => (
                            <option key={d.valeur} value={d.valeur}>{d.libelle}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="eqc-label" htmlFor={`pts-${q.id}`}>Points</label>
                        <input
                          id={`pts-${q.id}`}
                          type="number"
                          className="eqc-champ"
                          min={POINTS_MIN}
                          max={POINTS_MAX}
                          value={q.points || 1}
                          onChange={(e) =>
                            majQuestion(q.id, {
                              points: Math.min(POINTS_MAX, Math.max(POINTS_MIN, parseInt(e.target.value, 10) || 1)),
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Actions de la question */}
                    <div className="eqc-actions">
                      <button type="button" className="eqc-btn eqc-btn--contour" onClick={() => ajouter(index)}>
                        <CornerDownRight size={14} /> Insérer une question après
                      </button>
                      <button type="button" className="eqc-btn eqc-btn--contour" onClick={() => dupliquer(index)}>
                        <Copy size={14} /> Dupliquer
                      </button>
                      <button
                        type="button"
                        className="eqc-btn eqc-btn--danger"
                        onClick={() => supprimer(index)}
                        disabled={questions.length <= minQuestions}
                        title={questions.length <= minQuestions ? 'Le quiz doit garder au moins une question' : undefined}
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* ── Ajout en fin de liste ── */}
      <button type="button" className="eqc-btn eqc-btn--primaire eqc-ajout" onClick={() => ajouter()}>
        <Plus size={16} /> Ajouter une question
      </button>
    </div>
  );
};

export default EditeurQuestionsClassiques;

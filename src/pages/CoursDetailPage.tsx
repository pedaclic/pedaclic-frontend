// ============================================================
// PedaClic — Phase 24 : CoursDetailPage.tsx — Lecture élève
// Route : /cours/:coursId
// Accès : Tous (sections Premium nécessitent abonnement)
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { aAccesCours } from '../services/premiumCoursService';
import {
  getCoursById,
  getSectionsCours,
  extractYoutubeId,
} from '../services/coursService';
import {
  getProgression,
  initProgression,
  marquerSectionLue,
  enregistrerReponseQuiz,
} from '../services/progressionCoursService';
import type {
  CoursEnLigne,
  SectionCours,
  BlocContenu,
  BlocTexte,
  BlocImage,
  BlocVideo,
  BlocEncadre,
  BlocQuiz,
  BlocExercice,
  ProgressionCours,
} from '../cours_types';
import { CONFIG_ENCADRE, NIVEAUX_COURS } from '../cours_types';
import '../styles/CoursEnLigne.css';

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANTS — Rendu de chaque type de bloc
// ─────────────────────────────────────────────────────────────

/** Rendu du bloc texte avec Markdown simplifié */
function RenduTexte({ bloc }: { bloc: BlocTexte }) {
  // Conversion Markdown basique vers HTML
  const html = bloc.contenu
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  return (
    <div
      className="bloc-texte"
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
    />
  );
}

/** Rendu du bloc image */
function RenduImage({ bloc }: { bloc: BlocImage }) {
  return (
    <figure className="bloc-image">
      <img src={bloc.url} alt={bloc.alt} loading="lazy" />
      {bloc.legende && <figcaption>{bloc.legende}</figcaption>}
    </figure>
  );
}

/** Rendu du bloc vidéo YouTube */
function RenduVideo({ bloc }: { bloc: BlocVideo }) {
  const videoId = extractYoutubeId(bloc.urlYoutube);
  if (!videoId) return null;
  return (
    <div className="bloc-video">
      {bloc.titre && <h4 className="bloc-video__titre">▶ {bloc.titre}</h4>}
      {bloc.description && <p className="bloc-video__description">{bloc.description}</p>}
      <div className="bloc-video__embed">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={bloc.titre || 'Vidéo pédagogique'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
}

/** Rendu du bloc encadré (définition, remarque, etc.) */
function RenduEncadre({ bloc }: { bloc: BlocEncadre }) {
  const config = CONFIG_ENCADRE[bloc.variante];
  return (
    <div
      className="bloc-encadre"
      style={{
        background: config.bg,
        borderLeftColor: config.border,
        color: config.color,
      }}
    >
      <p className="bloc-encadre__titre">
        {config.emoji} {bloc.titre}
      </p>
      <p className="bloc-encadre__contenu">{bloc.contenu}</p>
    </div>
  );
}

/** Rendu du bloc quiz interactif */
function RenduQuiz({
  bloc,
  onReponse,
  reponseExistante,
}: {
  bloc: BlocQuiz;
  onReponse: (optionId: string, estCorrecte: boolean) => void;
  reponseExistante?: string; // ID de l'option déjà choisie
}) {
  const [optionChoisie, setOptionChoisie] = useState<string | null>(
    reponseExistante ?? null
  );
  const dejaRepondu = optionChoisie !== null;

  function choisirOption(optionId: string, estCorrecte: boolean) {
    if (dejaRepondu) return;
    setOptionChoisie(optionId);
    onReponse(optionId, estCorrecte);
  }

  return (
    <div className="bloc-quiz">
      <p className="bloc-quiz__question">❓ {bloc.question}</p>
      <div className="bloc-quiz__options">
        {bloc.options.map(option => {
          let statut = '';
          if (dejaRepondu) {
            if (option.id === optionChoisie) {
              statut = option.estCorrecte ? 'correct' : 'incorrect';
            } else if (option.estCorrecte) {
              statut = 'attendu'; // Affiche la bonne réponse après erreur
            }
          }
          return (
            <button
              key={option.id}
              className={`bloc-quiz__option bloc-quiz__option--${statut || 'neutre'}`}
              onClick={() => choisirOption(option.id, option.estCorrecte)}
              disabled={dejaRepondu}
              aria-pressed={option.id === optionChoisie}
            >
              {statut === 'correct' && '✅ '}
              {statut === 'incorrect' && '❌ '}
              {statut === 'attendu' && '👉 '}
              {option.texte}
            </button>
          );
        })}
      </div>
      {dejaRepondu && bloc.explication && (
        <div className="bloc-quiz__explication">
          💡 <strong>Explication :</strong> {bloc.explication}
        </div>
      )}
    </div>
  );
}

/** Rendu du bloc exercice avec correction masquée */
function RenduExercice({ bloc }: { bloc: BlocExercice }) {
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const diffColors = {
    facile: '#16a34a',
    moyen: '#ca8a04',
    difficile: '#dc2626',
  };
  return (
    <div className="bloc-exercice">
      <div className="bloc-exercice__header">
        <span className="bloc-exercice__titre">✏️ Exercice</span>
        <span
          className="bloc-exercice__difficulte"
          style={{ color: diffColors[bloc.difficulte] }}
        >
          {bloc.difficulte.charAt(0).toUpperCase() + bloc.difficulte.slice(1)}
          {bloc.points && ` — ${bloc.points} pt${bloc.points > 1 ? 's' : ''}`}
        </span>
      </div>
      <p className="bloc-exercice__enonce">{bloc.enonce}</p>
      {!correctionVisible ? (
        <button
          className="btn-secondary btn--sm"
          onClick={() => setCorrectionVisible(true)}
        >
          👁 Voir la correction
        </button>
      ) : (
        <div className="bloc-exercice__correction">
          <p className="bloc-exercice__correction-titre">✅ Correction</p>
          <p>{bloc.correction}</p>
        </div>
      )}
    </div>
  );
}

/** Dispatche le rendu selon le type de bloc */
function RenduBloc({
  bloc,
  isPremiumVerrou,
  onReponseQuiz,
  reponseExistante,
}: {
  bloc: BlocContenu;
  isPremiumVerrou: boolean;
  onReponseQuiz: (blocId: string, optionId: string, estCorrecte: boolean) => void;
  reponseExistante?: string;
}) {
  if (isPremiumVerrou) {
    return (
      <div className="bloc-premium-verrou" aria-label="Contenu Premium">
        <span>⭐</span>
        <p>Ce contenu est réservé aux abonnés Premium.</p>
      </div>
    );
  }

  switch (bloc.type) {
    case 'texte':    return <RenduTexte bloc={bloc as BlocTexte} />;
    case 'image':    return <RenduImage bloc={bloc as BlocImage} />;
    case 'video':    return <RenduVideo bloc={bloc as BlocVideo} />;
    case 'encadre':  return <RenduEncadre bloc={bloc as BlocEncadre} />;
    case 'quiz':
      return (
        <RenduQuiz
          bloc={bloc as BlocQuiz}
          reponseExistante={reponseExistante}
          onReponse={(optionId, estCorrecte) =>
            onReponseQuiz(bloc.id, optionId, estCorrecte)
          }
        />
      );
    case 'exercice': return <RenduExercice bloc={bloc as BlocExercice} />;
    default:         return null;
  }
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : Lecture d'un cours
// ─────────────────────────────────────────────────────────────

export default function CoursDetailPage() {
  const { coursId } = useParams<{ coursId: string }>();
  const navigate = useNavigate();
  const { currentUser: user } = useAuth();
  const userIsPremium = user?.isPremium ?? false;
  const userHasAccess = userIsPremium && aAccesCours(
    coursId || '',
    userIsPremium,
    user?.subscriptionPlan,
    user?.coursChoisis ?? []
  );

  // ── Données ───────────────────────────────────────────────
  const [cours, setCours] = useState<CoursEnLigne | null>(null);
  const [sections, setSections] = useState<SectionCours[]>([]);
  const [progression, setProgression] = useState<ProgressionCours | null>(null);
  const [sectionActive, setSectionActive] = useState<string | null>(null);

  // ── États UI ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Référence pour scroll auto vers section active
  const sectionRef = useRef<HTMLDivElement>(null);

  // ── Chargement ────────────────────────────────────────────
  useEffect(() => {
    if (coursId) charger();
  }, [coursId, user]);
  async function charger() {
    if (!coursId) return;
    setLoading(true);
    setError(null);
    try {
      // Chargement cours + sections en parallèle
      const [coursData, sectionsData] = await Promise.all([
        getCoursById(coursId),
        getSectionsCours(coursId),
      ]);

      if (!coursData || coursData.statut !== 'publie') {
        setError('Ce cours n\'est pas disponible.');
        setLoading(false);
        return;
      }

      setCours(coursData);
      setSections(sectionsData);

      // Activer la première section par défaut
      if (sectionsData.length > 0) {
        setSectionActive(sectionsData[0].id);
      }

      // Progression utilisateur (si connecté)
      if (user) {
        // Vérifier isPremium depuis Firestore (via votre système existant)
        // On suppose que l'utilisateur a un champ isPremium dans son profil
        // À adapter selon votre AuthContext existant
        let prog = await getProgression(user.uid, coursId);
        if (!prog) {
          await initProgression(user.uid, coursId);
          prog = await getProgression(user.uid, coursId);
        }
        setProgression(prog);
      }
    } catch (err) {
      console.error('[CoursDetailPage] Erreur chargement :', err);
      setError('Erreur de chargement. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  /** Vérifie si l'élève a 60% aux quiz de la section pour pouvoir passer. */
  function aReussiQuizSection(section: SectionCours): boolean {
    const quizBlocs = section.blocs.filter(b => b.type === 'quiz');
    if (quizBlocs.length === 0) return true;
    const reponsesSection = progression?.reponsesQuiz.filter(r =>
      quizBlocs.some(q => q.id === r.blocId)
    ) ?? [];
    if (reponsesSection.length < quizBlocs.length) return false;
    const correctes = reponsesSection.filter(r => r.estCorrecte).length;
    const score = (correctes / quizBlocs.length) * 100;
    return score >= 60;
  }

  // ── Marquer section comme lue ─────────────────────────────
  async function handleSectionLue(sectionId: string) {
    if (!user || !progression || !cours) return;

    // Vérifier si déjà lue
    if (progression.sectionsLues.includes(sectionId)) return;

    const section = sections.find(s => s.id === sectionId);
    if (section && !aReussiQuizSection(section)) {
      setError('Réussissez les quiz de cette section (60% minimum) pour continuer.');
      return;
    }

    try {
      await marquerSectionLue(progression.id, sectionId, cours.nombreSections);
      // Mettre à jour l'état local optimistiquement
      setProgression(prev => prev ? {
        ...prev,
        sectionsLues: [...prev.sectionsLues, sectionId],
        pourcentageProgression: Math.round(
          ((prev.sectionsLues.length + 1) / cours.nombreSections) * 100
        ),
      } : null);
    } catch (err) {
      console.error('[CoursDetailPage] Erreur marquer section :', err);
    }
  }

  // ── Enregistrer réponse quiz ──────────────────────────────
  async function handleReponseQuiz(
    blocId: string,
    optionId: string,
    estCorrecte: boolean
  ) {
    if (!user || !progression) return;
    try {
      await enregistrerReponseQuiz(progression.id, {
        blocId,
        optionChoisieId: optionId,
        estCorrecte,
        reponduAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('[CoursDetailPage] Erreur enregistrement quiz :', err);
    }
  }

  // ── Vérification accès Premium ────────────────────────────
  function peutAccederSection(section: SectionCours): boolean {
    // La 1ère section est toujours accessible (aperçu)
    if (section.estGratuite || section.ordre === 1) return true;
    // Si le cours est gratuit, toutes les sections sont accessibles
    if (!cours?.isPremium) return true;
    // Si l'utilisateur a accès (illimité ou cours choisi), accès total
    if (userHasAccess) return true;
    return false;
  }

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="cours-detail__loading" aria-busy="true">
        <div className="spinner spinner--blue" />
        <p>Chargement du cours...</p>
      </div>
    );
  }

  if (error || !cours) {
    return (
      <div className="cours-detail__erreur" role="alert">
        <span aria-hidden="true">📭</span>
        <p>{error ?? 'Cours introuvable.'}</p>
        <button className="btn-secondary" onClick={() => navigate('/cours')}>
          ← Retour au catalogue
        </button>
      </div>
    );
  }

  const niveauLabel = NIVEAUX_COURS.find(n => n.valeur === cours.niveau)?.label ?? cours.niveau;
  const sectionCourante = sections.find(s => s.id === sectionActive);
  const peutAcceder = sectionCourante ? peutAccederSection(sectionCourante) : false;

  return (
    <div className="cours-detail">

      {/* ══════════════════════════════════════════════════════
          EN-TÊTE — Titre, meta, progression
      ══════════════════════════════════════════════════════ */}
      <header className="cours-detail__header">
        {/* Fil d'Ariane */}
        <p className="cours-detail__breadcrumb">
          <button className="btn-link" onClick={() => navigate('/cours')}>
            📚 Cours
          </button>
          {' / '}
          <span>{cours.matiere}</span>
          {' / '}
          <span>{cours.titre}</span>
        </p>

        <div className="cours-detail__header-grid">
          {/* Infos principales */}
          <div>
            <div className="cours-detail__badges">
              <span className="badge badge--matiere">{cours.matiere}</span>
              <span className="badge badge--niveau">{niveauLabel}</span>
              {cours.isPremium
                ? <span className="badge badge--premium">⭐ Premium</span>
                : <span className="badge badge--gratuit">✅ Gratuit</span>
              }
            </div>
            <h1 className="cours-detail__titre">{cours.titre}</h1>
            <p className="cours-detail__description">{cours.description}</p>
            <p className="cours-detail__prof">👨‍🏫 Cours de <strong>{cours.profNom}</strong></p>

            {/* Objectifs */}
            {cours.objectifs.length > 0 && (
              <div className="cours-detail__objectifs">
                <h3>🎯 Objectifs du cours</h3>
                <ul>
                  {cours.objectifs.map((obj, i) => <li key={i}>{obj}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Barre de progression (si connecté) */}
          {user && progression && (
            <div className="cours-detail__progression-card">
              <h3>📈 Ma progression</h3>
              <div className="progression-bar">
                <div
                  className="progression-bar__fill"
                  style={{ width: `${progression.pourcentageProgression}%` }}
                  role="progressbar"
                  aria-valuenow={progression.pourcentageProgression}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <p className="progression-bar__label">
                {progression.pourcentageProgression}% — {progression.sectionsLues.length}/{cours.nombreSections} section{cours.nombreSections > 1 ? 's' : ''} lue{progression.sectionsLues.length > 1 ? 's' : ''}
              </p>
              {progression.scoreQuiz > 0 && (
                <p className="progression-bar__score">
                  🏆 Score quiz : <strong>{progression.scoreQuiz}%</strong>
                </p>
              )}
              {progression.estTermine && (
                <div className="cours-detail__termine-badge">
                  🎉 Cours terminé !
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          LAYOUT : Sidebar sections + Contenu principal
      ══════════════════════════════════════════════════════ */}
      <div className="cours-detail__layout">

        {/* ── Sidebar : liste des sections ────────────────── */}
        <nav className="cours-detail__sidebar" aria-label="Sections du cours">
          <h2 className="cours-detail__sidebar-titre">📋 Sections</h2>
          <ol className="cours-detail__sections-liste">
            {sections.map((section) => {
              const estLue = progression?.sectionsLues.includes(section.id) ?? false;
              const estActive = section.id === sectionActive;
              const acces = peutAccederSection(section);

              return (
                <li key={section.id}>
                  <button
                    className={[
                      'cours-detail__section-btn',
                      estActive  ? 'cours-detail__section-btn--active'  : '',
                      estLue     ? 'cours-detail__section-btn--lue'     : '',
                      !acces     ? 'cours-detail__section-btn--verrou'  : '',
                    ].join(' ')}
                    onClick={() => setSectionActive(section.id)}
                    aria-current={estActive ? 'true' : undefined}
                  >
                    {/* Icône statut */}
                    <span className="cours-detail__section-icone" aria-hidden="true">
                      {!acces ? '🔒' : estLue ? '✅' : `${section.ordre}.`}
                    </span>
                    {/* Titre section */}
                    <span className="cours-detail__section-nom">{section.titre}</span>
                    {/* Durée */}
                    <span className="cours-detail__section-duree">{section.dureeEstimee} min</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* ── Contenu de la section active ────────────────── */}
        <main className="cours-detail__contenu" ref={sectionRef} aria-live="polite">
          {sectionCourante ? (
            <>
              {/* En-tête de section */}
              <div className="cours-detail__section-header">
                <h2 className="cours-detail__section-titre">
                  {sectionCourante.ordre}. {sectionCourante.titre}
                </h2>
                <span className="cours-detail__section-duree-label">
                  ⏱ {sectionCourante.dureeEstimee} min de lecture
                </span>
              </div>

              {/* Verrou Premium sur toute la section */}
              {!peutAcceder ? (
                <div className="cours-detail__premium-gate">
                  <span className="cours-detail__premium-gate-icon" aria-hidden="true">⭐</span>
                  <h3>Contenu Premium</h3>
                  <p>
                    Cette section nécessite un abonnement Premium PedaClic.<br />
                    Formules à partir de <strong>1 000 FCFA/mois</strong> (1 cours) jusqu'à l'accès illimité.
                  </p>
                  {user ? (
                    <div className="cours-detail__premium-gate-actions">
                      <button
                        className="btn-primary"
                        onClick={() => navigate('/premium')}
                      >
                        ✨ Découvrir les formules
                      </button>
                      {user.isPremium && (
                        <button
                          className="btn-secondary"
                          onClick={() => navigate('/premium/mes-cours')}
                        >
                          📚 Choisir mes cours
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() => navigate('/connexion')}
                    >
                      Se connecter pour accéder
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Rendu des blocs de la section */}
                  <div className="cours-detail__blocs">
                    {sectionCourante.blocs
                      .sort((a, b) => a.ordre - b.ordre)
                      .map(bloc => {
                        const verrou = bloc.isPremium && !userIsPremium && !sectionCourante.estGratuite;
                        const reponseQuiz = progression?.reponsesQuiz
                          .find(r => r.blocId === bloc.id)?.optionChoisieId;

                        return (
                          <div key={bloc.id} className={`cours-detail__bloc cours-detail__bloc--${bloc.type}`}>
                            <RenduBloc
                              bloc={bloc}
                              isPremiumVerrou={verrou}
                              onReponseQuiz={handleReponseQuiz}
                              reponseExistante={reponseQuiz}
                            />
                          </div>
                        );
                      })}
                  </div>

                  {/* Bouton "Marquer comme lu" */}
                  {user && !(progression?.sectionsLues.includes(sectionCourante.id)) && (
                    <div className="cours-detail__action-lu">
                      <button
                        className="btn-primary"
                        onClick={() => handleSectionLue(sectionCourante.id)}
                      >
                        ✅ Marquer cette section comme lue
                      </button>
                    </div>
                  )}

                    {/* Navigation entre sections */}
                  <div className="cours-detail__nav-sections">
                    {!aReussiQuizSection(sectionCourante) && sectionCourante.blocs.some(b => b.type === 'quiz') && (
                      <p className="cours-detail__quiz-requis" role="alert">
                        ⚠️ Réussissez les quiz de cette section (60% minimum) pour passer à la suite.
                      </p>
                    )}
                    {/* Section précédente */}
                    {sectionCourante.ordre > 1 && (
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          const prev = sections.find(s => s.ordre === sectionCourante.ordre - 1);
                          if (prev) setSectionActive(prev.id);
                        }}
                      >
                        ← Section précédente
                      </button>
                    )}
                    {/* Section suivante */}
                    {sectionCourante.ordre < sections.length && (
                      <button
                        className="btn-primary"
                        onClick={() => {
                          if (!aReussiQuizSection(sectionCourante) && sectionCourante.blocs.some(b => b.type === 'quiz')) return;
                          const next = sections.find(s => s.ordre === sectionCourante.ordre + 1);
                          if (next) setSectionActive(next.id);
                        }}
                      >
                        Section suivante →
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="cours-detail__vide-section" role="status">
              <p>Sélectionnez une section dans le menu de gauche pour commencer.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

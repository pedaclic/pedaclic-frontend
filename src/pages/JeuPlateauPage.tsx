// ============================================================
// PedaClic — Jeu de plateau pédagogique « Le Sentier du Savoir »
// Route : /eleve/jeu
//
// Outil ludique (type « jeu de l'oie ») pour aider les élèves à
// assimiler règles et concepts par le jeu. Chaque joueur lance le
// dé, avance sur le parcours et répond à des questions ILLUSTRÉES.
//
// ► AUTONOME & CONFIGURABLE :
//   - Aucune dépendance réseau : tout le contenu d'exemple est
//     embarqué ci-dessous dans la constante THEMES.
//   - Pour ajouter / modifier un thème ou des questions, il suffit
//     d'éditer THEMES (structure simple : énoncé, illustration emoji,
//     options, bonne réponse, explication).
//   - La disposition du plateau est définie dans PLATEAU_TYPES et peut
//     être ajustée (nombre de cases, types) sans toucher à la logique.
// ============================================================

import React, { useMemo, useState, useCallback } from 'react';
import '../styles/JeuPlateau.css';

// ─────────────────────────────────────────────────────────────
// 1) TYPES
// ─────────────────────────────────────────────────────────────

/** Une question illustrée à choix multiple. */
interface Question {
  id: string;
  illustration: string; // Emoji servant d'« image » (autonome, sans asset externe)
  enonce: string;
  options: string[];
  bonneReponse: number; // Index de la bonne option
  explication: string;
}

/** Un thème regroupe une famille de questions. */
interface Theme {
  id: string;
  nom: string;
  emoji: string;
  description: string;
  questions: Question[];
}

/** Type d'une case du plateau. */
type CaseType = 'depart' | 'arrivee' | 'question' | 'bonus' | 'malus' | 'rejouer' | 'vide';

/** Un joueur (pion) en cours de partie. */
interface Joueur {
  id: number;
  nom: string;
  couleur: string;
  position: number;
}

// ─────────────────────────────────────────────────────────────
// 2) CONTENU D'EXEMPLE (modifiable par l'enseignant)
//    Quatre thèmes couvrant plusieurs disciplines / niveaux.
// ─────────────────────────────────────────────────────────────

const THEMES: Theme[] = [
  {
    id: 'maths',
    nom: 'Mathématiques',
    emoji: '➗',
    description: 'Calcul, géométrie et logique de base.',
    questions: [
      { id: 'm1', illustration: '🔢', enonce: 'Combien font 7 × 8 ?', options: ['54', '56', '64', '49'], bonneReponse: 1, explication: '7 × 8 = 56.' },
      { id: 'm2', illustration: '📐', enonce: "Combien de côtés a un triangle ?", options: ['3', '4', '5', '6'], bonneReponse: 0, explication: 'Un triangle a 3 côtés.' },
      { id: 'm3', illustration: '➕', enonce: 'Quel est le résultat de 125 + 75 ?', options: ['200', '190', '210', '180'], bonneReponse: 0, explication: '125 + 75 = 200.' },
      { id: 'm4', illustration: '🍕', enonce: 'La moitié de 3/4 vaut…', options: ['3/8', '1/2', '3/2', '1/4'], bonneReponse: 0, explication: 'La moitié de 3/4 = 3/8.' },
      { id: 'm5', illustration: '⏰', enonce: 'Combien de minutes dans 2 heures ?', options: ['100', '120', '90', '140'], bonneReponse: 1, explication: '2 × 60 = 120 minutes.' },
      { id: 'm6', illustration: '🔺', enonce: "L'angle droit mesure…", options: ['45°', '60°', '90°', '180°'], bonneReponse: 2, explication: "Un angle droit mesure 90°." },
    ],
  },
  {
    id: 'francais',
    nom: 'Français',
    emoji: '📚',
    description: 'Grammaire, conjugaison et vocabulaire.',
    questions: [
      { id: 'f1', illustration: '✍️', enonce: "Quel est le pluriel de « cheval » ?", options: ['chevals', 'chevaux', 'chevales', 'chevaus'], bonneReponse: 1, explication: 'Le pluriel de cheval est chevaux.' },
      { id: 'f2', illustration: '🗣️', enonce: "« Je (aller) à l'école » au présent :", options: ['vais', 'vas', 'va', 'allons'], bonneReponse: 0, explication: "Je vais (verbe aller, 1re pers.)." },
      { id: 'f3', illustration: '🔤', enonce: 'Un mot qui décrit un nom est un…', options: ['verbe', 'adjectif', 'adverbe', 'pronom'], bonneReponse: 1, explication: "L'adjectif qualifie le nom." },
      { id: 'f4', illustration: '📖', enonce: "Le contraire de « rapide » est…", options: ['vif', 'lent', 'fort', 'léger'], bonneReponse: 1, explication: "L'antonyme de rapide est lent." },
      { id: 'f5', illustration: '❓', enonce: "Quelle phrase est correcte ?", options: ['Il mange une pomme.', 'Il manger une pomme.', 'Il mangé une pomme.', 'Il mangent une pomme.'], bonneReponse: 0, explication: 'Présent : il mange.' },
      { id: 'f6', illustration: '🅰️', enonce: 'Combien de voyelles dans « éducation » ?', options: ['4', '5', '6', '3'], bonneReponse: 1, explication: 'é-u-a-i-o = 5 voyelles.' },
    ],
  },
  {
    id: 'sciences',
    nom: 'Sciences & Nature',
    emoji: '🔬',
    description: 'Le corps, la nature et la planète.',
    questions: [
      { id: 's1', illustration: '🌍', enonce: 'Quelle planète habitons-nous ?', options: ['Mars', 'La Terre', 'Vénus', 'Jupiter'], bonneReponse: 1, explication: 'Nous vivons sur la Terre.' },
      { id: 's2', illustration: '💧', enonce: "L'eau bout à…", options: ['50 °C', '80 °C', '100 °C', '120 °C'], bonneReponse: 2, explication: "L'eau bout à 100 °C (au niveau de la mer)." },
      { id: 's3', illustration: '🌳', enonce: 'Que produisent les plantes le jour ?', options: ['Du gaz carbonique', "De l'oxygène", "De l'azote", 'Du méthane'], bonneReponse: 1, explication: "Par la photosynthèse, les plantes produisent de l'oxygène." },
      { id: 's4', illustration: '🦴', enonce: 'Le squelette humain sert surtout à…', options: ['digérer', 'soutenir le corps', 'respirer', 'penser'], bonneReponse: 1, explication: 'Le squelette soutient et protège le corps.' },
      { id: 's5', illustration: '☀️', enonce: 'Quelle est notre principale source de lumière ?', options: ['La Lune', 'Le Soleil', 'Les étoiles', 'Les nuages'], bonneReponse: 1, explication: 'Le Soleil est notre source de lumière et de chaleur.' },
      { id: 's6', illustration: '🐝', enonce: 'Les abeilles aident les plantes en…', options: ['les arrosant', 'les pollinisant', 'les coupant', 'les mangeant'], bonneReponse: 1, explication: 'Les abeilles transportent le pollen (pollinisation).' },
    ],
  },
  {
    id: 'citoyennete',
    nom: 'Vivre ensemble',
    emoji: '🤝',
    description: 'Citoyenneté, respect et règles de vie.',
    questions: [
      { id: 'c1', illustration: '🚦', enonce: 'Au feu rouge, le piéton doit…', options: ['traverser vite', "s'arrêter et attendre", 'courir', 'reculer'], bonneReponse: 1, explication: 'Au feu rouge, on attend le feu vert pour traverser.' },
      { id: 'c2', illustration: '🗑️', enonce: 'Où jette-t-on un papier ?', options: ['par terre', 'dans la poubelle', 'dans la rue', "dans l'eau"], bonneReponse: 1, explication: 'On garde la classe propre : à la poubelle.' },
      { id: 'c3', illustration: '🙋', enonce: 'En classe, pour parler on…', options: ['crie', 'lève la main', 'tape sur la table', 'se lève'], bonneReponse: 1, explication: 'On lève la main et on attend son tour.' },
      { id: 'c4', illustration: '🤲', enonce: 'Un camarade est tombé. Je…', options: ['je me moque', "je l'aide", 'je pars', "je l'ignore"], bonneReponse: 1, explication: "L'entraide et le respect sont essentiels." },
      { id: 'c5', illustration: '🌐', enonce: 'Respecter les autres, c\'est…', options: ['les écouter', 'les bousculer', 'se moquer', 'les ignorer'], bonneReponse: 0, explication: 'Le respect commence par l\'écoute.' },
      { id: 'c6', illustration: '🤐', enonce: 'Quand quelqu\'un parle, je…', options: ['parle plus fort', "j'écoute", 'je sors', 'je dors'], bonneReponse: 1, explication: 'On écoute la personne qui parle.' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// 3) DISPOSITION DU PLATEAU (30 cases)
//    'D' départ · 'A' arrivée · 'Q' question · 'B' bonus (+2)
//    'M' malus (-2) · 'R' rejouer · '.' case neutre
// ─────────────────────────────────────────────────────────────

const PLATEAU_CODES = [
  'D', 'Q', 'Q', 'B', 'Q', 'Q',
  'M', 'Q', 'R', 'Q', 'Q', 'B',
  'Q', 'Q', 'M', 'Q', 'B', 'Q',
  'Q', 'R', 'Q', 'M', 'Q', 'Q',
  'B', 'Q', 'Q', 'M', 'Q', 'A',
] as const;

const COLONNES = 6;

/** Couleurs des pions (jusqu'à 4 joueurs). */
const COULEURS_JOUEURS = ['#2563eb', '#dc2626', '#16a34a', '#d97706'];

/** Convertit un code en type de case lisible. */
function codeVersType(code: string): CaseType {
  switch (code) {
    case 'D': return 'depart';
    case 'A': return 'arrivee';
    case 'Q': return 'question';
    case 'B': return 'bonus';
    case 'M': return 'malus';
    case 'R': return 'rejouer';
    default:  return 'vide';
  }
}

/** Emoji représentatif d'un type de case (affiché sur le plateau). */
function emojiCase(type: CaseType): string {
  switch (type) {
    case 'depart':   return '🏁';
    case 'arrivee':  return '🏆';
    case 'question': return '❓';
    case 'bonus':    return '⭐';
    case 'malus':    return '⚠️';
    case 'rejouer':  return '🔁';
    default:         return '·';
  }
}

const DERNIERE_CASE = PLATEAU_CODES.length - 1;

// ─────────────────────────────────────────────────────────────
// 4) COMPOSANT
// ─────────────────────────────────────────────────────────────

const JeuPlateauPage: React.FC = () => {
  // Phase du jeu : configuration → partie en cours → fin.
  const [phase, setPhase] = useState<'config' | 'jeu'>('config');

  // Paramètres choisis avant de démarrer.
  const [themeId, setThemeId] = useState<string>(THEMES[0].id);
  const [nbJoueurs, setNbJoueurs] = useState<number>(2);

  // État de la partie.
  const [joueurs, setJoueurs] = useState<Joueur[]>([]);
  const [tour, setTour] = useState<number>(0);          // Index du joueur courant
  const [deValeur, setDeValeur] = useState<number>(1);
  const [deRoule, setDeRoule] = useState<boolean>(false);
  const [enAttente, setEnAttente] = useState<boolean>(false); // Bloque le dé pendant une animation/question
  const [gagnant, setGagnant] = useState<Joueur | null>(null);
  const [journal, setJournal] = useState<string[]>([]);

  // Question en cours (null si aucune modale ouverte).
  const [question, setQuestion] = useState<Question | null>(null);
  const [reponseChoisie, setReponseChoisie] = useState<number | null>(null);

  const themeChoisi = useMemo(
    () => THEMES.find((t) => t.id === themeId) ?? THEMES[0],
    [themeId],
  );

  // Types des cases (constants), calculés une fois.
  const cases = useMemo(() => PLATEAU_CODES.map((c) => codeVersType(c)), []);

  // Pioche d'une question aléatoire dans le thème courant.
  const piocherQuestion = useCallback((): Question => {
    const qs = themeChoisi.questions;
    return qs[Math.floor(Math.random() * qs.length)];
  }, [themeChoisi]);

  /** Ajoute une ligne en tête du journal (les plus récentes en haut). */
  const log = useCallback((msg: string) => {
    setJournal((j) => [msg, ...j].slice(0, 30));
  }, []);

  // ── Démarrage de la partie ──
  const demarrer = () => {
    const liste: Joueur[] = Array.from({ length: nbJoueurs }, (_, i) => ({
      id: i,
      nom: `Joueur ${i + 1}`,
      couleur: COULEURS_JOUEURS[i],
      position: 0,
    }));
    setJoueurs(liste);
    setTour(0);
    setDeValeur(1);
    setGagnant(null);
    setJournal([`🎲 La partie commence avec ${nbJoueurs} joueur(s) — thème : ${themeChoisi.nom}.`]);
    setQuestion(null);
    setReponseChoisie(null);
    setEnAttente(false);
    setPhase('jeu');
  };

  /** Passe au joueur suivant (sans changer de joueur s'il rejoue). */
  const joueurSuivant = useCallback(() => {
    setTour((t) => (t + 1) % nbJoueurs);
  }, [nbJoueurs]);

  /** Borne une position dans l'intervalle [0, DERNIERE_CASE]. */
  const borner = (p: number) => Math.max(0, Math.min(DERNIERE_CASE, p));

  /** Fixe la position absolue d'un joueur (mise à jour fonctionnelle sûre). */
  const fixerPosition = useCallback((joueurIndex: number, pos: number) => {
    setJoueurs((prev) =>
      prev.map((j, idx) => (idx === joueurIndex ? { ...j, position: pos } : j)),
    );
  }, []);

  /**
   * Résout l'effet de la case sur laquelle un joueur vient d'arriver.
   * Renvoie true si le tour doit passer au joueur suivant immédiatement,
   * false si une interaction (question) est en attente ou si le joueur rejoue.
   */
  const resoudreCase = useCallback(
    (joueurIndex: number, position: number): boolean => {
      const type = cases[position];
      const joueur = joueurs[joueurIndex];
      const nom = joueur?.nom ?? `Joueur ${joueurIndex + 1}`;

      if (type === 'arrivee') {
        log(`🏆 ${nom} atteint l'arrivée et remporte la partie !`);
        setGagnant({ ...joueur, position });
        return false;
      }
      if (type === 'bonus') {
        const p = borner(position + 2);
        fixerPosition(joueurIndex, p);
        log(`⭐ ${nom} tombe sur une case bonus : avance de 2 (case ${p + 1}).`);
        if (cases[p] === 'arrivee') { setGagnant({ ...joueur, position: p }); log(`🏆 ${nom} gagne !`); return false; }
        return true;
      }
      if (type === 'malus') {
        const p = borner(position - 2);
        fixerPosition(joueurIndex, p);
        log(`⚠️ ${nom} tombe sur une case malus : recule de 2 (case ${p + 1}).`);
        return true;
      }
      if (type === 'rejouer') {
        log(`🔁 ${nom} rejoue !`);
        return false; // même joueur, pas de passage de tour
      }
      if (type === 'question') {
        // Ouvre la modale de question : le tour se résout à la réponse.
        setQuestion(piocherQuestion());
        setReponseChoisie(null);
        return false;
      }
      // Case neutre / départ : rien de spécial.
      return true;
    },
    [cases, joueurs, fixerPosition, log, piocherQuestion],
  );

  // ── Lancer le dé ──
  const lancerDe = () => {
    if (enAttente || gagnant || question) return;
    setEnAttente(true);
    setDeRoule(true);

    const valeur = 1 + Math.floor(Math.random() * 6);
    const joueurIndex = tour;

    // Petite temporisation pour l'animation du dé.
    window.setTimeout(() => {
      setDeValeur(valeur);
      setDeRoule(false);

      const joueur = joueurs[joueurIndex];
      const nom = joueur?.nom ?? `Joueur ${joueurIndex + 1}`;
      const nouvellePos = borner((joueur?.position ?? 0) + valeur);
      fixerPosition(joueurIndex, nouvellePos);
      log(`🎲 ${nom} fait ${valeur} et avance case ${nouvellePos + 1}.`);

      // resoudreCase renvoie false si une question s'ouvre, si le joueur
      // rejoue, ou s'il a gagné → dans ces cas, on NE passe PAS le tour ici.
      const passerTour = resoudreCase(joueurIndex, nouvellePos);
      const ouvreQuestion = cases[nouvellePos] === 'question';
      if (passerTour) joueurSuivant();
      // On reste « en attente » uniquement tant qu'une question est ouverte ;
      // fermerQuestion() lèvera ce verrou. Sinon, on déverrouille le dé.
      setEnAttente(ouvreQuestion);
    }, 450);
  };

  // ── Répondre à une question ──
  const repondre = (index: number) => {
    if (reponseChoisie !== null || !question) return;
    setReponseChoisie(index);
    const joueurIndex = tour;
    const joueur = joueurs[joueurIndex];
    const nom = joueur?.nom ?? `Joueur ${joueurIndex + 1}`;
    const correct = index === question.bonneReponse;
    const base = joueur?.position ?? 0; // position déjà à jour (case question)

    if (correct) {
      const p = borner(base + 1); // bonne réponse : petit bonus +1
      fixerPosition(joueurIndex, p);
      log(`✅ ${nom} répond correctement : avance d'1 case (case ${p + 1}).`);
      if (cases[p] === 'arrivee') { setGagnant({ ...joueur, position: p }); log(`🏆 ${nom} gagne !`); }
    } else {
      const p = borner(base - 2); // mauvaise réponse : recule de 2
      fixerPosition(joueurIndex, p);
      log(`❌ ${nom} se trompe : recule de 2 cases (case ${p + 1}).`);
    }
  };

  /** Ferme la modale de question et passe la main. */
  const fermerQuestion = () => {
    setQuestion(null);
    setReponseChoisie(null);
    setEnAttente(false);
    if (!gagnant) joueurSuivant();
  };

  /** Rejoue une nouvelle partie (revient à l'écran de configuration). */
  const rejouer = () => {
    setPhase('config');
    setGagnant(null);
    setQuestion(null);
    setJoueurs([]);
  };

  // ─────────────────────────────────────────────────────────────
  // RENDU — Écran de configuration
  // ─────────────────────────────────────────────────────────────
  if (phase === 'config') {
    return (
      <div className="jeu-plateau-page">
        <header className="jeu-entete">
          <h1>🎲 Le Sentier du Savoir</h1>
          <p>
            Lance le dé, avance sur le plateau et réponds aux questions illustrées
            pour atteindre le trophée. Apprendre en s'amusant !
          </p>
        </header>

        <div className="jeu-config">
          <h2>1. Choisis un thème</h2>
          <div className="jeu-themes-grille">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`jeu-theme-carte ${themeId === t.id ? 'actif' : ''}`}
                onClick={() => setThemeId(t.id)}
                aria-pressed={themeId === t.id}
              >
                <span className="emoji">{t.emoji}</span>
                <span className="nom">{t.nom}</span>
                <span className="desc">{t.description}</span>
              </button>
            ))}
          </div>

          <h2>2. Nombre de joueurs</h2>
          <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                className={`jeu-theme-carte ${nbJoueurs === n ? 'actif' : ''}`}
                style={{ width: 64, textAlign: 'center' }}
                onClick={() => setNbJoueurs(n)}
                aria-pressed={nbJoueurs === n}
              >
                <span className="emoji" style={{ marginBottom: 0 }}>
                  {'👤'.repeat(n)}
                </span>
                <span className="nom" style={{ display: 'block', textAlign: 'center' }}>{n}</span>
              </button>
            ))}
          </div>

          <button type="button" className="jeu-btn jeu-btn-primaire" onClick={demarrer} style={{ maxWidth: 260 }}>
            ▶️ Commencer la partie
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDU — Partie en cours
  // ─────────────────────────────────────────────────────────────
  const joueurCourant = joueurs[tour];

  // Construit l'ordre d'affichage en serpentin (lignes paires →, impaires ←).
  const lignes: number[][] = [];
  for (let r = 0; r * COLONNES < PLATEAU_CODES.length; r++) {
    const debut = r * COLONNES;
    const ligne = PLATEAU_CODES.slice(debut, debut + COLONNES).map((_, i) => debut + i);
    lignes.push(r % 2 === 1 ? [...ligne].reverse() : ligne);
  }

  return (
    <div className="jeu-plateau-page">
      <header className="jeu-entete">
        <h1>🎲 {themeChoisi.emoji} {themeChoisi.nom}</h1>
        <p>Atteins la case 🏆 pour gagner. Bonne réponse = +1 case · mauvaise réponse = −2 cases.</p>
      </header>

      <div className="jeu-layout">
        {/* ── Le plateau ── */}
        <div className="jeu-plateau">
          <div className="jeu-plateau-grille">
            {lignes.flat().map((caseIndex) => {
              const type = cases[caseIndex];
              const pionsIci = joueurs.filter((j) => j.position === caseIndex);
              const estActive = joueurCourant?.position === caseIndex;
              return (
                <div
                  key={caseIndex}
                  className={`jeu-case ${type} ${estActive ? 'active' : ''}`}
                  title={`Case ${caseIndex + 1}`}
                >
                  <span className="num">{caseIndex + 1}</span>
                  <span aria-hidden="true">{emojiCase(type)}</span>
                  {pionsIci.length > 0 && (
                    <span className="jeu-pions">
                      {pionsIci.map((p) => (
                        <span
                          key={p.id}
                          className="jeu-pion"
                          style={{ background: p.couleur }}
                          title={p.nom}
                        >
                          {p.id + 1}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Panneau latéral ── */}
        <aside className="jeu-panneau">
          {/* Joueurs et progression */}
          <div className="jeu-carte">
            <h3>Joueurs</h3>
            {joueurs.map((j, idx) => (
              <div key={j.id} className={`jeu-joueur ${idx === tour && !gagnant ? 'tour' : ''}`}>
                <span className="puce" style={{ background: j.couleur }} />
                <span style={{ flex: 1 }}>{j.nom}</span>
                <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>
                  case {j.position + 1}/{DERNIERE_CASE + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Dé + action */}
          {!gagnant && (
            <div className="jeu-carte" style={{ textAlign: 'center' }}>
              <h3>Au tour de {joueurCourant?.nom}</h3>
              <div className={`jeu-de ${deRoule ? 'roule' : ''}`} aria-live="polite">
                {deValeur}
              </div>
              <button
                type="button"
                className="jeu-btn jeu-btn-primaire"
                onClick={lancerDe}
                disabled={enAttente || !!question}
              >
                🎲 Lancer le dé
              </button>
            </div>
          )}

          {/* Journal de partie */}
          <div className="jeu-carte">
            <h3>Journal</h3>
            <ul className="jeu-journal">
              {journal.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>

          <button type="button" className="jeu-btn jeu-btn-secondaire" onClick={rejouer}>
            ↩️ Nouvelle partie
          </button>
        </aside>
      </div>

      {/* ── Modale de question illustrée ── */}
      {question && !gagnant && (
        <div className="jeu-modale-overlay" role="dialog" aria-modal="true" aria-label="Question">
          <div className="jeu-modale">
            <div className="jeu-question-illu" aria-hidden="true">{question.illustration}</div>
            <div className="jeu-question-enonce">{question.enonce}</div>

            <div className="jeu-options">
              {question.options.map((opt, idx) => {
                // Classe visuelle après réponse : verte si bonne, rouge si choisie à tort.
                let cls = 'jeu-option';
                if (reponseChoisie !== null) {
                  if (idx === question.bonneReponse) cls += ' correcte';
                  else if (idx === reponseChoisie) cls += ' fausse';
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    className={cls}
                    onClick={() => repondre(idx)}
                    disabled={reponseChoisie !== null}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {reponseChoisie !== null && (
              <>
                <div className={`jeu-explication ${reponseChoisie === question.bonneReponse ? 'ok' : 'nok'}`}>
                  {reponseChoisie === question.bonneReponse ? '✅ Bravo ! ' : '❌ Pas tout à fait. '}
                  {question.explication}
                </div>
                <button
                  type="button"
                  className="jeu-btn jeu-btn-primaire"
                  style={{ marginTop: 14 }}
                  onClick={fermerQuestion}
                >
                  Continuer →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Bandeau de victoire ── */}
      {gagnant && (
        <div className="jeu-modale-overlay" role="dialog" aria-modal="true" aria-label="Victoire">
          <div className="jeu-modale jeu-victoire">
            <div className="trophee" aria-hidden="true">🏆</div>
            <h2>{gagnant.nom} a gagné !</h2>
            <p style={{ color: '#6b7280', marginBottom: 18 }}>
              Félicitations, tu as parcouru tout le Sentier du Savoir.
            </p>
            <button type="button" className="jeu-btn jeu-btn-primaire" onClick={rejouer}>
              🔁 Rejouer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JeuPlateauPage;

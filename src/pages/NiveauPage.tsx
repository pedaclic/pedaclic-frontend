// ============================================================
// PedaClic — Phase 44 : NiveauPage.tsx
// Route  : /niveaux/:niveauSlug
//          (maternelle | elementaire | college | lycee | formation-libre)
// Accès  : public
// Ouverte par les 5 cartes « Tous les niveaux » de l'accueil.
// ------------------------------------------------------------
// Contenu affiché :
//   1. En-tête (icône, titre, introduction)   ← /admin/niveaux
//   2. Choix de la classe + compteurs          ← /admin/disciplines + cours publiés
//   3. Derniers cours publiés du niveau        ← Cours en ligne (statut « publié »)
//   4. Raccourcis (quiz, ebooks, médiathèque)
// ============================================================

import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getClassesByNiveau } from '../types';
import { slugVersNiveau, niveauVersSlug } from '../types/niveauxContenu.types';
import { useNiveauxContenu } from '../hooks/useNiveauxContenu';
import { filtrerCoursClasse, filtrerDisciplines } from '../services/niveauxService';
import {
  useDonneesNiveau,
  FilAriane,
  ChargementNiveau,
  EtatVideNiveau,
  NiveauIntrouvable,
  BandeauNiveauMasque,
} from '../components/niveaux/NiveauxShared';
import { CoursCatalogCard } from './CoursPage';

/** Nombre de cours affichés dans l'aperçu « Derniers cours » */
const NB_COURS_APERCU = 6;

const NiveauPage: React.FC = () => {
  const { niveauSlug } = useParams<{ niveauSlug: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const niveau = slugVersNiveau(niveauSlug);

  const { contenu } = useNiveauxContenu();
  const { disciplines, cours, loading, error } = useDonneesNiveau(niveau);

  // ── Garde : slug inconnu ──────────────────────────────────
  if (!niveau) {
    return <NiveauIntrouvable message={`Le niveau « ${niveauSlug} » n'existe pas.`} />;
  }

  const info = contenu[niveau];
  const estAdmin = currentUser?.role === 'admin';
  const slug = niveauVersSlug(niveau);
  const classes = getClassesByNiveau(niveau);
  const estLycee = niveau === 'lycee';
  const estFormationLibre = niveau === 'formation_libre';

  // ── Garde : niveau masqué par l'admin ─────────────────────
  if (!info.actif && !estAdmin) {
    return (
      <div className="niveau-page">
        <div className="niveau-conteneur">
          <EtatVideNiveau
            icone={info.icone}
            titre={`${info.titre} — bientôt disponible`}
            texte="Ce niveau est en cours de préparation. Revenez très prochainement !"
            lien={{ to: '/', label: "← Retour à l'accueil" }}
          />
        </div>
      </div>
    );
  }

  /** Lien vers la classe : choix de série au lycée, liste des cours ailleurs */
  const lienClasse = (classe: string) =>
    estLycee ? `/niveaux/lycee/${classe}` : `/niveaux/${slug}/${classe}/cours`;

  return (
    <div className="niveau-page">
      {/* ===== EN-TÊTE ===== */}
      <header className={`niveau-hero niveau-hero--${niveau}`}>
        <div className="niveau-conteneur">
          <FilAriane etapes={[{ label: 'Accueil', to: '/' }, { label: info.titre }]} />
          {!info.actif && estAdmin && <BandeauNiveauMasque />}
          <div className="niveau-hero__contenu">
            <span className="niveau-hero__icone" aria-hidden="true">{info.icone}</span>
            <div>
              <h1 className="niveau-hero__titre">{info.titre}</h1>
              <p className="niveau-hero__sous-titre">{info.sousTitre}</p>
              {info.introduction && <p className="niveau-hero__intro">{info.introduction}</p>}
            </div>
          </div>
          {/* Compteurs synthétiques */}
          {!loading && (
            <ul className="niveau-hero__stats" aria-label="Chiffres clés">
              <li><strong>{classes.length}</strong> {estFormationLibre ? 'niveaux' : 'classes'}</li>
              <li><strong>{new Set(disciplines.map((d) => d.nom)).size}</strong> disciplines</li>
              <li><strong>{cours.length}</strong> cours en ligne</li>
            </ul>
          )}
        </div>
      </header>

      <div className="niveau-conteneur">
        {error && <p className="niveau-erreur" role="alert">{error}</p>}

        {/* ===== 1. CHOIX DE LA CLASSE ===== */}
        <section className="niveau-section" aria-labelledby="titre-classes">
          <h2 id="titre-classes" className="niveau-section__titre">
            {estFormationLibre ? 'Choisissez votre niveau' : 'Choisissez votre classe'}
          </h2>
          {loading ? <ChargementNiveau /> : (
            <div className="niveau-grille niveau-grille--classes">
              {classes.map((c) => {
                const nbDisc = filtrerDisciplines(disciplines, c.value).length;
                const nbCours = filtrerCoursClasse(cours, c.value).length;
                return (
                  <Link key={c.value} to={lienClasse(c.value)} className="niveau-classe">
                    <span className="niveau-classe__nom">{c.label}</span>
                    <span className="niveau-classe__compteurs">
                      {nbDisc} discipline{nbDisc > 1 ? 's' : ''} · {nbCours} cours
                    </span>
                    <span className="niveau-classe__cta">
                      {estLycee ? 'Choisir la série' : 'Voir les contenus'} →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ===== 2. DERNIERS COURS PUBLIÉS ===== */}
        <section className="niveau-section" aria-labelledby="titre-cours">
          <div className="niveau-section__entete">
            <h2 id="titre-cours" className="niveau-section__titre">Derniers cours en ligne</h2>
            {cours.length > NB_COURS_APERCU && (
              <Link to="/cours" className="niveau-lien">Tout le catalogue →</Link>
            )}
          </div>
          {loading ? <ChargementNiveau /> : cours.length === 0 ? (
            <EtatVideNiveau
              icone="📘"
              titre="Aucun cours publié pour l'instant"
              texte="Les cours de ce niveau arrivent bientôt. En attendant, explorez les disciplines et les ressources."
              lien={{ to: '/disciplines', label: 'Explorer les disciplines' }}
            />
          ) : (
            <div className="cours-catalogue__grille">
              {cours.slice(0, NB_COURS_APERCU).map((c) => (
                <CoursCatalogCard key={c.id} cours={c} onClick={() => navigate(`/cours/${c.id}`)} />
              ))}
            </div>
          )}
        </section>

        {/* ===== 3. RACCOURCIS ===== */}
        <section className="niveau-section" aria-labelledby="titre-raccourcis">
          <h2 id="titre-raccourcis" className="niveau-section__titre">Pour aller plus loin</h2>
          <div className="niveau-grille niveau-grille--raccourcis">
            <Link to="/quiz-gratuits" className="niveau-raccourci">
              <span aria-hidden="true">🧩</span> Quiz gratuits
            </Link>
            <Link to="/ebooks" className="niveau-raccourci">
              <span aria-hidden="true">📚</span> Bibliothèque d'ebooks
            </Link>
            <Link to="/mediatheque" className="niveau-raccourci">
              <span aria-hidden="true">🎬</span> Médiathèque
            </Link>
            <Link to="/premium" className="niveau-raccourci niveau-raccourci--premium">
              <span aria-hidden="true">⭐</span> Passer Premium
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default NiveauPage;

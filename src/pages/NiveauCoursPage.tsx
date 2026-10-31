// ============================================================
// PedaClic — Phase 44 : NiveauCoursPage.tsx
// Routes : /niveaux/:niveauSlug/:classeValue/cours
//          /niveaux/lycee/:classeValue/:serie/cours
// Accès  : public
// ------------------------------------------------------------
// Page finale du parcours « niveau → classe (→ série) » :
//   • sélecteur rapide des autres classes (et séries au lycée)
//   • disciplines de la classe → /disciplines/:id
//     (chapitres + ressources, gérés dans /admin/chapitres et /admin/ressources)
//   • cours en ligne publiés pour la classe → /cours/:id
// ============================================================

import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SERIES_LYCEE, getClasseLabel, getClassesByNiveau } from '../types';
import { slugVersNiveau, niveauVersSlug } from '../types/niveauxContenu.types';
import { useNiveauxContenu } from '../hooks/useNiveauxContenu';
import { classeDepuisUrl, filtrerCoursClasse, filtrerDisciplines } from '../services/niveauxService';
import {
  useDonneesNiveau,
  FilAriane,
  ChargementNiveau,
  EtatVideNiveau,
  NiveauIntrouvable,
  CarteDiscipline,
  BandeauNiveauMasque,
} from '../components/niveaux/NiveauxShared';
import { CoursCatalogCard } from './CoursPage';

const NiveauCoursPage: React.FC = () => {
  const { niveauSlug, classeValue, serie } = useParams<{
    niveauSlug?: string;
    classeValue?: string;
    serie?: string;
  }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { contenu } = useNiveauxContenu();

  // La route « série » n'a pas de :niveauSlug → c'est forcément le lycée
  const niveau = serie ? 'lycee' : slugVersNiveau(niveauSlug);
  const { disciplines, cours, loading, error } = useDonneesNiveau(niveau);

  // ── Gardes : niveau / classe / série inconnus ─────────────
  if (!niveau) {
    return <NiveauIntrouvable message={`Le niveau « ${niveauSlug} » n'existe pas.`} />;
  }
  const classe = classeDepuisUrl(classeValue, niveau);
  if (!classe) {
    return <NiveauIntrouvable message={`La classe « ${classeValue} » n'existe pas pour ce niveau.`} />;
  }
  const serieInfo = serie ? SERIES_LYCEE.find((s) => s.value.toLowerCase() === serie.toLowerCase()) : undefined;
  if (serie && !serieInfo) {
    return <NiveauIntrouvable message={`La série « ${serie} » n'existe pas.`} />;
  }

  const info = contenu[niveau];
  const estAdmin = currentUser?.role === 'admin';
  const slug = niveauVersSlug(niveau);
  const labelClasse = getClasseLabel(classe);
  const valeurSerie = serieInfo?.value;

  // Si le niveau est masqué, seul l'admin peut parcourir ses pages
  if (!info.actif && !estAdmin) {
    return <NiveauIntrouvable message={`Le niveau ${info.titre} n'est pas encore disponible.`} />;
  }

  // ── Données filtrées ──────────────────────────────────────
  const disciplinesClasse = filtrerDisciplines(disciplines, classe, valeurSerie);
  const coursClasse = filtrerCoursClasse(cours, classe, valeurSerie);

  // ── Fil d'Ariane ──────────────────────────────────────────
  const ariane = [
    { label: 'Accueil', to: '/' },
    { label: info.titre, to: `/niveaux/${slug}` },
    ...(niveau === 'lycee'
      ? [{ label: labelClasse, to: `/niveaux/lycee/${classe}` }]
      : []),
    { label: serieInfo ? serieInfo.label : (niveau === 'lycee' ? 'Toutes séries' : labelClasse) },
  ];

  const titre = serieInfo ? `${labelClasse} — ${serieInfo.label}` : labelClasse;

  return (
    <div className="niveau-page">
      {/* ===== EN-TÊTE ===== */}
      <header className={`niveau-hero niveau-hero--${niveau} niveau-hero--compact`}>
        <div className="niveau-conteneur">
          <FilAriane etapes={ariane} />
          {!info.actif && estAdmin && <BandeauNiveauMasque />}
          <div className="niveau-hero__contenu">
            <span className="niveau-hero__icone" aria-hidden="true">{info.icone}</span>
            <div>
              <p className="niveau-hero__sur-titre">{info.titre}</p>
              <h1 className="niveau-hero__titre">{titre}</h1>
            </div>
          </div>

          {/* Navigation rapide entre classes du même niveau */}
          <nav className="niveau-onglets" aria-label="Autres classes">
            {getClassesByNiveau(niveau).map((c) => (
              <NavLink
                key={c.value}
                to={niveau === 'lycee'
                  ? (valeurSerie ? `/niveaux/lycee/${c.value}/${valeurSerie}/cours` : `/niveaux/lycee/${c.value}/cours`)
                  : `/niveaux/${slug}/${c.value}/cours`}
                className={() => `niveau-onglet${c.value === classe ? ' niveau-onglet--actif' : ''}`}
              >
                {c.label}
              </NavLink>
            ))}
          </nav>

          {/* Au lycée : navigation rapide entre séries */}
          {niveau === 'lycee' && (
            <nav className="niveau-onglets niveau-onglets--series" aria-label="Séries">
              <Link
                to={`/niveaux/lycee/${classe}/cours`}
                className={`niveau-onglet${!valeurSerie ? ' niveau-onglet--actif' : ''}`}
              >
                Toutes
              </Link>
              {SERIES_LYCEE.map((s) => (
                <Link
                  key={s.value}
                  to={`/niveaux/lycee/${classe}/${s.value}/cours`}
                  className={`niveau-onglet${s.value === valeurSerie ? ' niveau-onglet--actif' : ''}`}
                >
                  {s.value}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      <div className="niveau-conteneur">
        {error && <p className="niveau-erreur" role="alert">{error}</p>}

        {/* ===== DISCIPLINES ===== */}
        <section className="niveau-section" aria-labelledby="titre-disciplines">
          <h2 id="titre-disciplines" className="niveau-section__titre">
            Disciplines {!loading && <span className="niveau-compteur">{disciplinesClasse.length}</span>}
          </h2>
          {loading ? <ChargementNiveau /> : disciplinesClasse.length === 0 ? (
            <EtatVideNiveau
              icone="📚"
              titre="Aucune discipline pour l'instant"
              texte="Les disciplines de cette classe seront bientôt disponibles."
            />
          ) : (
            <div className="niveau-grille niveau-grille--disciplines">
              {disciplinesClasse.map((d) => <CarteDiscipline key={d.id} discipline={d} />)}
            </div>
          )}
        </section>

        {/* ===== COURS EN LIGNE ===== */}
        <section className="niveau-section" aria-labelledby="titre-cours-classe">
          <h2 id="titre-cours-classe" className="niveau-section__titre">
            Cours en ligne {!loading && <span className="niveau-compteur">{coursClasse.length}</span>}
          </h2>
          {loading ? <ChargementNiveau /> : coursClasse.length === 0 ? (
            <EtatVideNiveau
              icone="📘"
              titre="Aucun cours publié pour cette classe"
              texte="De nouveaux cours sont ajoutés régulièrement. Consultez le catalogue complet en attendant."
              lien={{ to: '/cours', label: 'Voir tout le catalogue' }}
            />
          ) : (
            <div className="cours-catalogue__grille">
              {coursClasse.map((c) => (
                <CoursCatalogCard key={c.id} cours={c} onClick={() => navigate(`/cours/${c.id}`)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default NiveauCoursPage;

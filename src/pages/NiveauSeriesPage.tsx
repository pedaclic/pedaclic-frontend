// ============================================================
// PedaClic — Phase 44 : NiveauSeriesPage.tsx
// Route  : /niveaux/lycee/:classeValue   (2nde | 1ere | Terminale)
// Accès  : public
// Étape intermédiaire du parcours Lycée : choix de la série.
// ------------------------------------------------------------
// Séries : SERIES_LYCEE (types/index.ts) — L, S1, S2, S3, STEG, T.
// Compteurs : disciplines (champ « series », /admin/disciplines)
//             + cours publiés (champ « serie » du cours).
// Une discipline ou un cours sans série = commun à toutes les séries.
// ============================================================

import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SERIES_LYCEE, getClasseLabel } from '../types';
import { useNiveauxContenu } from '../hooks/useNiveauxContenu';
import { classeDepuisUrl, filtrerCoursClasse, filtrerDisciplines } from '../services/niveauxService';
import {
  useDonneesNiveau,
  FilAriane,
  ChargementNiveau,
  NiveauIntrouvable,
  BandeauNiveauMasque,
} from '../components/niveaux/NiveauxShared';

const NiveauSeriesPage: React.FC = () => {
  const { classeValue } = useParams<{ classeValue: string }>();
  const { currentUser } = useAuth();
  const { contenu } = useNiveauxContenu();
  const { disciplines, cours, loading, error } = useDonneesNiveau('lycee');

  // ── Garde : classe inconnue ───────────────────────────────
  const classe = classeDepuisUrl(classeValue, 'lycee');
  if (!classe) {
    return <NiveauIntrouvable message={`La classe « ${classeValue} » n'existe pas au lycée.`} />;
  }

  const info = contenu.lycee;
  const estAdmin = currentUser?.role === 'admin';
  const labelClasse = getClasseLabel(classe);

  // Totaux « toutes séries » de la classe
  const nbDiscTotal = filtrerDisciplines(disciplines, classe).length;
  const nbCoursTotal = filtrerCoursClasse(cours, classe).length;

  return (
    <div className="niveau-page">
      {/* ===== EN-TÊTE ===== */}
      <header className="niveau-hero niveau-hero--lycee">
        <div className="niveau-conteneur">
          <FilAriane etapes={[
            { label: 'Accueil', to: '/' },
            { label: info.titre, to: '/niveaux/lycee' },
            { label: labelClasse },
          ]} />
          {!info.actif && estAdmin && <BandeauNiveauMasque />}
          <div className="niveau-hero__contenu">
            <span className="niveau-hero__icone" aria-hidden="true">{info.icone}</span>
            <div>
              <h1 className="niveau-hero__titre">{labelClasse}</h1>
              <p className="niveau-hero__intro">Choisissez votre série pour accéder aux disciplines et cours adaptés.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="niveau-conteneur">
        {error && <p className="niveau-erreur" role="alert">{error}</p>}

        <section className="niveau-section" aria-labelledby="titre-series">
          <h2 id="titre-series" className="niveau-section__titre">Séries</h2>
          {loading ? <ChargementNiveau /> : (
            <div className="niveau-grille niveau-grille--classes">
              {SERIES_LYCEE.map((s) => {
                const nbDisc = filtrerDisciplines(disciplines, classe, s.value).length;
                const nbCours = filtrerCoursClasse(cours, classe, s.value).length;
                return (
                  <Link
                    key={s.value}
                    to={`/niveaux/lycee/${classe}/${s.value}/cours`}
                    className="niveau-classe"
                  >
                    <span className="niveau-classe__nom">{s.label}</span>
                    <span className="niveau-classe__compteurs">
                      {nbDisc} discipline{nbDisc > 1 ? 's' : ''} · {nbCours} cours
                    </span>
                    <span className="niveau-classe__cta">Voir les contenus →</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Accès direct à tous les contenus de la classe, toutes séries confondues */}
          <p className="niveau-note">
            <Link to={`/niveaux/lycee/${classe}/cours`} className="niveau-lien">
              Voir tous les contenus de {labelClasse} ({nbDiscTotal} disciplines · {nbCoursTotal} cours) →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
};

export default NiveauSeriesPage;

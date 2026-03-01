// ============================================================
// PedaClic — Phase 24 : CoursPage.tsx — Catalogue public
// Route : /cours
// Accès : Tous (connecté ou non)
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { estFormuleALaCarte } from '../types/premiumPlans';
import { getCoursPublies } from '../services/coursService';
import type { CoursEnLigne, FiltresCours } from '../cours_types';
import { NIVEAUX_COURS } from '../cours_types';
import { CLASSES } from '../types/cahierTextes.types';
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import '../styles/CoursEnLigne.css';

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Carte cours du catalogue
// ─────────────────────────────────────────────────────────────

interface CoursCatalogCardProps {
  cours: CoursEnLigne;
  onClick: () => void;
}

function CoursCatalogCard({ cours, onClick }: CoursCatalogCardProps) {
  // Durée lisible (ex: "1h30" ou "45 min")
  const dureeLabel =
    cours.dureeEstimee >= 60
      ? `${Math.floor(cours.dureeEstimee / 60)}h${cours.dureeEstimee % 60 > 0 ? cours.dureeEstimee % 60 : ''}`
      : `${cours.dureeEstimee} min`;

  const niveauLabel =
    NIVEAUX_COURS.find(n => n.valeur === cours.niveau)?.label ?? cours.niveau;

  return (
    /* Carte cliquable du catalogue */
    <article className="cours-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      aria-label={`Cours : ${cours.titre}`}>

      {/* Image de couverture ou placeholder dégradé */}
      <div className="cours-card__cover">
        {cours.couvertureUrl
          ? <img src={cours.couvertureUrl} alt={cours.titre} loading="lazy" />
          : <div className="cours-card__cover-placeholder">
              <span>{cours.matiere.charAt(0)}</span>
            </div>
        }
        {/* Badge Premium */}
        {cours.isPremium && (
          <span className="cours-card__badge cours-card__badge--premium">⭐ Premium</span>
        )}
        {/* Badge Gratuit */}
        {!cours.isPremium && (
          <span className="cours-card__badge cours-card__badge--gratuit">✅ Gratuit</span>
        )}
      </div>

      {/* Corps de la carte */}
      <div className="cours-card__body">
        {/* Matière et niveau */}
        <div className="cours-card__meta">
          <span className="cours-card__matiere">{cours.matiere}</span>
          <span className="cours-card__niveau">{niveauLabel}</span>
        </div>

        {/* Titre */}
        <h3 className="cours-card__titre">{cours.titre}</h3>

        {/* Description courte */}
        <p className="cours-card__description">{cours.description}</p>

        {/* Pied de carte : prof + stats */}
        <div className="cours-card__footer">
          <span className="cours-card__prof">👨‍🏫 {cours.profNom}</span>
          <div className="cours-card__stats">
            <span>📚 {cours.nombreSections} section{cours.nombreSections > 1 ? 's' : ''}</span>
            <span>⏱ {dureeLabel}</span>
            <span>👥 {cours.nombreInscrits}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : Catalogue des cours
// ─────────────────────────────────────────────────────────────

export default function CoursPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { matieres } = useDisciplinesOptions();
  const formule = currentUser?.subscriptionPlan;
  const isALaCarte = currentUser?.isPremium && formule && estFormuleALaCarte(formule);

  // ── État ──────────────────────────────────────────────────
  const [cours, setCours] = useState<CoursEnLigne[]>([]);
  const [coursFiltres, setCoursFiltres] = useState<CoursEnLigne[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtres, setFiltres] = useState<FiltresCours>({
    matiere: '',
    niveau: '',
    recherche: '',
    isPremium: '',
  });

  // ── Chargement initial ────────────────────────────────────
  useEffect(() => {
    chargerCours();
  }, [currentUser?.role]);

  async function chargerCours() {
    setLoading(true);
    setError(null);
    try {
      let data = await getCoursPublies();
      // Exclure les cours reservedPro pour les élèves et visiteurs
      if (currentUser?.role !== 'prof' && currentUser?.role !== 'admin') {
        data = data.filter(c => !c.reservedPro);
      }
      setCours(data);
      setCoursFiltres(data);
    } catch (err) {
      console.error('[CoursPage] Erreur chargement :', err);
      setError('Impossible de charger les cours. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }

  // ── Filtrage client ───────────────────────────────────────
  const appliquerFiltres = useCallback(
    (nouveauxFiltres: FiltresCours) => {
      setFiltres(nouveauxFiltres);
      let resultat = [...cours];

      if (nouveauxFiltres.matiere) {
        resultat = resultat.filter(c => c.matiere === nouveauxFiltres.matiere);
      }
      if (nouveauxFiltres.niveau) {
        resultat = resultat.filter(c => c.niveau === nouveauxFiltres.niveau);
      }
      if (nouveauxFiltres.isPremium !== '' && nouveauxFiltres.isPremium !== undefined) {
        resultat = resultat.filter(c => c.isPremium === nouveauxFiltres.isPremium);
      }
      if (nouveauxFiltres.recherche) {
        const terme = nouveauxFiltres.recherche.toLowerCase();
        resultat = resultat.filter(
          c =>
            c.titre.toLowerCase().includes(terme) ||
            c.description.toLowerCase().includes(terme) ||
            c.matiere.toLowerCase().includes(terme) ||
            c.tags.some(t => t.toLowerCase().includes(terme))
        );
      }

      setCoursFiltres(resultat);
    },
    [cours]
  );

  const resetFiltres = () => {
    const vide: FiltresCours = { matiere: '', niveau: '', recherche: '', isPremium: '' };
    setFiltres(vide);
    setCoursFiltres(cours);
  };

  const filtresActifs = !!(filtres.matiere || filtres.niveau || filtres.recherche || filtres.isPremium !== '');

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────

  return (
    <div className="cours-catalogue">

      {/* ══════════════════════════════════════════════════════
          HERO — En-tête de la page catalogue
      ══════════════════════════════════════════════════════ */}
      <section className="cours-catalogue__hero" aria-label="Introduction aux cours">
        <div className="cours-catalogue__hero-content">
          <h1 className="cours-catalogue__hero-titre">📚 Cours en ligne</h1>
          <p className="cours-catalogue__hero-sous-titre">
            Des cours complets du programme sénégalais — de la 6ème au Bac.
            Créés par vos professeurs, accessibles partout, même hors-ligne.
          </p>
          {isALaCarte && (
            <button
              className="btn-primary"
              onClick={() => navigate('/premium/mes-cours')}
              style={{ marginTop: '1rem' }}
            >
              📚 Choisir mes cours
            </button>
          )}
          {/* Statistiques globales */}
          <div className="cours-catalogue__hero-stats" aria-label="Statistiques de la plateforme">
            <div className="cours-catalogue__stat">
              <span className="cours-catalogue__stat-val">{cours.length}</span>
              <span className="cours-catalogue__stat-label">Cours disponibles</span>
            </div>
            <div className="cours-catalogue__stat">
              <span className="cours-catalogue__stat-val">
                {cours.filter(c => !c.isPremium).length}
              </span>
              <span className="cours-catalogue__stat-label">Cours gratuits</span>
            </div>
            <div className="cours-catalogue__stat">
              <span className="cours-catalogue__stat-val">
                {[...new Set(cours.map(c => c.matiere))].length}
              </span>
              <span className="cours-catalogue__stat-label">Matières</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FILTRES — Barre de recherche et sélecteurs
      ══════════════════════════════════════════════════════ */}
      <section className="cours-catalogue__filtres" aria-label="Filtres de recherche">
        <div className="cours-catalogue__filtres-inner">

          {/* Recherche texte */}
          <div className="cours-catalogue__search">
            <span className="cours-catalogue__search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              placeholder="Rechercher un cours, une matière, un tag..."
              value={filtres.recherche}
              onChange={e => appliquerFiltres({ ...filtres, recherche: e.target.value })}
              className="cours-catalogue__search-input"
              aria-label="Rechercher dans les cours"
            />
          </div>

          {/* Filtre matière */}
          <select
            value={filtres.matiere}
            onChange={e => appliquerFiltres({ ...filtres, matiere: e.target.value })}
            className="cours-catalogue__select"
            aria-label="Filtrer par matière"
          >
            <option value="">Toutes les matières</option>
            {matieres.map(m => (
              <option key={m.valeur} value={m.valeur}>{m.label}</option>
            ))}
          </select>

          {/* Filtre niveau */}
          <select
            value={filtres.niveau}
            onChange={e => appliquerFiltres({ ...filtres, niveau: e.target.value })}
            className="cours-catalogue__select"
            aria-label="Filtrer par niveau"
          >
            <option value="">Tous les niveaux</option>
            {CLASSES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Filtre accès */}
          <select
            value={String(filtres.isPremium)}
            onChange={e => {
              const val = e.target.value === '' ? '' : e.target.value === 'true';
              appliquerFiltres({ ...filtres, isPremium: val as boolean | '' });
            }}
            className="cours-catalogue__select"
            aria-label="Filtrer par accès"
          >
            <option value="">Tous les accès</option>
            <option value="false">✅ Gratuits</option>
            <option value="true">⭐ Premium</option>
          </select>

          {/* Bouton reset */}
          {filtresActifs && (
            <button className="btn-secondary btn--sm" onClick={resetFiltres} aria-label="Effacer les filtres">
              ✕ Effacer les filtres
            </button>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          GRILLE DES COURS
      ══════════════════════════════════════════════════════ */}
      <main className="cours-catalogue__contenu">

        {/* Message d'erreur */}
        {error && (
          <div className="error-banner" role="alert">
            ⚠️ {error}
            <button className="btn-link" onClick={chargerCours}>Réessayer</button>
          </div>
        )}

        {/* Skeleton loader */}
        {loading && (
          <div className="cours-catalogue__grille" aria-busy="true" aria-label="Chargement des cours">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="cours-card cours-card--skeleton">
                <div className="skeleton cours-card__cover" />
                <div className="cours-card__body">
                  <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 20, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 14, width: '80%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grille des résultats */}
        {!loading && coursFiltres.length > 0 && (
          <>
            {/* Compteur de résultats */}
            <p className="cours-catalogue__compteur" aria-live="polite">
              {coursFiltres.length} cours trouvé{coursFiltres.length > 1 ? 's' : ''}
              {filtresActifs && ' pour ces critères'}
            </p>

            <div className="cours-catalogue__grille">
              {coursFiltres.map(c => (
                <CoursCatalogCard
                  key={c.id}
                  cours={c}
                  onClick={() => navigate(`/cours/${c.id}`)}
                />
              ))}
            </div>
          </>
        )}

        {/* État vide */}
        {!loading && coursFiltres.length === 0 && !error && (
          <div className="cours-catalogue__vide" role="status">
            <span aria-hidden="true">📭</span>
            <h3>Aucun cours trouvé</h3>
            <p>
              {filtresActifs
                ? 'Essayez de modifier ou supprimer vos filtres.'
                : 'Les cours seront disponibles bientôt. Revenez dans quelques jours !'}
            </p>
            {filtresActifs && (
              <button className="btn-secondary" onClick={resetFiltres}>
                Afficher tous les cours
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

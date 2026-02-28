// ============================================================
// PedaClic — Choix des cours (formule à la carte)
// Route : /premium/mes-cours
// Accès : Utilisateurs Premium avec formule à la carte
// www.pedaclic.sn | Extension Cours à la carte
// ============================================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getCoursPublies } from '../services/coursService';
import { mettreAJourCoursChoisis } from '../services/premiumCoursService';
import {
  estFormuleALaCarte,
  getNombreCoursMax,
  PLANS_A_LA_CARTE,
} from '../types/premiumPlans';
import type { CoursEnLigne } from '../cours_types';
import { NIVEAUX_COURS } from '../cours_types';
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import '../styles/CoursEnLigne.css';

export default function PremiumCoursChoicePage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { matieres } = useDisciplinesOptions();

  const [cours, setCours] = useState<CoursEnLigne[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filtreMatiere, setFiltreMatiere] = useState('');
  const [filtreNiveau, setFiltreNiveau] = useState('');
  const [selection, setSelection] = useState<string[]>(
    currentUser?.coursChoisis ?? []
  );

  const formule = currentUser?.subscriptionPlan;
  const maxCours = getNombreCoursMax(formule || 'a_la_carte_1');
  const isALaCarte = estFormuleALaCarte(formule || 'a_la_carte_1');
  const planConfig = PLANS_A_LA_CARTE.find(p => p.id === formule);

  useEffect(() => {
    chargerCours();
  }, []);

  async function chargerCours() {
    setLoading(true);
    try {
      const data = await getCoursPublies();
      setCours(data);
    } catch {
      setCours([]);
    } finally {
      setLoading(false);
    }
  }

  const coursFiltres = cours.filter(c => {
    if (filtreMatiere && c.matiere !== filtreMatiere) return false;
    if (filtreNiveau && c.niveau !== filtreNiveau) return false;
    return true;
  });

  function toggleCours(coursId: string) {
    if (!maxCours) return; // illimité = pas de limite
    const idx = selection.indexOf(coursId);
    if (idx >= 0) {
      setSelection(selection.filter(id => id !== coursId));
    } else if (selection.length < maxCours) {
      setSelection([...selection, coursId]);
    }
  }

  async function enregistrerChoix() {
    if (!currentUser) return;
    setSaving(true);
    try {
      await mettreAJourCoursChoisis(currentUser.uid, selection);
      navigate('/dashboard', { state: { message: 'Vos cours ont été mis à jour.' } });
    } catch {
      setSaving(false);
    }
  }

  // Redirection si non Premium ou formule illimitée
  if (!currentUser?.isPremium) {
    return (
      <div className="cours-catalogue">
        <div className="cours-catalogue__hero">
          <h1>Choix des cours</h1>
          <p>Cette page est réservée aux abonnés Premium.</p>
          <Link to="/premium" className="btn btn--primary">Découvrir Premium</Link>
        </div>
      </div>
    );
  }

  if (!isALaCarte || maxCours === null) {
    return (
      <div className="cours-catalogue">
        <div className="cours-catalogue__hero">
          <h1>Accès illimité</h1>
          <p>Votre formule vous donne accès à tous les cours. Aucun choix à faire !</p>
          <Link to="/cours" className="btn btn--primary">Voir le catalogue</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cours-catalogue">
      <section className="cours-catalogue__hero">
        <h1 className="cours-catalogue__hero-titre">📚 Mes cours à la carte</h1>
        <p className="cours-catalogue__hero-sous-titre">
          Choisissez jusqu'à <strong>{maxCours} cours</strong> parmi le catalogue.
          Filtrez par discipline et niveau.
        </p>
        <div className="premium-cours-choice__plan">
          <span className="badge badge--premium">
            {planConfig?.nom} — {planConfig?.prix.toLocaleString('fr-FR')} FCFA / {planConfig?.duree}
          </span>
          <span className="premium-cours-choice__count">
            {selection.length} / {maxCours} cours sélectionnés
          </span>
        </div>
      </section>

      <section className="cours-catalogue__filtres">
        <div className="cours-catalogue__filtres-inner">
          <select
            value={filtreMatiere}
            onChange={e => setFiltreMatiere(e.target.value)}
            className="cours-catalogue__select"
            aria-label="Filtrer par matière"
          >
            <option value="">Toutes les matières</option>
            {matieres.map(m => (
              <option key={m.valeur} value={m.valeur}>{m.label}</option>
            ))}
          </select>
          <select
            value={filtreNiveau}
            onChange={e => setFiltreNiveau(e.target.value)}
            className="cours-catalogue__select"
            aria-label="Filtrer par niveau"
          >
            <option value="">Tous les niveaux</option>
            {NIVEAUX_COURS.map(n => (
              <option key={n.valeur} value={n.valeur}>{n.label}</option>
            ))}
          </select>
        </div>
      </section>

      <main className="cours-catalogue__contenu">
        {loading ? (
          <div className="cours-catalogue__grille" aria-busy="true">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="cours-card cours-card--skeleton">
                <div className="skeleton cours-card__cover" />
                <div className="cours-card__body">
                  <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 20, marginBottom: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="premium-cours-choice__actions">
              <button
                className="btn-primary"
                onClick={enregistrerChoix}
                disabled={saving}
              >
                {saving ? 'Enregistrement...' : '✓ Enregistrer mes choix'}
              </button>
              <Link to="/cours" className="btn-secondary">Voir le catalogue</Link>
            </div>

            <div className="cours-catalogue__grille">
              {coursFiltres.map(c => {
                const estSelectionne = selection.includes(c.id);
                const peutAjouter = selection.length < (maxCours || 0) || estSelectionne;
                const niveauLabel = NIVEAUX_COURS.find(n => n.valeur === c.niveau)?.label ?? c.niveau;

                return (
                  <article
                    key={c.id}
                    className={`cours-card ${estSelectionne ? 'cours-card--selected' : ''}`}
                    onClick={() => peutAjouter && toggleCours(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && peutAjouter && toggleCours(c.id)}
                  >
                    <div className="cours-card__cover">
                      {c.couvertureUrl ? (
                        <img src={c.couvertureUrl} alt={c.titre} loading="lazy" />
                      ) : (
                        <div className="cours-card__cover-placeholder">
                          <span>{c.matiere.charAt(0)}</span>
                        </div>
                      )}
                      <span className={`cours-card__badge ${estSelectionne ? 'cours-card__badge--premium' : 'cours-card__badge--gratuit'}`}>
                        {estSelectionne ? '✓ Sélectionné' : 'Cliquer pour ajouter'}
                      </span>
                    </div>
                    <div className="cours-card__body">
                      <div className="cours-card__meta">
                        <span className="cours-card__matiere">{c.matiere}</span>
                        <span className="cours-card__niveau">{niveauLabel}</span>
                      </div>
                      <h3 className="cours-card__titre">{c.titre}</h3>
                      <p className="cours-card__description">{c.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>

            {coursFiltres.length === 0 && !loading && (
              <div className="cours-catalogue__vide">
                <span>📭</span>
                <h3>Aucun cours trouvé</h3>
                <p>Modifiez vos filtres ou consultez le catalogue complet.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

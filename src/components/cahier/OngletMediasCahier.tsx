// ============================================================
// PedaClic — Phase 58 : onglet « Médias partagés » du cahier
// ------------------------------------------------------------
// Composant partagé prof / élève :
//   mode="prof"  → bouton « Copier le lien » de la ressource ;
//   mode="eleve" → LECTURE SEULE (ouvrir uniquement, aucun
//                  partage ni modification).
// Chaque ressource liste ses séances ; un clic sur une séance
// appelle onOuvrirSeance(id) → la page bascule sur la liste et
// défile jusqu'à la séance (même mécanisme que le lien de séance).
// ============================================================

import React, { useMemo, useState } from 'react';
import type { EntreeCahier } from '../../types/cahierTextes.types';
import {
  FAMILLES_MEDIA,
  formaterTaille,
  indexerMediasCahier,
  type FamilleMedia,
} from '../../utils/mediasCahier';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/Phase58.css';

interface OngletMediasCahierProps {
  entrees: EntreeCahier[];
  mode: 'prof' | 'eleve';
  onOuvrirSeance: (entreeId: string) => void;
}

/** Date courte : « 19 nov. » */
const dateCourte = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

const OngletMediasCahier: React.FC<OngletMediasCahierProps> = ({ entrees, mode, onOuvrirSeance }) => {
  const { toast } = useToast();
  const [famille, setFamille] = useState<FamilleMedia | 'tous'>('tous');
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState<'recent' | 'ancien' | 'nom'>('recent');

  // Index recalculé seulement quand les séances changent
  const ressources = useMemo(() => indexerMediasCahier(entrees), [entrees]);

  // Compteurs par famille (les familles vides sont masquées)
  const compteurs = useMemo(() => {
    const c: Partial<Record<FamilleMedia, number>> = {};
    ressources.forEach(r => { c[r.famille] = (c[r.famille] ?? 0) + 1; });
    return c;
  }, [ressources]);

  // Filtre type + recherche (nom de la ressource ou titre de séance) + tri
  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = ressources.filter(r =>
      (famille === 'tous' || r.famille === famille) &&
      (!q || r.nom.toLowerCase().includes(q) || r.seances.some(s => s.chapitre.toLowerCase().includes(q))),
    );
    if (tri === 'ancien') liste.reverse();
    if (tri === 'nom') liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    return liste;
  }, [ressources, famille, recherche, tri]);

  // Copie de l'adresse de la ressource (prof uniquement)
  const copierRessource = async (url: string) => {
    const absolue = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    try {
      await navigator.clipboard.writeText(absolue);
      toast.success('Lien de la ressource copié.');
    } catch {
      window.prompt('Copiez ce lien :', absolue);
    }
  };

  const codeFamille = (f: FamilleMedia) => FAMILLES_MEDIA.find(x => x.id === f)?.code ?? '···';

  // ── Aucun média dans le cahier ──────────────────────────────
  if (ressources.length === 0) {
    return (
      <div className="medias-vide">
        <p className="medias-vide__titre">Aucune ressource partagée pour l'instant</p>
        <p className="medias-vide__sub">
          {mode === 'prof'
            ? 'Les fichiers, liens et ebooks ajoutés aux séances apparaîtront ici automatiquement.'
            : 'Les documents joints par votre professeur apparaîtront ici.'}
        </p>
      </div>
    );
  }

  return (
    <div className={`medias-cahier medias-cahier--${mode}`}>
      {/* ── Colonne / barre des types ── */}
      <nav className="medias-types" aria-label="Types de ressources">
        <button type="button" className={`medias-type${famille === 'tous' ? ' is-actif' : ''}`}
                onClick={() => setFamille('tous')}>
          Tout afficher <span className="medias-type__n">{ressources.length}</span>
        </button>
        {FAMILLES_MEDIA.filter(f => compteurs[f.id]).map(f => (
          <button key={f.id} type="button" className={`medias-type${famille === f.id ? ' is-actif' : ''}`}
                  onClick={() => setFamille(f.id)}>
            {f.label} <span className="medias-type__n">{compteurs[f.id]}</span>
          </button>
        ))}
      </nav>

      {/* ── Liste ── */}
      <section className="medias-liste">
        <div className="medias-outils">
          <label htmlFor={`medias-q-${mode}`} className="medias-sr">Rechercher une ressource</label>
          <input id={`medias-q-${mode}`} type="search" value={recherche}
                 onChange={e => setRecherche(e.target.value)}
                 placeholder="Rechercher une ressource, une séance…" />
          <label htmlFor={`medias-tri-${mode}`} className="medias-sr">Trier</label>
          <select id={`medias-tri-${mode}`} value={tri} onChange={e => setTri(e.target.value as typeof tri)}>
            <option value="recent">Plus récent</option>
            <option value="ancien">Plus ancien</option>
            <option value="nom">Nom (A → Z)</option>
          </select>
        </div>

        {visibles.length === 0 && <p className="medias-aucun">Aucune ressource pour cette sélection.</p>}

        {visibles.map(r => (
          <article key={r.cle} className="medias-item">
            <span className={`medias-item__code medias-code--${r.famille}`} aria-hidden="true">
              {codeFamille(r.famille)}
            </span>

            <div className="medias-item__corps">
              <strong className="medias-item__nom">{r.nom}</strong>
              <div className="medias-item__seances">
                <span className="medias-item__meta">
                  {[FAMILLES_MEDIA.find(f => f.id === r.famille)?.label, formaterTaille(r.taille)]
                    .filter(Boolean).join(' · ')} · Utilisé dans :
                </span>
                {r.seances.map(s => (
                  <button key={s.id} type="button" className="medias-seance"
                          onClick={() => onOuvrirSeance(s.id)}
                          title={`Aller à la séance : ${s.chapitre}`}>
                    {dateCourte(s.date)} · {s.chapitre} →
                  </button>
                ))}
              </div>
            </div>

            <div className="medias-item__actions">
              {/* Ouvrir : nouvel onglet pour un fichier / lien, page ebooks pour un livre */}
              <a className="medias-btn" href={r.url}
                 target={r.famille === 'ebook' ? undefined : '_blank'}
                 rel={r.famille === 'ebook' ? undefined : 'noopener noreferrer'}>
                Ouvrir
              </a>
              {mode === 'prof' && (
                <button type="button" className="medias-btn" onClick={() => copierRessource(r.url)}>
                  Copier le lien
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

export default OngletMediasCahier;

// ============================================================
// PedaClic — Phase 44 : Composants partagés des pages « Niveaux »
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ------------------------------------------------------------
// Regroupe ce qui est commun à NiveauPage, NiveauSeriesPage et
// NiveauCoursPage :
//   • useDonneesNiveau  : charge disciplines + cours d'un niveau
//   • FilAriane         : fil d'Ariane accessible
//   • ChargementNiveau  : squelette pendant le chargement
//   • EtatVideNiveau    : message quand il n'y a pas (encore) de contenu
//   • CarteDiscipline   : carte cliquable → /disciplines/:id
//   • NiveauIntrouvable : slug ou classe inconnus dans l'URL
// ============================================================

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Discipline, Niveau } from '../../types';
import type { CoursEnLigne } from '../../types/cours_types';
import {
  getDisciplinesDuNiveau,
  getTousCoursPublies,
  filtrerCoursNiveau,
} from '../../services/niveauxService';
import '../../styles/Niveaux.css';

// ------------------------------------------------------------
// HOOK : données d'un niveau
// ------------------------------------------------------------

interface DonneesNiveau {
  disciplines: Discipline[];
  cours: CoursEnLigne[];
  loading: boolean;
  error: string | null;
}

/**
 * Charge en parallèle les disciplines et les cours publiés d'un niveau.
 * Les deux chargements sont indépendants : si l'un échoue, l'autre
 * s'affiche quand même (dégradation progressive).
 */
export function useDonneesNiveau(niveau: Niveau | null): DonneesNiveau {
  const { currentUser } = useAuth();
  // Les cours « réservés profs » restent visibles pour les profs et l'admin
  const voitReservesPro = currentUser?.role === 'prof' || currentUser?.role === 'admin';

  const [etat, setEtat] = useState<DonneesNiveau>({
    disciplines: [], cours: [], loading: true, error: null,
  });

  useEffect(() => {
    if (!niveau) { setEtat((e) => ({ ...e, loading: false })); return; }
    let annule = false;
    setEtat((e) => ({ ...e, loading: true, error: null }));

    Promise.allSettled([
      getDisciplinesDuNiveau(niveau),
      getTousCoursPublies(voitReservesPro),
    ]).then(([resDisc, resCours]) => {
      if (annule) return;
      const echec = resDisc.status === 'rejected' && resCours.status === 'rejected';
      if (resDisc.status === 'rejected') console.error('[Niveaux] disciplines :', resDisc.reason);
      if (resCours.status === 'rejected') console.error('[Niveaux] cours :', resCours.reason);
      setEtat({
        disciplines: resDisc.status === 'fulfilled' ? resDisc.value : [],
        cours: resCours.status === 'fulfilled' ? filtrerCoursNiveau(resCours.value, niveau) : [],
        loading: false,
        error: echec ? 'Impossible de charger les contenus. Vérifiez votre connexion.' : null,
      });
    });

    return () => { annule = true; };
  }, [niveau, voitReservesPro]);

  return etat;
}

// ------------------------------------------------------------
// FIL D'ARIANE
// ------------------------------------------------------------

export interface EtapeAriane { label: string; to?: string }

export function FilAriane({ etapes }: { etapes: EtapeAriane[] }) {
  return (
    <nav className="niveau-ariane" aria-label="Fil d'Ariane">
      <ol>
        {etapes.map((e, i) => (
          <li key={i}>
            {/* Dernière étape = page courante, non cliquable */}
            {e.to && i < etapes.length - 1
              ? <Link to={e.to}>{e.label}</Link>
              : <span aria-current="page">{e.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ------------------------------------------------------------
// ÉTATS : chargement, vide, introuvable
// ------------------------------------------------------------

/** Squelette animé (4 cartes grises) */
export function ChargementNiveau() {
  return (
    <div className="niveau-grille" aria-busy="true" aria-label="Chargement…">
      {[0, 1, 2, 3].map((i) => <div key={i} className="niveau-squelette" />)}
    </div>
  );
}

/** Message affiché quand une section n'a pas encore de contenu */
export function EtatVideNiveau({ icone, titre, texte, lien }: {
  icone: string; titre: string; texte: string; lien?: { to: string; label: string };
}) {
  return (
    <div className="niveau-vide">
      <span className="niveau-vide__icone" aria-hidden="true">{icone}</span>
      <h3>{titre}</h3>
      <p>{texte}</p>
      {lien && <Link to={lien.to} className="niveau-btn niveau-btn--secondaire">{lien.label}</Link>}
    </div>
  );
}

/** Page affichée pour un niveau, une classe ou une série inexistants */
export function NiveauIntrouvable({ message }: { message: string }) {
  return (
    <div className="niveau-page">
      <div className="niveau-conteneur">
        <EtatVideNiveau
          icone="🧭"
          titre="Page introuvable"
          texte={message}
          lien={{ to: '/', label: "← Retour à l'accueil" }}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// CARTE DISCIPLINE → /disciplines/:id (page existante)
// ------------------------------------------------------------

export function CarteDiscipline({ discipline }: { discipline: Discipline }) {
  // La couleur saisie par l'admin colore la bordure gauche de la carte
  const couleur = discipline.couleur || 'var(--color-primary)';
  return (
    <Link
      to={`/disciplines/${discipline.id}`}
      className="niveau-discipline"
      style={{ borderLeftColor: couleur }}
    >
      <span className="niveau-discipline__icone" aria-hidden="true">
        {discipline.icone || '📘'}
      </span>
      <span className="niveau-discipline__corps">
        <strong>{discipline.nom}</strong>
        {discipline.description && (
          <span className="niveau-discipline__desc">
            {discipline.description.length > 90
              ? `${discipline.description.slice(0, 90)}…`
              : discipline.description}
          </span>
        )}
        {discipline.coefficient !== undefined && discipline.coefficient !== null && (
          <span className="niveau-discipline__coef">Coef. {discipline.coefficient}</span>
        )}
      </span>
      <span className="niveau-discipline__fleche" aria-hidden="true">→</span>
    </Link>
  );
}

/** Bandeau visible uniquement par l'admin quand un niveau est masqué */
export function BandeauNiveauMasque() {
  return (
    <div className="niveau-bandeau-admin" role="status">
      👁️ Ce niveau est <strong>masqué</strong> pour le public. Vous le voyez car vous êtes administrateur —{' '}
      <Link to="/admin/niveaux">modifier dans l'admin</Link>.
    </div>
  );
}

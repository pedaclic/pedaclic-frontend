// ============================================================
// PedaClic — ElveCahiersListePage
// Page de liste des cahiers de textes accessibles à l'élève
// Route : /eleve/cahiers
// L'élève voit tous les cahiers partagés (isPartage === true)
// dont les groupeIds incluent au moins un de ses groupes.
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import { getCahiersPartagesForEleve } from './services/cahierTextesService';
import type { CahierTextes } from './types/cahierTextes.types';
import './CahierEnrichi.css';
import './ElveCahiersListe.css';

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

const ElveCahiersListePage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // ── États ──
  const [cahiers, setCahiers]       = useState<CahierTextes[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur]         = useState('');

  // ── Chargement des cahiers accessibles ──
  useEffect(() => {
    async function chargerCahiers() {
      if (!currentUser) return;
      setChargement(true);
      setErreur('');

      try {
        // 1. Récupérer le document utilisateur pour avoir ses groupeIds
        const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
        if (!userSnap.exists()) {
          setErreur('Profil utilisateur introuvable.');
          return;
        }

        const userData = userSnap.data();
        const groupeIds: string[] = userData.groupeIds ?? [];

        // 2. Vérifier que l'élève appartient à au moins un groupe
        if (groupeIds.length === 0) {
          setCahiers([]);
          return;
        }

        // 3. Récupérer les cahiers partagés pour ces groupes
        const resultats = await getCahiersPartagesForEleve(groupeIds);
        setCahiers(resultats);
      } catch (err) {
        console.error('Erreur chargement cahiers élève :', err);
        setErreur('Impossible de charger les cahiers de textes.');
      } finally {
        setChargement(false);
      }
    }

    chargerCahiers();
  }, [currentUser]);

  // ─────────────────────────────────────────────────────────
  // RENDU — Chargement
  // ─────────────────────────────────────────────────────────

  if (chargement) {
    return (
      <div className="eleve-cahiers-liste-chargement">
        {/* Skeleton cards */}
        <div className="eleve-cahiers-liste-header-skeleton" />
        <div className="eleve-cahiers-liste-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="eleve-cahier-card-skeleton">
              <div className="skeleton-line w60" />
              <div className="skeleton-line w40" />
              <div className="skeleton-line w80" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDU — Erreur
  // ─────────────────────────────────────────────────────────

  if (erreur) {
    return (
      <div className="eleve-cahiers-liste-erreur">
        <span className="emoji">⚠️</span>
        <p>{erreur}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => window.location.reload()}
        >
          Réessayer
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDU PRINCIPAL
  // ─────────────────────────────────────────────────────────

  return (
    <main className="eleve-cahiers-liste-page">
      {/* ── En-tête ── */}
      <header className="eleve-cahiers-liste-hero">
        <h1>📖 Cahiers de textes</h1>
        <p>
          Retrouvez ici les séances réalisées par vos professeurs.
        </p>
      </header>

      {/* ── Aucun cahier ── */}
      {cahiers.length === 0 && (
        <div className="eleve-cahiers-vide">
          <span className="emoji">📭</span>
          <h3>Aucun cahier de textes disponible</h3>
          <p>
            Vos professeurs n'ont pas encore partagé de cahier avec votre classe.
            <br />
            Assurez-vous d'avoir rejoint un groupe-classe avec le code d'invitation de votre professeur.
          </p>
        </div>
      )}

      {/* ── Grille des cahiers ── */}
      {cahiers.length > 0 && (
        <>
          <p className="eleve-cahiers-compteur">
            {cahiers.length} cahier{cahiers.length > 1 ? 's' : ''} disponible{cahiers.length > 1 ? 's' : ''}
          </p>

          <div className="eleve-cahiers-liste-grid">
            {cahiers.map(cahier => (
              <article
                key={cahier.id}
                className="eleve-cahier-card"
                onClick={() => navigate(`/eleve/cahiers/${cahier.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter') navigate(`/eleve/cahiers/${cahier.id}`);
                }}
              >
                {/* Bande de couleur en haut */}
                <div
                  className="eleve-cahier-card-bande"
                  style={{ backgroundColor: '#2563eb' }}
                />

                {/* Contenu de la carte */}
                <div className="eleve-cahier-card-body">
                  {/* Matière */}
                  <span className="eleve-cahier-card-matiere">
                    {cahier.matiere}
                  </span>

                  {/* Titre */}
                  <h3 className="eleve-cahier-card-titre">
                    {cahier.titre}
                  </h3>

                  {/* Classe + Année */}
                  <div className="eleve-cahier-card-meta">
                    <span>🎓 {cahier.classe}</span>
                    <span>📅 {cahier.anneeScolaire}</span>
                  </div>

                  {/* Description (tronquée) */}
                  {cahier.description && (
                    <p className="eleve-cahier-card-desc">
                      {cahier.description.length > 100
                        ? cahier.description.slice(0, 100) + '…'
                        : cahier.description}
                    </p>
                  )}

                  {/* Groupes liés */}
                  {cahier.groupeNoms && cahier.groupeNoms.length > 0 && (
                    <div className="eleve-cahier-card-groupes">
                      {cahier.groupeNoms.map((nom, i) => (
                        <span key={i} className="badge-groupe-eleve">
                          👥 {nom}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Flèche d'accès */}
                <div className="eleve-cahier-card-arrow">
                  →
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
};

export default ElveCahiersListePage;

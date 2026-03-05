// ============================================================
// PedaClic — Phase 22 : ElveCahiersListePage
// Liste des cahiers de textes accessibles à l'élève.
// Route : /eleve/cahiers
// ============================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getGroupesEleve } from '../services/profGroupeService';
import { getCahiersPartagesForEleve } from '../services/cahierTextesService';
import type { CahierTextes } from '../types/cahierTextes.types';
import '../styles/CahierEnrichi.css';

const ElveCahiersListePage: React.FC = () => {
  const { currentUser } = useAuth();
  const [cahiers, setCahiers] = useState<CahierTextes[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    async function charger() {
      if (!currentUser?.uid) return;
      setChargement(true);
      setErreur('');

      try {
        const groupes = await getGroupesEleve(currentUser.uid);
        const groupeIds = groupes.map((g) => g.id);
        const liste = await getCahiersPartagesForEleve(groupeIds);
        setCahiers(liste);
      } catch {
        setErreur('Une erreur est survenue lors du chargement des cahiers.');
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, [currentUser?.uid]);

  if (chargement) {
    return (
      <div className="eleve-cahier-page">
        <div className="eleve-vide" style={{ padding: '3rem' }}>
          <p>Chargement des cahiers...</p>
        </div>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="eleve-cahier-page">
        <div className="eleve-vide" style={{ padding: '3rem', color: '#dc2626' }}>
          <p>{erreur}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="eleve-cahier-page">
      <header className="eleve-cahier-header">
        <h1>Mes cahiers de textes</h1>
        <p>
          Cahiers partagés par vos professeurs
        </p>
      </header>

      {cahiers.length === 0 ? (
        <div className="eleve-vide">
          <p>Aucun cahier de textes partagé pour le moment.</p>
          <p>Rejoignez un groupe via un code d'invitation pour accéder aux cahiers.</p>
        </div>
      ) : (
        <div className="eleve-cahiers-liste">
          {cahiers.map((c) => (
            <Link
              key={c.id}
              to={`/eleve/cahiers/${c.id}`}
              className="seance-card-eleve eleve-cahier-card"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <h3 className="seance-card-eleve-titre">{c.titre || 'Cahier sans titre'}</h3>
              {c.groupeNoms && c.groupeNoms.length > 0 && (
                <div className="seance-card-eleve-date">
                  {c.groupeNoms.join(', ')}
                </div>
              )}
              {c.anneeScolaire && (
                <div className="seance-card-eleve-date">{c.anneeScolaire}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ElveCahiersListePage;

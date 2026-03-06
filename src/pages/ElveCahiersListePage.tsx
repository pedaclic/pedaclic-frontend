// ============================================================
// PedaClic — Phase 22 : ElveCahiersListePage
// Liste des cahiers de textes accessibles à l'élève.
// Route : /eleve/cahiers
// ============================================================

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getGroupesEleve } from '../services/profGroupeService';
import { getCahiersPartagesForEleve } from '../services/cahierTextesService';
import type { CahierTextes } from '../types/cahierTextes.types';
import '../styles/CahierEnrichi.css';
import '../ElveCahiersListe.css';

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
        // 1. Récupérer les groupes via inscriptions (RejoindreGroupe)
        let groupes = await getGroupesEleve(currentUser.uid);
        let groupeIds = groupes.map((g) => g.id);

        // 2. Fallback : si aucun groupe, vérifier groupeIds dans le profil utilisateur
        if (groupeIds.length === 0) {
          const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            groupeIds = userData.groupeIds ?? [];
          }
        }

        if (groupeIds.length === 0) {
          setCahiers([]);
          return;
        }

        const liste = await getCahiersPartagesForEleve(groupeIds);
        setCahiers(liste);
      } catch (err) {
        console.error('[ElveCahiersListePage] Erreur chargement:', err);
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
    <main className="eleve-cahiers-liste-page">
      <header className="eleve-cahiers-liste-hero">
        <h1>📖 Cahiers de textes</h1>
        <p>Retrouvez ici les séances réalisées par vos professeurs.</p>
      </header>

      {cahiers.length === 0 ? (
        <div className="eleve-cahiers-vide">
          <span className="emoji">📭</span>
          <h3>Aucun cahier de textes disponible</h3>
          <p>
            Vos professeurs n'ont pas encore partagé de cahier avec votre classe.
            <br />
            Assurez-vous d'avoir rejoint un groupe-classe avec le code d'invitation de votre professeur.
          </p>
        </div>
      ) : (
        <>
          <p className="eleve-cahiers-compteur">
            {cahiers.length} cahier{cahiers.length > 1 ? 's' : ''} disponible{cahiers.length > 1 ? 's' : ''}
          </p>
        <div className="eleve-cahiers-liste-grid">
          {cahiers.map((c) => (
            <Link
              key={c.id}
              to={`/eleve/cahiers/${c.id}`}
              className="eleve-cahier-card"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div className="eleve-cahier-card-bande" style={{ backgroundColor: '#2563eb' }} />
              <div className="eleve-cahier-card-body">
                <span className="eleve-cahier-card-matiere">{c.matiere}</span>
                <h3 className="eleve-cahier-card-titre">{c.titre || 'Cahier sans titre'}</h3>
                <div className="eleve-cahier-card-meta">
                  <span>🎓 {c.classe}</span>
                  <span>📅 {c.anneeScolaire}</span>
                </div>
                {c.description && (
                  <p className="eleve-cahier-card-desc">
                    {c.description.length > 100 ? c.description.slice(0, 100) + '…' : c.description}
                  </p>
                )}
                {c.groupeNoms && c.groupeNoms.length > 0 && (
                  <div className="eleve-cahier-card-groupes">
                    {c.groupeNoms.map((nom, i) => (
                      <span key={i} className="badge-groupe-eleve">👥 {nom}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="eleve-cahier-card-arrow">→</div>
            </Link>
          ))}
        </div>
        </>
      )}
    </main>
  );
};

export default ElveCahiersListePage;

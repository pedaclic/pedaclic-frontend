// ============================================================
// PedaClic — Phase 58 : page de redirection « /seance/:entreeId »
// ------------------------------------------------------------
// Point d'entrée UNIQUE des liens de séance partagés.
//   1. Lit la séance (règles Firestore inchangées :
//        prof propriétaire, admin, ou élève si visibleEleves == true).
//   2. Redirige selon le rôle :
//        prof / admin → /prof/cahiers/:cahierId?seance=:id
//        élève        → /eleve/cahiers/:cahierId?seance=:id
//   3. Sinon : message « séance pas disponible ».
// La route est protégée : un visiteur non connecté passe par
// /connexion puis revient ici (Phase 56, state.from).
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PARAM_SEANCE } from '../utils/lienSeance';
import '../styles/Phase58.css';

type Etat = 'chargement' | 'indisponible' | 'autre_prof';

const SeanceLienPage: React.FC = () => {
  const { entreeId } = useParams<{ entreeId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [etat, setEtat] = useState<Etat>('chargement');

  useEffect(() => {
    if (!entreeId || !currentUser) return;
    let annule = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'entrees_cahier', entreeId));
        if (annule) return;
        if (!snap.exists()) { setEtat('indisponible'); return; }

        const data = snap.data() as { cahierId?: string; profId?: string; visibleEleves?: boolean };
        if (!data.cahierId) { setEtat('indisponible'); return; }
        const cible = `?${PARAM_SEANCE}=${encodeURIComponent(entreeId)}`;

        // Prof propriétaire ou admin → vue professeur
        if (currentUser.role === 'admin' ||
            (currentUser.role === 'prof' && data.profId === currentUser.uid)) {
          navigate(`/prof/cahiers/${data.cahierId}${cible}`, { replace: true });
          return;
        }
        // Élève → vue élève (le contrôle d'appartenance au cahier
        // reste assuré par ElveCahierPage / getCahierPartageById)
        if (currentUser.role === 'eleve') {
          navigate(`/eleve/cahiers/${data.cahierId}${cible}`, { replace: true });
          return;
        }
        // Prof non propriétaire : pas de vue adaptée
        setEtat('autre_prof');
      } catch {
        // permission-denied : séance non partagée / non réalisée / autre classe
        if (!annule) setEtat('indisponible');
      }
    })();

    return () => { annule = true; };
  }, [entreeId, currentUser, navigate]);

  if (etat === 'chargement') {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Ouverture de la séance…</p>
      </div>
    );
  }

  const retour = currentUser?.role === 'eleve' ? '/eleve/cahiers' : '/prof/cahiers';
  return (
    <main className="seance-lien-page">
      <div className="seance-lien-page__carte">
        <h1>Séance indisponible</h1>
        <p>
          {etat === 'autre_prof'
            ? 'Cette séance appartient au cahier d’un autre enseignant.'
            : 'Cette séance n’est pas encore disponible, ou vous n’y avez pas accès.'}
        </p>
        <Link to={retour} className="seance-lien-page__btn">Voir mes cahiers</Link>
      </div>
    </main>
  );
};

export default SeanceLienPage;

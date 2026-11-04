// ============================================================
// PedaClic — Phase 48 : bandeau « Aujourd'hui » (/prof/cahiers)
// ------------------------------------------------------------
// Affiche les cours du jour, TOUS établissements confondus, dans
// l'ordre chronologique. Un clic ouvre la saisie de la séance dans
// le bon cahier (même logique que les créneaux de l'emploi du temps).
// Rien n'est affiché le dimanche ou s'il n'y a aucun cours.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { subscribeEmploisProfAnnee } from '../../services/emploiDuTempsService';
import type { EmploiDuTempsProf } from '../../types/emploiDuTemps.types';
import type { EtablissementProf } from '../../types/etablissement.types';
import { libelleCourtEtablissement } from '../../types/etablissement.types';
import { aplatirCreneaux, trierCreneaux, enMinutes, jourCourant, estDimanche } from '../../utils/emploiDuTempsUtils';
import type { OuvrirCahierInfo } from './EmploiDuTempsDrawer';
import '../../styles/EmploiDuTemps.css';

interface EdtAujourdhuiProps {
  profId: string;
  annee: string;
  etablissements: EtablissementProf[];
  onOuvrirCahier: (info: OuvrirCahierInfo) => void;
  onVoirSemaine: () => void;
}

const EdtAujourdhui: React.FC<EdtAujourdhuiProps> = ({
  profId, annee, etablissements, onOuvrirCahier, onVoirSemaine,
}) => {
  const [emplois, setEmplois] = useState<EmploiDuTempsProf[]>([]);

  useEffect(() => {
    if (!profId || !annee) return;
    // Erreur silencieuse : le bandeau est un raccourci, pas un écran clé
    const unsub = subscribeEmploisProfAnnee(profId, annee, setEmplois, () => setEmplois([]));
    return () => unsub();
  }, [profId, annee]);

  const etabsParId = useMemo(() => new Map(etablissements.map(e => [e.id, e])), [etablissements]);
  const jour = jourCourant();
  const coursDuJour = useMemo(
    () => trierCreneaux(aplatirCreneaux(emplois).filter(c => c.jour === jour)),
    [emplois, jour]
  );

  if (estDimanche() || coursDuJour.length === 0) return null;

  // Heure actuelle en minutes : repère « maintenant » / « passé »
  const maintenant = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <section className="edt-aujourdhui" aria-label="Mes cours d'aujourd'hui">
      <div className="edt-aujourdhui-titre">
        <span>📍 Aujourd'hui — {coursDuJour.length} cours</span>
        <button type="button" className="edt-aujourdhui-lien" onClick={onVoirSemaine}>
          Ma semaine →
        </button>
      </div>
      <div className="edt-aujourdhui-liste">
        {coursDuJour.map(c => {
          const etab = c.etablissementId ? etabsParId.get(c.etablissementId) : undefined;
          const debut = enMinutes(c.heureDebut), fin = enMinutes(c.heureFin);
          const etat = maintenant >= fin ? 'passe' : maintenant >= debut ? 'maintenant' : 'avenir';
          return (
            <button
              key={c.cle}
              type="button"
              className={`edt-aujourdhui-item edt-aujourdhui-item--${etat}`}
              style={etab ? { borderLeftColor: etab.couleur } : undefined}
              onClick={() => onOuvrirCahier({
                classe: c.classe,
                matiere: c.matiere,
                groupeId: c.groupeId,
                groupeNom: c.groupeNom,
                etablissementId: c.etablissementId,
              })}
              title="Saisir la séance dans le cahier de textes"
            >
              <span>{etat === 'maintenant' ? '🟢 ' : ''}{c.heureDebut}–{c.heureFin}</span>
              <strong>{c.groupeNom ?? c.classe}{c.matiere ? ` · ${c.matiere}` : ''}</strong>
              <span>{etab ? libelleCourtEtablissement(etab) : (c.etablissementNom || '—')} · {c.salle}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default EdtAujourdhui;

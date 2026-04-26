/**
 * Vue lecture seule des notes — Élèves et Parents
 * PedaClic — Charte respectée
 */

import React, { useState, useEffect } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { getFeuillesForEleve, getFeuillesForParent } from '../../services/feuillesNotesService';
import { buildLignesNotes } from '../../services/feuillesNotesService';
import { getElevesGroupe } from '../../services/profGroupeService';
import type { FeuilleDeNotes, LigneNotes, StatutAbsenceDevoir } from '../../types/feuillesNotes.types';
import {
  STATUT_ABSENCE_LABELS,
  STATUT_ABSENCE_BADGES,
  STATUT_ABSENCE_COLORS,
} from '../../types/feuillesNotes.types';
import '../../styles/feuillesNotes.css';

interface FeuillesNotesViewProps {
  /** Pour élève : son uid. Pour parent : les uids de ses enfants */
  eleveIds: string[];
  /** Si true, on affiche le nom du groupe (pour parent avec plusieurs enfants) */
  showGroupeNom?: boolean;
  /** Si true, on filtre les lignes pour n'afficher que les élèves concernés (élève ou enfants du parent) */
  filterForEleves?: boolean;
}

const FeuillesNotesView: React.FC<FeuillesNotesViewProps> = ({ eleveIds, showGroupeNom = true, filterForEleves = true }) => {
  const [feuilles, setFeuilles] = useState<FeuilleDeNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeuille, setSelectedFeuille] = useState<FeuilleDeNotes | null>(null);
  const [lignes, setLignes] = useState<LigneNotes[]>([]);

  useEffect(() => {
    const load = async () => {
      const all = eleveIds.length > 1
        ? await getFeuillesForParent(eleveIds)
        : eleveIds.length === 1
          ? await getFeuillesForEleve(eleveIds[0])
          : [];
      all.sort((a, b) => {
        const da = a.dateDebut instanceof Date ? a.dateDebut : (a.dateDebut as { toDate?: () => Date })?.toDate?.() ?? new Date();
        const db = b.dateDebut instanceof Date ? b.dateDebut : (b.dateDebut as { toDate?: () => Date })?.toDate?.() ?? new Date();
        return db.getTime() - da.getTime();
      });
      setFeuilles(all);
      setLoading(false);
    };
    load();
  }, [eleveIds.join(',')]);

  useEffect(() => {
    if (!selectedFeuille) {
      setLignes([]);
      return;
    }
    getElevesGroupe(selectedFeuille.groupeId).then((insc) => {
      setLignes(
        buildLignesNotes(
          selectedFeuille,
          insc.map((i) => ({ eleveId: i.eleveId, eleveNom: i.eleveNom, eleveEmail: i.eleveEmail }))
        )
      );
    });
  }, [selectedFeuille?.id]);

  const lignesFiltrees = filterForEleves && eleveIds.length > 0
    ? lignes.filter((l) => eleveIds.includes(l.eleveId))
    : lignes;

  const getClasseMoyenne = (m: number) => {
    if (m >= 16) return 'prof-note-excellent';
    if (m >= 12) return 'prof-note-bien';
    if (m >= 10) return 'prof-note-passable';
    if (m >= 8) return 'prof-note-insuffisant';
    return 'prof-note-critique';
  };

  if (loading) return <p className="text-muted">Chargement des notes...</p>;
  if (feuilles.length === 0)
    return (
      <div className="feuilles-notes-empty">
        <FileSpreadsheet size={40} style={{ opacity: 0.5 }} />
        <p>Aucune feuille de notes pour le moment.</p>
      </div>
    );

  return (
    <div className="feuilles-notes-view">
      <div className="feuilles-notes-view-list">
        <h4>📝 Feuilles de notes</h4>
        {feuilles.map((f) => (
          <button
            key={f.id}
            className={`feuille-select-btn ${selectedFeuille?.id === f.id ? 'active' : ''}`}
            onClick={() => setSelectedFeuille(f)}
          >
            {showGroupeNom && `${f.groupeNom} — `}
            {/*
              Affiche le titre libre saisi par le prof s'il existe,
              sinon retombe sur le libellé de période. Même logique que
              FeuillesNotesManager.tsx (ligne 302) côté prof, pour que
              l'élève / le parent voient EXACTEMENT le même intitulé.
            */}
            {f.titre || f.periodeLabel}
            <span className="feuille-meta">
              {/* On garde la période en sous-libellé quand un titre est défini,
                  sinon on affiche la matière (comportement historique) */}
              {f.titre ? `${f.periodeLabel} • ${f.matiereNom}` : f.matiereNom}
            </span>
          </button>
        ))}
      </div>
      {selectedFeuille && (
        <div className="feuilles-notes-view-detail">
          <h4>
            {/* Titre principal du panneau de détail : titre libre s'il existe,
                sinon période + matière (comportement précédent) */}
            {selectedFeuille.titre
              ? `${selectedFeuille.titre} — ${selectedFeuille.matiereNom}`
              : `${selectedFeuille.periodeLabel} — ${selectedFeuille.matiereNom}`}
          </h4>
          <div className="feuille-readonly-table-wrapper">
            <table className="feuille-editor-table">
              {/* ────────────────────────────────────────────────────────────
                   En-tête du tableau de notes (vue élève / parent).
                   On conserve la colonne « Élève », puis chaque évaluation,
                   et on AJOUTE en fin de tableau les 3 colonnes de synthèse
                   identiques à l'éditeur prof :
                     • Moy. Devoirs  — moyenne pondérée des devoirs
                     • Moy. Gén.     — (Moy. Devoirs + Compo) / 2
                     • Rang          — classement dans la classe
                   ──────────────────────────────────────────────────────── */}
              <thead>
                <tr>
                  <th className="col-eleve">Élève</th>
                  {(selectedFeuille.evaluations || []).map((e) => (
                    <th key={e.id} className="col-note">
                      {e.libelle}
                    </th>
                  ))}
                  {/* Colonnes de synthèse : titres explicites + tooltip */}
                  <th className="col-moyenne" title="Moyenne des devoirs (pondérée par coef.)">
                    Moy. Devoirs
                  </th>
                  <th className="col-moyenne" title="Moyenne générale = (Moy. Devoirs + Compo) / 2">
                    Moy. Gén.
                  </th>
                  <th className="col-moyenne" title="Rang de classe (1 = meilleur)">
                    Rang
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignesFiltrees.map((l) => (
                  <tr key={l.eleveId}>
                    <td className="col-eleve">
                      <strong>{l.eleveNom}</strong>
                    </td>
                    {(selectedFeuille.evaluations || []).map((e) => {
                      // ── Statut d'absence (lecture seule) ──
                      //   Identique à l'éditeur prof, mais sans bouton de
                      //   bascule : on n'autorise pas l'élève / parent à
                      //   modifier. Le badge AJ / ANJ remplace la note.
                      const statut: StatutAbsenceDevoir | undefined = l.absences?.[e.id];
                      if (statut === 'absent_justifie' || statut === 'absent_non_justifie') {
                        return (
                          <td key={e.id} className="col-note">
                            <span
                              className="note-cell--absent"
                              title={STATUT_ABSENCE_LABELS[statut]}
                              style={{
                                color: STATUT_ABSENCE_COLORS[statut],
                                fontWeight: 700,
                                fontStyle: 'italic',
                              }}
                            >
                              {STATUT_ABSENCE_BADGES[statut]}
                            </span>
                          </td>
                        );
                      }
                      // Cas standard : on affiche la note (ou « — » si vide).
                      return (
                        <td key={e.id} className="col-note">
                          {l.notes[e.id] != null ? l.notes[e.id] : '—'}
                        </td>
                      );
                    })}
                    {/* Cellule Moy. Devoirs — colorée selon le palier de note */}
                    <td className={`col-moyenne ${getClasseMoyenne(l.moyenneDevoirs)}`}>
                      {l.moyenneDevoirs > 0 ? l.moyenneDevoirs.toFixed(2) : '—'}
                    </td>
                    {/* Cellule Moy. Générale — affichée en gras (valeur clé du bulletin) */}
                    <td className={`col-moyenne ${getClasseMoyenne(l.moyenneGenerale)}`}>
                      <strong>{l.moyenneGenerale > 0 ? l.moyenneGenerale.toFixed(2) : '—'}</strong>
                    </td>
                    {/* Cellule Rang — badge visuel (or pour 1er, violet pour top 3, gris sinon) */}
                    <td className="col-moyenne">
                      {l.rang > 0 ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontWeight: 600,
                            background: l.rang === 1 ? '#fde68a' : l.rang <= 3 ? '#e9d5ff' : '#e5e7eb',
                            color: l.rang === 1 ? '#78350f' : '#1f2937',
                          }}
                        >
                          {l.rang}
                          {l.rang === 1 ? 'er' : 'e'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeuillesNotesView;

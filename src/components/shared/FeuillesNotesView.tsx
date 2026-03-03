/**
 * Vue lecture seule des notes — Élèves et Parents
 * PedaClic — Charte respectée
 */

import React, { useState, useEffect } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { getFeuillesForEleve, getFeuillesForParent } from '../../services/feuillesNotesService';
import { buildLignesNotes } from '../../services/feuillesNotesService';
import { getElevesGroupe } from '../../services/profGroupeService';
import type { FeuilleDeNotes, LigneNotes } from '../../types/feuillesNotes.types';
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
            {f.periodeLabel}
            <span className="feuille-meta">{f.matiereNom}</span>
          </button>
        ))}
      </div>
      {selectedFeuille && (
        <div className="feuilles-notes-view-detail">
          <h4>
            {selectedFeuille.periodeLabel} — {selectedFeuille.matiereNom}
          </h4>
          <div className="feuille-readonly-table-wrapper">
            <table className="feuille-editor-table">
              <thead>
                <tr>
                  <th className="col-eleve">Élève</th>
                  {(selectedFeuille.evaluations || []).map((e) => (
                    <th key={e.id} className="col-note">
                      {e.libelle}
                    </th>
                  ))}
                  <th className="col-moyenne">Moyenne</th>
                </tr>
              </thead>
              <tbody>
                {lignesFiltrees.map((l) => (
                  <tr key={l.eleveId}>
                    <td className="col-eleve">
                      <strong>{l.eleveNom}</strong>
                    </td>
                    {(selectedFeuille.evaluations || []).map((e) => (
                      <td key={e.id} className="col-note">
                        {l.notes[e.id] != null ? l.notes[e.id] : '—'}
                      </td>
                    ))}
                    <td className={`col-moyenne ${getClasseMoyenne(l.moyenne)}`}>
                      {l.moyenne > 0 ? l.moyenne.toFixed(2) : '—'}
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

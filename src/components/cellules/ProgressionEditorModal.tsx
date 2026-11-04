// ============================================================
// PedaClic — Phase 49 : éditeur de progression commune (animateur)
// ------------------------------------------------------------
// Une progression = une liste de rubriques (chapitres / unités),
// chacune avec un nombre de séances prévues et ses leçons
// (une par ligne). Format identique aux rubriques du cahier :
// l'import dans un cahier est donc direct.
// ============================================================

import React, { useState } from 'react';
import { texteErreur } from '../../utils/messageErreurFirestore';
import { CLASSES, type RubriqueCahier } from '../../types/cahierTextes.types';
import { COULEURS_RUBRIQUES } from '../../services/cahierTextesService';
import type { ProgressionCellule } from '../../types/cellule.types';

/** Ligne éditable (les leçons sont saisies en texte, une par ligne) */
interface LigneRubrique {
  nom: string;
  seances: string;   // texte du champ numérique ('' = non précisé)
  lecons: string;    // une leçon par ligne
}

interface ProgressionEditorModalProps {
  initiale?: ProgressionCellule;
  onValider: (donnees: Pick<ProgressionCellule, 'titre' | 'classe' | 'rubriques'>) => Promise<void>;
  onClose: () => void;
}

const ligneVide = (): LigneRubrique => ({ nom: '', seances: '', lecons: '' });

const ProgressionEditorModal: React.FC<ProgressionEditorModalProps> = ({ initiale, onValider, onClose }) => {
  const [titre, setTitre] = useState(initiale?.titre ?? '');
  const [classe, setClasse] = useState<string>(initiale?.classe ?? '6ème');
  const [lignes, setLignes] = useState<LigneRubrique[]>(
    initiale?.rubriques.length
      ? initiale.rubriques.map(r => ({
          nom: r.nom,
          seances: r.nombreSeancesPrevu ? String(r.nombreSeancesPrevu) : '',
          lecons: (r.titres ?? []).map(t => t.nom).join('\n'),
        }))
      : [ligneVide()]
  );
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  const majLigne = (i: number, p: Partial<LigneRubrique>) =>
    setLignes(ls => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const deplacer = (i: number, sens: -1 | 1) => setLignes(ls => {
    const c = i + sens;
    if (c < 0 || c >= ls.length) return ls;
    const copie = [...ls];
    [copie[i], copie[c]] = [copie[c], copie[i]];
    return copie;
  });

  /** Convertit les lignes saisies au format RubriqueCahier */
  const versRubriques = (): RubriqueCahier[] =>
    lignes
      .filter(l => l.nom.trim())
      .map((l, i) => {
        const lecons = l.lecons.split('\n').map(s => s.trim()).filter(Boolean);
        const nb = parseInt(l.seances, 10);
        return {
          id: `p${i}`,
          nom: l.nom.trim(),
          ordre: i,
          couleur: COULEURS_RUBRIQUES[i % COULEURS_RUBRIQUES.length],
          ...(nb > 0 || lecons.length ? { nombreSeancesPrevu: Math.max(nb > 0 ? nb : 0, lecons.length) } : {}),
          ...(lecons.length
            ? { titres: lecons.map((nom, j) => ({ id: `p${i}_${j}`, nom, ordre: j, statut: 'non_commence' as const })) }
            : {}),
        };
      });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rubriques = versRubriques();
    if (!titre.trim()) { setErreur('Donnez un titre à la progression.'); return; }
    if (!rubriques.length) { setErreur('Ajoutez au moins une rubrique.'); return; }
    setSaving(true);
    setErreur('');
    try { await onValider({ titre, classe, rubriques }); }
    catch (err) { setErreur(texteErreur(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay cel-overlay" onClick={onClose}>
      <div className="modal-content cel-modal-large" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cel-prog-titre">
        <h2 className="modal-title" id="cel-prog-titre">
          🧭 {initiale ? 'Modifier la progression' : 'Nouvelle progression commune'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cel-prog-nom">Titre *</label>
              <input id="cel-prog-nom" className="form-input" required maxLength={120} autoFocus
                placeholder="Ex : Progression harmonisée 3ème"
                value={titre} onChange={e => setTitre(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cel-prog-classe">Classe</label>
              <select id="cel-prog-classe" className="form-select" value={classe} onChange={e => setClasse(e.target.value)}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* ── Rubriques ── */}
          <div className="cel-rubriques-editeur">
            {lignes.map((l, i) => (
              <fieldset key={i} className="cel-rubrique-ligne">
                <legend>Rubrique {i + 1}</legend>
                <div className="cel-rubrique-entete">
                  <input className="form-input" placeholder="Ex : Le récit — étude de la nouvelle" maxLength={120}
                    value={l.nom} onChange={e => majLigne(i, { nom: e.target.value })} aria-label={`Nom de la rubrique ${i + 1}`} />
                  <input className="form-input cel-input-nb" type="number" min={0} max={200} placeholder="Séances"
                    value={l.seances} onChange={e => majLigne(i, { seances: e.target.value })} aria-label="Nombre de séances prévues" />
                  <button type="button" className="btn-icon-sm" onClick={() => deplacer(i, -1)} disabled={i === 0} aria-label="Monter">↑</button>
                  <button type="button" className="btn-icon-sm" onClick={() => deplacer(i, 1)} disabled={i === lignes.length - 1} aria-label="Descendre">↓</button>
                  <button type="button" className="btn-icon-sm btn-icon-sm--danger"
                    onClick={() => setLignes(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : [ligneVide()])}
                    aria-label="Supprimer la rubrique">🗑️</button>
                </div>
                <textarea className="form-textarea" rows={3}
                  placeholder={'Leçons (une par ligne)\nEx : Lecture méthodique\nEx : Expression écrite'}
                  value={l.lecons} onChange={e => majLigne(i, { lecons: e.target.value })} aria-label="Leçons de la rubrique" />
              </fieldset>
            ))}
            <button type="button" className="btn-secondary" onClick={() => setLignes(ls => [...ls, ligneVide()])}>
              + Ajouter une rubrique
            </button>
          </div>

          {erreur && <p className="cel-erreur" role="alert">{erreur}</p>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer la progression'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProgressionEditorModal;

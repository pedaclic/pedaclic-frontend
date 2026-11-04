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
  seances: string;      // texte du champ numérique ('' = non précisé)
  lecons: string;       // une leçon par ligne
  /** true : le nombre de séances suit automatiquement le nombre de leçons */
  seancesAuto: boolean;
}

/** Leçons non vides d'une rubrique (une par ligne) */
const listeLecons = (texte: string) => texte.split('\n').map(s => s.trim()).filter(Boolean);

/** Une rubrique est « vide » si rien n'a été saisi (elle est alors ignorée) */
const estVide = (l: LigneRubrique) => !l.nom.trim() && !listeLecons(l.lecons).length && !l.seances.trim();

interface ProgressionEditorModalProps {
  initiale?: ProgressionCellule;
  onValider: (donnees: Pick<ProgressionCellule, 'titre' | 'classe' | 'rubriques'>) => Promise<void>;
  onClose: () => void;
}

const ligneVide = (): LigneRubrique => ({ nom: '', seances: '', lecons: '', seancesAuto: true });

const ProgressionEditorModal: React.FC<ProgressionEditorModalProps> = ({ initiale, onValider, onClose }) => {
  const [titre, setTitre] = useState(initiale?.titre ?? '');
  const [classe, setClasse] = useState<string>(initiale?.classe ?? '6ème');
  const [lignes, setLignes] = useState<LigneRubrique[]>(
    initiale?.rubriques.length
      ? initiale.rubriques.map(r => ({
          nom: r.nom,
          seances: r.nombreSeancesPrevu ? String(r.nombreSeancesPrevu) : '',
          lecons: (r.titres ?? []).map(t => t.nom).join('\n'),
          // Mode automatique si le nombre saisi correspond au nombre de leçons
          seancesAuto: !r.nombreSeancesPrevu || r.nombreSeancesPrevu === (r.titres ?? []).length,
        }))
      : [ligneVide()]
  );
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  const majLigne = (i: number, p: Partial<LigneRubrique>) =>
    setLignes(ls => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  /** Saisie des leçons : en mode auto, le nombre de séances suit */
  const majLecons = (i: number, lecons: string) =>
    setLignes(ls => ls.map((l, j) => {
      if (j !== i) return l;
      const nb = listeLecons(lecons).length;
      return l.seancesAuto ? { ...l, lecons, seances: nb ? String(nb) : '' } : { ...l, lecons };
    }));

  /** Saisie manuelle du nombre de séances : on quitte le mode auto */
  const majSeances = (i: number, seances: string) => majLigne(i, { seances, seancesAuto: false });

  /** Revient au calcul automatique (= nombre de leçons) */
  const recalerSeances = (i: number) =>
    setLignes(ls => ls.map((l, j) => {
      if (j !== i) return l;
      const nb = listeLecons(l.lecons).length;
      return { ...l, seances: nb ? String(nb) : '', seancesAuto: true };
    }));
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
      .filter(l => !estVide(l))
      .map((l, i) => {
        const lecons = listeLecons(l.lecons);
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
    if (!titre.trim()) { setErreur('Donnez un titre à la progression.'); return; }
    // Une rubrique commencée doit porter un nom (rien n'est ignoré en silence)
    const sansNom = lignes.findIndex(l => !estVide(l) && !l.nom.trim());
    if (sansNom >= 0) { setErreur(`Donnez un nom à la rubrique ${sansNom + 1}.`); return; }
    const rubriques = versRubriques();
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
                {/* Ligne 1 : nom (large) | séances (étroit) | actions */}
                <div className="cel-rubrique-entete">
                  <label className="cel-champ cel-champ--nom">
                    <span>Nom de la rubrique *</span>
                    <input className="form-input" placeholder="Ex : Le récit — étude de la nouvelle" maxLength={120}
                      value={l.nom} onChange={e => majLigne(i, { nom: e.target.value })} />
                  </label>
                  <label className="cel-champ cel-champ--nb">
                    <span>Séances</span>
                    <input className="form-input" type="number" inputMode="numeric"
                      min={listeLecons(l.lecons).length} max={200}
                      value={l.seances} onChange={e => majSeances(i, e.target.value)} />
                  </label>
                  <div className="cel-rubrique-actions">
                  <button type="button" className="btn-icon-sm" onClick={() => deplacer(i, -1)} disabled={i === 0} aria-label="Monter">↑</button>
                  <button type="button" className="btn-icon-sm" onClick={() => deplacer(i, 1)} disabled={i === lignes.length - 1} aria-label="Descendre">↓</button>
                  <button type="button" className="btn-icon-sm btn-icon-sm--danger"
                    onClick={() => setLignes(ls => ls.length > 1 ? ls.filter((_, j) => j !== i) : [ligneVide()])}
                    aria-label="Supprimer la rubrique">🗑️</button>
                  </div>
                </div>
                {/* Ligne 2 : leçons ; le nombre de séances se calcule tout seul */}
                <label className="cel-champ">
                  <span>Leçons (une par ligne)</span>
                  <textarea className="form-textarea" rows={3}
                    placeholder={'Ex : Lecture méthodique\nEx : Expression écrite'}
                    value={l.lecons} onChange={e => majLecons(i, e.target.value)} />
                </label>
                <p className="cel-seances-info">
                  {l.seancesAuto
                    ? <>🔄 Séances calculées automatiquement : {listeLecons(l.lecons).length} leçon(s).</>
                    : <>✏️ Nombre de séances saisi manuellement.{' '}
                        <button type="button" className="cel-lien" onClick={() => recalerSeances(i)}>
                          Recalculer d'après les leçons ({listeLecons(l.lecons).length})
                        </button></>}
                </p>
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

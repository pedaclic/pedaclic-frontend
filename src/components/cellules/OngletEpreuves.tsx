// ============================================================
// PedaClic — Phase 51 : onglet « 🧪 Épreuves communes »
// ------------------------------------------------------------
// • Animateur  : crée, valide (verrouille) / rouvre, supprime.
// • Membres    : co-construisent sujet, barème et corrigé tant que
//                l'épreuve est en brouillon (versions + anti-écrasement).
// • Tous       : export PDF (sujet, ou sujet + corrigé).
// • Résultats  : chaque professeur publie les STATISTIQUES ANONYMES
//                de sa classe, calculées depuis sa feuille de notes.
// • Observateur: consultation seule (aucun bouton d'écriture).
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import type {
  Cellule, EpreuveCommune, EpreuveFormData, LigneBareme, VersionEpreuve, ResultatsEpreuve,
} from '../../types/cellule.types';
import { TRANCHES_NOTES, dateLongue } from '../../types/cellule.types';
import { CLASSES } from '../../types/cahierTextes.types';
import type { FeuilleDeNotes } from '../../types/feuillesNotes.types';
import {
  creerEpreuve, enregistrerEpreuve, changerStatutEpreuve, supprimerEpreuve,
  subscribeVersions, subscribeResultats, publierResultats, retirerResultats, getMesFeuillesNotes,
  type Auteur,
} from '../../services/cellulesService';
import { agregerResultats } from '../../utils/statistiquesNotes';
import { exporterEpreuvePDF } from '../../utils/celluleExports';
import { texteErreur } from '../../utils/messageErreurFirestore';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

interface OngletEpreuvesProps {
  cellule: Cellule;
  epreuves: EpreuveCommune[];
  auteur: Auteur;
  estAnimateur: boolean;
  /** false pour un observateur (lecture seule) */
  peutContribuer: boolean;
}

const formVide = (): EpreuveFormData => ({
  titre: '', classe: '3ème', type: 'devoir_harmonise', date: '', duree: '2 h', noteSur: 20,
  sujet: '', bareme: [{ intitule: '', points: 0 }], corrige: '',
});

const totalBareme = (b: LigneBareme[]) => b.reduce((s, l) => s + (Number(l.points) || 0), 0);

// ═════════════════════════════════════════════════════════════
// Éditeur (création / modification / restauration)
// ═════════════════════════════════════════════════════════════
const EditeurEpreuve: React.FC<{
  titreModale: string;
  initial: EpreuveFormData;
  avecNote: boolean;
  noteInitiale?: string;
  onValider: (form: EpreuveFormData, note: string) => Promise<void>;
  onClose: () => void;
}> = ({ titreModale, initial, avecNote, noteInitiale = '', onValider, onClose }) => {
  const [form, setForm] = useState<EpreuveFormData>(initial);
  const [note, setNote] = useState(noteInitiale);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  const maj = (p: Partial<EpreuveFormData>) => setForm(f => ({ ...f, ...p }));
  const majLigne = (i: number, p: Partial<LigneBareme>) =>
    maj({ bareme: form.bareme.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const total = totalBareme(form.bareme);

  const valider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titre.trim()) { setErreur('Donnez un intitulé à l\'épreuve.'); return; }
    setSaving(true);
    setErreur('');
    try { await onValider(form, note); }
    catch (err) { setErreur(texteErreur(err, 'Enregistrement')); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay cel-overlay" onClick={onClose}>
      <div className="modal-content cel-modal-large" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ep-titre-modale">
        <h2 className="modal-title" id="ep-titre-modale">{titreModale}</h2>
        <form onSubmit={valider}>
          <div className="form-group">
            <label className="form-label" htmlFor="ep-titre">Intitulé *</label>
            <input id="ep-titre" className="form-input" required maxLength={120} placeholder="Ex : Devoir harmonisé n°1 — Le récit"
              value={form.titre} onChange={e => maj({ titre: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="ep-type">Type</label>
              <select id="ep-type" className="form-select" value={form.type}
                onChange={e => maj({ type: e.target.value as EpreuveFormData['type'] })}>
                <option value="devoir_harmonise">📝 Devoir harmonisé</option>
                <option value="composition">📊 Composition</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ep-classe">Classe</label>
              <select id="ep-classe" className="form-select" value={form.classe} onChange={e => maj({ classe: e.target.value })}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="ep-date">Date</label>
              <input id="ep-date" type="date" className="form-input" value={form.date} onChange={e => maj({ date: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ep-duree">Durée</label>
              <input id="ep-duree" className="form-input" maxLength={20} value={form.duree} onChange={e => maj({ duree: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="ep-sur">Noté sur</label>
              <input id="ep-sur" type="number" min={1} max={100} className="form-input" value={form.noteSur}
                onChange={e => maj({ noteSur: Number(e.target.value) })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ep-sujet">Sujet</label>
            <textarea id="ep-sujet" className="form-textarea cel-texte-long" rows={10}
              placeholder="Texte support, consignes, questions… (une ligne vide sépare deux paragraphes)"
              value={form.sujet} onChange={e => maj({ sujet: e.target.value })} />
          </div>

          {/* Barème : lignes intitulé / points, total contrôlé */}
          <fieldset className="cel-bareme">
            <legend className="form-label">
              Barème — total {total} / {form.noteSur}
              {total !== form.noteSur && <span className="cel-bareme-alerte"> ⚠️ le total diffère de la note maximale</span>}
            </legend>
            {form.bareme.map((l, i) => (
              <div key={i} className="cel-bareme-ligne">
                <input className="form-input" placeholder="Ex : I. Compréhension (questions 1 à 4)" maxLength={120}
                  value={l.intitule} onChange={e => majLigne(i, { intitule: e.target.value })} aria-label={`Partie ${i + 1}`} />
                <input className="form-input cel-input-nb" type="number" min={0} step={0.25}
                  value={l.points} onChange={e => majLigne(i, { points: Number(e.target.value) })} aria-label="Points" />
                <button type="button" className="btn-icon-sm btn-icon-sm--danger" aria-label="Supprimer la ligne"
                  onClick={() => maj({ bareme: form.bareme.length > 1 ? form.bareme.filter((_, j) => j !== i) : [{ intitule: '', points: 0 }] })}>🗑️</button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={() => maj({ bareme: [...form.bareme, { intitule: '', points: 0 }] })}>
              + Ajouter une partie
            </button>
          </fieldset>

          <div className="form-group">
            <label className="form-label" htmlFor="ep-corrige">Corrigé / éléments de réponse</label>
            <textarea id="ep-corrige" className="form-textarea cel-texte-long" rows={8}
              value={form.corrige} onChange={e => maj({ corrige: e.target.value })} />
          </div>

          {avecNote && (
            <div className="form-group">
              <label className="form-label" htmlFor="ep-note">Ce que vous avez modifié (visible dans l'historique)</label>
              <input id="ep-note" className="form-input" maxLength={200} placeholder="Ex : reformulation de la question 3"
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
          )}

          {erreur && <p className="cel-erreur" role="alert">{erreur}</p>}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// Historique des versions
// ═════════════════════════════════════════════════════════════
const HistoriqueVersions: React.FC<{
  celluleId: string; epreuveId: string; peutRestaurer: boolean;
  onRestaurer: (v: VersionEpreuve) => void;
}> = ({ celluleId, epreuveId, peutRestaurer, onRestaurer }) => {
  const [versions, setVersions] = useState<VersionEpreuve[]>([]);
  const [vue, setVue] = useState<string | null>(null);
  useEffect(() => subscribeVersions(celluleId, epreuveId, setVersions), [celluleId, epreuveId]);

  return (
    <div className="cel-versions">
      <h4 className="cel-sous-titre">📜 Historique ({versions.length} version{versions.length > 1 ? 's' : ''})</h4>
      <ol className="cel-versions-liste">
        {versions.map(v => (
          <li key={v.id}>
            <div className="cel-version-entete">
              <strong>v{v.numero}</strong>
              <span>{v.auteurNom}</span>
              <span className="cel-bloc-meta">
                {v.createdAt?.toDate?.().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              {v.note && <em className="cel-version-note">« {v.note} »</em>}
              <span className="cel-bloc-actions cel-version-actions">
                <button type="button" className="btn-secondary" onClick={() => setVue(vue === v.id ? null : v.id)}>
                  {vue === v.id ? 'Masquer' : 'Voir'}
                </button>
                {peutRestaurer && (
                  <button type="button" className="btn-secondary" onClick={() => onRestaurer(v)}>↩️ Repartir de cette version</button>
                )}
              </span>
            </div>
            {vue === v.id && (
              <div className="cel-version-contenu">
                <h5>Sujet</h5><p className="cel-cr-texte">{v.sujet || '—'}</p>
                <h5>Barème</h5>
                <ul>{v.bareme.map((l, i) => <li key={i}>{l.intitule} — {l.points} pt(s)</li>)}</ul>
                <h5>Corrigé</h5><p className="cel-cr-texte">{v.corrige || '—'}</p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// Résultats (statistiques anonymes)
// ═════════════════════════════════════════════════════════════
const ResultatsEpreuveBloc: React.FC<{
  cellule: Cellule; epreuve: EpreuveCommune; auteur: Auteur; peutContribuer: boolean;
}> = ({ cellule, epreuve, auteur, peutContribuer }) => {
  const { toast } = useToast();
  const [resultats, setResultats] = useState<ResultatsEpreuve[]>([]);
  const [publication, setPublication] = useState(false);
  const [feuilles, setFeuilles] = useState<FeuilleDeNotes[]>([]);
  const [feuilleId, setFeuilleId] = useState('');
  const [evaluationId, setEvaluationId] = useState('');
  const [groupeNom, setGroupeNom] = useState('');
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => subscribeResultats(cellule.id, epreuve.id, setResultats), [cellule.id, epreuve.id]);

  const global = useMemo(() => agregerResultats(resultats), [resultats]);
  const maxTranche = Math.max(1, ...(global?.repartition ?? [0]));
  const mesResultats = resultats.find(r => r.id === auteur.uid);

  // Ouverture : charge mes feuilles de la discipline (sinon toutes)
  const ouvrirPublication = async () => {
    setErreur('');
    setPublication(true);
    try {
      const toutes = await getMesFeuillesNotes(auteur.uid);
      const discipline = toutes.filter(f => f.matiereNom === cellule.discipline);
      const liste = (discipline.length ? discipline : toutes)
        .sort((a, b) => a.groupeNom.localeCompare(b.groupeNom, 'fr'));
      setFeuilles(liste);
      const premiere = liste[0];
      setFeuilleId(premiere?.id ?? '');
      setEvaluationId(premiere?.evaluations?.[premiere.evaluations.length - 1]?.id ?? '');
      setGroupeNom(premiere?.groupeNom ?? '');
    } catch (err) {
      setErreur(texteErreur(err, 'Lecture des feuilles de notes'));
    }
  };

  const feuille = feuilles.find(f => f.id === feuilleId);

  const publier = async () => {
    if (!feuille || !evaluationId) return;
    setSaving(true);
    setErreur('');
    try {
      await publierResultats(cellule.id, epreuve, auteur, feuille, evaluationId, groupeNom);
      toast.success('Statistiques publiées (aucune note individuelle n\'est partagée).');
      setPublication(false);
    } catch (err) {
      setErreur(texteErreur(err, 'Publication'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cel-resultats">
      <div className="cel-barre">
        <h4 className="cel-sous-titre">📊 Résultats harmonisés ({resultats.length} classe{resultats.length > 1 ? 's' : ''})</h4>
        {peutContribuer && (
          <div className="cel-bloc-actions">
            <button type="button" className="btn-primary" onClick={ouvrirPublication}>
              {mesResultats ? '🔄 Actualiser mes résultats' : '📊 Publier mes résultats'}
            </button>
            {mesResultats && (
              <button type="button" className="btn-secondary" onClick={() =>
                retirerResultats(cellule.id, epreuve.id, auteur.uid).catch(err => toast.error(texteErreur(err, 'Retrait')))
              }>Retirer</button>
            )}
          </div>
        )}
      </div>

      {resultats.length === 0 ? (
        <p className="cel-vide">Aucun résultat publié. Chaque professeur publie les statistiques de sa classe après correction.</p>
      ) : (
        <>
          {/* Tableau comparatif par classe (notes ramenées sur 20) */}
          <div className="cel-tableau-defilant">
            <table className="cel-tableau">
              <caption className="cel-bloc-meta">Notes ramenées sur 20 — statistiques anonymes</caption>
              <thead>
                <tr>
                  <th scope="col">Classe</th><th scope="col">Professeur</th><th scope="col">Présents</th>
                  <th scope="col">Moyenne</th><th scope="col">Médiane</th><th scope="col">Min – Max</th>
                  <th scope="col">Écart-type</th><th scope="col">≥ 10</th>
                </tr>
              </thead>
              <tbody>
                {resultats.map(r => (
                  <tr key={r.id}>
                    <th scope="row">{r.groupeNom}</th>
                    <td>{r.profNom}</td>
                    <td>{r.presents} / {r.effectif}</td>
                    <td className={r.moyenne >= 10 ? 'cel-ok' : 'cel-ko'}>{r.moyenne.toFixed(2)}</td>
                    <td>{r.mediane.toFixed(2)}</td>
                    <td>{r.min} – {r.max}</td>
                    <td>{r.ecartType.toFixed(2)}</td>
                    <td>{r.tauxReussite} %</td>
                  </tr>
                ))}
              </tbody>
              {global && resultats.length > 1 && (
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={2}>Ensemble de la cellule</th>
                    <td>{global.presents} / {global.effectif}</td>
                    <td className={global.moyenne >= 10 ? 'cel-ok' : 'cel-ko'}>{global.moyenne.toFixed(2)}</td>
                    <td>—</td>
                    <td>{global.min} – {global.max}</td>
                    <td>{global.ecartType.toFixed(2)}</td>
                    <td>{global.tauxReussite} %</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Répartition globale par tranches (barres horizontales) */}
          {global && (
            <div className="cel-repartition" aria-label="Répartition des notes, toutes classes confondues">
              <h5>Répartition des notes (toutes classes)</h5>
              {TRANCHES_NOTES.map((t, i) => (
                <div key={t.label} className="cel-repartition-ligne">
                  <span className="cel-repartition-label">{t.label}</span>
                  <span className="cel-repartition-barre">
                    <span className={t.min >= 10 ? 'cel-ok-fond' : 'cel-ko-fond'}
                      style={{ width: `${(global.repartition[i] / maxTranche) * 100}%` }} />
                  </span>
                  <span className="cel-repartition-nb">{global.repartition[i]}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modale de publication ── */}
      {publication && (
        <div className="modal-overlay cel-overlay" onClick={() => setPublication(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="ep-pub-titre">
            <h2 className="modal-title" id="ep-pub-titre">📊 Publier mes résultats</h2>
            <p className="cel-aide">
              Choisissez la feuille de notes et l'évaluation correspondant à « {epreuve.titre} ».
              Seuls des chiffres globaux (moyenne, médiane, répartition…) sont publiés :
              <strong> aucun nom ni aucune note d'élève</strong>.
            </p>
            {feuilles.length === 0 ? (
              <p className="cel-aide">Aucune feuille de notes trouvée. Créez-la d'abord depuis votre groupe-classe.</p>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="ep-feuille">Feuille de notes</label>
                  <select id="ep-feuille" className="form-select" value={feuilleId} onChange={e => {
                    const f = feuilles.find(x => x.id === e.target.value);
                    setFeuilleId(e.target.value);
                    setEvaluationId(f?.evaluations?.[f.evaluations.length - 1]?.id ?? '');
                    setGroupeNom(f?.groupeNom ?? '');
                  }}>
                    {feuilles.map(f => (
                      <option key={f.id} value={f.id}>{f.groupeNom} — {f.titre || f.periodeLabel} ({f.matiereNom})</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ep-eval">Évaluation</label>
                    <select id="ep-eval" className="form-select" value={evaluationId} onChange={e => setEvaluationId(e.target.value)}>
                      {(feuille?.evaluations ?? []).map(ev => <option key={ev.id} value={ev.id}>{ev.libelle}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ep-groupe">Libellé de la classe</label>
                    <input id="ep-groupe" className="form-input" maxLength={40} value={groupeNom} onChange={e => setGroupeNom(e.target.value)} />
                  </div>
                </div>
              </>
            )}
            {erreur && <p className="cel-erreur" role="alert">{erreur}</p>}
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setPublication(false)}>Annuler</button>
              <button type="button" className="btn-primary" onClick={publier} disabled={saving || !feuille || !evaluationId}>
                {saving ? 'Publication…' : 'Publier les statistiques'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
// Onglet
// ═════════════════════════════════════════════════════════════
const OngletEpreuves: React.FC<OngletEpreuvesProps> = ({ cellule, epreuves, auteur, estAnimateur, peutContribuer }) => {
  const confirmDialog = useConfirm();
  const { toast } = useToast();
  const [ouverte, setOuverte] = useState<string | null>(epreuves[0]?.id ?? null);
  const [voirCorrige, setVoirCorrige] = useState<Set<string>>(new Set());
  const [historique, setHistorique] = useState<string | null>(null);
  /** Édition en cours : épreuve + contenu de départ (+ note pré-remplie) */
  const [edition, setEdition] = useState<
    | { mode: 'creation' }
    | { mode: 'modification'; epreuve: EpreuveCommune; depart: EpreuveFormData; note: string }
    | null
  >(null);

  const versForm = (e: EpreuveCommune): EpreuveFormData => ({
    titre: e.titre, classe: e.classe, type: e.type, date: e.date, duree: e.duree, noteSur: e.noteSur,
    sujet: e.sujet, bareme: e.bareme.length ? e.bareme : [{ intitule: '', points: 0 }], corrige: e.corrige,
  });

  const exporter = (e: EpreuveCommune, corrige: boolean) =>
    exporterEpreuvePDF(e, cellule, corrige).catch(err => toast.error(texteErreur(err, 'Export PDF')));

  return (
    <section aria-label="Épreuves communes">
      <div className="cel-barre">
        <p className="cel-aide">
          Sujet, barème et corrigé construits ensemble. Chaque enregistrement crée une version ;
          l'animateur valide l'épreuve définitive. Les résultats sont comparés de façon anonyme.
        </p>
        {estAnimateur && <button className="btn-primary" onClick={() => setEdition({ mode: 'creation' })}>+ Nouvelle épreuve</button>}
      </div>

      {epreuves.length === 0 ? (
        <p className="cel-vide">Aucune épreuve commune pour l'instant.</p>
      ) : epreuves.map(e => {
        const deplie = ouverte === e.id;
        const validee = e.statut === 'validee';
        const peutModifier = peutContribuer && !validee;
        return (
          <article key={e.id} className="cel-bloc">
            <div className="cel-bloc-entete">
              <button type="button" className="cel-bloc-titre" onClick={() => setOuverte(deplie ? null : e.id)} aria-expanded={deplie}>
                <span className="cel-chevron" aria-hidden="true">{deplie ? '▾' : '▸'}</span>
                {e.type === 'composition' ? '📊' : '📝'} {e.titre}
              </button>
              <span className={`cel-statut ${validee ? 'cel-statut--validee' : ''}`}>
                {validee ? '✅ Validée' : `✏️ Brouillon v${e.version}`}
              </span>
            </div>
            <p className="cel-bloc-meta">
              {e.classe}{e.date ? ` · ${dateLongue(e.date)}` : ''}{e.duree ? ` · ${e.duree}` : ''} · sur {e.noteSur} ·
              dernière modification : {e.derniereModifParNom}
            </p>

            {deplie && (
              <div className="cel-cr">
                <h4>Sujet</h4>
                <p className="cel-cr-texte">{e.sujet || '—'}</p>

                {e.bareme.length > 0 && (
                  <>
                    <h4>Barème ({totalBareme(e.bareme)} / {e.noteSur})</h4>
                    <ul className="cel-bareme-lecture">
                      {e.bareme.map((l, i) => <li key={i}><span>{l.intitule}</span><strong>{l.points} pt{l.points > 1 ? 's' : ''}</strong></li>)}
                    </ul>
                  </>
                )}

                <button type="button" className="cel-retour" onClick={() => setVoirCorrige(s => {
                  const n = new Set(s); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n;
                })}>
                  {voirCorrige.has(e.id) ? '▾ Masquer le corrigé' : '▸ Afficher le corrigé'}
                </button>
                {voirCorrige.has(e.id) && <p className="cel-cr-texte">{e.corrige || '—'}</p>}

                <div className="cel-bloc-actions">
                  {peutModifier && (
                    <button type="button" className="btn-primary" onClick={() =>
                      setEdition({ mode: 'modification', epreuve: e, depart: versForm(e), note: '' })
                    }>✏️ Proposer une modification</button>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => exporter(e, false)}>📄 Sujet (PDF)</button>
                  <button type="button" className="btn-secondary" onClick={() => exporter(e, true)}>📄 Sujet + corrigé</button>
                  <button type="button" className="btn-secondary" onClick={() => setHistorique(historique === e.id ? null : e.id)}>
                    📜 Historique
                  </button>
                  {estAnimateur && (
                    <>
                      <button type="button" className="btn-secondary" onClick={async () => {
                        const ok = await confirmDialog(validee
                          ? { title: 'Rouvrir l\'épreuve ?', message: 'Les membres pourront de nouveau la modifier.', confirmLabel: 'Rouvrir', variant: 'warning' }
                          : { title: 'Valider l\'épreuve ?', message: 'Le sujet, le barème et le corrigé deviennent définitifs (vous pourrez rouvrir si besoin). Les membres sont prévenus.', confirmLabel: 'Valider', variant: 'success' });
                        if (ok) changerStatutEpreuve(cellule, e, auteur, validee ? 'brouillon' : 'validee')
                          .then(() => toast.success(validee ? 'Épreuve rouverte.' : 'Épreuve validée.'))
                          .catch(err => toast.error(texteErreur(err, 'Validation')));
                      }}>{validee ? '🔓 Rouvrir' : '✅ Valider'}</button>
                      <button type="button" className="btn-secondary cel-btn-danger" aria-label="Supprimer" onClick={async () => {
                        const ok = await confirmDialog({ title: 'Supprimer l\'épreuve ?', message: `« ${e.titre} » sera retirée de la cellule.`, confirmLabel: 'Supprimer', variant: 'danger' });
                        if (ok) supprimerEpreuve(cellule.id, e.id).then(() => toast.success('Épreuve supprimée.'))
                          .catch(err => toast.error(texteErreur(err, 'Suppression')));
                      }}>🗑️</button>
                    </>
                  )}
                </div>

                {historique === e.id && (
                  <HistoriqueVersions
                    celluleId={cellule.id}
                    epreuveId={e.id}
                    peutRestaurer={peutModifier}
                    onRestaurer={v => setEdition({
                      mode: 'modification', epreuve: e,
                      depart: { ...versForm(e), sujet: v.sujet, bareme: v.bareme.length ? v.bareme : [{ intitule: '', points: 0 }], corrige: v.corrige },
                      note: `Retour au contenu de la v${v.numero}`,
                    })}
                  />
                )}

                <ResultatsEpreuveBloc cellule={cellule} epreuve={e} auteur={auteur} peutContribuer={peutContribuer} />
              </div>
            )}
          </article>
        );
      })}

      {/* ── Éditeur ── */}
      {edition?.mode === 'creation' && (
        <EditeurEpreuve
          titreModale="🧪 Nouvelle épreuve commune"
          initial={formVide()}
          avecNote={false}
          onValider={async form => {
            await creerEpreuve(cellule, auteur, form);
            toast.success('Épreuve créée ; les membres sont prévenus.');
            setEdition(null);
          }}
          onClose={() => setEdition(null)}
        />
      )}
      {edition?.mode === 'modification' && (
        <EditeurEpreuve
          titreModale={`✏️ ${edition.epreuve.titre} — à partir de la v${edition.epreuve.version}`}
          initial={edition.depart}
          avecNote
          noteInitiale={edition.note}
          onValider={async (form, note) => {
            const v = await enregistrerEpreuve(cellule.id, edition.epreuve.id, auteur, form, edition.epreuve.version, note);
            toast.success(`Version ${v} enregistrée.`);
            setEdition(null);
          }}
          onClose={() => setEdition(null)}
        />
      )}
    </section>
  );
};

export default OngletEpreuves;

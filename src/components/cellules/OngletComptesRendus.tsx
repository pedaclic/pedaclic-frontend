// ============================================================
// PedaClic — Phase 50 : onglet « 📝 Comptes rendus » d'une cellule
// ------------------------------------------------------------
// • Animateur : rédige / modifie / supprime les comptes rendus
//   (présents cochés dans la liste des membres, ordre du jour,
//   échanges, décisions, prochaine réunion).
// • Tous : lecture, commentaires, export PDF à la charte PedaClic.
// ============================================================

import React, { useEffect, useState } from 'react';
import type {
  Cellule, CompteRenduCellule, CompteRenduFormData, CommentaireCR,
} from '../../types/cellule.types';
import { dateLongue } from '../../types/cellule.types';
import {
  enregistrerCompteRendu, supprimerCompteRendu,
  subscribeCommentaires, ajouterCommentaire, supprimerCommentaire,
  type Auteur,
} from '../../services/cellulesService';
import { exporterCompteRenduPDF } from '../../utils/celluleExports';
import { texteErreur } from '../../utils/messageErreurFirestore';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

interface OngletComptesRendusProps {
  cellule: Cellule;
  comptesRendus: CompteRenduCellule[];
  auteur: Auteur;
  estAnimateur: boolean;
  /** Membres actifs (pour cocher les présents) */
  membres: Array<{ id: string; nom: string }>;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const lignes = (t: string) => t.split('\n').map(s => s.trim()).filter(Boolean);

// ─────────────────────────────────────────────────────────────
// Fil de commentaires d'un compte rendu
// ─────────────────────────────────────────────────────────────
const FilCommentaires: React.FC<{
  celluleId: string; compteRenduId: string; auteur: Auteur; estAnimateur: boolean;
}> = ({ celluleId, compteRenduId, auteur, estAnimateur }) => {
  const { toast } = useToast();
  const [commentaires, setCommentaires] = useState<CommentaireCR[]>([]);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => subscribeCommentaires(celluleId, compteRenduId, setCommentaires), [celluleId, compteRenduId]);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true);
    try { await ajouterCommentaire(celluleId, compteRenduId, auteur, texte); setTexte(''); }
    catch (err) { toast.error(texteErreur(err, 'Commentaire')); }
    finally { setEnvoi(false); }
  };

  return (
    <div className="cel-commentaires">
      <h4 className="cel-sous-titre">💬 Commentaires ({commentaires.length})</h4>
      {commentaires.map(c => (
        <div key={c.id} className="cel-commentaire">
          <div className="cel-commentaire-entete">
            <strong>{c.auteurNom}</strong>
            <span className="cel-bloc-meta">
              {c.createdAt?.toDate?.().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
            {(c.auteurId === auteur.uid || estAnimateur) && (
              <button type="button" className="cel-commentaire-suppr" aria-label="Supprimer le commentaire"
                onClick={() => supprimerCommentaire(celluleId, compteRenduId, c.id).catch(err => toast.error(texteErreur(err, 'Suppression')))}>
                ✕
              </button>
            )}
          </div>
          {/* Texte affiché tel quel (React échappe le HTML) ; sauts de ligne conservés en CSS */}
          <p className="cel-commentaire-texte">{c.texte}</p>
        </div>
      ))}
      <form className="cel-commentaire-form" onSubmit={envoyer}>
        <textarea className="form-textarea" rows={2} maxLength={2000} placeholder="Ajouter un commentaire…"
          value={texte} onChange={e => setTexte(e.target.value)} aria-label="Votre commentaire" />
        <button type="submit" className="btn-primary" disabled={envoi || !texte.trim()}>{envoi ? '…' : 'Publier'}</button>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Onglet
// ─────────────────────────────────────────────────────────────
const OngletComptesRendus: React.FC<OngletComptesRendusProps> = ({
  cellule, comptesRendus, auteur, estAnimateur, membres,
}) => {
  const confirmDialog = useConfirm();
  const { toast } = useToast();
  const [ouvert, setOuvert] = useState<string | null>(comptesRendus[0]?.id ?? null);
  const [edition, setEdition] = useState<CompteRenduCellule | 'nouveau' | null>(null);
  const [form, setForm] = useState<CompteRenduFormData | null>(null);
  const [prevenir, setPrevenir] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');

  const maj = (p: Partial<CompteRenduFormData>) => setForm(f => (f ? { ...f, ...p } : f));

  const ouvrirEdition = (cr?: CompteRenduCellule) => {
    setErreur('');
    setPrevenir(true);
    setForm(cr
      ? {
          titre: cr.titre, dateReunion: cr.dateReunion, lieu: cr.lieu,
          presentsIds: cr.presentsIds, presentsNoms: cr.presentsNoms,
          ordreDuJour: cr.ordreDuJour, deliberations: cr.deliberations,
          decisions: cr.decisions, prochaineReunion: cr.prochaineReunion,
        }
      : {
          titre: 'Réunion de cellule', dateReunion: aujourdhui(), lieu: '',
          presentsIds: [auteur.uid], presentsNoms: [auteur.nom],
          ordreDuJour: '', deliberations: '', decisions: '', prochaineReunion: '',
        });
    setEdition(cr ?? 'nouveau');
  };

  /** Coche / décoche un présent (les noms suivent, pour le PDF) */
  const basculerPresent = (id: string) => {
    if (!form) return;
    const ids = form.presentsIds.includes(id) ? form.presentsIds.filter(x => x !== id) : [...form.presentsIds, id];
    const nomDe = (x: string) => membres.find(m => m.id === x)?.nom
      ?? form.presentsNoms[form.presentsIds.indexOf(x)] ?? 'Membre';
    maj({ presentsIds: ids, presentsNoms: ids.map(nomDe) });
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !form.titre.trim() || !form.dateReunion) { setErreur('Titre et date sont requis.'); return; }
    setSaving(true);
    setErreur('');
    try {
      await enregistrerCompteRendu(cellule, auteur, form, {
        compteRenduId: edition !== 'nouveau' && edition ? edition.id : undefined,
        prevenir,
      });
      toast.success('Compte rendu enregistré.');
      setEdition(null);
    } catch (err) {
      setErreur(texteErreur(err, 'Enregistrement'));
    } finally {
      setSaving(false);
    }
  };

  const supprimer = async (cr: CompteRenduCellule) => {
    const ok = await confirmDialog({ title: 'Supprimer le compte rendu ?', message: `« ${cr.titre} » du ${dateLongue(cr.dateReunion)} sera définitivement supprimé.`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try { await supprimerCompteRendu(cellule.id, cr.id); toast.success('Compte rendu supprimé.'); }
    catch (err) { toast.error(texteErreur(err, 'Suppression')); }
  };

  return (
    <section aria-label="Comptes rendus de réunion">
      <div className="cel-barre">
        <p className="cel-aide">Comptes rendus des réunions de cellule, exportables en PDF à la charte PedaClic.</p>
        {estAnimateur && <button className="btn-primary" onClick={() => ouvrirEdition()}>+ Nouveau compte rendu</button>}
      </div>

      {comptesRendus.length === 0 ? (
        <p className="cel-vide">Aucun compte rendu pour l'instant.</p>
      ) : comptesRendus.map(cr => {
        const deplie = ouvert === cr.id;
        return (
          <article key={cr.id} className="cel-bloc">
            <div className="cel-bloc-entete">
              <button type="button" className="cel-bloc-titre" onClick={() => setOuvert(deplie ? null : cr.id)} aria-expanded={deplie}>
                <span className="cel-chevron" aria-hidden="true">{deplie ? '▾' : '▸'}</span>📝 {cr.titre}
              </button>
              <span className="cel-badge">{new Date(`${cr.dateReunion}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <p className="cel-bloc-meta">
              {dateLongue(cr.dateReunion)}{cr.lieu ? ` · ${cr.lieu}` : ''} · {cr.presentsNoms.length} présent(s) · rédigé par {cr.auteurNom}
            </p>

            {deplie && (
              <div className="cel-cr">
                <h4>Présents</h4>
                <p>{cr.presentsNoms.join(', ') || '—'}</p>
                {lignes(cr.ordreDuJour).length > 0 && (<><h4>Ordre du jour</h4><ol>{lignes(cr.ordreDuJour).map((l, i) => <li key={i}>{l}</li>)}</ol></>)}
                {cr.deliberations && (<><h4>Déroulement et échanges</h4><p className="cel-cr-texte">{cr.deliberations}</p></>)}
                {lignes(cr.decisions).length > 0 && (<><h4>Décisions et recommandations</h4><ul>{lignes(cr.decisions).map((l, i) => <li key={i}>{l}</li>)}</ul></>)}
                {cr.prochaineReunion && (<><h4>Prochaine réunion</h4><p>{dateLongue(cr.prochaineReunion)}</p></>)}

                <div className="cel-bloc-actions">
                  <button type="button" className="btn-secondary" onClick={() =>
                    exporterCompteRenduPDF(cr, cellule).catch(err => toast.error(texteErreur(err, 'Export PDF')))
                  }>📄 Exporter en PDF</button>
                  {estAnimateur && (
                    <>
                      <button type="button" className="btn-secondary" onClick={() => ouvrirEdition(cr)}>✏️ Modifier</button>
                      <button type="button" className="btn-secondary cel-btn-danger" onClick={() => supprimer(cr)} aria-label="Supprimer">🗑️</button>
                    </>
                  )}
                </div>

                <FilCommentaires celluleId={cellule.id} compteRenduId={cr.id} auteur={auteur} estAnimateur={estAnimateur} />
              </div>
            )}
          </article>
        );
      })}

      {/* ── Modale de rédaction (animateur) ── */}
      {edition && form && (
        <div className="modal-overlay cel-overlay" onClick={() => setEdition(null)}>
          <div className="modal-content cel-modal-large" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cel-cr-titre">
            <h2 className="modal-title" id="cel-cr-titre">📝 {edition === 'nouveau' ? 'Nouveau compte rendu' : 'Modifier le compte rendu'}</h2>
            <form onSubmit={enregistrer}>
              <div className="form-group">
                <label className="form-label" htmlFor="cr-titre">Intitulé *</label>
                <input id="cr-titre" className="form-input" required maxLength={120}
                  value={form.titre} onChange={e => maj({ titre: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="cr-date">Date de la réunion *</label>
                  <input id="cr-date" type="date" className="form-input" required
                    value={form.dateReunion} onChange={e => maj({ dateReunion: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cr-lieu">Lieu</label>
                  <input id="cr-lieu" className="form-input" maxLength={100}
                    value={form.lieu} onChange={e => maj({ lieu: e.target.value })} />
                </div>
              </div>

              {/* Présents : cases à cocher sur les membres actuels */}
              <fieldset className="cel-presents">
                <legend className="form-label">Présents ({form.presentsIds.length})</legend>
                {membres.map(m => (
                  <label key={m.id} className={form.presentsIds.includes(m.id) ? 'actif' : ''}>
                    <input type="checkbox" checked={form.presentsIds.includes(m.id)} onChange={() => basculerPresent(m.id)} />
                    {m.nom}
                  </label>
                ))}
              </fieldset>

              <div className="form-group">
                <label className="form-label" htmlFor="cr-odj">Ordre du jour (un point par ligne)</label>
                <textarea id="cr-odj" className="form-textarea" rows={3}
                  value={form.ordreDuJour} onChange={e => maj({ ordreDuJour: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cr-delib">Déroulement et échanges</label>
                <textarea id="cr-delib" className="form-textarea" rows={6} maxLength={10000}
                  placeholder="Une ligne vide sépare deux paragraphes."
                  value={form.deliberations} onChange={e => maj({ deliberations: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cr-dec">Décisions et recommandations (une par ligne)</label>
                <textarea id="cr-dec" className="form-textarea" rows={3}
                  value={form.decisions} onChange={e => maj({ decisions: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cr-prochaine">Prochaine réunion</label>
                <input id="cr-prochaine" type="date" className="form-input"
                  value={form.prochaineReunion} onChange={e => maj({ prochaineReunion: e.target.value })} />
              </div>

              <label className="toggle-partage">
                <input type="checkbox" checked={prevenir} onChange={e => setPrevenir(e.target.checked)} />
                <span>🔔 Prévenir les membres (notification)</span>
              </label>

              {erreur && <p className="cel-erreur" role="alert">{erreur}</p>}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEdition(null)}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default OngletComptesRendus;

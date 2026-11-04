// ============================================================
// PedaClic — Phase 50 : onglet « 📅 Calendrier » d'une cellule
// ------------------------------------------------------------
// • Animateur : crée / modifie / supprime les événements
//   (devoirs harmonisés, compositions, réunions…) et peut
//   prévenir les membres (notification dans la cloche).
// • Tous : liste « À venir » / « Passés », compte à rebours,
//   ajout à son agenda personnel (.ics).
// ============================================================

import React, { useState } from 'react';
import type {
  Cellule, EvenementCellule, EvenementFormData, TypeEvenementCellule,
} from '../../types/cellule.types';
import {
  TYPE_EVENEMENT_CONFIG, dateLongue, joursAvant, libelleEcheance,
} from '../../types/cellule.types';
import { CLASSES } from '../../types/cahierTextes.types';
import { enregistrerEvenement, supprimerEvenement, type Auteur } from '../../services/cellulesService';
import { telechargerIcs } from '../../utils/celluleExports';
import { texteErreur } from '../../utils/messageErreurFirestore';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

interface OngletCalendrierProps {
  cellule: Cellule;
  evenements: EvenementCellule[];
  auteur: Auteur;
  estAnimateur: boolean;
}

/** Date du jour au format AAAA-MM-JJ (heure locale) */
const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formVide = (): EvenementFormData => ({
  type: 'devoir_harmonise', titre: '', date: aujourdhui(), heure: '', duree: 120, lieu: '', classe: '', description: '',
});

const OngletCalendrier: React.FC<OngletCalendrierProps> = ({ cellule, evenements, auteur, estAnimateur }) => {
  const confirmDialog = useConfirm();
  const { toast } = useToast();
  const [edition, setEdition] = useState<EvenementCellule | 'nouveau' | null>(null);
  const [form, setForm] = useState<EvenementFormData>(formVide());
  const [prevenir, setPrevenir] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  const [afficherPasses, setAfficherPasses] = useState(false);

  const maj = (p: Partial<EvenementFormData>) => setForm(f => ({ ...f, ...p }));

  const aVenir = evenements.filter(e => joursAvant(e.date) >= 0);
  const passes = evenements.filter(e => joursAvant(e.date) < 0).reverse(); // plus récents d'abord

  const ouvrir = (e?: EvenementCellule) => {
    setErreur('');
    setPrevenir(true);
    if (e) {
      setForm({ type: e.type, titre: e.titre, date: e.date, heure: e.heure, duree: e.duree || 120, lieu: e.lieu, classe: e.classe, description: e.description });
      setEdition(e);
    } else {
      setForm(formVide());
      setEdition('nouveau');
    }
  };

  const enregistrer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.titre.trim() || !form.date) { setErreur('Titre et date sont requis.'); return; }
    setSaving(true);
    setErreur('');
    try {
      await enregistrerEvenement(cellule, auteur, form, {
        evenementId: edition !== 'nouveau' && edition ? edition.id : undefined,
        prevenir,
      });
      toast.success(prevenir ? 'Événement enregistré, membres prévenus.' : 'Événement enregistré.');
      setEdition(null);
    } catch (err) {
      setErreur(texteErreur(err, 'Enregistrement'));
    } finally {
      setSaving(false);
    }
  };

  const supprimer = async (e: EvenementCellule) => {
    const ok = await confirmDialog({ title: 'Supprimer l\'événement ?', message: `« ${e.titre} » (${dateLongue(e.date)}) sera retiré du calendrier.`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try { await supprimerEvenement(cellule.id, e.id); toast.success('Événement supprimé.'); }
    catch (err) { toast.error(texteErreur(err, 'Suppression')); }
  };

  /** Carte d'un événement */
  const carte = (e: EvenementCellule, passe: boolean) => {
    const cfg = TYPE_EVENEMENT_CONFIG[e.type];
    const n = joursAvant(e.date);
    return (
      <article key={e.id} className={`cel-evt ${passe ? 'cel-evt--passe' : ''}`} style={{ borderLeftColor: cfg.couleur }}>
        {/* Bloc date (jour + mois abrégé) */}
        <div className="cel-evt-date" aria-hidden="true">
          <span className="cel-evt-jour">{Number(e.date.slice(8, 10))}</span>
          <span className="cel-evt-mois">
            {new Date(`${e.date}T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' })}
          </span>
        </div>
        <div className="cel-evt-corps">
          <div className="cel-evt-entete">
            <span className="cel-evt-type" style={{ color: cfg.couleur }}>{cfg.emoji} {cfg.label}</span>
            {!passe && (
              <span className={`cel-evt-echeance ${n <= 3 ? 'cel-evt-echeance--proche' : ''}`}>{libelleEcheance(e.date)}</span>
            )}
          </div>
          <h3 className="cel-evt-titre">{e.titre}</h3>
          <p className="cel-bloc-meta">
            {dateLongue(e.date)}{e.heure ? ` · ${e.heure}` : ' · journée'}
            {e.classe ? ` · ${e.classe}` : ''}{e.lieu ? ` · 📍 ${e.lieu}` : ''}
          </p>
          {e.description && <p className="cel-apercu">{e.description}</p>}
          <div className="cel-bloc-actions">
            {!passe && (
              <button type="button" className="btn-secondary" onClick={() => telechargerIcs(e, cellule)}
                title="Télécharge un fichier à ouvrir avec l'agenda du téléphone ou de l'ordinateur">
                📲 Ajouter à mon agenda
              </button>
            )}
            {estAnimateur && (
              <>
                <button type="button" className="btn-secondary" onClick={() => ouvrir(e)}>✏️ Modifier</button>
                <button type="button" className="btn-secondary cel-btn-danger" onClick={() => supprimer(e)} aria-label="Supprimer">🗑️</button>
              </>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <section aria-label="Calendrier de la cellule">
      <div className="cel-barre">
        <p className="cel-aide">
          Devoirs harmonisés, compositions et réunions de la cellule.
          « Ajouter à mon agenda » crée un rappel dans votre téléphone la veille.
        </p>
        {estAnimateur && <button className="btn-primary" onClick={() => ouvrir()}>+ Nouvel événement</button>}
      </div>

      <h3 className="cel-sous-titre">À venir ({aVenir.length})</h3>
      {aVenir.length === 0
        ? <p className="cel-vide">Aucun événement à venir.</p>
        : aVenir.map(e => carte(e, false))}

      {passes.length > 0 && (
        <>
          <button type="button" className="cel-retour" onClick={() => setAfficherPasses(v => !v)} aria-expanded={afficherPasses}>
            {afficherPasses ? '▾' : '▸'} Événements passés ({passes.length})
          </button>
          {afficherPasses && passes.map(e => carte(e, true))}
        </>
      )}

      {/* ── Modale de saisie (animateur) ── */}
      {edition && (
        <div className="modal-overlay cel-overlay" onClick={() => setEdition(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cel-evt-titre">
            <h2 className="modal-title" id="cel-evt-titre">📅 {edition === 'nouveau' ? 'Nouvel événement' : 'Modifier l\'événement'}</h2>
            <form onSubmit={enregistrer}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="evt-type">Type</label>
                  <select id="evt-type" className="form-select" value={form.type}
                    onChange={e => maj({ type: e.target.value as TypeEvenementCellule })}>
                    {(Object.keys(TYPE_EVENEMENT_CONFIG) as TypeEvenementCellule[]).map(t => (
                      <option key={t} value={t}>{TYPE_EVENEMENT_CONFIG[t].emoji} {TYPE_EVENEMENT_CONFIG[t].label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="evt-classe">Classe concernée</label>
                  <select id="evt-classe" className="form-select" value={form.classe} onChange={e => maj({ classe: e.target.value })}>
                    <option value="">Toutes les classes</option>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="evt-titre-champ">Intitulé *</label>
                <input id="evt-titre-champ" className="form-input" required maxLength={120} autoFocus
                  placeholder="Ex : Devoir harmonisé n°1 — Le récit"
                  value={form.titre} onChange={e => maj({ titre: e.target.value })} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="evt-date">Date *</label>
                  <input id="evt-date" type="date" className="form-input" required
                    value={form.date} onChange={e => maj({ date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="evt-heure">Heure (vide = journée)</label>
                  <input id="evt-heure" type="time" className="form-input"
                    value={form.heure} onChange={e => maj({ heure: e.target.value })} />
                </div>
                {form.heure && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="evt-duree">Durée (min)</label>
                    <input id="evt-duree" type="number" min={15} max={600} step={15} className="form-input"
                      value={form.duree} onChange={e => maj({ duree: Number(e.target.value) })} />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="evt-lieu">Lieu</label>
                <input id="evt-lieu" className="form-input" maxLength={100} placeholder="Ex : Salle des professeurs"
                  value={form.lieu} onChange={e => maj({ lieu: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="evt-desc">Précisions</label>
                <textarea id="evt-desc" className="form-textarea" rows={3} maxLength={1000}
                  placeholder="Chapitres évalués, durée de l'épreuve, consignes de correction…"
                  value={form.description} onChange={e => maj({ description: e.target.value })} />
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

export default OngletCalendrier;

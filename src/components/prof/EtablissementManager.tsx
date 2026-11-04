// ============================================================
// PedaClic — Phase 46 : Gestionnaire « Mes établissements »
// ------------------------------------------------------------
// Fenêtre modale : ajouter, modifier, réordonner, archiver,
// supprimer. Peut s'ouvrir PAR-DESSUS la modale de création de
// cahier (classe org-modal-superpose) ; `onCree` permet alors de
// présélectionner l'établissement qui vient d'être créé.
// ============================================================

import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import {
  creerEtablissement,
  modifierEtablissement,
  archiverEtablissement,
  reordonnerEtablissements,
  supprimerEtablissement,
} from '../../services/etablissementsService';
import {
  COULEURS_ETABLISSEMENT,
  etablissementFormVide,
  type EtablissementProf,
  type EtablissementFormData,
} from '../../types/etablissement.types';

interface EtablissementManagerProps {
  profId: string;
  etablissements: EtablissementProf[];
  /** Nombre de cahiers (année affichée) par établissement */
  compteurs: Map<string, number>;
  onClose: () => void;
  /** Appelé après création (présélection dans le formulaire de cahier) */
  onCree?: (etab: Pick<EtablissementProf, 'id' | 'nom'>) => void;
  /** Ouvre directement le formulaire d'ajout */
  ouvrirEnAjout?: boolean;
}

const EtablissementManager: React.FC<EtablissementManagerProps> = ({
  profId, etablissements, compteurs, onClose, onCree, ouvrirEnAjout = false,
}) => {
  const { toast } = useToast();
  const confirmDialog = useConfirm();

  // null = formulaire fermé · 'nouveau' = ajout · sinon établissement édité
  const [edition, setEdition] = useState<EtablissementProf | 'nouveau' | null>(
    ouvrirEnAjout || etablissements.length === 0 ? 'nouveau' : null
  );
  const [form, setForm] = useState<EtablissementFormData>(etablissementFormVide());
  const [saving, setSaving] = useState(false);

  const actifs = etablissements.filter(e => !e.isArchived);
  const archives = etablissements.filter(e => e.isArchived);

  // ── Ouverture du formulaire ──────────────────────────────
  const ouvrirAjout = () => {
    // Couleur suivante de la palette, pour distinguer les pastilles
    const couleur = COULEURS_ETABLISSEMENT[etablissements.length % COULEURS_ETABLISSEMENT.length];
    setForm({ ...etablissementFormVide(), couleur });
    setEdition('nouveau');
  };

  const ouvrirModif = (e: EtablissementProf) => {
    setForm({ nom: e.nom, sigle: e.sigle, ville: e.ville, ief: e.ief, couleur: e.couleur });
    setEdition(e);
  };

  // ── Enregistrement ───────────────────────────────────────
  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    ev.stopPropagation();           // ne pas soumettre la modale de cahier sous-jacente
    if (!form.nom.trim()) return;
    // Doublon de nom (insensible à la casse)
    const doublon = etablissements.find(e =>
      e.nom.trim().toLowerCase() === form.nom.trim().toLowerCase() &&
      (edition === 'nouveau' || e.id !== edition?.id)
    );
    if (doublon) { toast.warning(`« ${doublon.nom} » existe déjà.`); return; }

    setSaving(true);
    try {
      if (edition === 'nouveau') {
        const ordre = etablissements.reduce((m, e) => Math.max(m, e.ordre), -1) + 1;
        const id = await creerEtablissement(profId, form, ordre);
        toast.success('Établissement ajouté.');
        onCree?.({ id, nom: form.nom.trim() });
      } else if (edition) {
        await modifierEtablissement(profId, edition, form);
        toast.success('Établissement modifié.');
      }
      setEdition(null);
    } catch (err) {
      console.error(err);
      toast.error('Enregistrement impossible. Vérifiez votre connexion.');
    } finally {
      setSaving(false);
    }
  };

  // ── Réordonner (flèches haut / bas) ──────────────────────
  const deplacer = async (index: number, sens: -1 | 1) => {
    const cible = index + sens;
    if (cible < 0 || cible >= actifs.length) return;
    const ids = actifs.map(e => e.id);
    [ids[index], ids[cible]] = [ids[cible], ids[index]];
    try { await reordonnerEtablissements([...ids, ...archives.map(e => e.id)]); }
    catch { toast.error('Réordonnancement impossible.'); }
  };

  const handleArchiver = async (e: EtablissementProf) => {
    try { await archiverEtablissement(e.id, !e.isArchived); }
    catch { toast.error('Opération impossible.'); }
  };

  const handleSupprimer = async (e: EtablissementProf) => {
    const ok = await confirmDialog({
      title: 'Supprimer l\'établissement ?',
      message: `« ${e.nom} » sera retiré de votre carnet. Ses cahiers ne sont pas supprimés : ils redeviendront « Non classés ». Pour garder l'historique, préférez « Archiver ».`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await supprimerEtablissement(profId, e.id);
      toast.success('Établissement supprimé.');
    } catch {
      toast.error('Suppression impossible.');
    }
  };

  // ── Ligne d'établissement ────────────────────────────────
  const renderLigne = (e: EtablissementProf, index: number) => (
    <li key={e.id} className={`org-etab-ligne ${e.isArchived ? 'org-etab-ligne--archivee' : ''}`}>
      <span className="org-etab-pastille" style={{ background: e.couleur }} aria-hidden="true" />
      <div className="org-etab-infos">
        <strong>{e.nom}</strong>
        <span>
          {[e.sigle, e.ville, e.ief && `IEF ${e.ief}`].filter(Boolean).join(' · ') || '—'}
          {' · '}{compteurs.get(e.id) ?? 0} cahier(s)
        </span>
      </div>
      <div className="org-etab-actions">
        {!e.isArchived && (
          <>
            <button type="button" className="btn-icon-sm" onClick={() => deplacer(index, -1)} disabled={index === 0} title="Monter" aria-label="Monter">↑</button>
            <button type="button" className="btn-icon-sm" onClick={() => deplacer(index, 1)} disabled={index === actifs.length - 1} title="Descendre" aria-label="Descendre">↓</button>
          </>
        )}
        <button type="button" className="btn-icon-sm" onClick={() => ouvrirModif(e)} title="Modifier" aria-label="Modifier">✏️</button>
        <button type="button" className="btn-icon-sm" onClick={() => handleArchiver(e)} title={e.isArchived ? 'Réactiver' : 'Archiver'} aria-label={e.isArchived ? 'Réactiver' : 'Archiver'}>
          {e.isArchived ? '↩️' : '📦'}
        </button>
        <button type="button" className="btn-icon-sm btn-icon-sm--danger" onClick={() => handleSupprimer(e)} title="Supprimer" aria-label="Supprimer">🗑️</button>
      </div>
    </li>
  );

  return (
    <div className="modal-overlay org-modal-superpose" onClick={onClose}>
      <div className="modal-content org-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="org-etab-titre">
        <h2 className="modal-title" id="org-etab-titre">🏫 Mes établissements</h2>
        <p className="org-aide">
          Enregistrez les établissements où vous enseignez, puis rattachez-y vos cahiers
          pour les filtrer en un clic.
        </p>

        {/* ── Liste ── */}
        {actifs.length > 0 && <ul className="org-etab-liste">{actifs.map(renderLigne)}</ul>}
        {archives.length > 0 && (
          <details className="org-etab-archives">
            <summary>Établissements archivés ({archives.length})</summary>
            <ul className="org-etab-liste">{archives.map(renderLigne)}</ul>
          </details>
        )}

        {/* ── Formulaire ajout / modification ── */}
        {edition ? (
          <form className="org-etab-form" onSubmit={handleSubmit}>
            <h3>{edition === 'nouveau' ? 'Nouvel établissement' : `Modifier « ${edition.nom} »`}</h3>
            <div className="form-group">
              <label className="form-label" htmlFor="org-etab-nom">Nom *</label>
              <input id="org-etab-nom" className="form-input" required maxLength={120} autoFocus
                placeholder="Ex : Lycée Lamine Guèye"
                value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="org-etab-sigle">Sigle</label>
                <input id="org-etab-sigle" className="form-input" maxLength={12} placeholder="LLG"
                  value={form.sigle} onChange={e => setForm(f => ({ ...f, sigle: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="org-etab-ville">Ville</label>
                <input id="org-etab-ville" className="form-input" maxLength={60} placeholder="Dakar"
                  value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="org-etab-ief">Inspection (IA / IEF)</label>
              <input id="org-etab-ief" className="form-input" maxLength={60} placeholder="Ex : IEF Dakar-Plateau"
                value={form.ief} onChange={e => setForm(f => ({ ...f, ief: e.target.value }))} />
            </div>
            <div className="form-group">
              <span className="form-label">Couleur</span>
              <div className="couleur-picker">
                {COULEURS_ETABLISSEMENT.map(c => (
                  <button key={c} type="button"
                    className={`couleur-option ${form.couleur === c ? 'selected' : ''}`}
                    style={{ background: c }} aria-label={`Couleur ${c}`}
                    onClick={() => setForm(f => ({ ...f, couleur: c }))} />
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setEdition(null)}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={saving || !form.nom.trim()}>
                {saving ? 'Enregistrement…' : edition === 'nouveau' ? 'Ajouter' : 'Enregistrer'}
              </button>
            </div>
          </form>
        ) : (
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>
            <button type="button" className="btn-primary" onClick={ouvrirAjout}>+ Ajouter un établissement</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EtablissementManager;

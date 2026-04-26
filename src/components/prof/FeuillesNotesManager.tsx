/**
 * Gestionnaire de feuilles de notes — PedaClic
 * Liste des feuilles par groupe, création, navigation vers l'éditeur
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Plus, Pencil, Trash2, Check, X, Tag } from 'lucide-react';
import {
  getFeuillesByGroupe,
  creerFeuilleDeNotes,
  supprimerFeuille,
  updateTitreFeuille,
} from '../../services/feuillesNotesService';
import type { FeuilleDeNotes, PeriodeType } from '../../types/feuillesNotes.types';
import { PERIODE_LABELS } from '../../types/feuillesNotes.types';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import type { GroupeProf } from '../../types/prof';
import '../../styles/prof.css';

interface FeuillesNotesManagerProps {
  groupe: GroupeProf;
  currentUser: { uid: string; displayName?: string };
}

/** Génère les dates pour une période */
function getPeriodeDates(type: PeriodeType, annee: number, index: number): { debut: Date; fin: Date; label: string } {
  const debut = new Date(annee, 8, 1); // 1er sept
  if (type === 'mensuelle') {
    debut.setMonth(8 + index);
    const fin = new Date(debut);
    fin.setMonth(fin.getMonth() + 1);
    fin.setDate(0);
    const mois = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][debut.getMonth() + 1];
    return { debut, fin, label: `${mois} ${debut.getFullYear()}` };
  }
  if (type === 'trimestrielle') {
    const trim = index + 1;
    debut.setMonth(8 + (trim - 1) * 3);
    const fin = new Date(debut);
    fin.setMonth(fin.getMonth() + 3);
    fin.setDate(0);
    return { debut, fin, label: `${trim}er trimestre` };
  }
  // semestrielle
  debut.setMonth(8 + index * 6);
  const fin = new Date(debut);
  fin.setMonth(fin.getMonth() + 6);
  fin.setDate(0);
  return { debut, fin, label: `${index + 1}er semestre` };
}

const FeuillesNotesManager: React.FC<FeuillesNotesManagerProps> = ({ groupe, currentUser }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirmDlg = useConfirm();
  const [feuilles, setFeuilles] = useState<FeuilleDeNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPeriodeType, setNewPeriodeType] = useState<PeriodeType>('trimestrielle');
  const [newPeriodeIndex, setNewPeriodeIndex] = useState(0);
  // ✨ Titre libre saisi à la création (vide → l'UI retombera sur la
  //    période, comportement historique pour ne pas surprendre).
  const [newTitre, setNewTitre] = useState<string>('');
  // ✨ Édition inline du titre d'une feuille existante.
  //    `editTitreId` : id de la feuille en cours d'édition (null = aucune).
  //    `draftTitre`  : valeur du champ de saisie pendant l'édition.
  const [editTitreId, setEditTitreId] = useState<string | null>(null);
  const [draftTitre, setDraftTitre] = useState<string>('');

  useEffect(() => {
    getFeuillesByGroupe(groupe.id).then(setFeuilles).catch(console.error).finally(() => setLoading(false));
  }, [groupe.id]);

  const handleCreate = async () => {
    if (!currentUser?.uid) return;
    setCreating(true);
    try {
      const annee = parseInt(groupe.anneeScolaire.split('-')[0], 10);
      const { debut, fin, label } = getPeriodeDates(newPeriodeType, annee, newPeriodeIndex);
      const f = await creerFeuilleDeNotes(
        groupe.id,
        groupe.nom,
        groupe.matiereId,
        groupe.matiereNom,
        currentUser.uid,
        currentUser.displayName || 'Professeur',
        groupe.anneeScolaire,
        newPeriodeType,
        label,
        debut,
        fin,
        // 12e arg : evaluations par défaut (générées côté service).
        [],
        // 13e arg ✨ : titre libre saisi par le prof.
        newTitre,
      );
      setShowCreate(false);
      setNewTitre(''); // reset pour la prochaine création
      setFeuilles((prev) => [f, ...prev]);
      // ✨ On transmet le groupeId via location.state pour que le bouton
      //    "Retour" de l'éditeur sache à quel onglet revenir (tab "notes").
      navigate(`/prof/feuilles/${f.id}`, {
        state: { groupeId: groupe.id, fromTab: 'notes' },
      });
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la création.');
    } finally {
      setCreating(false);
    }
  };

  /**
   * ✨ Persiste le titre saisi pour une feuille existante.
   *  - Vide la saisie revient à supprimer le titre (et donc retomber
   *    sur le periodeLabel à l'affichage).
   *  - Optimiste : on met l'état local à jour avant la confirmation
   *    serveur pour fluidité ; en cas d'erreur on log et on toast.
   */
  const handleSaveTitre = async (feuille: FeuilleDeNotes) => {
    const valeur = draftTitre.trim();
    setEditTitreId(null);
    // Pas de changement → on n'appelle pas Firestore inutilement.
    if ((feuille.titre || '') === valeur) return;
    setFeuilles((prev) =>
      prev.map((x) => (x.id === feuille.id ? { ...x, titre: valeur || undefined } : x)),
    );
    try {
      await updateTitreFeuille(feuille.id, valeur);
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de mettre à jour le titre.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDlg({ title: 'Supprimer ?', message: 'Supprimer cette feuille de notes ?', confirmLabel: 'Supprimer', variant: 'danger' })) return;
    try {
      await supprimerFeuille(id);
      setFeuilles((prev) => prev.filter((f) => f.id !== id));
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la suppression.');
    }
  };

  const periodeOptions =
    newPeriodeType === 'mensuelle'
      ? Array.from({ length: 10 }, (_, i) => ({ i, label: getPeriodeDates('mensuelle', parseInt(groupe.anneeScolaire.split('-')[0], 10), i).label }))
      : newPeriodeType === 'trimestrielle'
        ? [
            { i: 0, label: '1er trimestre' },
            { i: 1, label: '2e trimestre' },
            { i: 2, label: '3e trimestre' },
          ]
        : [
            { i: 0, label: '1er semestre' },
            { i: 1, label: '2e semestre' },
          ];

  return (
    <div className="feuilles-notes-manager">
      <div className="feuilles-notes-header">
        <h3 className="feuilles-notes-titre">
          <FileSpreadsheet size={22} /> Feuilles de notes
        </h3>
        <button
          className="prof-btn prof-btn-primary"
          onClick={() => setShowCreate(!showCreate)}
          disabled={creating}
        >
          <Plus size={18} /> Nouvelle feuille
        </button>
      </div>

      {showCreate && (
        <div className="feuilles-notes-create-card">
          <h4>Créer une feuille</h4>
          <div className="feuilles-notes-create-form">
            {/*
              ✨ Titre libre de la feuille (facultatif).
              Permet de différencier plusieurs feuilles d'une même
              discipline/période — ex. « Évaluation orthographe » vs
              « Évaluation grammaire » sur le 1er trimestre.
              Si vide, l'affichage retombe sur le `periodeLabel`.
            */}
            <div className="form-group">
              <label htmlFor="feuille-titre">
                Titre de la feuille <span className="text-muted">(optionnel)</span>
              </label>
              <input
                id="feuille-titre"
                type="text"
                className="prof-select"
                placeholder="Ex. Évaluation orthographe — 1er trimestre"
                value={newTitre}
                onChange={(e) => setNewTitre(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="form-group">
              <label>Période</label>
              <select
                className="prof-select"
                value={newPeriodeType}
                onChange={(e) => setNewPeriodeType(e.target.value as PeriodeType)}
              >
                {(['mensuelle', 'trimestrielle', 'semestrielle'] as PeriodeType[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIODE_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Période</label>
              <select
                className="prof-select"
                value={newPeriodeIndex}
                onChange={(e) => setNewPeriodeIndex(Number(e.target.value))}
              >
                {periodeOptions.map((opt) => (
                  <option key={opt.i} value={opt.i}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="feuilles-notes-create-actions">
              <button className="prof-btn prof-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? 'Création...' : 'Créer'}
              </button>
              <button className="prof-btn prof-btn-secondary" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Chargement...</p>
      ) : feuilles.length === 0 ? (
        <div className="prof-empty-state">
          <FileSpreadsheet size={48} style={{ opacity: 0.5 }} />
          <p>Aucune feuille de notes. Créez-en une pour suivre les notes de la classe.</p>
        </div>
      ) : (
        <div className="feuilles-notes-list">
          {feuilles.map((f) => {
            const enEdition = editTitreId === f.id;
            return (
              <div key={f.id} className="feuilles-notes-card">
                <div className="feuilles-notes-card-body">
                  {/*
                    Titre principal : en mode lecture, on privilégie
                    f.titre, à défaut on retombe sur le periodeLabel
                    (rétro-compatibilité avec les feuilles existantes).
                    En mode édition, un input remplace le titre + boutons
                    OK / Annuler. Validation : Enter, Annulation : Escape.
                  */}
                  {enEdition ? (
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <input
                        type="text"
                        className="prof-select"
                        autoFocus
                        value={draftTitre}
                        placeholder={f.periodeLabel}
                        onChange={(e) => setDraftTitre(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveTitre(f);
                          if (e.key === 'Escape') setEditTitreId(null);
                        }}
                        maxLength={120}
                        style={{ flex: '1 1 240px', minWidth: 200 }}
                      />
                      <button
                        className="prof-btn prof-btn-primary prof-btn-sm"
                        onClick={() => handleSaveTitre(f)}
                        title="Enregistrer le titre"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        className="prof-btn prof-btn-secondary prof-btn-sm"
                        onClick={() => setEditTitreId(null)}
                        title="Annuler"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <strong>{f.titre || f.periodeLabel}</strong>
                      {/*
                        Quand un titre custom est défini, on garde le
                        periodeLabel en sous-ligne pour ne pas perdre
                        l'information de période d'un coup d'œil.
                      */}
                      {f.titre && (
                        <span className="feuilles-notes-meta" style={{ display: 'block' }}>
                          {f.periodeLabel}
                        </span>
                      )}
                      <span className="feuilles-notes-meta">
                        {f.matiereNom} • {f.anneeScolaire}
                      </span>
                    </>
                  )}
                </div>
                <div className="feuilles-notes-card-actions">
                  {/*
                    ✨ Bouton « Renommer » : place la carte en mode
                    édition de titre (sans aller sur l'éditeur).
                    Permet le renommage rétroactif des feuilles
                    existantes (qui n'avaient pas de titre).
                  */}
                  {!enEdition && (
                    <button
                      className="prof-btn prof-btn-secondary prof-btn-sm"
                      onClick={() => {
                        setEditTitreId(f.id);
                        setDraftTitre(f.titre || '');
                      }}
                      title="Renommer la feuille"
                    >
                      <Tag size={14} /> Renommer
                    </button>
                  )}
                  <button
                    className="prof-btn prof-btn-primary prof-btn-sm"
                    onClick={() =>
                      // ✨ Idem que pour la création : on transporte le contexte
                      //    du groupe (id + onglet d'origine) afin de pouvoir y
                      //    revenir précisément depuis l'éditeur de feuille.
                      navigate(`/prof/feuilles/${f.id}`, {
                        state: { groupeId: groupe.id, fromTab: 'notes' },
                      })
                    }
                  >
                    <Pencil size={14} /> Modifier
                  </button>
                  <button
                    className="prof-btn prof-btn-danger prof-btn-sm"
                    onClick={() => handleDelete(f.id)}
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeuillesNotesManager;

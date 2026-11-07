// ============================================================
// PedaClic — Phase 53 : Copier des rubriques vers d'autres cahiers
// ------------------------------------------------------------
// Ouvert depuis la section « 📂 Rubriques » de CahierDetailPage :
//   • bouton d'en-tête « ⧉ Copier vers… » → toutes les rubriques
//     précochées ;
//   • bouton ⧉ d'une ligne → seule cette rubrique précochée.
//
// Étapes dans la fenêtre :
//   1. choisir les rubriques à copier ;
//   2. choisir les cahiers de destination (par défaut : même
//      niveau + même discipline + même année, non archivés) ;
//   3. régler les options (doublons, avancement des titres) ;
//   4. lire le bilan par cahier.
//
// Le cahier source n'est jamais modifié (voir le service).
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import {
  getCahiersByProf,
  copierRubriquesVersCahiers,
  normaliserLibelleRubrique,
  getNombreSeancesEffectif,
  type ModeConflitRubrique,
  type ResultatCopieCahier,
} from '../../services/cahierTextesService';
import type { CahierTextes, RubriqueCahier } from '../../types/cahierTextes.types';
import { libelleClasse } from '../../utils/organisateurCahiers';
import './CopierRubriquesModal.css';

interface CopierRubriquesModalProps {
  /** Cahier ouvert (source de la copie — jamais modifié) */
  cahierSource: CahierTextes;
  /** Rubriques du cahier source, dans leur ordre d'affichage */
  rubriques: RubriqueCahier[];
  /** UID du professeur connecté */
  profId: string;
  /** Rubriques précochées à l'ouverture (toutes si absent) */
  rubriqueIdsInitiales?: string[];
  onClose: () => void;
}

const CopierRubriquesModal: React.FC<CopierRubriquesModalProps> = ({
  cahierSource, rubriques, profId, rubriqueIdsInitiales, onClose,
}) => {
  const { toast } = useToast();

  // ── États ──────────────────────────────────────────────────
  const [cahiers, setCahiers] = useState<CahierTextes[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);

  const [rubriquesCochees, setRubriquesCochees] = useState<Set<string>>(
    () => new Set(rubriqueIdsInitiales?.length ? rubriqueIdsInitiales : rubriques.map(r => r.id))
  );
  const [ciblesCochees, setCiblesCochees] = useState<Set<string>>(new Set());

  // Filtres de la liste des cahiers de destination
  const [memeNiveauSeulement, setMemeNiveauSeulement] = useState(true);
  const [afficherArchives, setAfficherArchives] = useState(false);

  // Options de copie
  const [conflit, setConflit] = useState<ModeConflitRubrique>('ignorer');
  const [conserverStatuts, setConserverStatuts] = useState(false);

  const [saving, setSaving] = useState(false);
  const [resultats, setResultats] = useState<ResultatCopieCahier[] | null>(null);

  // ── Chargement des autres cahiers du professeur (même année) ─
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        setLoading(true);
        const liste = await getCahiersByProf(profId, cahierSource.anneeScolaire);
        if (!annule) setCahiers(liste.filter(c => c.id !== cahierSource.id));
      } catch (err) {
        console.error('[CopierRubriquesModal] Chargement des cahiers :', err);
        if (!annule) setErreurChargement('Impossible de charger vos cahiers. Vérifiez votre connexion.');
      } finally {
        if (!annule) setLoading(false);
      }
    })();
    return () => { annule = true; };
  }, [profId, cahierSource.id, cahierSource.anneeScolaire]);

  // ── Fermeture au clavier (Échap), sauf pendant l'écriture ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  // ── Données dérivées ───────────────────────────────────────
  const estMemeNiveau = (c: CahierTextes) =>
    c.classe === cahierSource.classe && c.matiere === cahierSource.matiere;

  /** Cahiers affichés : filtrés puis « même niveau » en tête */
  const cahiersVisibles = useMemo(() => {
    return cahiers
      .filter(c => afficherArchives || !c.isArchived)
      .filter(c => !memeNiveauSeulement || estMemeNiveau(c))
      .sort((a, b) => {
        const d = Number(estMemeNiveau(b)) - Number(estMemeNiveau(a));
        return d !== 0 ? d : libelleClasse(a).localeCompare(libelleClasse(b), 'fr', { numeric: true });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cahiers, afficherArchives, memeNiveauSeulement, cahierSource.classe, cahierSource.matiere]);

  const rubriquesAcopier = useMemo(
    () => rubriques.filter(r => rubriquesCochees.has(r.id)),
    [rubriques, rubriquesCochees]
  );

  /** Aperçu : combien de rubriques sélectionnées existent déjà dans un cahier */
  const nbDoublons = (c: CahierTextes) => {
    const noms = new Set((c.rubriques ?? []).map(r => normaliserLibelleRubrique(r.nom)));
    return rubriquesAcopier.filter(r => noms.has(normaliserLibelleRubrique(r.nom))).length;
  };

  // Seuls les cahiers cochés ET visibles sont traités (pas de surprise)
  const idsCibles = cahiersVisibles.filter(c => ciblesCochees.has(c.id)).map(c => c.id);

  // ── Handlers ───────────────────────────────────────────────
  const basculer = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setter(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });

  const handleCopier = async () => {
    if (!rubriquesAcopier.length || !idsCibles.length) return;
    setSaving(true);
    try {
      const res = await copierRubriquesVersCahiers(rubriquesAcopier, idsCibles, profId, {
        conflit, conserverStatuts,
      });
      // On complète le titre (vide en cas d'erreur) à partir de la liste locale
      const complets = res.map(r => ({
        ...r,
        titre: r.titre || cahiers.find(c => c.id === r.cahierId)?.titre || r.cahierId,
      }));
      setResultats(complets);
      const total = complets.reduce((s, r) => s + r.copiees, 0);
      const echecs = complets.filter(r => r.erreur).length;
      if (echecs) toast.error(`${echecs} cahier(s) n'ont pas pu être mis à jour.`);
      else toast.success(`${total} rubrique(s) copiée(s).`);
    } catch (err) {
      console.error('[CopierRubriquesModal] Copie :', err);
      toast.error('Erreur lors de la copie. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  // ── Rendu ──────────────────────────────────────────────────
  return (
    <div className="modal-overlay crm-overlay" onClick={() => !saving && onClose()}>
      <div
        className="modal-content crm-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-titre"
      >
        <h2 className="modal-title" id="crm-titre">⧉ Copier des rubriques</h2>
        <p className="crm-aide">
          Depuis <strong>{cahierSource.titre}</strong>. Les rubriques copiées sont
          ajoutées à la suite de celles du cahier de destination ; rien n'est
          modifié ni supprimé, ni ici ni là-bas.
        </p>

        {/* ═══ Bilan après copie ═══ */}
        {resultats ? (
          <>
            <ul className="crm-bilan" aria-live="polite">
              {resultats.map(r => (
                <li key={r.cahierId} className={r.erreur ? 'crm-bilan-erreur' : ''}>
                  <span className="crm-bilan-titre">{r.titre}</span>
                  {r.erreur ? (
                    <span className="crm-bilan-detail">❌ {r.erreur}</span>
                  ) : (
                    <span className="crm-bilan-detail">
                      ✅ {r.copiees} copiée(s)
                      {r.ignorees.length > 0 && ` · ${r.ignorees.length} déjà présente(s) : ${r.ignorees.join(', ')}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="modal-footer">
              <button type="button" className="btn-primary" onClick={onClose}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            {/* ═══ 1. Rubriques à copier ═══ */}
            <fieldset className="crm-bloc">
              <legend className="crm-legende">
                1. Rubriques à copier
                <span className="crm-liens">
                  <button type="button" onClick={() => setRubriquesCochees(new Set(rubriques.map(r => r.id)))}>Tout</button>
                  <button type="button" onClick={() => setRubriquesCochees(new Set())}>Aucune</button>
                </span>
              </legend>
              <ul className="crm-liste">
                {rubriques.map(r => (
                  <li key={r.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={rubriquesCochees.has(r.id)}
                        onChange={() => basculer(setRubriquesCochees, r.id)}
                      />
                      <span className="crm-pastille" style={{ background: r.couleur ?? '#64748b' }} aria-hidden="true" />
                      <span className="crm-nom">{r.nom}</span>
                      <span className="crm-meta">
                        {(r.titres ?? []).length} titre(s)
                        {getNombreSeancesEffectif(r) > 0 && ` · ${getNombreSeancesEffectif(r)} séance(s)`}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>

            {/* ═══ 2. Cahiers de destination ═══ */}
            <fieldset className="crm-bloc">
              <legend className="crm-legende">
                2. Cahiers de destination
                {cahiersVisibles.length > 0 && (
                  <span className="crm-liens">
                    <button type="button" onClick={() => setCiblesCochees(new Set(cahiersVisibles.map(c => c.id)))}>Tout</button>
                    <button type="button" onClick={() => setCiblesCochees(new Set())}>Aucun</button>
                  </span>
                )}
              </legend>

              <div className="crm-filtres">
                <label>
                  <input type="checkbox" checked={memeNiveauSeulement} onChange={e => setMemeNiveauSeulement(e.target.checked)} />
                  Uniquement {cahierSource.classe} · {cahierSource.matiere}
                </label>
                <label>
                  <input type="checkbox" checked={afficherArchives} onChange={e => setAfficherArchives(e.target.checked)} />
                  Afficher les cahiers archivés
                </label>
              </div>

              {loading ? (
                <p className="crm-aide">Chargement de vos cahiers…</p>
              ) : erreurChargement ? (
                <p className="crm-alerte">{erreurChargement}</p>
              ) : cahiersVisibles.length === 0 ? (
                <p className="crm-aide">
                  Aucun autre cahier ne correspond pour l'année {cahierSource.anneeScolaire}.
                  {memeNiveauSeulement && ' Décochez le filtre de niveau pour voir tous vos cahiers.'}
                </p>
              ) : (
                <ul className="crm-liste">
                  {cahiersVisibles.map(c => {
                    const doublons = nbDoublons(c);
                    return (
                      <li key={c.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={ciblesCochees.has(c.id)}
                            onChange={() => basculer(setCiblesCochees, c.id)}
                          />
                          <span className="crm-pastille" style={{ background: c.couleur }} aria-hidden="true" />
                          <span className="crm-nom">{c.titre}</span>
                          <span className="crm-meta">
                            {libelleClasse(c)} · {c.matiere}
                            {c.etablissementNom ? ` · ${c.etablissementNom}` : ''}
                            {c.isArchived ? ' · archivé' : ''}
                          </span>
                          {doublons > 0 && (
                            <span className="crm-badge-doublon" title="Rubriques portant déjà le même nom dans ce cahier">
                              {doublons} déjà présente(s)
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>

            {/* ═══ 3. Options ═══ */}
            <fieldset className="crm-bloc">
              <legend className="crm-legende">3. Options</legend>
              <div className="crm-options">
                <span className="crm-option-titre">Si une rubrique du même nom existe déjà :</span>
                <label>
                  <input type="radio" name="crm-conflit" checked={conflit === 'ignorer'} onChange={() => setConflit('ignorer')} />
                  ne pas la copier (recommandé)
                </label>
                <label>
                  <input type="radio" name="crm-conflit" checked={conflit === 'dupliquer'} onChange={() => setConflit('dupliquer')} />
                  la copier sous le nom « … (copie) »
                </label>
                <label className="crm-option-separee">
                  <input type="checkbox" checked={conserverStatuts} onChange={e => setConserverStatuts(e.target.checked)} />
                  Conserver l'avancement des titres (sinon : « Non commencé »)
                </label>
              </div>
            </fieldset>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCopier}
                disabled={saving || rubriquesAcopier.length === 0 || idsCibles.length === 0}
              >
                {saving
                  ? 'Copie en cours…'
                  : `Copier ${rubriquesAcopier.length} rubrique(s) vers ${idsCibles.length} cahier(s)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CopierRubriquesModal;

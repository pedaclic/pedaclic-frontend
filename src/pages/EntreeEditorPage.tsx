// ============================================================
// PHASE 21 + 22 — PAGE : EntreeEditorPage
// Phase 22 : ajout liens externes, ebooks, médias enrichis
// Routes :
//   /prof/cahiers/:cahierId/nouvelle
//   /prof/cahiers/:cahierId/modifier/:entreeId
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  createEntree,
  updateEntree,
  getEntreeById,
  getCahierById,
  getEntreesByCahier,
  updateCahier,
  uploadPieceJointe,
  addPiecesJointes,
  deletePieceJointe,
  resoudreRubriqueIdPourEntree,
  modifierRubrique,
} from '../services/cahierTextesService';
import {
  TYPE_CONTENU_CONFIG,
  STATUT_CONFIG,
  COMPETENCES_PREDEFINIES,
  TYPE_EVAL_LABELS,
} from '../types/cahierTextes.types';
import type {
  EntreeFormData, TypeContenu, StatutSeance,
  TypeEvaluation, CahierTextes,
  EntreeCahier, PieceJointe,
  LienExterne, LienEbook, LienContenuIA, RubriqueCahier, StatutTitre,
} from '../types/cahierTextes.types';
import { STATUT_TITRE_CONFIG } from '../types/cahierTextes.types';
// Phase 22 — composants enrichis
import LienExterneEditor from '../components/prof/LienExterneEditor';
import EbookSelector from '../components/prof/EbookSelector';
// Phase 23 — contenus IA
import ContenuIASelector from '../components/prof/ContenuIASelector';
import RichTextEditor from '../components/RichTextEditor';
import Breadcrumbs from '../components/shared/Breadcrumbs';
import { SkeletonDashboard } from '../components/shared/Skeleton';
// Phase 32 — 3e onglet : Quiz rattachés à la séance
import OngletQuizSeance from '../components/prof/OngletQuizSeance';
// Phase 35 — Échéancier de l'exercice à domicile (synchro auto vers travaux_a_faire)
import EcheanceDomicilePicker from '../components/prof/EcheanceDomicilePicker';
import { upsertTravailDepuisExerciceDomicile } from '../services/travauxAFaireService';
import { useToast } from '../contexts/ToastContext';
import '../styles/CahierTextes.css';
import '../styles/CahierEnrichi.css';
import '../styles/Phase32.css';

// ─── Formulaire vide ─────────────────────────────────────────
const emptyForm = (): EntreeFormData => ({
  date: new Date().toISOString().slice(0, 10),
  heureDebut: '',
  heureFin: '',
  chapitre: '',
  typeContenu: 'cours',
  contenu: '',
  objectifs: '',
  competences: [],
  rubrique: '',
  statut: 'realise',
  motifAnnulation: '',
  dateReport: '',
  notesPrivees: '',
  isMarqueEvaluation: false,
  typeEvaluation: '',
  dateEvaluationPrevue: '',
  statutEvaluation: 'a_evaluer',
  // Phase 34 — Exercices liés à la leçon (vides par défaut)
  exerciceJour: '',
  exerciceDomicile: '',
  // Phase 35 — Échéance exercice à domicile (null = pas d'échéance)
  echeanceDomicile: null,
});

// ─── Utilitaires de périodisation (trimestre / mois / semaine) ──
//   Utilisés pour organiser le panneau "Séances précédentes" en vignettes
//   cliquables et filtrables de manière hiérarchique.
//   Trimestre 1 = Sept/Oct/Nov, T2 = Déc/Jan/Fév, T3 = Mars/Avr/Mai.
//   Le calendrier scolaire sénégalais (octobre → juillet) est compatible.
function getTrimestreKey(d: Date): string {
  const m = d.getMonth(); // 0 = janvier
  const y = d.getFullYear();
  // Année scolaire basculée : septembre-août
  const anneeScolaire = m >= 8 ? y : y - 1;
  let t: 1 | 2 | 3;
  if (m >= 8 && m <= 10)       t = 1; // sept-oct-nov
  else if (m === 11 || m <= 1) t = 2; // déc-jan-fév
  else                          t = 3; // mars-avr-mai-juin-juil-août
  return `${anneeScolaire}-T${t}`;
}
function getTrimestreLabel(cle: string): string {
  const [anneeScolaire, tag] = cle.split('-');
  const labelT: Record<string, string> = {
    T1: 'Trimestre 1 (sept. – nov.)',
    T2: 'Trimestre 2 (déc. – févr.)',
    T3: 'Trimestre 3 (mars – août)',
  };
  return `${labelT[tag] ?? tag} — ${anneeScolaire}/${Number(anneeScolaire) + 1}`;
}
function getMoisKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function getMoisLabel(cle: string): string {
  const [a, m] = cle.split('-').map(Number);
  return new Date(a, m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
function getLundi(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function getSemaineKey(d: Date): string {
  return getLundi(d).toISOString().slice(0, 10);
}
function getSemaineLabel(cle: string): string {
  const lundi = new Date(cle);
  const dimanche = new Date(lundi);
  dimanche.setDate(lundi.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `Semaine du ${lundi.toLocaleDateString('fr-FR', opts)} au ${dimanche.toLocaleDateString('fr-FR', opts)}`;
}


// ─── Composant principal ─────────────────────────────────────
const EntreeEditorPage: React.FC = () => {
  const { cahierId, entreeId } = useParams<{ cahierId: string; entreeId?: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // États Phase 21
  const [cahier, setCahier]                   = useState<CahierTextes | null>(null);
  const [entreeOriginale, setEntreeOriginale] = useState<EntreeCahier | null>(null);
  const [form, setForm]                       = useState<EntreeFormData>(emptyForm());
  const [piecesJointes, setPiecesJointes]     = useState<PieceJointe[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [uploadingFile, setUploadingFile]     = useState(false);
  const [error, setError]                     = useState('');

  // États Phase 22 — médias enrichis
  const [liens, setLiens]           = useState<LienExterne[]>([]);
  const [ebooksLies, setEbooksLies] = useState<LienEbook[]>([]);
  // État Phase 23 — contenus IA
  const [contenuIA, setContenuIA]   = useState<LienContenuIA[]>([]);
  const [cahierRubriques, setCahierRubriques] = useState<string[]>([]);
  // Phase 29 — rubrique du cahier (RubriqueCahier)
  const [rubriqueId, setRubriqueId] = useState<string>('');
  // Phase 33 — titre sélectionné dans la rubrique
  const [titreId, setTitreId] = useState<string>('');

  // Feature 3 — Séances existantes (consultation sans quitter l'éditeur)
  const [autresEntrees, setAutresEntrees] = useState<EntreeCahier[]>([]);
  const [showSeances, setShowSeances] = useState(false);
  // Phase 34 — Organisation hiérarchique trimestre > mois > semaine
  //   null = racine (liste des trimestres), sinon descente dans un niveau.
  const [trimestreFiltre, setTrimestreFiltre] = useState<string | null>(null);
  const [moisFiltre, setMoisFiltre] = useState<string | null>(null);
  const [semaineFiltre, setSemaineFiltre] = useState<string | null>(null);
  // Séance affichée en modale plein écran (preview)
  const [seanceModaleId, setSeanceModaleId] = useState<string | null>(null);
  // Feature 1 — Aperçu live
  const [showPreview, setShowPreview] = useState(false);

  // Phase 34 + Phase 32 — Onglets du bloc "Contenu / Exercices / Quiz"
  //   'contenu'   = contenu de la leçon (champ `contenu`)
  //   'exercices' = exercices liés (exerciceJour + exerciceDomicile)
  //   'quiz'      = quiz rattachés à la séance (Phase 32)
  const [ongletContenu, setOngletContenu] = useState<'contenu' | 'exercices' | 'quiz'>('contenu');

  const isEdit = !!entreeId;

  // Charger les sous-rubriques configurables (admin) — lisible par tout utilisateur authentifié
  useEffect(() => {
    getDoc(doc(db, 'settings', 'platform'))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const rubs = data.cahierRubriques as string[] | undefined;
          const arr = Array.isArray(rubs) ? rubs : [];
          setCahierRubriques(arr.filter((r): r is string => typeof r === 'string' && r.trim().length > 0));
        }
      })
      .catch(() => {});
  }, []);

  // ── Chargement initial ────────────────────────────────────
  useEffect(() => {
    if (!cahierId) return;
    const fetch = async () => {
      setLoading(true);
      try {
        const cahierData = await getCahierById(cahierId);
        if (!cahierData) { navigate('/prof/cahiers'); return; }
        setCahier(cahierData);

        if (isEdit && entreeId) {
          const entreeData = await getEntreeById(entreeId);
          if (entreeData) {
            setEntreeOriginale(entreeData);
            setPiecesJointes(entreeData.piecesJointes || []);
            // Phase 22 — pré-remplissage médias enrichis
            setLiens(entreeData.liens ?? []);
            setEbooksLies(entreeData.ebooksLies ?? []);
            // Phase 23 — contenus IA
            setContenuIA(entreeData.contenuIA ?? []);
            const rubsCahier = cahierData.rubriques ?? [];
            let ridPhase29 = entreeData.rubriqueId ?? '';
            if (!ridPhase29 && rubsCahier.length > 0) {
              const resolu = resoudreRubriqueIdPourEntree(entreeData, rubsCahier);
              if (resolu) ridPhase29 = resolu;
            }
            setRubriqueId(ridPhase29);
            setForm({
              date: entreeData.date.toDate().toISOString().slice(0, 10),
              heureDebut: entreeData.heureDebut || '',
              heureFin: entreeData.heureFin || '',
              chapitre: entreeData.chapitre,
              typeContenu: entreeData.typeContenu,
              contenu: entreeData.contenu,
              objectifs: entreeData.objectifs || '',
              competences: entreeData.competences || [],
              rubrique: entreeData.rubrique || '',
              statut: entreeData.statut,
              motifAnnulation: entreeData.motifAnnulation || '',
              dateReport: entreeData.dateReport
                ? entreeData.dateReport.toDate().toISOString().slice(0, 10)
                : '',
              notesPrivees: entreeData.notesPrivees || '',
              isMarqueEvaluation: entreeData.isMarqueEvaluation,
              typeEvaluation: entreeData.typeEvaluation || '',
              dateEvaluationPrevue: entreeData.dateEvaluationPrevue
                ? entreeData.dateEvaluationPrevue.toDate().toISOString().slice(0, 10)
                : '',
              statutEvaluation: entreeData.statutEvaluation || 'a_evaluer',
              // Phase 34 — charger les exercices liés (rétrocompat : chaînes vides si absents)
              exerciceJour:     entreeData.exerciceJour     ?? '',
              exerciceDomicile: entreeData.exerciceDomicile ?? '',
              // Phase 35 — échéance existante si persistée (null sinon)
              echeanceDomicile: entreeData.echeanceDomicile ?? null,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [cahierId, entreeId]);

  // ── Feature 3 : Charger les séances existantes du cahier ──
  useEffect(() => {
    if (!cahierId) return;
    getEntreesByCahier(cahierId).then(entries => {
      // Trier par date décroissante
      const sorted = [...entries].sort((a, b) => {
        const da = a.date?.toDate?.() ?? new Date(0);
        const db = b.date?.toDate?.() ?? new Date(0);
        return db.getTime() - da.getTime();
      });
      setAutresEntrees(sorted);
    }).catch(() => setAutresEntrees([]));
  }, [cahierId]);

  // ── Feature 1 : Données de l'aperçu (mémoïsées) ──
  const previewData = useMemo(() => {
    const typeCfg = TYPE_CONTENU_CONFIG[form.typeContenu];
    const statutCfg = STATUT_CONFIG[form.statut];
    const rubrique = cahier?.rubriques?.find(r => r.id === rubriqueId);
    return { typeCfg, statutCfg, rubrique };
  }, [form.typeContenu, form.statut, rubriqueId, cahier?.rubriques]);

  // ── Toggle compétence (Phase 21) ──────────────────────────
  const toggleCompetence = (comp: string) => {
    setForm(f => ({
      ...f,
      competences: f.competences.includes(comp)
        ? f.competences.filter(c => c !== comp)
        : [...f.competences, comp],
    }));
  };

  // ── Upload pièce jointe (Phase 21) ────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !currentUser?.uid || !cahierId) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) { toast.warning('Fichier trop volumineux (max 10 Mo)'); return; }
    setUploadingFile(true);
    try {
      const piece = await uploadPieceJointe(currentUser.uid, cahierId, file);
      const newPieces = [...piecesJointes, piece];
      setPiecesJointes(newPieces);
      if (isEdit && entreeId && entreeOriginale) {
        await addPiecesJointes(entreeId, piecesJointes, [piece]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNetworkErr = /réseau|network|timeout|quic|failed|err_/i.test(msg);
      toast.error(isNetworkErr
        ? 'Impossible d\'importer le fichier. Vérifiez votre connexion et réessayez.'
        : 'Erreur lors de l\'import du fichier. Réessayez.');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  // ── Supprimer pièce jointe (Phase 21) ────────────────────
  const handleDeletePiece = async (url: string) => {
    if (!entreeId) {
      setPiecesJointes(prev => prev.filter(p => p.url !== url));
      return;
    }
    try {
      await deletePieceJointe(entreeId, piecesJointes, url);
      setPiecesJointes(prev => prev.filter(p => p.url !== url));
    } catch {
      toast.error('Erreur lors de la suppression du fichier.');
    }
  };

  // ── Soumettre ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.chapitre.trim()) { setError('Le chapitre est obligatoire.'); return; }
    if (!form.date) { setError('La date est obligatoire.'); return; }
    if (!currentUser?.uid || !cahierId || !cahier) return;

    // Vérifier que le prof est bien propriétaire du cahier (évite erreurs Firestore)
    if (cahier.profId !== currentUser.uid) {
      setError('Vous n\'êtes pas le propriétaire de ce cahier. Enregistrement impossible.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const rubriqueIdFirestore = resoudreRubriqueIdPourEntree(
        { rubriqueId: rubriqueId || undefined, rubrique: form.rubrique },
        cahier.rubriques ?? []
      );

      if (isEdit && entreeId) {
        // Phase 21 — mise à jour base + Phase 22 — médias enrichis
        await updateEntree(entreeId, cahierId, form);
        // Phase 22 + Phase 29 : rubriqueId doit toujours être écrit en édition (sinon la progression reste « Sans rubrique »)
        await updateEntree(entreeId, {
          liens,
          ebooksLies,
          contenuIA,
          rubriqueId: rubriqueIdFirestore,
        });
      } else {
        const newId = await createEntree(cahierId, currentUser.uid, form);
        // Pièces jointes uploadées avant création (Phase 21)
        if (piecesJointes.length > 0) {
          await addPiecesJointes(newId, [], piecesJointes);
        }
        const extras = { liens, ebooksLies, contenuIA, rubriqueId: rubriqueIdFirestore };
        const hasExtras =
          liens.length > 0 ||
          ebooksLies.length > 0 ||
          contenuIA.length > 0 ||
          rubriqueId !== '' ||
          (cahier.rubriques?.length ?? 0) > 0;
        if (hasExtras) {
          await updateEntree(newId, extras);
        }
      }

      // Recalcule le compteur de séances réalisées sur le cahier
      const toutesEntrees = await getEntreesByCahier(cahierId);
      const nbRealise = toutesEntrees.filter(e => e.statut === 'realise').length;
      await updateCahier(cahierId, { nombreSeancesRealise: nbRealise });

      // Phase 35 — Synchronisation auto des Travaux à faire depuis l'exercice à domicile.
      // Non bloquant : une erreur ici n'annule pas la sauvegarde de la séance.
      const seanceIdPourSync = isEdit && entreeId
        ? entreeId
        : (toutesEntrees.find((e) => e.chapitre === form.chapitre && e.date?.toDate?.().toISOString().slice(0, 10) === form.date)?.id ?? null);
      if (seanceIdPourSync && cahier) {
        const rubriqueObj = cahier.rubriques?.find((r) => r.id === rubriqueIdFirestore);
        await upsertTravailDepuisExerciceDomicile({
          seanceId:          seanceIdPourSync,
          chapitre:          form.chapitre,
          exerciceDomicile:  form.exerciceDomicile,
          echeanceDomicile:  form.echeanceDomicile ?? null,
          cahier: {
            id:         cahier.id,
            profId:     cahier.profId,
            matiere:    cahier.matiere,
            groupeIds:  cahier.groupeIds ?? [],
            groupeNoms: cahier.groupeNoms ?? [],
          },
          rubriqueId:        rubriqueIdFirestore || null,
          rubriqueNom:       rubriqueObj?.nom || null,
        });
      }

      // Phase 33 — Mettre à jour le statut du titre sélectionné
      if (titreId && rubriqueId && cahier.rubriques) {
        const rubrique = cahier.rubriques.find(r => r.id === rubriqueId);
        if (rubrique?.titres) {
          const nouveauStatut: import('../types/cahierTextes.types').StatutTitre =
            form.statut === 'realise' ? 'acheve' : form.statut === 'planifie' ? 'en_cours' : 'non_commence';
          const titreActuel = rubrique.titres.find(t => t.id === titreId);
          if (titreActuel && titreActuel.statut !== nouveauStatut) {
            const titresMaj = rubrique.titres.map(t =>
              t.id === titreId ? { ...t, statut: nouveauStatut } : t
            );
            await modifierRubrique(cahierId, cahier.rubriques, rubriqueId, { titres: titresMaj });
          }
        }
      }

      navigate(`/prof/cahiers/${cahierId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Erreur : ' + msg);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  if (loading) return <SkeletonDashboard />;
  if (!cahier) return null;

  return (
    <div className="entree-editor-page">
      {/* ── Fil d'Ariane ── */}
      <Breadcrumbs items={[
        { label: 'Cahiers de textes', path: '/prof/cahiers' },
        { label: cahier.titre || 'Cahier', path: `/prof/cahiers/${cahierId}` },
        { label: isEdit ? 'Modifier la séance' : 'Nouvelle séance' },
      ]} />

      {/* ── En-tête ── */}
      <div className="editor-header">
        <button
          onClick={() => navigate(`/prof/cahiers/${cahierId}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.2rem' }}
        >
          ←
        </button>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2937', margin: '0 0 0.2rem' }}>
            {isEdit ? '✏️ Modifier la séance' : '➕ Nouvelle séance'}
          </h1>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            {cahier.titre} • {cahier.classe} • {cahier.matiere}
          </div>
        </div>
      </div>

      <div className="editor-layout">
      <form onSubmit={handleSubmit} className="editor-layout__form">
        {/* ── Informations de base (Phase 21 — inchangé) ── */}
        <div className="editor-card">
          <div className="editor-section-title">📋 Informations de la séance</div>

          <div className="form-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input type="date" className="form-input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Heure début</label>
              <input type="time" className="form-input" value={form.heureDebut}
                onChange={e => setForm(f => ({ ...f, heureDebut: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Heure fin</label>
              <input type="time" className="form-input" value={form.heureFin}
                onChange={e => setForm(f => ({ ...f, heureFin: e.target.value }))} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Chapitre / Titre de la séance *</label>
            {(() => {
              const rubSel = cahier?.rubriques?.find(r => r.id === rubriqueId);
              const titresDispos = rubSel?.titres ?? [];
              if (titresDispos.length > 0) {
                return (
                  <>
                    <select
                      className="form-select"
                      value={titreId}
                      onChange={e => {
                        const tid = e.target.value;
                        setTitreId(tid);
                        const titre = titresDispos.find(t => t.id === tid);
                        if (titre) setForm(f => ({ ...f, chapitre: titre.nom }));
                      }}
                    >
                      <option value="">— Sélectionner un titre —</option>
                      {titresDispos.map(t => {
                        const cfg = STATUT_TITRE_CONFIG[t.statut];
                        return (
                          <option key={t.id} value={t.id}>
                            {cfg.emoji} {t.nom}
                          </option>
                        );
                      })}
                    </select>
                    <input className="form-input" style={{ marginTop: '0.4rem' }}
                      placeholder="Ou saisissez un titre libre"
                      value={form.chapitre}
                      onChange={e => { setForm(f => ({ ...f, chapitre: e.target.value })); setTitreId(''); }}
                    />
                  </>
                );
              }
              return (
                <input className="form-input"
                  placeholder="Ex: Chapitre 3 — Les fonctions affines"
                  value={form.chapitre}
                  onChange={e => setForm(f => ({ ...f, chapitre: e.target.value }))} required />
              );
            })()}
          </div>

          {/* Phase 29 — Module du cahier (utilisé pour la progression par rubrique) */}
          {cahier?.rubriques && cahier.rubriques.length > 0 && (
            <div className="entree-form-field form-group">
              <label htmlFor="entree-rubrique" className="form-label">
                Module du cahier <span className="entree-form-hint">(progression)</span>
              </label>
              <select
                id="entree-rubrique"
                value={rubriqueId}
                onChange={e => setRubriqueId(e.target.value)}
                className="form-select entree-rubrique-select"
              >
                <option value="">— Sans rubrique —</option>
                {cahier.rubriques.map(r => (
                  <option key={r.id} value={r.id}>{r.nom}</option>
                ))}
              </select>
              {rubriqueId && (() => {
                const r = cahier.rubriques!.find(x => x.id === rubriqueId);
                if (!r) return null;
                return (
                  <span
                    className="entree-rubrique-apercu"
                    style={{
                      backgroundColor: (r.couleur ?? '#64748b') + '1a',
                      borderColor: r.couleur ?? '#64748b',
                      color: r.couleur ?? '#64748b',
                    }}
                  >
                    {r.nom}
                  </span>
                );
              })()}
              <p className="entree-rubrique-progression-hint">
                Ce choix compte pour les barres « par rubrique ». Si vous aviez renseigné une sous-rubrique (liste admin)
                dont le libellé est identique au nom d’un module, elle est reconnue automatiquement pour la progression.
              </p>
            </div>
          )}

          <div className="form-row" style={
            cahierRubriques.length > 0 && !(cahier?.rubriques && cahier.rubriques.length > 0)
              ? { gridTemplateColumns: '1fr 1fr 1fr' }
              : undefined
          }>
            <div className="form-group">
              <label className="form-label">Type de séance</label>
              <select className="form-select" value={form.typeContenu}
                onChange={e => setForm(f => ({ ...f, typeContenu: e.target.value as TypeContenu }))}>
                {Object.entries(TYPE_CONTENU_CONFIG).map(([k, cfg]) => (
                  <option key={k} value={k}>{cfg.emoji} {cfg.label}</option>
                ))}
              </select>
            </div>
            {cahierRubriques.length > 0 && !(cahier?.rubriques && cahier.rubriques.length > 0) && (
              <div className="form-group">
                <label className="form-label">Sous-rubrique <span className="entree-form-hint">(admin)</span></label>
                <select className="form-select" value={form.rubrique}
                  onChange={e => setForm(f => ({ ...f, rubrique: e.target.value }))}>
                  <option value="">— Aucune —</option>
                  {cahierRubriques.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Statut</label>
              <select className="form-select" value={form.statut}
                onChange={e => setForm(f => ({ ...f, statut: e.target.value as StatutSeance }))}>
                {Object.entries(STATUT_CONFIG).map(([k, cfg]) => (
                  <option key={k} value={k}>{cfg.label}</option>
                ))}
              </select>
            </div>
          </div>

          {form.statut === 'annule' && (
            <div className="form-group">
              <label className="form-label">Motif d'annulation</label>
              <input className="form-input" placeholder="Ex: Grève enseignants, sortie scolaire..."
                value={form.motifAnnulation}
                onChange={e => setForm(f => ({ ...f, motifAnnulation: e.target.value }))} />
            </div>
          )}

          {form.statut === 'reporte' && (
            <div className="form-group">
              <label className="form-label">Nouvelle date (report)</label>
              <input type="date" className="form-input" value={form.dateReport}
                onChange={e => setForm(f => ({ ...f, dateReport: e.target.value }))} />
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            Phase 34 — Contenu pédagogique + Exercices (tabbed)
            Deux onglets dans un même bloc "Cahier de textes" :
              • Contenu de la leçon      → champ `contenu`
              • Exercices liés à la leçon → 2 sous-blocs :
                  - Exercice du jour (exercice d'application)
                  - Exercice à domicile
            ═══════════════════════════════════════════════════════ */}
        <div className="editor-card">
          <div className="editor-section-title">📝 Cahier de textes — contenu à saisir</div>

          {/* Barre d'onglets */}
          <div className="cahier-contenu-tabs" role="tablist" aria-label="Type de contenu à saisir">
            <button
              type="button"
              role="tab"
              aria-selected={ongletContenu === 'contenu'}
              className={`cahier-contenu-tab ${ongletContenu === 'contenu' ? 'cahier-contenu-tab--actif' : ''}`}
              onClick={() => setOngletContenu('contenu')}
            >
              📘 Contenu de la leçon
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={ongletContenu === 'exercices'}
              className={`cahier-contenu-tab ${ongletContenu === 'exercices' ? 'cahier-contenu-tab--actif' : ''}`}
              onClick={() => setOngletContenu('exercices')}
            >
              📝 Exercices liés à la leçon
              {/* Pastille de présence : indique à l'enseignant qu'au moins un exercice est déjà renseigné */}
              {(form.exerciceJour || form.exerciceDomicile) && (
                <span className="cahier-contenu-tab-dot" aria-hidden="true" />
              )}
            </button>
            {/* Phase 32 — Onglet Quiz */}
            <button
              type="button"
              role="tab"
              aria-selected={ongletContenu === 'quiz'}
              className={`cahier-contenu-tab ${ongletContenu === 'quiz' ? 'cahier-contenu-tab--actif' : ''}`}
              onClick={() => setOngletContenu('quiz')}
              title={!isEdit ? 'Enregistrez d’abord la séance pour rattacher un quiz' : undefined}
            >
              🎯 Quiz
              {isEdit && (entreeOriginale?.quizIds?.length ?? 0) > 0 && (
                <span className="cahier-contenu-tab-dot" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* ── Onglet 1 : Contenu de la leçon ── */}
          {ongletContenu === 'contenu' && (
            <div className="form-group" role="tabpanel" aria-label="Contenu de la leçon">
              <label className="form-label">Contenu (mise en forme riche)</label>
              <RichTextEditor
                value={form.contenu}
                onChange={html => setForm(f => ({ ...f, contenu: html }))}
                placeholder="Décrivez le contenu enseigné, les exemples traités, les formules vues (titres, listes, tableaux…)"
                minHeight={250}
              />
            </div>
          )}

          {/* ── Onglet 2 : Exercices liés à la leçon ── */}
          {ongletContenu === 'exercices' && (
            <div role="tabpanel" aria-label="Exercices liés à la leçon" className="cahier-exercices-panel">
              {/* Sous-bloc 1 : Exercice du jour (exercice d'application) */}
              <div className="form-group cahier-exercice-bloc">
                <div className="cahier-exercice-entete">
                  <span className="cahier-exercice-pictogramme" aria-hidden="true">🎯</span>
                  <div>
                    <label className="form-label" htmlFor="exo-jour">
                      Exercice du jour
                      <span className="cahier-exercice-hint">(exercice d'application)</span>
                    </label>
                    <p className="cahier-exercice-desc">
                      Exercices résolus ou proposés pendant la séance pour consolider les notions.
                    </p>
                  </div>
                </div>
                <RichTextEditor
                  value={form.exerciceJour ?? ''}
                  onChange={html => setForm(f => ({ ...f, exerciceJour: html }))}
                  placeholder="Exemple : calculer, compléter, démontrer, traduire en français…"
                  minHeight={160}
                />
              </div>

              {/* Sous-bloc 2 : Exercice à domicile */}
              <div className="form-group cahier-exercice-bloc">
                <div className="cahier-exercice-entete">
                  <span className="cahier-exercice-pictogramme" aria-hidden="true">🏠</span>
                  <div>
                    <label className="form-label" htmlFor="exo-maison">
                      Exercice à domicile
                      <span className="cahier-exercice-hint">(à faire à la maison)</span>
                    </label>
                    <p className="cahier-exercice-desc">
                      Travail à la maison, préparation pour la prochaine séance, devoirs à rendre…
                    </p>
                  </div>
                </div>
                <RichTextEditor
                  value={form.exerciceDomicile ?? ''}
                  onChange={html => setForm(f => ({ ...f, exerciceDomicile: html }))}
                  placeholder="Consignes, énoncés, numéros d'exercices du manuel, date de remise attendue…"
                  minHeight={160}
                />
                {/* Phase 35 — Échéancier (date + heure) : si défini, génère
                    automatiquement un TravailAFaire pour chaque groupe du cahier. */}
                <EcheanceDomicilePicker
                  valeur={form.echeanceDomicile ?? null}
                  onChange={(v) => setForm((f) => ({ ...f, echeanceDomicile: v }))}
                />
              </div>
            </div>
          )}

          {/* ── Onglet 3 : Quiz rattachés à la séance (Phase 32) ── */}
          {ongletContenu === 'quiz' && (
            <OngletQuizSeance
              seanceId={entreeId ?? null}
              cahierId={cahierId ?? ''}
              profId={currentUser?.uid ?? ''}
              groupeIdParDefaut={cahier?.groupeIds?.[0] ?? null}
              titreSeance={form.chapitre}
            />
          )}

          <div className="form-group">
            <label className="form-label">Objectifs pédagogiques</label>
            <textarea className="form-textarea"
              placeholder="Ex: L'élève sera capable de résoudre une équation du second degré..."
              value={form.objectifs}
              onChange={e => setForm(f => ({ ...f, objectifs: e.target.value }))} rows={2} />
          </div>

          <div className="form-group">
            <label className="form-label">Compétences visées</label>
            <div className="competences-container">
              {COMPETENCES_PREDEFINIES.map(comp => (
                <button key={comp} type="button"
                  className={`competence-tag ${form.competences.includes(comp) ? 'selected' : ''}`}
                  onClick={() => toggleCompetence(comp)}>
                  {comp}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Signet d'évaluation (Phase 21 — inchangé) ── */}
        <div className="editor-card">
          <div className="editor-section-title">📌 Signet d'évaluation</div>
          <div className="signet-section">
            <div className="signet-toggle"
              onClick={() => setForm(f => ({ ...f, isMarqueEvaluation: !f.isMarqueEvaluation }))}>
              <div className={`toggle-switch ${form.isMarqueEvaluation ? 'on' : ''}`} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>
                  Marquer pour évaluation
                </div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                  Ce contenu sera évalué ultérieurement
                </div>
              </div>
            </div>

            {form.isMarqueEvaluation && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Type d'évaluation</label>
                    <select className="form-select" value={form.typeEvaluation}
                      onChange={e => setForm(f => ({ ...f, typeEvaluation: e.target.value as TypeEvaluation }))}>
                      <option value="">Choisir...</option>
                      {Object.entries(TYPE_EVAL_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date prévue d'évaluation</label>
                    <input type="date" className="form-input" value={form.dateEvaluationPrevue}
                      onChange={e => setForm(f => ({ ...f, dateEvaluationPrevue: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Pièces jointes (Phase 21 — inchangé) ── */}
        <div className="editor-card">
          <div className="editor-section-title">📎 Pièces jointes</div>
          {piecesJointes.length > 0 && (
            <div className="pieces-jointes-list">
              {piecesJointes.map(p => (
                <div key={p.url} className="piece-jointe-item">
                  <span>📄</span>
                  <a href={p.url} target="_blank" rel="noopener noreferrer">{p.nom}</a>
                  <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                    ({Math.round((p.taille ?? 0) / 1024)} Ko)
                  </span>
                  <button type="button" onClick={() => handleDeletePiece(p.url)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', marginLeft: 'auto' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="upload-zone">
            {uploadingFile ? 'Envoi en cours...' : '📂 Cliquer pour ajouter un fichier (PDF, image — max 10 Mo)'}
            <input type="file" style={{ display: 'none' }}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.ppt,.pptx"
              onChange={handleFileUpload} disabled={uploadingFile} />
          </label>
        </div>

        {/* ── PHASE 22 : Ressources enrichies ── */}
        <div className="editor-card">
          <div className="editor-section-title">🌐 Ressources enrichies</div>
          <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0 0 4px' }}>
            Ajoutez des liens ou des ebooks pour enrichir cette séance.
          </p>

          {/* Liens externes (vidéos, articles, exercices) */}
          <LienExterneEditor liens={liens} onChange={setLiens} />

          {/* Ebooks de la bibliothèque */}
          <EbookSelector ebooksLies={ebooksLies} onChange={setEbooksLies} />

          {/* Contenus générés par l'IA */}
          <ContenuIASelector
            userId={currentUser!.uid}
            contenuIA={contenuIA}
            onChange={setContenuIA}
          />
        </div>

        {/* ── Notes privées (Phase 21 — inchangé) ── */}
        <div className="editor-card">
          <div className="editor-section-title">🔒 Notes privées</div>
          <textarea className="form-textarea"
            placeholder="Notes personnelles (non visibles par l'administration)..."
            value={form.notesPrivees}
            onChange={e => setForm(f => ({ ...f, notesPrivees: e.target.value }))} rows={3} />
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
            Ces notes sont uniquement visibles par vous.
          </div>
        </div>

        {/* ── Erreur + Boutons ── */}
        {error && (
          <div style={{ color: '#dc2626', background: '#fee2e2', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingBottom: '2rem' }}>
          <button type="button" className="btn-secondary"
            onClick={() => navigate(`/prof/cahiers/${cahierId}`)}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: 160 }}>
            {saving ? 'Enregistrement...' : isEdit ? '💾 Mettre à jour' : '✅ Enregistrer la séance'}
          </button>
        </div>
      </form>

      {/* ── Sidebar flottante : Aperçu + Séances existantes ── */}
      <aside className="editor-layout__sidebar">

        {/* Feature 1 : Aperçu live de la séance */}
        <div className="editor-card sidebar-panel">
          <button
            type="button"
            className="editor-toggle-btn"
            onClick={() => setShowPreview(v => !v)}
          >
            <span className="editor-section-title" style={{ margin: 0 }}>
              👁️ Aperçu de la séance
            </span>
            <span className="editor-toggle-chevron">{showPreview ? '▲' : '▼'}</span>
          </button>

          {showPreview && (
            <div className="seance-preview">
              <div className="seance-preview__date">
                📅 {form.date
                  ? new Date(form.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })
                  : '—'}
                {form.heureDebut && (
                  <span className="seance-preview__heure">
                    🕐 {form.heureDebut}{form.heureFin ? ` → ${form.heureFin}` : ''}
                  </span>
                )}
              </div>

              <h3 className="seance-preview__titre">
                {form.chapitre || <em style={{ color: '#9ca3af' }}>Titre de la séance…</em>}
              </h3>

              <div className="seance-preview__badges">
                <span className="entree-type-badge" style={{ background: previewData.typeCfg.color }}>
                  {previewData.typeCfg.emoji} {previewData.typeCfg.label}
                </span>
                <span className="entree-statut-badge" style={{ background: previewData.statutCfg.bg, color: previewData.statutCfg.color }}>
                  {previewData.statutCfg.label}
                </span>
                {previewData.rubrique && (
                  <span
                    className="entree-card-rubrique-badge"
                    style={{
                      backgroundColor: (previewData.rubrique.couleur ?? '#64748b') + '1a',
                      borderColor: previewData.rubrique.couleur ?? '#64748b',
                      color: previewData.rubrique.couleur ?? '#64748b',
                    }}
                  >
                    {previewData.rubrique.nom}
                  </span>
                )}
                {form.isMarqueEvaluation && <span className="signet-badge">📌 Évaluation</span>}
              </div>

              {form.contenu && (
                <div className="seance-preview__contenu" dangerouslySetInnerHTML={{ __html: form.contenu }} />
              )}

              {form.objectifs && (
                <div className="seance-preview__objectifs">
                  🎯 <em>{form.objectifs}</em>
                </div>
              )}

              {form.competences.length > 0 && (
                <div className="seance-preview__competences">
                  {form.competences.map(c => (
                    <span key={c} className="competence-tag selected">{c}</span>
                  ))}
                </div>
              )}

              {piecesJointes.length > 0 && (
                <div className="seance-preview__pj">
                  📎 {piecesJointes.length} pièce{piecesJointes.length > 1 ? 's' : ''} jointe{piecesJointes.length > 1 ? 's' : ''}
                </div>
              )}

              {liens.length > 0 && (
                <div className="seance-preview__pj">
                  🌐 {liens.length} lien{liens.length > 1 ? 's' : ''} externe{liens.length > 1 ? 's' : ''}
                </div>
              )}

              {form.notesPrivees && (
                <div className="seance-preview__notes-privees">
                  🔒 <em>Notes privées : {form.notesPrivees}</em>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
            Phase 34 — Séances précédentes organisées en vignettes
            Navigation hiérarchique cliquable :
              1) Trimestres  →  2) Mois du trimestre  →  3) Semaines du mois
            Clic sur une vignette : ouvre le contenu complet dans une modale.
            Un fil d'Ariane en haut permet de remonter rapidement.
            ═══════════════════════════════════════════════════════ */}
        <div className="editor-card sidebar-panel">
          <button
            type="button"
            className="editor-toggle-btn"
            onClick={() => setShowSeances(v => !v)}
          >
            <span className="editor-section-title" style={{ margin: 0 }}>
              📚 Séances précédentes ({autresEntrees.length})
            </span>
            <span className="editor-toggle-chevron">{showSeances ? '▲' : '▼'}</span>
          </button>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
            Navigation par trimestre → mois → semaine. Les listes longues sont masquées ; les vignettes s'ouvrent au clic.
          </p>

          {showSeances && (() => {
            // ── Regroupement hiérarchique des séances ──
            //   Trimestres : Set d'identifiants distincts
            //   Pour chaque trimestre, on calcule mois et semaines à la volée.
            const trimestres = new Map<string, EntreeCahier[]>();
            autresEntrees.forEach(e => {
              const d = e.date?.toDate?.() ?? new Date(0);
              const key = getTrimestreKey(d);
              if (!trimestres.has(key)) trimestres.set(key, []);
              trimestres.get(key)!.push(e);
            });
            const trimestresOrdre = [...trimestres.keys()].sort((a, b) => b.localeCompare(a));

            // Mois disponibles dans le trimestre sélectionné
            const moisDispos = (() => {
              if (!trimestreFiltre) return [];
              const map = new Map<string, EntreeCahier[]>();
              (trimestres.get(trimestreFiltre) ?? []).forEach(e => {
                const d = e.date?.toDate?.() ?? new Date(0);
                const k = getMoisKey(d);
                if (!map.has(k)) map.set(k, []);
                map.get(k)!.push(e);
              });
              return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
            })();

            // Semaines disponibles dans le mois sélectionné
            const semainesDispos = (() => {
              if (!moisFiltre) return [];
              const map = new Map<string, EntreeCahier[]>();
              autresEntrees
                .filter(e => {
                  const d = e.date?.toDate?.() ?? new Date(0);
                  return getMoisKey(d) === moisFiltre;
                })
                .forEach(e => {
                  const d = e.date?.toDate?.() ?? new Date(0);
                  const k = getSemaineKey(d);
                  if (!map.has(k)) map.set(k, []);
                  map.get(k)!.push(e);
                });
              return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
            })();

            // Séances visibles (feuilles) selon le niveau atteint
            const seancesVisibles = (() => {
              if (semaineFiltre) {
                return autresEntrees.filter(e => {
                  const d = e.date?.toDate?.() ?? new Date(0);
                  return getSemaineKey(d) === semaineFiltre;
                });
              }
              return [];
            })();

            return (
              <div className="seances-timeline">

                {/* Fil d'Ariane des filtres — reset au clic */}
                <nav className="seances-timeline__breadcrumb" aria-label="Fil d'Ariane des périodes">
                  <button
                    type="button"
                    className="seances-timeline__crumb"
                    onClick={() => { setTrimestreFiltre(null); setMoisFiltre(null); setSemaineFiltre(null); }}
                  >
                    📅 Toutes les périodes
                  </button>
                  {trimestreFiltre && (
                    <>
                      <span className="seances-timeline__sep">›</span>
                      <button
                        type="button"
                        className="seances-timeline__crumb"
                        onClick={() => { setMoisFiltre(null); setSemaineFiltre(null); }}
                      >
                        {getTrimestreLabel(trimestreFiltre)}
                      </button>
                    </>
                  )}
                  {moisFiltre && (
                    <>
                      <span className="seances-timeline__sep">›</span>
                      <button
                        type="button"
                        className="seances-timeline__crumb"
                        onClick={() => setSemaineFiltre(null)}
                      >
                        {getMoisLabel(moisFiltre)}
                      </button>
                    </>
                  )}
                  {semaineFiltre && (
                    <>
                      <span className="seances-timeline__sep">›</span>
                      <span className="seances-timeline__crumb seances-timeline__crumb--actif">
                        {getSemaineLabel(semaineFiltre)}
                      </span>
                    </>
                  )}
                </nav>

                {autresEntrees.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#9ca3af', padding: '1rem 0' }}>
                    Aucune séance enregistrée.
                  </p>
                )}

                {/* Niveau 1 : Trimestres */}
                {autresEntrees.length > 0 && !trimestreFiltre && (
                  <div className="seances-timeline__grille">
                    {trimestresOrdre.map(key => {
                      const nb = trimestres.get(key)!.length;
                      return (
                        <button
                          key={key}
                          type="button"
                          className="seances-timeline__vignette seances-timeline__vignette--trimestre"
                          onClick={() => setTrimestreFiltre(key)}
                        >
                          <span className="seances-timeline__vignette-icon">📅</span>
                          <span className="seances-timeline__vignette-label">{getTrimestreLabel(key)}</span>
                          <span className="seances-timeline__vignette-count">{nb} séance{nb > 1 ? 's' : ''}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Niveau 2 : Mois du trimestre */}
                {trimestreFiltre && !moisFiltre && (
                  <div className="seances-timeline__grille">
                    {moisDispos.map(([key, list]) => (
                      <button
                        key={key}
                        type="button"
                        className="seances-timeline__vignette seances-timeline__vignette--mois"
                        onClick={() => setMoisFiltre(key)}
                      >
                        <span className="seances-timeline__vignette-icon">🗓️</span>
                        <span className="seances-timeline__vignette-label">{getMoisLabel(key)}</span>
                        <span className="seances-timeline__vignette-count">{list.length} séance{list.length > 1 ? 's' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Niveau 3 : Semaines du mois */}
                {moisFiltre && !semaineFiltre && (
                  <div className="seances-timeline__grille">
                    {semainesDispos.map(([key, list]) => (
                      <button
                        key={key}
                        type="button"
                        className="seances-timeline__vignette seances-timeline__vignette--semaine"
                        onClick={() => setSemaineFiltre(key)}
                      >
                        <span className="seances-timeline__vignette-icon">📆</span>
                        <span className="seances-timeline__vignette-label">{getSemaineLabel(key)}</span>
                        <span className="seances-timeline__vignette-count">{list.length} séance{list.length > 1 ? 's' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Niveau 4 (feuilles) : vignettes de séances cliquables → modale */}
                {semaineFiltre && (
                  <div className="seances-timeline__grille seances-timeline__grille--seances">
                    {seancesVisibles.map(e => {
                      const isCurrentEntry = e.id === entreeId;
                      const typeCfg = TYPE_CONTENU_CONFIG[e.typeContenu];
                      const statutCfg = STATUT_CONFIG[e.statut];
                      const dateSeance = e.date?.toDate?.() ?? new Date(0);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className={`seances-timeline__carte${isCurrentEntry ? ' seances-timeline__carte--actuelle' : ''}`}
                          style={{ borderLeftColor: typeCfg.color }}
                          onClick={() => setSeanceModaleId(e.id)}
                          title="Cliquer pour afficher le contenu complet"
                        >
                          <span className="seances-timeline__carte-date">
                            {dateSeance.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          </span>
                          <span className="seances-timeline__carte-titre">{e.chapitre}</span>
                          <span className="seances-timeline__carte-badges">
                            <span className="entree-type-badge" style={{ background: typeCfg.color }}>
                              {typeCfg.emoji} {typeCfg.label}
                            </span>
                            <span className="entree-statut-badge" style={{ background: statutCfg.bg, color: statutCfg.color }}>
                              {statutCfg.label}
                            </span>
                            {isCurrentEntry && (
                              <span className="seances-timeline__carte-en-cours">✎ en cours</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

              </div>
            );
          })()}
        </div>

        {/* ══════════════════════════════════════════════════════
            Modale de prévisualisation plein écran d'une séance
            Ouverte via setSeanceModaleId(id) depuis la timeline.
            ═══════════════════════════════════════════════════════ */}
        {seanceModaleId && (() => {
          const seance = autresEntrees.find(e => e.id === seanceModaleId);
          if (!seance) return null;
          const typeCfg = TYPE_CONTENU_CONFIG[seance.typeContenu];
          const statutCfg = STATUT_CONFIG[seance.statut];
          const dateSeance = seance.date?.toDate?.() ?? new Date(0);
          return (
            <div
              className="seance-preview-modale-overlay"
              onClick={() => setSeanceModaleId(null)}
              role="presentation"
            >
              <div
                className="seance-preview-modale"
                role="dialog"
                aria-modal="true"
                aria-label="Aperçu d'une séance"
                onClick={e => e.stopPropagation()}
              >
                <header className="seance-preview-modale__header" style={{ borderLeftColor: typeCfg.color }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="seance-preview-modale__date">
                      📅 {dateSeance.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      {seance.heureDebut && (
                        <span style={{ marginLeft: 8 }}>🕐 {seance.heureDebut}{seance.heureFin ? ` → ${seance.heureFin}` : ''}</span>
                      )}
                    </div>
                    <h3 className="seance-preview-modale__titre">{seance.chapitre}</h3>
                    <div className="seance-preview-modale__badges">
                      <span className="entree-type-badge" style={{ background: typeCfg.color }}>
                        {typeCfg.emoji} {typeCfg.label}
                      </span>
                      <span className="entree-statut-badge" style={{ background: statutCfg.bg, color: statutCfg.color }}>
                        {statutCfg.label}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="seance-preview-modale__fermer"
                    onClick={() => setSeanceModaleId(null)}
                    aria-label="Fermer l'aperçu"
                  >✕</button>
                </header>

                <div className="seance-preview-modale__corps">
                  {seance.objectifs && (
                    <div className="seance-preview-modale__objectifs">
                      🎯 <em>{seance.objectifs}</em>
                    </div>
                  )}

                  {seance.contenu && (
                    <section>
                      <h4 className="seance-preview-modale__section">📘 Contenu de la leçon</h4>
                      <div className="rte-content rte-content--lecture" dangerouslySetInnerHTML={{ __html: seance.contenu }} />
                    </section>
                  )}

                  {seance.exerciceJour && (
                    <section>
                      <h4 className="seance-preview-modale__section">🎯 Exercice du jour</h4>
                      <div className="rte-content rte-content--lecture" dangerouslySetInnerHTML={{ __html: seance.exerciceJour }} />
                    </section>
                  )}

                  {seance.exerciceDomicile && (
                    <section>
                      <h4 className="seance-preview-modale__section">🏠 Exercice à domicile</h4>
                      <div className="rte-content rte-content--lecture" dangerouslySetInnerHTML={{ __html: seance.exerciceDomicile }} />
                    </section>
                  )}

                  {seance.competences && seance.competences.length > 0 && (
                    <section>
                      <h4 className="seance-preview-modale__section">🎓 Compétences visées</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {seance.competences.map(c => (
                          <span key={c} className="competence-tag selected">{c}</span>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <footer className="seance-preview-modale__footer">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSeanceModaleId(null)}
                  >
                    Fermer
                  </button>
                  {seance.id !== entreeId && (
                    <button
                      type="button"
                      className="btn-pedaclic"
                      onClick={() => {
                        setSeanceModaleId(null);
                        navigate(`/prof/cahiers/${cahierId}/modifier/${seance.id}`);
                      }}
                    >
                      ✏️ Ouvrir cette séance
                    </button>
                  )}
                </footer>
              </div>
            </div>
          );
        })()}
      </aside>
      </div>
    </div>
  );
};

export default EntreeEditorPage;

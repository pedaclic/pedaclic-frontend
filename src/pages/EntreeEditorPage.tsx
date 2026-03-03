// ============================================================
// PHASE 21 + 22 — PAGE : EntreeEditorPage
// Phase 22 : ajout liens externes, ebooks, médias enrichis
// Routes :
//   /prof/cahiers/:cahierId/nouvelle
//   /prof/cahiers/:cahierId/modifier/:entreeId
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect } from 'react';
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
  LienExterne, LienEbook, LienContenuIA,
} from '../types/cahierTextes.types';
// Phase 22 — composants enrichis
import LienExterneEditor from '../components/prof/LienExterneEditor';
import EbookSelector from '../components/prof/EbookSelector';
// Phase 23 — contenus IA
import ContenuIASelector from '../components/prof/ContenuIASelector';
import RichTextEditor from '../components/quiz/RichTextEditor';
import '../styles/CahierTextes.css';
import '../styles/CahierEnrichi.css';

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
});


// ─── Composant principal ─────────────────────────────────────
const EntreeEditorPage: React.FC = () => {
  const { cahierId, entreeId } = useParams<{ cahierId: string; entreeId?: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

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

  const isEdit = !!entreeId;

  // Charger les rubriques configurables (admin)
  useEffect(() => {
    getDoc(doc(db, 'settings', 'platform'))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const rubs = data.cahierRubriques as string[] | undefined;
          setCahierRubriques(Array.isArray(rubs) ? rubs : []);
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
            });
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [cahierId, entreeId]);

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
    if (file.size > 10 * 1024 * 1024) { alert('Fichier trop volumineux (max 10 Mo)'); return; }
    setUploadingFile(true);
    try {
      const piece = await uploadPieceJointe(currentUser.uid, cahierId, file);
      const newPieces = [...piecesJointes, piece];
      setPiecesJointes(newPieces);
      if (isEdit && entreeId && entreeOriginale) {
        await addPiecesJointes(entreeId, piecesJointes, [piece]);
      }
    } catch {
      alert('Erreur upload fichier.');
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
      alert('Erreur suppression fichier.');
    }
  };

  // ── Soumettre ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.chapitre.trim()) { setError('Le chapitre est obligatoire.'); return; }
    if (!form.date) { setError('La date est obligatoire.'); return; }
    if (!currentUser?.uid || !cahierId) return;

    setSaving(true);
    setError('');
    try {
      if (isEdit && entreeId) {
        // Phase 21 — mise à jour base + Phase 22 — médias enrichis
        await updateEntree(entreeId, cahierId, form);
        // Mise à jour séparée des champs Phase 22
        await updateEntree(entreeId, { liens, ebooksLies, contenuIA });
      } else {
        const newId = await createEntree(cahierId, currentUser.uid, form);
        // Pièces jointes uploadées avant création (Phase 21)
        if (piecesJointes.length > 0) {
          await addPiecesJointes(newId, [], piecesJointes);
        }
        // Médias Phase 22 sauvegardés sur la nouvelle entrée
        if (liens.length > 0 || ebooksLies.length > 0 || contenuIA.length > 0) {
          await updateEntree(newId, { liens, ebooksLies, contenuIA });
        }
      }

      // Recalcule le compteur de séances réalisées sur le cahier
      const toutesEntrees = await getEntreesByCahier(cahierId);
      const nbRealise = toutesEntrees.filter(e => e.statut === 'realise').length;
      await updateCahier(cahierId, { nombreSeancesRealise: nbRealise });

      navigate(`/prof/cahiers/${cahierId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Erreur : ' + msg);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  if (loading) return <div className="loading-spinner"><div className="spinner-circle" /></div>;
  if (!cahier) return null;

  return (
    <div className="entree-editor-page">
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

      <form onSubmit={handleSubmit}>
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
            <input className="form-input"
              placeholder="Ex: Chapitre 3 — Les fonctions affines"
              value={form.chapitre}
              onChange={e => setForm(f => ({ ...f, chapitre: e.target.value }))} required />
          </div>

          <div className="form-row" style={cahierRubriques.length > 0 ? { gridTemplateColumns: '1fr 1fr 1fr' } : undefined}>
            <div className="form-group">
              <label className="form-label">Type de séance</label>
              <select className="form-select" value={form.typeContenu}
                onChange={e => setForm(f => ({ ...f, typeContenu: e.target.value as TypeContenu }))}>
                {Object.entries(TYPE_CONTENU_CONFIG).map(([k, cfg]) => (
                  <option key={k} value={k}>{cfg.emoji} {cfg.label}</option>
                ))}
              </select>
            </div>
            {cahierRubriques.length > 0 && (
              <div className="form-group">
                <label className="form-label">Rubrique</label>
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

        {/* ── Contenu pédagogique (Phase 21 — inchangé) ── */}
        <div className="editor-card">
          <div className="editor-section-title">📝 Contenu de la séance</div>

          <div className="form-group">
            <label className="form-label">Contenu (mise en forme riche)</label>
            <RichTextEditor
              value={form.contenu}
              onChange={html => setForm(f => ({ ...f, contenu: html }))}
              placeholder="Décrivez le contenu enseigné, les exemples traités, les formules vues..."
              minHeight={220}
              maxHeight={600}
            />
          </div>

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
    </div>
  );
};

export default EntreeEditorPage;

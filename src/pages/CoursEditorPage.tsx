// ============================================================
// PedaClic — Phase 24 : CoursEditorPage.tsx — Éditeur prof
// Routes : /prof/cours/nouveau | /prof/cours/:coursId/modifier
// Accès : Professeurs Premium uniquement
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================
// Fonctionnalités :
//   - Formulaire métadonnées du cours
//   - Gestion des sections (CRUD + drag-and-drop réordonnancement)
//   - Éditeur de blocs par section (ajout, suppression, drag-and-drop)
//   - Aperçu en temps réel
//   - Publication / brouillon
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// doc + collection : nécessaires pour pré-réserver un ID Firestore côté client
// (storageBasePath en mode création — aucune écriture déclenchée)
import { Timestamp, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
// Composant d'upload d'image vers Firebase Storage (cover + blocs image)
import ImageUploader from '../ImageUploader';
import {
  getCoursById,
  getSectionsCours,
  createCours,
  updateCours,
  createSection,
  updateSection,
  deleteSection,
  reordonnerSections,
  saveBlocsSection,
  publierCours,
} from '../services/coursService';
import { getAllCahiers } from '../services/cahierTextesService';
import type {
  CoursEnLigne,
  SectionCours,
  BlocContenu,
  BlocTexte,
  BlocImage,
  BlocVideo,
  BlocEncadre,
  BlocQuiz,
  BlocExercice,
  TypeBloc,
  TypeEncadre,
  CoursFormData,
} from '../cours_types';
import { LABELS_TYPE_BLOC, CONFIG_ENCADRE } from '../cours_types';
import { CLASSES } from '../types/cahierTextes.types';
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import '../styles/CoursEnLigne.css';

// ─────────────────────────────────────────────────────────────
// UTILITAIRE — Génération d'ID unique
// ─────────────────────────────────────────────────────────────
const genId = () => crypto.randomUUID();

// ─────────────────────────────────────────────────────────────
// FABRIQUE — Créer un bloc vide selon son type
// ─────────────────────────────────────────────────────────────
function creerBlocVide(type: TypeBloc, ordre: number): BlocContenu {
  const base = { id: genId(), type, ordre, isPremium: false };
  switch (type) {
    case 'texte':    return { ...base, type: 'texte',    contenu: '' };
    case 'image':    return { ...base, type: 'image',    url: '', alt: '', legende: '' };
    case 'video':    return { ...base, type: 'video',    urlYoutube: '', titre: '', description: '' };
    case 'encadre':  return { ...base, type: 'encadre',  variante: 'definition', titre: 'Définition', contenu: '' };
    case 'quiz':     return {
      ...base, type: 'quiz', question: '',
      options: [
        { id: genId(), texte: '', estCorrecte: true },
        { id: genId(), texte: '', estCorrecte: false },
      ],
      explication: '',
    };
    case 'exercice': return { ...base, type: 'exercice', enonce: '', correction: '', difficulte: 'moyen' };
  }
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT : Éditeur d'un bloc (formulaire inline)
// ─────────────────────────────────────────────────────────────

interface EditorBlocProps {
  bloc: BlocContenu;
  index: number;
  total: number;
  onUpdate: (bloc: BlocContenu) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  // Props drag-and-drop
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  dragOverIndex: number | null;
  // Props upload Firebase Storage (Phase 25)
  // storageBasePath : chemin racine dans Storage pour les images de ce bloc
  // onBlocUploadStart / onBlocUploadEnd : signalent l'état d'upload au parent
  //   afin que blocksUploading[index] soit mis à jour et isAnyUploading bloque la sauvegarde
  storageBasePath: string;
  onBlocUploadStart: (blocIndex: number) => void;
  onBlocUploadEnd: (blocIndex: number) => void;
}

function EditorBloc({
  bloc, index, total, onUpdate, onDelete, onMoveUp, onMoveDown,
  isDragging, onDragStart, onDragOver, onDrop, onDragEnd, dragOverIndex,
  storageBasePath, onBlocUploadStart, onBlocUploadEnd,
}: EditorBlocProps) {
  const config = LABELS_TYPE_BLOC[bloc.type];
  const isOver = dragOverIndex === index;

  // ── Rendu du formulaire selon le type de bloc ────────────
  function renderForm() {
    switch (bloc.type) {

      case 'texte':
        return (
          <textarea
            className="editor-bloc__textarea"
            placeholder="Texte du paragraphe (Markdown : **gras**, *italique*, - liste)"
            value={(bloc as BlocTexte).contenu}
            onChange={e => onUpdate({ ...bloc, contenu: e.target.value } as BlocTexte)}
            rows={4}
          />
        );

      case 'image':
        return (
          <div className="editor-bloc__form-grid">
            {/* Upload Firebase Storage — Phase 25 */}
            <ImageUploader
              storagePath={`${storageBasePath}/bloc-${index}`}
              existingUrl={(bloc as BlocImage).url}
              placeholder="Glissez l'image ici ou cliquez"
              onUploadStart={() => onBlocUploadStart(index)}
              onUploadComplete={(url) => {
                onUpdate({ ...bloc, url } as BlocImage);
                onBlocUploadEnd(index);
              }}
              onUploadError={() => onBlocUploadEnd(index)}
              maxSizeMo={5}
            />
            {/* Texte alternatif */}
            <input
              type="text"
              placeholder="Texte alternatif (accessibilité)"
              value={(bloc as BlocImage).alt}
              onChange={e => onUpdate({ ...bloc, alt: e.target.value } as BlocImage)}
              className="editor-bloc__input"
            />
            {/* Légende */}
            <input
              type="text"
              placeholder="Légende (optionnelle)"
              value={(bloc as BlocImage).legende ?? ''}
              onChange={e => onUpdate({ ...bloc, legende: e.target.value } as BlocImage)}
              className="editor-bloc__input"
            />
          </div>
        );

      case 'video':
        return (
          <div className="editor-bloc__form-grid">
            <input
              type="url"
              placeholder="URL YouTube (ex: https://www.youtube.com/watch?v=...)"
              value={(bloc as BlocVideo).urlYoutube}
              onChange={e => onUpdate({ ...bloc, urlYoutube: e.target.value } as BlocVideo)}
              className="editor-bloc__input"
            />
            <input
              type="text"
              placeholder="Titre de la vidéo"
              value={(bloc as BlocVideo).titre}
              onChange={e => onUpdate({ ...bloc, titre: e.target.value } as BlocVideo)}
              className="editor-bloc__input"
            />
            <input
              type="text"
              placeholder="Description courte (optionnelle)"
              value={(bloc as BlocVideo).description ?? ''}
              onChange={e => onUpdate({ ...bloc, description: e.target.value } as BlocVideo)}
              className="editor-bloc__input"
            />
          </div>
        );

      case 'encadre':
        return (
          <div className="editor-bloc__form-grid">
            {/* Sélecteur variante avec aperçu couleur */}
            <select
              value={(bloc as BlocEncadre).variante}
              onChange={e => onUpdate({ ...bloc, variante: e.target.value as TypeEncadre } as BlocEncadre)}
              className="editor-bloc__select"
            >
              {Object.entries(CONFIG_ENCADRE).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Titre de l'encadré"
              value={(bloc as BlocEncadre).titre}
              onChange={e => onUpdate({ ...bloc, titre: e.target.value } as BlocEncadre)}
              className="editor-bloc__input"
            />
            <textarea
              placeholder="Contenu de l'encadré"
              value={(bloc as BlocEncadre).contenu}
              onChange={e => onUpdate({ ...bloc, contenu: e.target.value } as BlocEncadre)}
              className="editor-bloc__textarea"
              rows={3}
            />
          </div>
        );

      case 'quiz': {
        const quiz = bloc as BlocQuiz;
        return (
          <div className="editor-bloc__form-grid">
            <input
              type="text"
              placeholder="Question"
              value={quiz.question}
              onChange={e => onUpdate({ ...quiz, question: e.target.value })}
              className="editor-bloc__input"
            />
            {/* Éditeur d'options */}
            <div className="editor-bloc__quiz-options">
              {quiz.options.map((opt, oi) => (
                <div key={opt.id} className="editor-bloc__quiz-option">
                  <input
                    type="radio"
                    name={`quiz-correct-${bloc.id}`}
                    checked={opt.estCorrecte}
                    onChange={() => onUpdate({
                      ...quiz,
                      options: quiz.options.map((o, i) => ({
                        ...o, estCorrecte: i === oi,
                      })),
                    })}
                    title="Marquer comme bonne réponse"
                  />
                  <input
                    type="text"
                    placeholder={`Option ${oi + 1}`}
                    value={opt.texte}
                    onChange={e => onUpdate({
                      ...quiz,
                      options: quiz.options.map((o, i) =>
                        i === oi ? { ...o, texte: e.target.value } : o
                      ),
                    })}
                    className="editor-bloc__input"
                  />
                  {quiz.options.length > 2 && (
                    <button
                      type="button"
                      className="btn-icon btn-icon--danger"
                      onClick={() => onUpdate({
                        ...quiz,
                        options: quiz.options.filter((_, i) => i !== oi),
                      })}
                      title="Supprimer cette option"
                    >✕</button>
                  )}
                </div>
              ))}
              {quiz.options.length < 4 && (
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => onUpdate({
                    ...quiz,
                    options: [...quiz.options, { id: genId(), texte: '', estCorrecte: false }],
                  })}
                >
                  + Ajouter une option
                </button>
              )}
            </div>
            <input
              type="text"
              placeholder="Explication après réponse (optionnelle)"
              value={quiz.explication ?? ''}
              onChange={e => onUpdate({ ...quiz, explication: e.target.value })}
              className="editor-bloc__input"
            />
          </div>
        );
      }

      case 'exercice':
        return (
          <div className="editor-bloc__form-grid">
            <textarea
              placeholder="Énoncé de l'exercice"
              value={(bloc as BlocExercice).enonce}
              onChange={e => onUpdate({ ...bloc, enonce: e.target.value } as BlocExercice)}
              className="editor-bloc__textarea"
              rows={3}
            />
            <textarea
              placeholder="Correction (masquée pour l'élève jusqu'au clic)"
              value={(bloc as BlocExercice).correction}
              onChange={e => onUpdate({ ...bloc, correction: e.target.value } as BlocExercice)}
              className="editor-bloc__textarea editor-bloc__textarea--correction"
              rows={3}
            />
            <div className="editor-bloc__row">
              <select
                value={(bloc as BlocExercice).difficulte}
                onChange={e => onUpdate({ ...bloc, difficulte: e.target.value as 'facile' | 'moyen' | 'difficile' } as BlocExercice)}
                className="editor-bloc__select"
              >
                <option value="facile">Facile</option>
                <option value="moyen">Moyen</option>
                <option value="difficile">Difficile</option>
              </select>
              <input
                type="number"
                placeholder="Points (opt.)"
                value={(bloc as BlocExercice).points ?? ''}
                onChange={e => onUpdate({ ...bloc, points: Number(e.target.value) || undefined } as BlocExercice)}
                className="editor-bloc__input editor-bloc__input--sm"
                min={1}
              />
            </div>
          </div>
        );

      default: return null;
    }
  }

  return (
    /* Carte draggable du bloc */
    <div
      className={[
        'editor-bloc',
        isDragging ? 'editor-bloc--dragging' : '',
        isOver     ? 'editor-bloc--drag-over' : '',
      ].join(' ')}
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDragOver={e  => onDragOver(e, index)}
      onDrop={e      => onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      {/* En-tête du bloc : type + actions */}
      <div className="editor-bloc__header">
        {/* Poignée de drag */}
        <span className="editor-bloc__drag-handle" title="Déplacer" aria-hidden="true">
          ⠿
        </span>
        {/* Type et icône */}
        <span className="editor-bloc__type-label">
          {config.emoji} {config.label}
        </span>

        {/* Toggle Premium */}
        <label className="editor-bloc__premium-toggle" title="Réserver aux abonnés Premium">
          <input
            type="checkbox"
            checked={bloc.isPremium}
            onChange={e => onUpdate({ ...bloc, isPremium: e.target.checked })}
          />
          <span>⭐ Premium</span>
        </label>

        {/* Actions navigation */}
        <div className="editor-bloc__actions">
          <button
            type="button"
            className="btn-icon"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Monter"
            aria-label="Monter ce bloc"
          >↑</button>
          <button
            type="button"
            className="btn-icon"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Descendre"
            aria-label="Descendre ce bloc"
          >↓</button>
          <button
            type="button"
            className="btn-icon btn-icon--danger"
            onClick={onDelete}
            title="Supprimer ce bloc"
            aria-label="Supprimer ce bloc"
          >🗑</button>
        </div>
      </div>

      {/* Formulaire du bloc */}
      <div className="editor-bloc__form">
        {renderForm()}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL : Éditeur de cours
// ─────────────────────────────────────────────────────────────

export default function CoursEditorPage() {
  const { coursId } = useParams<{ coursId: string }>();
  const navigate = useNavigate();
  const { currentUser: user } = useAuth();
  const isEdition = !!coursId;
  const { matieres } = useDisciplinesOptions();

  // ── ID stable pour Firebase Storage ──────────────────────
  // En mode création il n'y a pas encore de coursId.
  // On pré-réserve un ID Firestore côté client (doc() sans écriture)
  // afin de pouvoir uploader des images AVANT la 1ère sauvegarde.
  // En mode édition on utilise directement le vrai coursId du document.
  const [tempCoursId] = useState(() => doc(collection(db, 'cours_en_ligne')).id);

  // Chemin racine dans Firebase Storage pour toutes les images de ce cours.
  // – Édition  : cours-images/<coursId>  (ID définitif)
  // – Création : cours-images/<tempCoursId> (ID pré-réservé stable)
  const storageBasePath = `cours-images/${isEdition ? coursId : tempCoursId}`;

  // ── État du formulaire cours ──────────────────────────────
  const [formCours, setFormCours] = useState<CoursFormData>({
    titre: '',
    description: '',
    matiere: 'Mathématiques',
    niveau: '3ème',
    classe: '',
    isPremium: false,
    statut: 'brouillon',
    couvertureUrl: '',
    dureeEstimee: 0,
    objectifs: [''],
    prerequis: '',
    tags: [],
    cahierTextesId: '',
  });

  // ── État des sections ─────────────────────────────────────
  const [sections, setSections] = useState<SectionCours[]>([]);
  const [sectionActive, setSectionActive] = useState<string | null>(null);
  const [blocsSection, setBlocsSection] = useState<BlocContenu[]>([]);
  const [titreSectionEdite, setTitreSectionEdite] = useState('');

  // ── Drag-and-drop sections ────────────────────────────────
  const dragSectionIndex = useRef<number | null>(null);
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);

  // ── Drag-and-drop blocs ───────────────────────────────────
  const dragBlocIndex = useRef<number | null>(null);
  const [dragOverBlocIndex, setDragOverBlocIndex] = useState<number | null>(null);
  const [draggingBlocIndex, setDraggingBlocIndex] = useState<number | null>(null);

  // ── États UI ──────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<'infos' | 'sections'>('infos');

  // ── Cahiers de textes (admin — liaison cours ↔ cahier) ─────
  const [cahiers, setCahiers] = useState<Array<{ id: string; titre: string }>>([]);

  // ── États upload images ───────────────────────────────────
  // coverUploading   : true pendant l'upload de l'image de couverture du cours
  // blocksUploading  : map { [blocId]: boolean } — un booléen par bloc image actif
  // isAnyUploading   : agrégat — vrai si au moins un upload est en cours ;
  //                    utilisé pour désactiver le bouton "Sauvegarder / Publier"
  const [coverUploading, setCoverUploading] = useState(false);
  const [blocksUploading, setBlocksUploading] = useState<Record<string, boolean>>({});
  const isAnyUploading = coverUploading || Object.values(blocksUploading).some(Boolean);

  // ── Chargement en mode édition ────────────────────────────
  useEffect(() => {
    if (isEdition && coursId) chargerCours(coursId);
  }, [coursId]);

  // ── Chargement des cahiers (admin — liaison cours ↔ cahier) ─
  useEffect(() => {
    if (user?.role === 'admin') {
      getAllCahiers()
        .then(list => setCahiers(list.map(c => ({ id: c.id, titre: c.titre }))))
        .catch(() => {});
    }
  }, [user?.role]);

  async function chargerCours(id: string) {
    setLoading(true);
    try {
      const [coursData, sectionsData] = await Promise.all([
        getCoursById(id),
        getSectionsCours(id),
      ]);
      if (coursData) {
        setFormCours({
          titre: coursData.titre,
          description: coursData.description,
          matiere: coursData.matiere,
          niveau: coursData.niveau,
          classe: coursData.classe ?? '',
          cahierTextesId: coursData.cahierTextesId ?? '',
          isPremium: coursData.isPremium,
          statut: coursData.statut,
          couvertureUrl: coursData.couvertureUrl ?? '',
          dureeEstimee: coursData.dureeEstimee,
          objectifs: coursData.objectifs.length > 0 ? coursData.objectifs : [''],
          prerequis: coursData.prerequis ?? '',
          tags: coursData.tags,
        });
      }
      setSections(sectionsData);
      if (sectionsData.length > 0) {
        setSectionActive(sectionsData[0].id);
        setBlocsSection(sectionsData[0].blocs);
        setTitreSectionEdite(sectionsData[0].titre);
      }
    } catch (err) {
      setError('Erreur de chargement du cours.');
    } finally {
      setLoading(false);
    }
  }

  // ── Synchronisation blocs quand section change ────────────
  useEffect(() => {
    if (!sectionActive) return;
    const sec = sections.find(s => s.id === sectionActive);
    if (sec) {
      setBlocsSection([...sec.blocs].sort((a, b) => a.ordre - b.ordre));
      setTitreSectionEdite(sec.titre);
    }
  }, [sectionActive]);

  // ─────────────────────────────────────────────────────────
  // GESTION DU FORMULAIRE COURS
  // ─────────────────────────────────────────────────────────

  const updateFormField = <K extends keyof CoursFormData>(
    key: K,
    value: CoursFormData[K]
  ) => setFormCours(prev => ({ ...prev, [key]: value }));

  // Gestion des objectifs (liste dynamique)
  const updateObjectif = (index: number, value: string) => {
    const copy = [...formCours.objectifs];
    copy[index] = value;
    updateFormField('objectifs', copy);
  };
  const addObjectif = () => updateFormField('objectifs', [...formCours.objectifs, '']);
  const removeObjectif = (i: number) =>
    updateFormField('objectifs', formCours.objectifs.filter((_, idx) => idx !== i));

  // Gestion des tags
  const [tagInput, setTagInput] = useState('');
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !formCours.tags.includes(t)) {
      updateFormField('tags', [...formCours.tags, t]);
    }
    setTagInput('');
  };
  const removeTag = (t: string) =>
    updateFormField('tags', formCours.tags.filter(tag => tag !== t));

  // ─────────────────────────────────────────────────────────
  // SAUVEGARDE DU COURS
  // ─────────────────────────────────────────────────────────

  async function sauvegarder(publier = false) {
    if (!user) return;
    if (!formCours.titre.trim()) {
      setError('Le titre du cours est obligatoire.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const data: CoursFormData = {
        ...formCours,
        objectifs: formCours.objectifs.filter(o => o.trim()),
        statut: publier ? 'publie' : formCours.statut,
        cahierTextesId: formCours.cahierTextesId?.trim() || undefined,
      };

      if (isEdition && coursId) {
        await updateCours(coursId, data);
        if (publier) await publierCours(coursId);
        afficherSucces(publier ? '🎉 Cours publié !' : '✅ Cours sauvegardé.');
      } else {
        // TODO : récupérer le nom du prof depuis votre AuthContext
        const profNom = user.displayName ?? 'Professeur';
        const id = await createCours(user.uid, profNom, data);
        if (publier) await publierCours(id);
        afficherSucces('✅ Cours créé ! Ajoutez maintenant vos sections.');
        navigate(`/prof/cours/${id}/modifier`);
      }
    } catch (err) {
      console.error('[CoursEditorPage] Erreur sauvegarde :', err);
      setError('Erreur lors de la sauvegarde. Réessayez.');
    } finally {
      setSaving(false);
    }
  }

  function afficherSucces(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  }

  // ─────────────────────────────────────────────────────────
  // GESTION DES SECTIONS
  // ─────────────────────────────────────────────────────────

  async function ajouterSection() {
    if (!coursId) {
      setError('Sauvegardez d\'abord le cours pour ajouter des sections.');
      return;
    }
    const ordre = sections.length + 1;
    const titre = `Section ${ordre}`;
    try {
      const id = await createSection(coursId, {
        titre,
        ordre,
        blocs: [],
        dureeEstimee: 0,
        estGratuite: ordre === 1, // 1ère section toujours gratuite
      });
      const now = Timestamp.now();
      const nouvelleSection: SectionCours = {
        id,
        coursId,
        titre,
        ordre,
        blocs: [],
        dureeEstimee: 0,
        estGratuite: ordre === 1,
        createdAt: now,
        updatedAt: now,
      };
      setSections(prev => [...prev, nouvelleSection]);
      setSectionActive(id);
      setBlocsSection([]);
      setTitreSectionEdite(titre);
    } catch (err) {
      setError('Erreur lors de la création de la section.');
    }
  }

  async function supprimerSection(sectionId: string) {
    if (!coursId) return;
    if (!confirm('Supprimer cette section et tous ses blocs ?')) return;
    try {
      await deleteSection(sectionId, coursId);
      const nouvellesSections = sections
        .filter(s => s.id !== sectionId)
        .map((s, i) => ({ ...s, ordre: i + 1 }));
      setSections(nouvellesSections);
      if (sectionActive === sectionId) {
        setSectionActive(nouvellesSections[0]?.id ?? null);
      }
    } catch (err) {
      setError('Erreur lors de la suppression.');
    }
  }

  async function sauvegarderTitreSection() {
    if (!sectionActive) return;
    try {
      await updateSection(sectionActive, { titre: titreSectionEdite });
      setSections(prev => prev.map(s =>
        s.id === sectionActive ? { ...s, titre: titreSectionEdite } : s
      ));
    } catch (err) {
      setError('Erreur lors de la mise à jour du titre.');
    }
  }

  // ─────────────────────────────────────────────────────────
  // DRAG-AND-DROP — SECTIONS
  // ─────────────────────────────────────────────────────────

  function handleDragStartSection(e: React.DragEvent, index: number) {
    dragSectionIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOverSection(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSectionIndex(index);
  }

  async function handleDropSection(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    setDragOverSectionIndex(null);
    const fromIndex = dragSectionIndex.current;
    if (fromIndex === null || fromIndex === dropIndex) return;

    // Réordonner localement
    const newSections = [...sections];
    const [moved] = newSections.splice(fromIndex, 1);
    newSections.splice(dropIndex, 0, moved);
    const reordered = newSections.map((s, i) => ({ ...s, ordre: i + 1 }));
    setSections(reordered);

    // Persister en Firestore
    try {
      await reordonnerSections(reordered.map(s => ({ id: s.id, ordre: s.ordre })));
    } catch (err) {
      setError('Erreur lors du réordonnancement. Rechargez la page.');
    }
    dragSectionIndex.current = null;
  }

  // ─────────────────────────────────────────────────────────
  // GESTION DES BLOCS
  // ─────────────────────────────────────────────────────────

  function ajouterBloc(type: TypeBloc) {
    const nouveau = creerBlocVide(type, blocsSection.length);
    const newBlocs = [...blocsSection, nouveau];
    setBlocsSection(newBlocs);
    syncBlocsSection(newBlocs);
  }

  function updateBloc(index: number, bloc: BlocContenu) {
    const newBlocs = blocsSection.map((b, i) => i === index ? bloc : b);
    setBlocsSection(newBlocs);
    syncBlocsSection(newBlocs);
  }

  function supprimerBloc(index: number) {
    const newBlocs = blocsSection.filter((_, i) => i !== index);
    setBlocsSection(newBlocs);
    syncBlocsSection(newBlocs);
  }

  function monterBloc(index: number) {
    if (index === 0) return;
    const newBlocs = [...blocsSection];
    [newBlocs[index - 1], newBlocs[index]] = [newBlocs[index], newBlocs[index - 1]];
    setBlocsSection(newBlocs);
    syncBlocsSection(newBlocs);
  }

  function descendreBloc(index: number) {
    if (index === blocsSection.length - 1) return;
    const newBlocs = [...blocsSection];
    [newBlocs[index], newBlocs[index + 1]] = [newBlocs[index + 1], newBlocs[index]];
    setBlocsSection(newBlocs);
    syncBlocsSection(newBlocs);
  }

  // Sauvegarde auto des blocs (debounce 1.5s)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function syncBlocsSection(blocs: BlocContenu[]) {
    if (!sectionActive) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        await saveBlocsSection(sectionActive, blocs);
        // Mettre à jour sections locale
        setSections(prev => prev.map(s =>
          s.id === sectionActive ? { ...s, blocs } : s
        ));
      } catch (err) {
        console.error('[CoursEditorPage] Erreur sauvegarde blocs :', err);
      }
    }, 1500);
  }

  // ─────────────────────────────────────────────────────────
  // DRAG-AND-DROP — BLOCS
  // ─────────────────────────────────────────────────────────

  function handleDragStartBloc(e: React.DragEvent, index: number) {
    dragBlocIndex.current = index;
    setDraggingBlocIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOverBloc(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBlocIndex(index);
  }

  function handleDropBloc(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    setDragOverBlocIndex(null);
    setDraggingBlocIndex(null);
    const fromIndex = dragBlocIndex.current;
    if (fromIndex === null || fromIndex === dropIndex) return;

    const newBlocs = [...blocsSection];
    const [moved] = newBlocs.splice(fromIndex, 1);
    newBlocs.splice(dropIndex, 0, moved);
    const reordered = newBlocs.map((b, i) => ({ ...b, ordre: i }));
    setBlocsSection(reordered);
    syncBlocsSection(reordered);
    dragBlocIndex.current = null;
  }

  function handleDragEndBloc() {
    setDragOverBlocIndex(null);
    setDraggingBlocIndex(null);
    dragBlocIndex.current = null;
  }

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="cours-editor__loading" aria-busy="true">
        <div className="spinner spinner--blue" />
        <p>Chargement de l'éditeur...</p>
      </div>
    );
  }

  return (
    <div className="cours-editor">

      {/* ══════════════════════════════════════════════════════
          EN-TÊTE DE L'ÉDITEUR
      ══════════════════════════════════════════════════════ */}
      <header className="cours-editor__header">
        {/* Fil d'Ariane */}
        <p className="cours-editor__breadcrumb">
          <button className="btn-link" onClick={() => navigate('/prof/cours')}>
            📚 Mes cours
          </button>
          {' / '}
          {isEdition ? 'Modifier le cours' : 'Nouveau cours'}
        </p>

        <div className="cours-editor__header-actions">
          <h1 className="cours-editor__titre">
            {isEdition ? '✏️ Modifier le cours' : '✨ Nouveau cours'}
          </h1>
          <div className="cours-editor__btn-group">
            <button
              className="btn-secondary"
              onClick={() => navigate('/prof/cours')}
              disabled={saving}
            >
              Annuler
            </button>
            <button
              className="btn-secondary"
              onClick={() => sauvegarder(false)}
              disabled={saving}
            >
              {saving ? <><span className="spinner" /> Sauvegarde...</> : '💾 Sauvegarder'}
            </button>
            <button
              className="btn-primary"
              onClick={() => sauvegarder(true)}
              disabled={saving || formCours.statut === 'publie'}
            >
              {formCours.statut === 'publie' ? '✅ Publié' : '🚀 Publier'}
            </button>
          </div>
        </div>

        {/* Banners */}
        {error   && <div className="error-banner"   role="alert">⚠️ {error}</div>}
        {success && <div className="success-banner" role="status">{success}</div>}
      </header>

      {/* ══════════════════════════════════════════════════════
          ONGLETS : Infos du cours | Sections
      ══════════════════════════════════════════════════════ */}
      <div className="cours-editor__tabs" role="tablist">
        <button
          className={`cours-editor__tab ${onglet === 'infos' ? 'cours-editor__tab--active' : ''}`}
          onClick={() => setOnglet('infos')}
          role="tab"
          aria-selected={onglet === 'infos'}
        >
          📋 Informations du cours
        </button>
        <button
          className={`cours-editor__tab ${onglet === 'sections' ? 'cours-editor__tab--active' : ''}`}
          onClick={() => setOnglet('sections')}
          role="tab"
          aria-selected={onglet === 'sections'}
          disabled={!isEdition && !coursId}
        >
          📝 Sections et contenu {sections.length > 0 && `(${sections.length})`}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════
          ONGLET 1 — Formulaire métadonnées
      ════════════════════════════════════════════════════ */}
      {onglet === 'infos' && (
        <section className="cours-editor__form" aria-label="Informations du cours">

          {/* ── Infos de base ── */}
          <div className="cours-editor__card">
            <h2 className="cours-editor__card-titre">📖 Informations générales</h2>
            <div className="cours-editor__form-grid">
              {/* Titre */}
              <div className="cours-editor__field cours-editor__field--full">
                <label htmlFor="titre">Titre du cours *</label>
                <input
                  id="titre"
                  type="text"
                  value={formCours.titre}
                  onChange={e => updateFormField('titre', e.target.value)}
                  placeholder="Ex : Les fonctions affines — Terminale S"
                  className="cours-editor__input"
                  required
                />
              </div>
              {/* Description */}
              <div className="cours-editor__field cours-editor__field--full">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  value={formCours.description}
                  onChange={e => updateFormField('description', e.target.value)}
                  placeholder="Description courte affichée dans le catalogue"
                  className="cours-editor__textarea"
                  rows={3}
                />
              </div>
              {/* Matière */}
              <div className="cours-editor__field">
                <label htmlFor="matiere">Matière *</label>
                <select
                  id="matiere"
                  value={formCours.matiere}
                  onChange={e => updateFormField('matiere', e.target.value)}
                  className="cours-editor__select"
                >
                  {matieres.map(m => (
                    <option key={m.valeur} value={m.valeur}>{m.label}</option>
                  ))}
                </select>
              </div>
              {/* Niveau */}
              <div className="cours-editor__field">
                <label htmlFor="niveau">Niveau *</label>
                <select
                  id="niveau"
                  value={formCours.niveau}
                  onChange={e => updateFormField('niveau', e.target.value)}
                  className="cours-editor__select"
                >
                  {CLASSES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {/* Classe optionnelle */}
              <div className="cours-editor__field">
                <label htmlFor="classe">Classe (optionnelle)</label>
                <input
                  id="classe"
                  type="text"
                  value={formCours.classe ?? ''}
                  onChange={e => updateFormField('classe', e.target.value)}
                  placeholder="Ex : 3ème A, TS, L2"
                  className="cours-editor__input"
                />
              </div>
              {/* Lien cahier de textes (admin uniquement) */}
              {user?.role === 'admin' && cahiers.length > 0 && (
                <div className="cours-editor__field cours-editor__field--full">
                  <label htmlFor="cahierTextesId">📒 Lier à un cahier de textes</label>
                  <select
                    id="cahierTextesId"
                    value={formCours.cahierTextesId ?? ''}
                    onChange={e => updateFormField('cahierTextesId', e.target.value)}
                    className="cours-editor__select"
                  >
                    <option value="">— Aucun —</option>
                    {cahiers.map(c => (
                      <option key={c.id} value={c.id}>{c.titre}</option>
                    ))}
                  </select>
                  <span className="cours-editor__label-hint">
                    Si le cahier n'existe pas, créez-le d'abord dans Cahier de Textes.
                  </span>
                </div>
              )}
              {/* Image de couverture — Phase 25 : upload Firebase Storage */}
              <div className="cours-editor__field">
                <label htmlFor="couverture">
                  📸 Image de couverture
                  <span className="cours-editor__label-hint">
                    (JPG, PNG, WebP — max 5 Mo)
                  </span>
                </label>
                <ImageUploader
                  storagePath={`${storageBasePath}/couverture`}
                  existingUrl={formCours.couvertureUrl}
                  placeholder="Glissez l'image de couverture ici ou cliquez"
                  disabled={saving}
                  onUploadStart={() => setCoverUploading(true)}
                  onUploadComplete={(url) => {
                    updateFormField('couvertureUrl', url);
                    setCoverUploading(false);
                  }}
                  onUploadError={(err) => {
                    console.error('[Phase 25] Erreur couverture:', err);
                    setCoverUploading(false);
                  }}
                  maxSizeMo={5}
                />
                {coverUploading && (
                  <p className="cours-editor__upload-hint">
                    ⏳ Upload en cours, patientez avant d'enregistrer…
                  </p>
                )}
              </div>
              {/* Toggle Premium */}
              <div className="cours-editor__field cours-editor__field--full">
                <label className="cours-editor__toggle-label">
                  <input
                    type="checkbox"
                    checked={formCours.isPremium}
                    onChange={e => updateFormField('isPremium', e.target.checked)}
                  />
                  <span>⭐ Cours Premium — Les sections (sauf la 1ère) nécessitent un abonnement</span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Objectifs pédagogiques ── */}
          <div className="cours-editor__card">
            <h2 className="cours-editor__card-titre">🎯 Objectifs pédagogiques</h2>
            {formCours.objectifs.map((obj, i) => (
              <div key={i} className="cours-editor__objectif-row">
                <input
                  type="text"
                  value={obj}
                  onChange={e => updateObjectif(i, e.target.value)}
                  placeholder={`Objectif ${i + 1} (ex : Savoir calculer une dérivée)`}
                  className="cours-editor__input"
                />
                {formCours.objectifs.length > 1 && (
                  <button
                    type="button"
                    className="btn-icon btn-icon--danger"
                    onClick={() => removeObjectif(i)}
                    title="Supprimer cet objectif"
                  >✕</button>
                )}
              </div>
            ))}
            <button type="button" className="btn-link" onClick={addObjectif}>
              + Ajouter un objectif
            </button>
          </div>

          {/* ── Prérequis et tags ── */}
          <div className="cours-editor__card">
            <h2 className="cours-editor__card-titre">📌 Prérequis et tags</h2>
            <div className="cours-editor__field">
              <label htmlFor="prerequis">Prérequis conseillés</label>
              <input
                id="prerequis"
                type="text"
                value={formCours.prerequis ?? ''}
                onChange={e => updateFormField('prerequis', e.target.value)}
                placeholder="Ex : Maîtriser les équations du 2nd degré"
                className="cours-editor__input"
              />
            </div>
            {/* Tags */}
            <div className="cours-editor__field">
              <label>Tags (aide à la recherche)</label>
              <div className="cours-editor__tags-wrapper">
                {formCours.tags.map(t => (
                  <span key={t} className="cours-editor__tag">
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      aria-label={`Supprimer le tag ${t}`}
                    >✕</button>
                  </span>
                ))}
                <div className="cours-editor__tag-input-row">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Ajouter un tag..."
                    className="cours-editor__input cours-editor__input--sm"
                  />
                  <button type="button" className="btn-secondary btn--sm" onClick={addTag}>
                    + Tag
                  </button>
                </div>
              </div>
            </div>
          </div>

        </section>
      )}

      {/* ════════════════════════════════════════════════════
          ONGLET 2 — Éditeur de sections et blocs
      ════════════════════════════════════════════════════ */}
      {onglet === 'sections' && (
        <section className="cours-editor__sections" aria-label="Éditeur de sections">
          {!isEdition ? (
            <div className="cours-editor__sections-empty">
              <p>Sauvegardez d'abord les informations du cours pour ajouter des sections.</p>
              <button className="btn-primary" onClick={() => setOnglet('infos')}>
                ← Revenir aux informations
              </button>
            </div>
          ) : (
            <div className="cours-editor__sections-layout">

              {/* ── Sidebar : liste des sections (drag-and-drop) ── */}
              <aside className="cours-editor__sections-sidebar">
                <div className="cours-editor__sections-sidebar-header">
                  <h2>📋 Sections</h2>
                  <button className="btn-primary btn--sm" onClick={ajouterSection}>
                    + Ajouter
                  </button>
                </div>

                {sections.length === 0 ? (
                  <p className="cours-editor__sections-empty-hint">
                    Aucune section. Cliquez sur "+ Ajouter" pour commencer.
                  </p>
                ) : (
                  <ol className="cours-editor__sections-liste">
                    {sections.map((section, idx) => (
                      <li
                        key={section.id}
                        className={[
                          'cours-editor__section-item',
                          section.id === sectionActive ? 'cours-editor__section-item--active' : '',
                          dragOverSectionIndex === idx ? 'cours-editor__section-item--drag-over' : '',
                        ].join(' ')}
                        draggable
                        onDragStart={e => handleDragStartSection(e, idx)}
                        onDragOver={e => handleDragOverSection(e, idx)}
                        onDrop={e => handleDropSection(e, idx)}
                        onDragEnd={() => setDragOverSectionIndex(null)}
                      >
                        <span className="cours-editor__section-drag" aria-hidden="true">⠿</span>
                        <button
                          className="cours-editor__section-btn"
                          onClick={() => setSectionActive(section.id)}
                          aria-current={section.id === sectionActive ? 'true' : undefined}
                        >
                          <span className="cours-editor__section-ordre">{section.ordre}</span>
                          <span className="cours-editor__section-nom">
                            {section.titre}
                            {section.estGratuite && (
                              <span className="cours-editor__section-gratuite" title="Section gratuite">G</span>
                            )}
                          </span>
                          <span className="cours-editor__section-blocs-count">
                            {section.blocs.length} bloc{section.blocs.length > 1 ? 's' : ''}
                          </span>
                        </button>
                        <button
                          className="btn-icon btn-icon--danger btn-icon--xs"
                          onClick={() => supprimerSection(section.id)}
                          title="Supprimer cette section"
                          aria-label={`Supprimer la section ${section.titre}`}
                        >🗑</button>
                      </li>
                    ))}
                  </ol>
                )}
              </aside>

              {/* ── Zone d'édition de la section active ── */}
              {sectionActive ? (
                <div className="cours-editor__section-content">

                  {/* Titre de la section */}
                  <div className="cours-editor__section-titre-row">
                    <input
                      type="text"
                      value={titreSectionEdite}
                      onChange={e => setTitreSectionEdite(e.target.value)}
                      onBlur={sauvegarderTitreSection}
                      className="cours-editor__section-titre-input"
                      placeholder="Titre de la section"
                      aria-label="Titre de la section"
                    />
                    {/* Toggle gratuite/premium */}
                    <label className="cours-editor__toggle-label">
                      <input
                        type="checkbox"
                        checked={sections.find(s => s.id === sectionActive)?.estGratuite ?? false}
                        onChange={async e => {
                          try {
                            await updateSection(sectionActive, { estGratuite: e.target.checked });
                            setSections(prev => prev.map(s =>
                              s.id === sectionActive ? { ...s, estGratuite: e.target.checked } : s
                            ));
                          } catch {}
                        }}
                      />
                      <span>Gratuite</span>
                    </label>
                  </div>

                  {/* Palette d'ajout de blocs */}
                  <div className="cours-editor__palette" aria-label="Ajouter un bloc">
                    <span className="cours-editor__palette-label">Ajouter un bloc :</span>
                    {(Object.keys(LABELS_TYPE_BLOC) as TypeBloc[]).map(type => {
                      const config = LABELS_TYPE_BLOC[type];
                      return (
                        <button
                          key={type}
                          className="cours-editor__palette-btn"
                          onClick={() => ajouterBloc(type)}
                          title={config.description}
                        >
                          {config.emoji} {config.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Liste des blocs (drag-and-drop) */}
                  {blocsSection.length === 0 ? (
                    <div className="cours-editor__blocs-empty">
                      <p>📭 Aucun bloc dans cette section.</p>
                      <p>Utilisez la palette ci-dessus pour ajouter du contenu.</p>
                    </div>
                  ) : (
                    <div className="cours-editor__blocs-liste" aria-label="Blocs de la section">
                      {blocsSection.map((bloc, idx) => (
                        <EditorBloc
                          key={bloc.id}
                          bloc={bloc}
                          index={idx}
                          total={blocsSection.length}
                          onUpdate={updated => updateBloc(idx, updated)}
                          onDelete={() => supprimerBloc(idx)}
                          onMoveUp={() => monterBloc(idx)}
                          onMoveDown={() => descendreBloc(idx)}
                          isDragging={draggingBlocIndex === idx}
                          onDragStart={handleDragStartBloc}
                          onDragOver={handleDragOverBloc}
                          onDrop={handleDropBloc}
                          onDragEnd={handleDragEndBloc}
                          dragOverIndex={dragOverBlocIndex}
                          storageBasePath={`${storageBasePath}/section-${sectionActive}`}
                          onBlocUploadStart={(blocIdx) => {
                            const key = `${sectionActive}-${blocIdx}`;
                            setBlocksUploading(prev => ({ ...prev, [key]: true }));
                          }}
                          onBlocUploadEnd={(blocIdx) => {
                            const key = `${sectionActive}-${blocIdx}`;
                            setBlocksUploading(prev => ({ ...prev, [key]: false }));
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="cours-editor__section-content-empty">
                  <p>Sélectionnez ou créez une section pour commencer à éditer.</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

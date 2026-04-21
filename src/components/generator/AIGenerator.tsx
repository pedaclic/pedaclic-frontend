/**
 * ============================================================
 * PEDACLIC — Phase 16 : Composant Générateur de Contenu IA
 * ============================================================
 * Fichier : AIGenerator.tsx
 * Emplacement : src/components/generator/AIGenerator.tsx
 * 
 * Interface 5 étapes :
 *   1. Discipline + Classe + Durée de la leçon
 *   2. Saisie du chapitre
 *   3. Choix du type de contenu
 *   4. Options avancées
 *   5. Résultat (prévisualisation + sauvegarde)
 * 
 * Gate Premium : bloque l'accès aux non-abonnés
 * Prévisualisation Markdown → HTML
 * Sauvegarde dans Firestore (generated_content ou quizzes)
 * 
 * v2.1 — Classe et durée comme champs explicites obligatoires
 * ============================================================
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  generateContent,
  saveGeneratedContent,
  saveGeneratedQuiz,
  getGeneratedHistory,
  deleteGeneratedContent,
  GENERATION_TYPE_LABELS,
  GENERATION_TYPE_DESCRIPTIONS,
  GENERATION_TYPE_ICONS,
  GenerationType,
  GenerationOptions,
  GenerationRequest,
  GenerationResponse,
  GeneratedContent,
  QuizQuestion,
} from '../../services/aiGeneratorService';
import {
  verifierQuotaRessources,
  incrementerUsage,
} from '../../services/premiumProService';
import EbookCompiler from './EbookCompiler';
import {
  getCompiledEbooks,
  deleteCompiledEbook,
  CompiledEbook,
} from '../../services/compiledEbookService';
import { CLASSES } from '../../types/cahierTextes.types';
import { extractTextFromFile } from '../../utils/extractTextFromFile';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';

// ==================== CONSTANTES ====================

/** Options de durée prédéfinies (en minutes) */
const DUREE_OPTIONS = [30, 45, 60, 90, 120];

/**
 * Types de génération qui nécessitent obligatoirement un texte source
 * (sujet/exercice importé depuis PDF, DOCX, TXT ou collé manuellement).
 * Pour ces types, la génération est bloquée tant que sourceText est vide.
 */
const TYPES_AVEC_SOURCE_REQUISE: GenerationType[] = [
  'correction_sujet',
  'sujet_avec_corrige',
];

/** Formats de fichier acceptés pour l'import de sujet source */
const ACCEPT_SOURCE_FICHIERS =
  '.txt,.pdf,.docx,application/pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'text/plain';

// ==================== INTERFACES LOCALES ====================

/** Discipline récupérée depuis Firestore */
interface DisciplineOption {
  id: string;
  nom: string;
  classe: string;
  niveau: string;
}

/** Étape courante du wizard */
type WizardStep = 1 | 2 | 3 | 4 | 5;

// ==================== COMPOSANT PRINCIPAL ====================

const AIGenerator: React.FC = () => {
  // ---- Auth context ----
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const confirmDlg = useConfirm();

  // ---- États du wizard ----
  const [step, setStep] = useState<WizardStep>(1);
  const [disciplines, setDisciplines] = useState<DisciplineOption[]>([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineOption | null>(null);
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [dureeCours, setDureeCours] = useState<number | ''>('');
  const [chapitre, setChapitre] = useState('');
  /** Texte source optionnel (collé ou import depuis fichier) */
  const [sourceText, setSourceText] = useState('');
  const [sourceFileLabel, setSourceFileLabel] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const sourceFileInputRef = useRef<HTMLInputElement>(null);
  /** Ref pour le file input dédié à l'étape 4 (types nécessitant un document source) */
  const sourceFileInputStep4Ref = useRef<HTMLInputElement>(null);

  /** Options de structure (étape 4) */
  const [includeExercices, setIncludeExercices] = useState(true);
  const [includeQuiz, setIncludeQuiz] = useState(false);
  /**
   * Phase 35 — Afficher le texte source à l'élève pendant le Quiz IA.
   * Visible uniquement pour le type `quiz_auto` quand un sourceText est présent.
   * Par défaut désactivé : les questions doivent rester autonomes si possible.
   */
  const [afficherCorpus, setAfficherCorpus] = useState(false);
  /** Filigrane affiché sur les exports PDF / Word uniquement */
  const [filigrane, setFiligrane] = useState('');

  const [selectedType, setSelectedType] = useState<GenerationType | null>(null);
  const [options, setOptions] = useState<GenerationOptions>({});

  // ---- États de génération ----
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ---- Quota MENSUEL ressources ----
  // Limites : Pro (illimite_1an, a_la_carte_tous) = illimité ;
  //           annuel legacy                        = 70 / mois ;
  //           autres formules Premium              = 50 / mois ;
  // Reset automatique au 1er de chaque mois calendaire (cf. premiumProService).
  const [quotaInfo, setQuotaInfo] = useState<{ usage: number; limite: number | null } | null>(null);

  // ---- Historique ----
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<GeneratedContent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewingContent, setViewingContent] = useState<GeneratedContent | null>(null);

  // ---- Ebooks compilés ----
  const [showEbookCompiler, setShowEbookCompiler] = useState(false);
  const [showMyEbooks, setShowMyEbooks]           = useState(false);
  const [myEbooks, setMyEbooks]                   = useState<CompiledEbook[]>([]);
  const [loadingEbooks, setLoadingEbooks]         = useState(false);

  // ---- Chargement initial ----
  const [loadingDisciplines, setLoadingDisciplines] = useState(true);

  // ==================== DISCIPLINES DÉDUPLIQUÉES ====================

  /**
   * Déduplique les disciplines par nom pour l'affichage.
   * Plusieurs documents Firestore peuvent exister pour une même discipline
   * (ex: "Mathématiques" en 3ème et en Terminale).
   * On ne garde qu'une entrée par nom pour la sélection.
   */
  const uniqueDisciplines = useMemo(() => {
    const seen = new Map<string, DisciplineOption>();
    disciplines.forEach((disc) => {
      if (!seen.has(disc.nom)) {
        seen.set(disc.nom, disc);
      }
    });
    return Array.from(seen.values());
  }, [disciplines]);

  // ==================== EFFETS ====================

  /** Charge les disciplines depuis Firestore au montage */
  useEffect(() => {
    const loadDisciplines = async () => {
      try {
        setLoadingDisciplines(true);
        const q = query(collection(db, 'disciplines'), orderBy('nom'));
        const snapshot = await getDocs(q);
        const disciplineList: DisciplineOption[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Ne garder que les disciplines avec un nom valide
          if (data.nom && data.nom.trim()) {
            disciplineList.push({
              id: docSnap.id,
              nom: data.nom || '',
              classe: data.classe || '',
              niveau: data.niveau || '',
            });
          }
        });

        setDisciplines(disciplineList);
      } catch (err) {
        console.error('[AIGenerator] Erreur chargement disciplines:', err);
        setError('Impossible de charger les disciplines.');
      } finally {
        setLoadingDisciplines(false);
      }
    };

    loadDisciplines();
  }, []);

  /** Charge le quota ressources (usage/limite) pour les formules non-Pro */
  useEffect(() => {
    if (!currentUser?.uid) return;
    verifierQuotaRessources(currentUser.uid, currentUser.subscriptionPlan).then(
      ({ usage, limite }) => setQuotaInfo({ usage, limite })
    );
  }, [currentUser?.uid, currentUser?.subscriptionPlan]);

  // ==================== HANDLERS ====================

  /** Sélection d'une discipline (met en surbrillance, ne change pas d'étape) */
  const handleSelectDiscipline = (disc: DisciplineOption) => {
    setSelectedDiscipline(disc);
    setError(null);
  };

  /** Validation de l'étape 1 : discipline + classe + durée (→ étape 2) */
  const handleStep1Submit = () => {
    // Vérification des champs obligatoires
    const missing: string[] = [];
    if (!selectedDiscipline) missing.push('discipline');
    if (!selectedClasse) missing.push('classe');
    if (!dureeCours || dureeCours < 1) missing.push('durée de la leçon');

    if (missing.length > 0) {
      setError(`Champs requis manquants : ${missing.join(', ')}`);
      return;
    }

    setStep(2);
    setError(null);
  };

  /** Validation du chapitre (étape 2 → 3) */
  const handleChapitreSubmit = () => {
    if (!chapitre.trim()) {
      setError('Veuillez saisir le titre du chapitre.');
      return;
    }
    setStep(3);
    setError(null);
  };

  /** Sélection du type de contenu (étape 3 → 4) */
  const handleSelectType = (type: GenerationType) => {
    setSelectedType(type);
    setStep(4);
    setError(null);
  };

  /** Retour à une étape précédente */
  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => (prev - 1) as WizardStep);
      setError(null);
      // Reset le résultat si on revient avant l'étape 5
      if (step === 5) {
        setGenerationResult(null);
        setSaveSuccess(false);
        setSavedId(null);
      }
    }
  };

  /** Reset complet du wizard */
  const handleReset = () => {
    setStep(1);
    setSelectedDiscipline(null);
    setSelectedClasse('');
    setDureeCours('');
    setChapitre('');
    setSourceText('');
    setSourceFileLabel(null);
    setUploadError(null);
    setIncludeExercices(true);
    setIncludeQuiz(false);
    setAfficherCorpus(false);
    setFiligrane('');
    setSelectedType(null);
    setOptions({});
    setGenerationResult(null);
    setError(null);
    setSaveSuccess(false);
    setSavedId(null);
  };

  /** Lancement de la génération (étape 4 → 5) */
  const handleGenerate = async () => {
    if (!selectedDiscipline || !selectedType || !chapitre.trim() || !selectedClasse) {
      setError('Paramètres incomplets. Veuillez reprendre depuis le début.');
      return;
    }

    // Validation spécifique aux types nécessitant un document source
    if (TYPES_AVEC_SOURCE_REQUISE.includes(selectedType) && !sourceText.trim()) {
      setError(
        'Ce type de génération nécessite un document source. ' +
        'Veuillez coller le texte du sujet/exercice ou importer un fichier (PDF, DOCX, TXT) ci-dessous.'
      );
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Construire les options avec la durée du cours
      const mergedOptions: GenerationOptions = {
        ...options,
        duree: typeof dureeCours === 'number' ? dureeCours : undefined,
        sourceText: sourceText.trim() || undefined,
        includeExercices:
          selectedType === 'exercices_corriges' ? true : includeExercices,
        includeQuiz: selectedType === 'quiz_auto' ? true : includeQuiz,
      };

      const request: GenerationRequest = {
        type: selectedType,
        discipline: selectedDiscipline.nom,
        classe: selectedClasse,
        chapitre: chapitre.trim(),
        options: Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined,
      };

      const result = await generateContent(request);
      setGenerationResult(result);
      setStep(5);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  /** Sauvegarde du résultat dans Firestore */
  const handleSave = async () => {
    if (!currentUser || !generationResult || !selectedDiscipline || !selectedType) return;

    // Vérifier le quota MENSUEL ressources (50 ou 70 selon la formule ; illimité pour Pro)
    const { autorise, usage, limite } = await verifierQuotaRessources(
      currentUser.uid,
      currentUser.subscriptionPlan
    );
    if (!autorise && limite !== null) {
      setError(
        `Vous avez atteint la limite de ${limite} ressources (${usage}/${limite} utilisées). ` +
        'Passez à Premium Pro (abonnement annuel ou 9 mois) pour un accès illimité.'
      );
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let docId: string;

      // Trouver le bon disciplineId pour la classe sélectionnée
      const matchingDisc = disciplines.find(
        (d) => d.nom === selectedDiscipline.nom && d.classe === selectedClasse
      );
      const disciplineId = matchingDisc?.id || selectedDiscipline.id;

      const requestForSave: GenerationRequest = {
        type: selectedType,
        discipline: selectedDiscipline.nom,
        classe: selectedClasse,
        chapitre: chapitre.trim(),
        options: {
          ...options,
          duree: typeof dureeCours === 'number' ? dureeCours : undefined,
          includeExercices:
            selectedType === 'exercices_corriges' ? true : includeExercices,
          includeQuiz: selectedType === 'quiz_auto' ? true : includeQuiz,
          // Phase 35 — corpus : on transmet le sourceText et le drapeau uniquement
          // pour un quiz_auto. saveGeneratedQuiz filtre et ne persiste que si les
          // deux sont vérifiés (toggle ON + texte non vide).
          sourceText: sourceText.trim() || undefined,
          afficherCorpus: selectedType === 'quiz_auto' ? afficherCorpus : undefined,
        },
      };

      if (generationResult.type === 'quiz' && generationResult.data.questions) {
        // Sauvegarde comme quiz dans la collection quizzes
        docId = await saveGeneratedQuiz(
          currentUser.uid,
          requestForSave,
          generationResult.data.questions,
          disciplineId
        );
      } else {
        // Sauvegarde comme contenu dans generated_content
        docId = await saveGeneratedContent(
          currentUser.uid,
          requestForSave,
          generationResult.data.content || '',
          disciplineId
        );
      }

      setSavedId(docId);
      setSaveSuccess(true);

      // Incrémenter le compteur de ressources consommées
      await incrementerUsage(currentUser.uid);

      // Rafraîchit silencieusement l'historique pour que le nouvel élément
      // apparaisse immédiatement sans que l'utilisateur ait à le recharger.
      try {
        const items = await getGeneratedHistory(currentUser.uid);
        setHistory(items);
      } catch {
        // Non-bloquant — l'historique se rechargera à la prochaine ouverture manuelle.
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de sauvegarde';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  /** Charge l'historique des générations */
  const handleLoadHistory = async () => {
    if (!currentUser) return;

    setLoadingHistory(true);
    try {
      const items = await getGeneratedHistory(currentUser.uid);
      setHistory(items);
      setShowHistory(true);
    } catch (err) {
      console.error('[AIGenerator] Erreur historique:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  /** Normalise le nom de fichier */
  const safeFilename = (titre: string) =>
    titre
      .replace(/[^\w\u00C0-\u017E\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'contenu_pedaclic';

  /** Déclenche un téléchargement navigateur générique */
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSourceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadBusy(true);
    try {
      const text = await extractTextFromFile(file);
      const t = text.trim();
      if (!t) {
        setUploadError('Aucun texte lisible dans ce fichier.');
        return;
      }
      setSourceText((prev) => {
        if (!prev.trim()) return text;
        return `${prev.trim()}\n\n---\n\n${text}`;
      });
      setSourceFileLabel(file.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Import du fichier impossible.");
    } finally {
      setUploadBusy(false);
      const input = e.target;
      if (input) input.value = '';
    }
  };

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const watermarkHtml = (text: string) =>
    text.trim()
      ? `<div class="ai-generator__watermark" aria-hidden="true">${escapeHtml(text.trim())}</div>`
      : '';

  /** Télécharge le contenu en Word (.doc) via HTML compatible Office */
  const handleDownloadWord = (content: string, titre: string, watermark?: string) => {
    const html = markdownToHtml(content);
    const wm = watermarkHtml(watermark || '');
    const wordHtml = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titre)}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
  <style>
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 2cm; color: #1a1a1a; }
    h1 { font-size: 18pt; color: #1a56db; margin-bottom: 12pt; }
    h2 { font-size: 15pt; color: #1a56db; margin-top: 18pt; margin-bottom: 8pt; }
    h3 { font-size: 13pt; color: #333; margin-top: 14pt; }
    p  { margin-bottom: 8pt; }
    ul, ol { margin-left: 1cm; margin-bottom: 8pt; }
    li { margin-bottom: 4pt; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    code { font-family: Courier New; background: #f5f5f5; padding: 1pt 3pt; }
    pre  { font-family: Courier New; background: #f5f5f5; padding: 8pt; margin: 8pt 0; }
    hr { border: none; border-top: 1px solid #ccc; margin: 12pt 0; }
    .ai-generator__watermark {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      font-size: 44pt; font-weight: 700;
      color: rgba(26, 86, 219, 0.08);
      z-index: 0; pointer-events: none;
      white-space: pre-wrap; text-align: center; max-width: 95%; line-height: 1.15;
    }
    .ai-generator__print-body { position: relative; z-index: 1; }
  </style>
</head>
<body>
  ${wm}
  <div class="ai-generator__print-body">
  <h1>${escapeHtml(titre)}</h1>
  ${html}
  </div>
</body>
</html>`;
    const blob = new Blob(['\ufeff', wordHtml], {
      type: 'application/msword;charset=utf-8',
    });
    triggerDownload(blob, `${safeFilename(titre)}.doc`);
  };

  /** Export brut Markdown / texte */
  const handleDownloadMarkdown = (content: string, titre: string) => {
    const blob = new Blob(['\ufeff', content], {
      type: 'text/markdown;charset=utf-8',
    });
    triggerDownload(blob, `${safeFilename(titre)}.md`);
  };

  /** Ouvre une fenêtre d'impression pour enregistrer en PDF */
  const handleDownloadPDF = (content: string, titre: string, watermark?: string) => {
    const html = markdownToHtml(content);
    const wm = watermarkHtml(watermark || '');
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titre)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.7; color: #1a1a1a; padding: 2cm; max-width: 800px; margin: auto; }
    h1 { font-size: 20pt; color: #1a56db; margin-bottom: 14pt; padding-bottom: 6pt; border-bottom: 2px solid #1a56db; }
    h2 { font-size: 15pt; color: #1a56db; margin: 18pt 0 8pt; }
    h3 { font-size: 13pt; color: #333; margin: 14pt 0 6pt; }
    p  { margin-bottom: 8pt; }
    ul, ol { margin: 6pt 0 8pt 1.5cm; }
    li { margin-bottom: 4pt; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    code { font-family: Courier New, monospace; background: #f5f5f5; padding: 1pt 4pt; border-radius: 3pt; font-size: 10pt; }
    pre  { font-family: Courier New, monospace; background: #f5f5f5; padding: 10pt; margin: 8pt 0; border-radius: 4pt; font-size: 10pt; white-space: pre-wrap; }
    hr { border: none; border-top: 1px solid #ddd; margin: 14pt 0; }
    .header-meta { font-size: 9pt; color: #888; margin-bottom: 18pt; }
    .ai-generator__watermark {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      font-size: 56px; font-weight: 700;
      color: rgba(26, 86, 219, 0.08);
      z-index: 0; pointer-events: none;
      white-space: pre-wrap; text-align: center; max-width: 95%; line-height: 1.15;
    }
    .ai-generator__print-body { position: relative; z-index: 1; }
    @media print {
      body { padding: 0; }
      @page { margin: 2cm; }
    }
  </style>
</head>
<body>
  ${wm}
  <div class="ai-generator__print-body">
  <h1>${escapeHtml(titre)}</h1>
  <p class="header-meta">PedaClic · Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  ${html}
  </div>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  /** Supprime un élément de l'historique */
  const handleDeleteHistory = async (contentId: string) => {
    if (!await confirmDlg({ title: 'Supprimer ?', message: 'Supprimer ce contenu généré ?', confirmLabel: 'Supprimer', variant: 'danger' })) return;
    try {
      await deleteGeneratedContent(contentId);
      setHistory((prev) => prev.filter((item) => item.id !== contentId));
    } catch (err) {
      console.error('[AIGenerator] Erreur suppression:', err);
    }
  };

  /** Charge les ebooks compilés de l'utilisateur */
  const handleLoadMyEbooks = async () => {
    if (!currentUser) return;
    setLoadingEbooks(true);
    try {
      const books = await getCompiledEbooks(currentUser.uid);
      setMyEbooks(books);
      setShowMyEbooks(true);
    } catch (err) {
      console.error('[AIGenerator] Erreur chargement ebooks:', err);
    } finally {
      setLoadingEbooks(false);
    }
  };

  /** Supprime un ebook compilé */
  const handleDeleteCompiledEbook = async (id: string) => {
    if (!await confirmDlg({ title: 'Supprimer ?', message: 'Supprimer cet ebook ?', confirmLabel: 'Supprimer', variant: 'danger' })) return;
    try {
      await deleteCompiledEbook(id);
      setMyEbooks(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('[AIGenerator] Erreur suppression ebook:', err);
    }
  };

  /** Ouvre un ebook compilé pour lecture */
  const handleViewCompiledEbook = (ebook: CompiledEbook) => {
    const fullContent = ebook.sections
      .map((s, i) =>
        `# ${i + 1}. ${s.chapitre}\n\n**${GENERATION_TYPE_LABELS[s.type]}** · ${s.discipline} · ${s.classe}\n\n${s.content}`
      )
      .join('\n\n---\n\n');
    setViewingContent({
      id:          ebook.id,
      userId:      ebook.userId,
      type:        'cours_complet',
      discipline:  'Ebook compilé',
      disciplineId:'',
      classe:      '',
      chapitre:    ebook.titre,
      content:     fullContent,
      createdAt:   ebook.createdAt,
    });
    setShowMyEbooks(false);
  };

  // ==================== UTILITAIRES ====================

  /** Convertit le Markdown basique en HTML pour la prévisualisation */
  const markdownToHtml = useCallback((md: string): string => {
    if (!md) return '';
    
    let html = md
      // Titres
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Gras et italique
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Listes à puces
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Listes numérotées
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Séparateurs
      .replace(/^---$/gm, '<hr />')
      // Blocs de code
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Code inline
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Paragraphes (lignes vides)
      .replace(/\n\n/g, '</p><p>')
      // Retours à la ligne
      .replace(/\n/g, '<br />');

    // Entourer les <li> dans des <ul>
    html = html.replace(/(<li>.*?<\/li>(\s*<br \/>)?)+/g, (match) => {
      return '<ul>' + match.replace(/<br \/>/g, '') + '</ul>';
    });

    return `<p>${html}</p>`;
  }, []);

  // ==================== GATE PREMIUM ====================

  // Vérification : l'utilisateur doit être connecté
  if (!currentUser) {
    return (
      <div className="ai-generator">
        {/* ---- Message non connecté ---- */}
        <div className="ai-generator__gate">
          <div className="ai-generator__gate-icon">🔒</div>
          <h2>Connexion requise</h2>
          <p>Vous devez être connecté pour accéder au générateur de contenu IA.</p>
          <Link to="/connexion" className="btn btn--primary">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  // Vérification : l'utilisateur doit être Premium
  if (!currentUser.isPremium) {
    return (
      <div className="ai-generator">
        {/* ---- Gate Premium ---- */}
        <div className="ai-generator__gate">
          <div className="ai-generator__gate-icon">✨</div>
          <h2>Fonctionnalité Premium</h2>
          <p>
            Le générateur de contenu IA est réservé aux abonnés Premium.
            Générez des cours, des exercices, des quiz et des sujets d'examen 
            adaptés au programme sénégalais en un clic !
          </p>
          <div className="ai-generator__gate-price">
            <span className="price">2 000 FCFA</span>
            <span className="period">/mois</span>
          </div>
          <Link to="/premium" className="btn btn--primary btn--lg">
            Devenir Premium
          </Link>
        </div>
      </div>
    );
  }

  // ==================== RENDU PRINCIPAL ====================

  return (
    <div className="ai-generator">
      {/* ---- En-tête ---- */}
      <div className="ai-generator__header">
        <h1 className="ai-generator__title">
          🤖 Générateur de Contenu IA
        </h1>
        <p className="ai-generator__subtitle">
          Créez des cours, exercices, quiz et sujets d'examen adaptés au programme sénégalais
        </p>
        {quotaInfo && quotaInfo.limite !== null && (
          <p className="ai-generator__quota" style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Ressources utilisées : {quotaInfo.usage} / {quotaInfo.limite}
          </p>
        )}

        {/* Boutons en-tête */}
        <div className="ai-generator__header-actions">
          <button
            className="btn btn--outline btn--sm"
            onClick={handleLoadHistory}
            disabled={loadingHistory}
          >
            {loadingHistory ? '⏳ Chargement...' : '📂 Historique'}
          </button>
          <button
            className="btn btn--outline btn--sm"
            onClick={() => { handleLoadHistory(); setShowEbookCompiler(true); }}
            title="Compiler plusieurs contenus en un ebook"
          >
            📘 Compiler un Ebook
          </button>
          <button
            className="btn btn--outline btn--sm"
            onClick={handleLoadMyEbooks}
            disabled={loadingEbooks}
            title="Voir mes ebooks compilés"
          >
            {loadingEbooks ? '⏳...' : '📚 Mes Ebooks'}
          </button>
          {step > 1 && (
            <button className="btn btn--outline btn--sm" onClick={handleReset}>
              🔄 Recommencer
            </button>
          )}
        </div>
      </div>

      {/* ---- Indicateur d'étapes ---- */}
      <div className="ai-generator__steps">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`ai-generator__step-indicator ${
              s === step ? 'ai-generator__step-indicator--active' : ''
            } ${s < step ? 'ai-generator__step-indicator--done' : ''}`}
          >
            <span className="ai-generator__step-number">
              {s < step ? '✓' : s}
            </span>
            <span className="ai-generator__step-label">
              {s === 1 && 'Paramètres'}
              {s === 2 && 'Chapitre'}
              {s === 3 && 'Type'}
              {s === 4 && 'Options'}
              {s === 5 && 'Résultat'}
            </span>
          </div>
        ))}
      </div>

      {/* ---- Message d'erreur ---- */}
      {error && (
        <div className="ai-generator__error">
          <span className="ai-generator__error-icon">⚠️</span>
          {error}
          <button
            className="ai-generator__error-close"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ---- Contenu de l'étape ---- */}
      <div className="ai-generator__content">

        {/* ============ ÉTAPE 1 : Discipline + Classe + Durée ============ */}
        {step === 1 && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              📚 Paramètres de la leçon
            </h2>

            {/* ---- Sélection de la discipline ---- */}
            <div className="ai-generator__field">
              <label className="ai-generator__label">
                Discipline <span className="ai-generator__required">*</span>
              </label>

              {loadingDisciplines ? (
                <div className="ai-generator__loading">
                  <div className="spinner"></div>
                  <p>Chargement des disciplines...</p>
                </div>
              ) : uniqueDisciplines.length === 0 ? (
                <div className="ai-generator__empty">
                  <p>Aucune discipline disponible.</p>
                </div>
              ) : (
                <div className="ai-generator__discipline-grid">
                  {uniqueDisciplines.map((disc) => (
                    <button
                      key={disc.id}
                      className={`ai-generator__discipline-card ${
                        selectedDiscipline?.nom === disc.nom
                          ? 'ai-generator__discipline-card--selected'
                          : ''
                      }`}
                      onClick={() => handleSelectDiscipline(disc)}
                    >
                      <span className="ai-generator__discipline-name">
                        {disc.nom}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ---- Sélection de la classe ---- */}
            <div className="ai-generator__field">
              <label className="ai-generator__label">
                Classe <span className="ai-generator__required">*</span>
              </label>
              <div className="ai-generator__classe-grid">
                {CLASSES.map((cls) => (
                  <button
                    key={cls}
                    className={`ai-generator__classe-btn ${
                      selectedClasse === cls
                        ? 'ai-generator__classe-btn--selected'
                        : ''
                    }`}
                    onClick={() => {
                      setSelectedClasse(cls);
                      setError(null);
                    }}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            {/* ---- Durée de la leçon ---- */}
            <div className="ai-generator__field">
              <label htmlFor="dureeCours" className="ai-generator__label">
                Durée de la leçon (minutes) <span className="ai-generator__required">*</span>
              </label>
              <div className="ai-generator__duree-group">
                {/* Boutons rapides */}
                <div className="ai-generator__duree-presets">
                  {DUREE_OPTIONS.map((d) => (
                    <button
                      key={d}
                      className={`ai-generator__duree-btn ${
                        dureeCours === d ? 'ai-generator__duree-btn--selected' : ''
                      }`}
                      onClick={() => {
                        setDureeCours(d);
                        setError(null);
                      }}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
                {/* Saisie libre */}
                <input
                  id="dureeCours"
                  type="number"
                  className="ai-generator__input ai-generator__input--small"
                  min="15"
                  max="300"
                  step="5"
                  value={dureeCours}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setDureeCours(isNaN(val) ? '' : val);
                    setError(null);
                  }}
                  placeholder="Autre durée..."
                />
              </div>
            </div>

            {/* ---- Bouton Continuer ---- */}
            <div className="ai-generator__nav">
              <div></div> {/* Spacer pour aligner à droite */}
              <button
                className="btn btn--primary"
                onClick={handleStep1Submit}
                disabled={!selectedDiscipline || !selectedClasse || !dureeCours}
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ============ ÉTAPE 2 : Saisie du chapitre ============ */}
        {step === 2 && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              📖 Précisez le chapitre
            </h2>

            {/* Récapitulatif étape 1 */}
            <div className="ai-generator__recap">
              <span className="ai-generator__recap-label">Discipline :</span>
              <span className="ai-generator__recap-value">
                {selectedDiscipline?.nom}
              </span>
              <span className="ai-generator__recap-label">Classe :</span>
              <span className="ai-generator__recap-value">
                {selectedClasse}
              </span>
              <span className="ai-generator__recap-label">Durée :</span>
              <span className="ai-generator__recap-value">
                {dureeCours} minutes
              </span>
            </div>

            {/* Champ chapitre */}
            <div className="ai-generator__field">
              <label htmlFor="chapitre" className="ai-generator__label">
                Titre du chapitre ou du thème
              </label>
              <input
                id="chapitre"
                type="text"
                className="ai-generator__input"
                placeholder="Ex: Les fonctions affines, Le récit autobiographique, La tectonique des plaques..."
                value={chapitre}
                onChange={(e) => setChapitre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChapitreSubmit()}
                autoFocus
              />
            </div>

            <div className="ai-generator__field">
              <label className="ai-generator__label" htmlFor="sourceText">
                Contenu source (optionnel)
              </label>
              <p className="ai-generator__hint">
                Collez un texte ou importez un fichier (.txt, .pdf, .docx). L’IA s’appuiera sur ce
                matériau pour enrichir et structurer la génération.
              </p>
              <textarea
                id="sourceText"
                className="ai-generator__textarea ai-generator__textarea--source"
                rows={8}
                placeholder="Notes, extrait de cours, synthèse, copie de document, sujet d'examen…"
                value={sourceText}
                onChange={(e) => {
                  setSourceText(e.target.value);
                  setUploadError(null);
                }}
              />
              {sourceText.length > 0 && (
                <p style={{
                  fontSize: '0.75rem',
                  marginTop: 4,
                  marginBottom: 2,
                  color: sourceText.length > 25_000 ? '#dc2626' : sourceText.length > 15_000 ? '#d97706' : '#6b7280',
                }}>
                  {sourceText.length.toLocaleString('fr-FR')} caractères
                  {sourceText.length > 25_000
                    ? ' — ⚠️ Le texte sera tronqué intelligemment (début + fin conservés).'
                    : sourceText.length > 15_000
                      ? ' — Volume important, la génération sera plus longue.'
                      : ''}
                </p>
              )}
              <div className="ai-generator__source-actions">
                <input
                  ref={sourceFileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="ai-generator__file-input"
                  onChange={handleSourceFileUpload}
                />
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  disabled={uploadBusy}
                  onClick={() => sourceFileInputRef.current?.click()}
                >
                  {uploadBusy ? '⏳ Lecture…' : '📎 Importer un fichier'}
                </button>
                {sourceFileLabel && (
                  <span className="ai-generator__source-filename">· {sourceFileLabel}</span>
                )}
              </div>
              {uploadError && (
                <p className="ai-generator__source-error" role="alert">
                  {uploadError}
                </p>
              )}
            </div>

            {/* Boutons navigation */}
            <div className="ai-generator__nav">
              <button className="btn btn--outline" onClick={handleBack}>
                ← Retour
              </button>
              <button
                className="btn btn--primary"
                onClick={handleChapitreSubmit}
                disabled={!chapitre.trim()}
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ============ ÉTAPE 3 : Choix du type ============ */}
        {step === 3 && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              🎯 Quel type de contenu ?
            </h2>

            {/* Récapitulatif */}
            <div className="ai-generator__recap">
              <span className="ai-generator__recap-label">Discipline :</span>
              <span className="ai-generator__recap-value">
                {selectedDiscipline?.nom}
              </span>
              <span className="ai-generator__recap-label">Classe :</span>
              <span className="ai-generator__recap-value">
                {selectedClasse}
              </span>
              <span className="ai-generator__recap-label">Durée :</span>
              <span className="ai-generator__recap-value">
                {dureeCours} minutes
              </span>
              <span className="ai-generator__recap-label">Chapitre :</span>
              <span className="ai-generator__recap-value">{chapitre}</span>
            </div>

            {/* ---- Grille des types standards (sans document source) ---- */}
            <div className="ai-generator__type-grid">
              {(Object.keys(GENERATION_TYPE_LABELS) as GenerationType[])
                /* Exclure les types "document requis" de la grille principale */
                .filter((type) => !TYPES_AVEC_SOURCE_REQUISE.includes(type))
                .map((type) => (
                  <button
                    key={type}
                    className="ai-generator__type-card"
                    onClick={() => handleSelectType(type)}
                  >
                    <span className="ai-generator__type-icon">
                      {GENERATION_TYPE_ICONS[type]}
                    </span>
                    <span className="ai-generator__type-name">
                      {GENERATION_TYPE_LABELS[type]}
                    </span>
                    <span className="ai-generator__type-desc">
                      {GENERATION_TYPE_DESCRIPTIONS[type]}
                    </span>
                  </button>
                ))}
            </div>

            {/* ---- Section : types nécessitant un document source ---- */}
            <div className="ai-generator__type-section">
              {/* En-tête de la section */}
              <div className="ai-generator__type-section-header">
                <span className="ai-generator__type-section-icon">📎</span>
                <div>
                  <p className="ai-generator__type-section-title">
                    À partir d'un document (sujet ou exercice)
                  </p>
                  <p className="ai-generator__type-section-hint">
                    Importez un fichier PDF, DOCX ou TXT, ou collez le texte directement — l'IA
                    analyse votre document et génère le contenu demandé.
                  </p>
                </div>
              </div>

              {/* Grille des deux nouvelles cartes */}
              <div className="ai-generator__type-grid ai-generator__type-grid--document">
                {(Object.keys(GENERATION_TYPE_LABELS) as GenerationType[])
                  .filter((type) => TYPES_AVEC_SOURCE_REQUISE.includes(type))
                  .map((type) => (
                    <button
                      key={type}
                      /* Classe spécifique pour le style "document requis" */
                      className="ai-generator__type-card ai-generator__type-card--document"
                      onClick={() => handleSelectType(type)}
                    >
                      <span className="ai-generator__type-icon">
                        {GENERATION_TYPE_ICONS[type]}
                      </span>
                      <span className="ai-generator__type-name">
                        {GENERATION_TYPE_LABELS[type]}
                      </span>
                      <span className="ai-generator__type-desc">
                        {GENERATION_TYPE_DESCRIPTIONS[type]}
                      </span>
                      {/* Badge indiquant que le document source est obligatoire */}
                      <span className="ai-generator__type-badge">
                        📎 Document source requis
                      </span>
                    </button>
                  ))}
              </div>
            </div>

            {/* Bouton retour */}
            <div className="ai-generator__nav">
              <button className="btn btn--outline" onClick={handleBack}>
                ← Retour
              </button>
            </div>
          </div>
        )}

        {/* ============ ÉTAPE 4 : Options avancées ============ */}
        {step === 4 && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              ⚙️ Options de génération
            </h2>

            {/* Récapitulatif complet */}
            <div className="ai-generator__recap">
              <span className="ai-generator__recap-label">Discipline :</span>
              <span className="ai-generator__recap-value">
                {selectedDiscipline?.nom}
              </span>
              <span className="ai-generator__recap-label">Classe :</span>
              <span className="ai-generator__recap-value">
                {selectedClasse}
              </span>
              <span className="ai-generator__recap-label">Durée :</span>
              <span className="ai-generator__recap-value">
                {dureeCours} minutes
              </span>
              <span className="ai-generator__recap-label">Chapitre :</span>
              <span className="ai-generator__recap-value">{chapitre}</span>
              <span className="ai-generator__recap-label">Type :</span>
              <span className="ai-generator__recap-value">
                {selectedType && GENERATION_TYPE_ICONS[selectedType]}{' '}
                {selectedType && GENERATION_TYPE_LABELS[selectedType]}
              </span>
            </div>

            {/* ============================================================
                ZONE DOCUMENT SOURCE — affichée uniquement pour les types
                'correction_sujet' et 'sujet_avec_corrige'.
                Positionnée AVANT les autres options pour attirer l'attention.
                ============================================================ */}
            {selectedType && TYPES_AVEC_SOURCE_REQUISE.includes(selectedType) && (
              <div className={
                sourceText.trim()
                  ? 'ai-generator__source-required ai-generator__source-required--ok'
                  : 'ai-generator__source-required'
              }>
                {sourceText.trim() ? (
                  /* ---- Document source déjà présent ---- */
                  <>
                    <div className="ai-generator__source-required-header">
                      <span>✅</span>
                      <span>Document source chargé ({sourceText.length.toLocaleString('fr-FR')} caractères)</span>
                    </div>
                    {sourceFileLabel && (
                      <p className="ai-generator__source-required-file">
                        📎 {sourceFileLabel}
                      </p>
                    )}
                    <div className="ai-generator__source-actions" style={{ marginTop: '0.5rem' }}>
                      {/* Input caché partagé avec l'étape 2 */}
                      <input
                        ref={sourceFileInputStep4Ref}
                        type="file"
                        accept={ACCEPT_SOURCE_FICHIERS}
                        className="ai-generator__file-input"
                        onChange={handleSourceFileUpload}
                      />
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        disabled={uploadBusy}
                        onClick={() => sourceFileInputStep4Ref.current?.click()}
                      >
                        {uploadBusy ? '⏳ Lecture…' : '📎 Remplacer le fichier'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={() => { setSourceText(''); setSourceFileLabel(null); }}
                      >
                        🗑️ Effacer
                      </button>
                    </div>
                  </>
                ) : (
                  /* ---- Aucun document source — zone d'upload/saisie ---- */
                  <>
                    <div className="ai-generator__source-required-header">
                      <span>⚠️</span>
                      <span>Document source requis pour ce type de génération</span>
                    </div>
                    <p className="ai-generator__source-required-hint">
                      Importez le sujet ou les exercices à traiter (PDF, DOCX, TXT) ou
                      collez le texte directement ci-dessous.
                    </p>

                    {/* Textarea de saisie directe */}
                    <textarea
                      className="ai-generator__textarea ai-generator__textarea--source"
                      rows={8}
                      placeholder="Collez ici le texte du sujet ou des exercices à corriger / à enrichir…"
                      value={sourceText}
                      onChange={(e) => {
                        setSourceText(e.target.value);
                        setUploadError(null);
                        setError(null);
                      }}
                    />

                    {/* Compteur de caractères */}
                    {sourceText.length > 0 && (
                      <p style={{
                        fontSize: '0.75rem',
                        marginTop: 4,
                        color: sourceText.length > 25_000 ? '#dc2626' : '#6b7280',
                      }}>
                        {sourceText.length.toLocaleString('fr-FR')} caractères
                        {sourceText.length > 25_000 ? ' — ⚠️ Le texte sera tronqué intelligemment.' : ''}
                      </p>
                    )}

                    {/* Bouton d'import de fichier */}
                    <div className="ai-generator__source-actions">
                      <input
                        ref={sourceFileInputStep4Ref}
                        type="file"
                        accept={ACCEPT_SOURCE_FICHIERS}
                        className="ai-generator__file-input"
                        onChange={handleSourceFileUpload}
                      />
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        disabled={uploadBusy}
                        onClick={() => sourceFileInputStep4Ref.current?.click()}
                      >
                        {uploadBusy ? '⏳ Lecture…' : '📎 Importer un fichier (PDF, DOCX, TXT)'}
                      </button>
                      {sourceFileLabel && (
                        <span className="ai-generator__source-filename">· {sourceFileLabel}</span>
                      )}
                    </div>
                    {uploadError && (
                      <p className="ai-generator__source-error" role="alert">{uploadError}</p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Options selon le type */}
            <div className="ai-generator__options">
              {/* Difficulté (tous types) */}
              <div className="ai-generator__field">
                <label className="ai-generator__label">
                  Niveau de difficulté
                </label>
                <div className="ai-generator__radio-group">
                  {(['facile', 'moyen', 'difficile'] as const).map((level) => (
                    <label key={level} className="ai-generator__radio">
                      <input
                        type="radio"
                        name="difficulte"
                        value={level}
                        checked={options.difficulte === level}
                        onChange={() =>
                          setOptions((prev) => ({ ...prev, difficulte: level }))
                        }
                      />
                      <span className="ai-generator__radio-label">
                        {level === 'facile' && '🟢 Facile'}
                        {level === 'moyen' && '🟡 Moyen'}
                        {level === 'difficile' && '🔴 Difficile'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Type d'examen (sujet_examen uniquement) */}
              {selectedType === 'sujet_examen' && (
                <div className="ai-generator__field">
                  <label className="ai-generator__label">Type d'examen</label>
                  <div className="ai-generator__radio-group">
                    {(['BFEM', 'BAC'] as const).map((exam) => (
                      <label key={exam} className="ai-generator__radio">
                        <input
                          type="radio"
                          name="typeExamen"
                          value={exam}
                          checked={options.typeExamen === exam}
                          onChange={() =>
                            setOptions((prev) => ({ ...prev, typeExamen: exam }))
                          }
                        />
                        <span className="ai-generator__radio-label">
                          {exam}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Objectifs pédagogiques (optionnel) */}
              <div className="ai-generator__field">
                <label htmlFor="objectifs" className="ai-generator__label">
                  Objectifs pédagogiques (optionnel)
                </label>
                <textarea
                  id="objectifs"
                  className="ai-generator__textarea"
                  rows={3}
                  placeholder="Ex: L'élève doit être capable de résoudre une équation du 1er degré..."
                  value={options.objectifs || ''}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      objectifs: e.target.value || undefined,
                    }))
                  }
                />
              </div>

              {/* Consignes spéciales (optionnel) */}
              <div className="ai-generator__field">
                <label htmlFor="consignes" className="ai-generator__label">
                  Consignes spéciales (optionnel)
                </label>
                <textarea
                  id="consignes"
                  className="ai-generator__textarea"
                  rows={2}
                  placeholder="Ex: Inclure un exercice sur les statistiques, utiliser des exemples avec le football..."
                  value={options.consignesSpeciales || ''}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      consignesSpeciales: e.target.value || undefined,
                    }))
                  }
                />
              </div>

              <div className="ai-generator__field">
                <span className="ai-generator__label">Structure du document généré</span>
                <div className="ai-generator__checkbox-row">
                  <label className="ai-generator__checkbox">
                    <input
                      type="checkbox"
                      checked={
                        selectedType === 'exercices_corriges' ? true : includeExercices
                      }
                      disabled={selectedType === 'exercices_corriges'}
                      onChange={(e) => setIncludeExercices(e.target.checked)}
                    />
                    <span>Inclure des exercices ou applications</span>
                  </label>
                  <label className="ai-generator__checkbox">
                    <input
                      type="checkbox"
                      checked={selectedType === 'quiz_auto' ? true : includeQuiz}
                      disabled={selectedType === 'quiz_auto'}
                      onChange={(e) => setIncludeQuiz(e.target.checked)}
                    />
                    <span>Inclure une section quiz (QCM) en fin de document</span>
                  </label>

                  {/* Phase 35 — Toggle "Afficher le texte support à l'élève pendant le quiz".
                      Pertinent uniquement pour un Quiz IA basé sur un texte source
                      (compréhension écrite, analyse littéraire, documents historiques,
                      etc.). Les questions qui dépendent du texte deviennent résolvables
                      par l'élève sans quitter le quiz. */}
                  {selectedType === 'quiz_auto' && sourceText.trim().length > 0 && (
                    <label className="ai-generator__checkbox">
                      <input
                        type="checkbox"
                        checked={afficherCorpus}
                        onChange={(e) => setAfficherCorpus(e.target.checked)}
                      />
                      <span>
                        📖 Afficher le texte support à l'élève pendant le quiz
                      </span>
                    </label>
                  )}
                </div>
                <p className="ai-generator__hint">
                  {selectedType === 'quiz_auto'
                    ? (sourceText.trim().length > 0
                        ? 'Le type « Quiz auto-généré » produit un contenu entièrement en QCM. Cochez la dernière option si vos questions portent sur le texte source et que l\'élève doit y avoir accès pour répondre.'
                        : 'Le type « Quiz auto-généré » produit un contenu entièrement en QCM.')
                    : 'Décochez les exercices pour un texte plus synthétique. Cochez le quiz pour une auto-évaluation en fin de parcours.'}
                </p>
              </div>

              <div className="ai-generator__field">
                <label htmlFor="filigrane" className="ai-generator__label">
                  Filigrane (exports PDF et Word)
                </label>
                <input
                  id="filigrane"
                  type="text"
                  className="ai-generator__input"
                  placeholder="Ex. PedaClic — Usage personnel"
                  value={filigrane}
                  onChange={(e) => setFiligrane(e.target.value)}
                />
                <p className="ai-generator__hint">
                  Texte affiché en transparence sur l’aperçu d’impression. Laissez vide pour aucun filigrane.
                </p>
              </div>
            </div>

            {/* Boutons navigation */}
            <div className="ai-generator__nav">
              <button className="btn btn--outline" onClick={handleBack}>
                ← Retour
              </button>
              <button
                className="btn btn--primary btn--lg"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="spinner spinner--sm"></span>
                    Génération en cours...
                  </>
                ) : (
                  '🚀 Générer le contenu'
                )}
              </button>
            </div>

            {/* Message d'attente */}
            {isGenerating && (
              <div className="ai-generator__generating">
                <div className="ai-generator__generating-animation">
                  <span>🤖</span>
                  <span>📝</span>
                  <span>✨</span>
                </div>
                <p>
                  L'IA rédige votre{' '}
                  {selectedType && GENERATION_TYPE_LABELS[selectedType].toLowerCase()}...
                </p>
                <p className="ai-generator__generating-hint">
                  Cela peut prendre 15 à 30 secondes.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ============ ÉTAPE 5 : Résultat ============ */}
        {step === 5 && generationResult && (
          <div className="ai-generator__step-content">
            <h2 className="ai-generator__step-title">
              ✅ Contenu généré
            </h2>

            {/* Récapitulatif final */}
            <div className="ai-generator__recap ai-generator__recap--success">
              <span className="ai-generator__recap-label">Type :</span>
              <span className="ai-generator__recap-value">
                {selectedType && GENERATION_TYPE_ICONS[selectedType]}{' '}
                {selectedType && GENERATION_TYPE_LABELS[selectedType]}
              </span>
              <span className="ai-generator__recap-label">Discipline :</span>
              <span className="ai-generator__recap-value">
                {selectedDiscipline?.nom}
              </span>
              <span className="ai-generator__recap-label">Classe :</span>
              <span className="ai-generator__recap-value">
                {selectedClasse}
              </span>
              <span className="ai-generator__recap-label">Durée :</span>
              <span className="ai-generator__recap-value">
                {dureeCours} minutes
              </span>
              <span className="ai-generator__recap-label">Chapitre :</span>
              <span className="ai-generator__recap-value">{chapitre}</span>
            </div>

            {/* Prévisualisation du contenu */}
            <div className="ai-generator__preview">
              <div className="ai-generator__preview-header">
                <h3>Prévisualisation</h3>
                <div className="ai-generator__preview-actions">
                  <button
                    className="btn btn--outline btn--sm"
                    onClick={() => {
                      const text =
                        generationResult.type === 'quiz'
                          ? JSON.stringify(generationResult.data.questions, null, 2)
                          : generationResult.data.content || '';
                      navigator.clipboard.writeText(text);
                      toast.success('Contenu copié dans le presse-papier !');
                    }}
                  >
                    📋 Copier
                  </button>
                  {generationResult.type !== 'quiz' && (
                    <>
                      <button
                        className="btn btn--outline btn--sm"
                        onClick={() =>
                          handleDownloadPDF(
                            generationResult.data.content || '',
                            `${GENERATION_TYPE_LABELS[selectedType!]} — ${selectedDiscipline?.nom} ${selectedClasse}`,
                            filigrane.trim() || undefined
                          )
                        }
                        title="Télécharger en PDF (via impression)"
                      >
                        📄 PDF
                      </button>
                      <button
                        className="btn btn--outline btn--sm"
                        onClick={() =>
                          handleDownloadWord(
                            generationResult.data.content || '',
                            `${GENERATION_TYPE_LABELS[selectedType!]} — ${selectedDiscipline?.nom} ${selectedClasse}`,
                            filigrane.trim() || undefined
                          )
                        }
                        title="Télécharger en Word (.doc)"
                      >
                        📝 Word
                      </button>
                      <button
                        className="btn btn--outline btn--sm"
                        onClick={() =>
                          handleDownloadMarkdown(
                            generationResult.data.content || '',
                            `${GENERATION_TYPE_LABELS[selectedType!]} — ${selectedDiscipline?.nom} ${selectedClasse}`
                          )
                        }
                        title="Télécharger le fichier Markdown (.md)"
                      >
                        📥 Markdown
                      </button>
                    </>
                  )}
                  {generationResult.type === 'quiz' &&
                    generationResult.data.questions && (
                      <button
                        className="btn btn--outline btn--sm"
                        onClick={() => {
                          const titre = `${GENERATION_TYPE_LABELS[selectedType!]} — ${selectedDiscipline?.nom} ${selectedClasse}`;
                          const blob = new Blob(
                            ['\ufeff', JSON.stringify(generationResult.data.questions, null, 2)],
                            { type: 'application/json;charset=utf-8' }
                          );
                          triggerDownload(blob, `${safeFilename(titre)}.json`);
                        }}
                        title="Télécharger les questions au format JSON"
                      >
                        📥 JSON
                      </button>
                    )}
                </div>
              </div>

              <div className="ai-generator__preview-body">
                {generationResult.type === 'quiz' &&
                generationResult.data.questions ? (
                  /* ---- Prévisualisation Quiz ---- */
                  <div className="ai-generator__quiz-preview">
                    <p className="ai-generator__quiz-count">
                      {generationResult.data.questions.length} questions générées
                    </p>
                    {generationResult.data.questions.map(
                      (q: QuizQuestion, i: number) => (
                        <div key={i} className="ai-generator__quiz-item">
                          <div className="ai-generator__quiz-question">
                            <strong>Q{i + 1}.</strong> {q.question}
                            <span
                              className={`ai-generator__quiz-badge ai-generator__quiz-badge--${q.difficulte}`}
                            >
                              {q.difficulte}
                            </span>
                          </div>
                          <div className="ai-generator__quiz-options">
                            {q.options.map((opt: string, j: number) => (
                              <div
                                key={j}
                                className={`ai-generator__quiz-option ${
                                  j === q.reponseCorrecte
                                    ? 'ai-generator__quiz-option--correct'
                                    : ''
                                }`}
                              >
                                <span className="ai-generator__quiz-option-letter">
                                  {String.fromCharCode(65 + j)}
                                </span>
                                {opt}
                                {j === q.reponseCorrecte && ' ✅'}
                              </div>
                            ))}
                          </div>
                          {q.explication && (
                            <div className="ai-generator__quiz-explanation">
                              💡 {q.explication}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  /* ---- Prévisualisation Markdown → HTML ---- */
                  <div
                    className="ai-generator__markdown-preview"
                    dangerouslySetInnerHTML={{
                      __html: markdownToHtml(
                        generationResult.data.content || ''
                      ),
                    }}
                  />
                )}
              </div>
            </div>

            {/* Actions de sauvegarde */}
            <div className="ai-generator__actions">
              {saveSuccess ? (
                <div className="ai-generator__save-success">
                  <span>✅ Sauvegardé avec succès !</span>
                  {generationResult.type === 'quiz' && savedId && (
                    <Link
                      to={`/quiz/${savedId}`}
                      className="btn btn--outline btn--sm"
                    >
                      🎯 Voir le quiz
                    </Link>
                  )}
                </div>
              ) : (
                <button
                  className="btn btn--primary btn--lg"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner spinner--sm"></span>
                      Sauvegarde...
                    </>
                  ) : (
                    <>💾 Sauvegarder dans PedaClic</>
                  )}
                </button>
              )}

              <button className="btn btn--outline" onClick={handleReset}>
                🔄 Nouvelle génération
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== MODAL LECTURE CONTENU ==================== */}
      {viewingContent && (
        <div
          className="ai-generator__modal-overlay"
          onClick={() => setViewingContent(null)}
        >
          <div
            className="ai-generator__modal ai-generator__modal--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ai-generator__modal-header">
              <div className="ai-generator__modal-title-block">
                <h2>
                  {GENERATION_TYPE_ICONS[viewingContent.type]}{' '}
                  {GENERATION_TYPE_LABELS[viewingContent.type]}
                </h2>
                <span className="ai-generator__modal-subtitle">
                  {viewingContent.discipline} ({viewingContent.classe}) — {viewingContent.chapitre}
                </span>
              </div>
              <div className="ai-generator__modal-header-actions">
                {viewingContent.type !== 'quiz_auto' && viewingContent.content && (
                  <>
                    <button
                      className="btn btn--outline btn--sm"
                      onClick={() =>
                        handleDownloadPDF(
                          viewingContent.content!,
                          `${GENERATION_TYPE_LABELS[viewingContent.type]} — ${viewingContent.discipline} ${viewingContent.classe}`
                        )
                      }
                      title="Enregistrer en PDF"
                    >
                      📄 PDF
                    </button>
                    <button
                      className="btn btn--outline btn--sm"
                      onClick={() =>
                        handleDownloadWord(
                          viewingContent.content!,
                          `${GENERATION_TYPE_LABELS[viewingContent.type]} — ${viewingContent.discipline} ${viewingContent.classe}`
                        )
                      }
                      title="Télécharger en Word"
                    >
                      📝 Word
                    </button>
                  </>
                )}
                <button
                  className="btn btn--outline btn--sm"
                  onClick={async () => {
                    setViewingContent(null);
                    await handleLoadHistory();
                  }}
                  title="Retour à l'historique"
                >
                  ← Historique
                </button>
                <button
                  className="ai-generator__modal-close"
                  onClick={() => setViewingContent(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="ai-generator__modal-body">
              <div
                className="ai-generator__markdown-preview"
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(viewingContent.content || ''),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL EBOOK COMPILER ==================== */}
      {showEbookCompiler && (
        <EbookCompiler
          userId={currentUser!.uid}
          subscriptionPlan={currentUser?.subscriptionPlan}
          history={history}
          markdownToHtml={markdownToHtml}
          onClose={() => setShowEbookCompiler(false)}
          onSaved={async () => {
            const books = await getCompiledEbooks(currentUser!.uid);
            setMyEbooks(books);
          }}
        />
      )}

      {/* ==================== MODAL MES EBOOKS ==================== */}
      {showMyEbooks && (
        <div
          className="ai-generator__modal-overlay"
          onClick={() => setShowMyEbooks(false)}
        >
          <div
            className="ai-generator__modal ai-generator__modal--wide"
            onClick={e => e.stopPropagation()}
          >
            <div className="ai-generator__modal-header">
              <h2>📚 Mes Ebooks compilés</h2>
              <div className="ai-generator__modal-header-actions">
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => { setShowMyEbooks(false); setShowEbookCompiler(true); }}
                >
                  + Nouvel ebook
                </button>
                <button className="ai-generator__modal-close" onClick={() => setShowMyEbooks(false)}>✕</button>
              </div>
            </div>
            <div className="ai-generator__modal-body">
              {myEbooks.length === 0 ? (
                <p className="ai-generator__empty">
                  Vous n'avez pas encore compilé d'ebook. Cliquez sur "Compiler un Ebook" pour commencer.
                </p>
              ) : (
                <div className="ebook-compiler__my-list">
                  {myEbooks.map(ebook => (
                    <div key={ebook.id} className="ebook-compiler__my-item">
                      <div className="ebook-compiler__my-cover">📘</div>
                      <div className="ebook-compiler__my-info">
                        <div className="ebook-compiler__my-title">{ebook.titre}</div>
                        {ebook.description && (
                          <div className="ebook-compiler__my-desc">{ebook.description}</div>
                        )}
                        <div className="ebook-compiler__my-meta">
                          {ebook.sections.length} chapitre{ebook.sections.length > 1 ? 's' : ''} ·{' '}
                          {ebook.createdAt?.toDate
                            ? ebook.createdAt.toDate().toLocaleDateString('fr-FR', {
                                day: 'numeric', month: 'long', year: 'numeric',
                              })
                            : ''}
                        </div>
                      </div>
                      <div className="ai-generator__history-actions">
                        <button
                          className="btn btn--outline btn--sm"
                          onClick={() => handleViewCompiledEbook(ebook)}
                          title="Lire l'ebook"
                        >
                          📖 Lire
                        </button>
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => ebook.id && handleDeleteCompiledEbook(ebook.id)}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL HISTORIQUE ==================== */}
      {showHistory && (
        <div
          className="ai-generator__modal-overlay"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="ai-generator__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ai-generator__modal-header">
              <h2>📂 Historique des générations</h2>
              <button
                className="ai-generator__modal-close"
                onClick={() => setShowHistory(false)}
              >
                ✕
              </button>
            </div>

            <div className="ai-generator__modal-body">
              {history.length === 0 ? (
                <p className="ai-generator__empty">
                  Aucun contenu généré pour le moment.
                </p>
              ) : (
                <div className="ai-generator__history-list">
                  {history.map((item) => (
                    <div key={item.id} className="ai-generator__history-item">
                      <div className="ai-generator__history-info">
                        <span className="ai-generator__history-type">
                          {GENERATION_TYPE_ICONS[item.type]}{' '}
                          {GENERATION_TYPE_LABELS[item.type]}
                        </span>
                        <span className="ai-generator__history-details">
                          {item.discipline} ({item.classe}) — {item.chapitre}
                        </span>
                        <span className="ai-generator__history-date">
                          {item.createdAt?.toDate
                            ? item.createdAt.toDate().toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Date inconnue'}
                        </span>
                      </div>
                      <div className="ai-generator__history-actions">
                        <button
                          className="btn btn--outline btn--sm"
                          onClick={() => {
                            setViewingContent(item);
                            setShowHistory(false);
                          }}
                          title="Lire le contenu"
                        >
                          📖 Lire
                        </button>
                        {item.type !== 'quiz_auto' && item.content && (
                          <>
                            <button
                              className="btn btn--outline btn--sm"
                              onClick={() =>
                                handleDownloadPDF(
                                  item.content!,
                                  `${GENERATION_TYPE_LABELS[item.type]} — ${item.discipline} ${item.classe}`
                                )
                              }
                              title="PDF"
                            >
                              📄
                            </button>
                            <button
                              className="btn btn--outline btn--sm"
                              onClick={() =>
                                handleDownloadWord(
                                  item.content!,
                                  `${GENERATION_TYPE_LABELS[item.type]} — ${item.discipline} ${item.classe}`
                                )
                              }
                              title="Word"
                            >
                              📝
                            </button>
                          </>
                        )}
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => item.id && handleDeleteHistory(item.id)}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGenerator;

// ============================================================
// PHASE 21+ — PAGE : CahierDetailPage (refonte UX v2)
// Vue détaillée d'un cahier : panneau nav semaine/mois,
// tri chronologique, export PDF, design amélioré.
// Route : /prof/cahiers/:cahierId
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import {
  getCahierById,
  subscribeToEntreesCahier,
  deleteEntree,
  updateEntree,
  updateCahier,
  toggleArchiveCahier,
  COULEURS_RUBRIQUES,
  ajouterRubrique,
  modifierRubrique,
  supprimerRubrique,
  resoudreRubriqueIdPourEntree,
  getNombreSeancesEffectif,
  // Phase 34 — duplication rapide d'une séance (raccourci de mise à jour)
  duplicateEntree,
} from '../services/cahierTextesService';
import {
  TYPE_CONTENU_CONFIG,
  STATUT_CONFIG,
} from '../types/cahierTextes.types';
import {
  filtrerEntreesParPeriode,
  exportCahierPDF,
  type PeriodeExport,
} from '../utils/cahierExportPDF';
import type {
  CahierTextes, EntreeCahier, StatutSeance, RubriqueCahier, TitreRubrique, StatutTitre,
} from '../types/cahierTextes.types';
import { STATUT_TITRE_CONFIG } from '../types/cahierTextes.types';
import CahierCalendar from '../components/prof/CahierCalendar';
import RappelWidget from '../components/prof/RappelWidget';
import PlanificationWidget from '../components/prof/PlanificationWidget';
import SignetFilter from '../components/prof/SignetFilter';
import CahierStats from '../components/prof/CahierStats';
import CahierProgressionWidget from '../components/prof/CahierProgressionWidget';
import Breadcrumbs from '../components/shared/Breadcrumbs';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getTravauxByGroupe } from '../services/travauxAFaireService';
import type { TravailAFaire } from '../types/groupeAbsences.types';
// Phase 36 — cellule "Corrigé" avec date+heure auto + éditable
import CorrigeTravailCell from '../components/prof/CorrigeTravailCell';
import '../styles/CahierTextes.css';
import '../styles/CahierEnrichi.css';

/* ─────────────────────────────────────────────────────────────
   PHASE 40 — Persistance « dernière activité »
   ─────────────────────────────────────────────────────────────
   Doit utiliser EXACTEMENT la même clé que CahierTextesPage afin
   que la liste sache où rebondir. On écrit le couple
   (cahierId, entreeId facultatif) avec un horodatage à chaque
   ouverture/édition d'entrée.
   ───────────────────────────────────────────────────────────── */
const LS_LAST_CAHIER_KEY = 'pedaclic.cahier.lastActivity';

function ecrireDerniereActivite(cahierId: string, entreeId?: string) {
  try {
    localStorage.setItem(
      LS_LAST_CAHIER_KEY,
      JSON.stringify({ cahierId, entreeId, visitedAt: new Date().toISOString() }),
    );
  } catch {
    // localStorage indisponible (mode privé) → on ignore silencieusement
  }
}

// ─── Types ───────────────────────────────────────────────────
type VueActive = 'liste' | 'calendrier' | 'signets' | 'stats' | 'travaux';
type SortDirection = 'asc' | 'desc';

// ─── Utilitaires semaine ──────────────────────────────────────
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=dim, 1=lun…
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

function formatWeekLabel(weekStartStr: string): string {
  const start = new Date(weekStartStr);
  const end = getWeekEnd(start);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('fr-FR', opts)} – ${end.toLocaleDateString('fr-FR', opts)}`;
}

function formatMoisLabel(moisKey: string): string {
  const [annee, moisNum] = moisKey.split('-');
  return new Date(Number(annee), Number(moisNum) - 1)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

// ─── Composant principal ─────────────────────────────────────
const CahierDetailPage: React.FC = () => {
  const { cahierId } = useParams<{ cahierId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [cahier, setCahier] = useState<CahierTextes | null>(null);
  const [entrees, setEntrees] = useState<EntreeCahier[]>([]);
  const [rubriques, setRubriques] = useState<RubriqueCahier[]>([]);
  const [afficherFormRubrique, setAfficherFormRubrique] = useState(false);
  const [rubriqueEnEdition, setRubriqueEnEdition] = useState<RubriqueCahier | null>(null);
  const [formRubriqueNom, setFormRubriqueNom] = useState('');
  const [formRubriqueCouleur, setFormRubriqueCouleur] = useState(COULEURS_RUBRIQUES[0]);
  const [formRubriqueSeancesPrevu, setFormRubriqueSeancesPrevu] = useState<number | ''>(0);
  const [savingRubrique, setSavingRubrique] = useState(false);
  const [errorRubrique, setErrorRubrique] = useState('');
  const [rubriquesRepliees, setRubriquesRepliees] = useState(true);
  const [formTitres, setFormTitres] = useState<TitreRubrique[]>([]);
  const [rubriqueOuverteId, setRubriqueOuverteId] = useState<string | null>(null);
  const [loadingCahier, setLoadingCahier] = useState(true);
  const [loadingEntrees, setLoadingEntrees] = useState(true);
  const [vue, setVue] = useState<VueActive>('liste');

  // ── Travaux liés au cahier ─────────────────────────────────
  const [travauxCahier, setTravauxCahier] = useState<TravailAFaire[]>([]);
  const [loadingTravaux, setLoadingTravaux] = useState(false);
  const [filtreTravCorrige, setFiltreTravCorrige] = useState<'tous' | 'corrige' | 'non_corrige'>('tous');
  const [filtreTravRubrique, setFiltreTravRubrique] = useState<string>('tous');

  // ── Filtres + tri ─────────────────────────────────────────────
  const [filtreStatut, setFiltreStatut] = useState<StatutSeance | 'tous'>('tous');
  const [filtreType, setFiltreType] = useState<string>('tous');
  const [filtreRubrique, setFiltreRubrique] = useState<string>('tous');
  const [filtreMois, setFiltreMois] = useState<string>('tous');
  const [filtreSemaine, setFiltreSemaine] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Phase 31 — Jours repliés (groupement séances par jour)
  const [joursReplies, setJoursReplies] = useState<Set<string>>(new Set());

  // ── Export PDF (contrôlé par l'admin) ────────────────────
  const [pdfEnabled, setPdfEnabled] = useState(true);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // ── Charger le paramètre PDF depuis les settings admin ───
  useEffect(() => {
    getDoc(doc(db, 'settings', 'platform'))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          // Par défaut activé si la clé n'existe pas encore
          setPdfEnabled(data.cahierPdfExport !== false);
        }
      })
      .catch(() => { /* silencieux si settings non configuré */ });
  }, []);

  // ── Charger le cahier ─────────────────────────────────────
  useEffect(() => {
    if (!cahierId) return;
    const fetch = async () => {
      setLoadingCahier(true);
      try {
        const data = await getCahierById(cahierId);
        if (!data) { navigate('/prof/cahiers'); return; }
        setCahier(data);
        setRubriques(data.rubriques ?? []);
        // Phase 40 — Mémorise l'ouverture du cahier comme « dernière activité ».
        // L'entrée précise (entreeId) sera mise à jour ultérieurement
        // si l'utilisateur ouvre/édite une séance particulière.
        ecrireDerniereActivite(cahierId);
      } finally {
        setLoadingCahier(false);
      }
    };
    fetch();
  }, [cahierId, navigate]);

  // ── Abonnement temps réel aux entrées ──────────────────────
  // Utilise onSnapshot pour éviter les incohérences de cache (IndexedDB)
  // entre la carte (subscribeToCahiers) et la page détail.
  useEffect(() => {
    if (!cahierId) return;
    setLoadingEntrees(true);
    const unsub = subscribeToEntreesCahier(
      cahierId,
      (data) => {
        setEntrees(data);
        setLoadingEntrees(false);
      },
      (err) => {
        console.error('Erreur chargement entrées cahier:', err);
        setEntrees([]);
        setLoadingEntrees(false);
      }
    );
    return () => unsub();
  }, [cahierId]);

  // ── Charger les travaux liés au cahier (via groupeIds) ──
  useEffect(() => {
    if (!cahier) return;
    const gIds = cahier.groupeIds ?? [];
    if (gIds.length === 0) { setTravauxCahier([]); return; }
    setLoadingTravaux(true);
    Promise.all(gIds.map(gid => getTravauxByGroupe(gid)))
      .then(results => {
        const all = results.flat();
        // Dédupliquer au cas où un travail serait lié à plusieurs groupes
        const map = new Map<string, TravailAFaire>();
        all.forEach(t => map.set(t.id, t));
        const sorted = [...map.values()].sort((a, b) => a.dateEcheance.getTime() - b.dateEcheance.getTime());
        setTravauxCahier(sorted);
      })
      .catch(() => setTravauxCahier([]))
      .finally(() => setLoadingTravaux(false));
  }, [cahier, vue]);

  // ── Supprimer une entrée ──────────────────────────────────
  const handleDeleteEntree = async (entree: EntreeCahier) => {
    const ok = await confirm({ title: 'Supprimer la séance ?', message: `Supprimer la séance "${entree.chapitre}" ?`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try {
      await deleteEntree(entree.id);
      const nouvellesEntrees = entrees.filter(e => e.id !== entree.id);
      setEntrees(nouvellesEntrees);
      const nbRealise = nouvellesEntrees.filter(e => e.statut === 'realise').length;
      await updateCahier(cahierId!, { nombreSeancesRealise: nbRealise });
      setCahier(prev => prev ? { ...prev, nombreSeancesRealise: nbRealise } : prev);
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  // ── Phase 34 : dupliquer une séance ──────────────────────
  // Clone la séance avec un nouveau titre "(copie)" et le statut "planifie".
  // On redirige directement vers l'édition pour que le prof puisse ajuster
  // date, chapitre ou contenu avant de sauvegarder définitivement.
  const handleDuplicateEntree = useCallback(async (entree: EntreeCahier, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cahierId) return;
    try {
      const nouveauId = await duplicateEntree(entree, {
        nouvelleDate: new Date(),    // date du jour par défaut
        nouveauStatut: 'planifie',   // la copie est à relire/ajuster
      });
      toast.success('Séance dupliquée — prête à être ajustée.');
      // Ouvre l'éditeur sur la copie pour personnalisation
      navigate(`/prof/cahiers/${cahierId}/modifier/${nouveauId}`);
    } catch (err) {
      console.error('[CahierDetailPage] Erreur duplication séance :', err);
      toast.error('Erreur lors de la duplication.');
    }
  }, [cahierId, navigate, toast]);

  // ── Changer statut rapide ─────────────────────────────────
  const handleStatutChange = async (entree: EntreeCahier, statut: StatutSeance) => {
    try {
      await updateEntree(entree.id, { statut });
      const nouvellesEntrees = entrees.map(e =>
        e.id === entree.id ? { ...e, statut } : e
      );
      setEntrees(nouvellesEntrees);
      const nbRealise = nouvellesEntrees.filter(e => e.statut === 'realise').length;
      await updateCahier(cahierId!, { nombreSeancesRealise: nbRealise });
      setCahier(prev => prev ? { ...prev, nombreSeancesRealise: nbRealise } : prev);
    } catch {
      toast.error('Erreur lors de la mise à jour du statut.');
    }
  };

  // ── Phase 29 : Handlers rubriques ─────────────────────────
  const ouvrirAjoutRubrique = () => {
    setRubriqueEnEdition(null);
    setFormRubriqueNom('');
    setFormRubriqueCouleur(COULEURS_RUBRIQUES[rubriques.length % COULEURS_RUBRIQUES.length]);
    setFormRubriqueSeancesPrevu(0);
    setFormTitres([]);
    setErrorRubrique('');
    setAfficherFormRubrique(true);
  };

  const ouvrirEditionRubrique = (r: RubriqueCahier) => {
    setRubriqueEnEdition(r);
    setFormRubriqueNom(r.nom);
    setFormRubriqueCouleur(r.couleur ?? COULEURS_RUBRIQUES[0]);
    setFormRubriqueSeancesPrevu(getNombreSeancesEffectif(r));
    setFormTitres(r.titres ?? []);
    setErrorRubrique('');
    setAfficherFormRubrique(true);
  };

  const fermerFormRubrique = () => {
    setAfficherFormRubrique(false);
    setRubriqueEnEdition(null);
    setFormRubriqueNom('');
    setFormRubriqueSeancesPrevu(0);
    setFormTitres([]);
  };

  // ── Gestion des titres dans le formulaire rubrique ───────
  const ajouterTitreForm = () => {
    setFormTitres(prev => {
      const next = [
        ...prev,
        { id: Date.now().toString(), nom: '', ordre: prev.length, statut: 'non_commence' as StatutTitre },
      ];
      // Auto-sync : si nbSeances < nbTitres, aligner
      const nbNonVides = next.filter(t => t.nom.trim()).length + 1; // +1 car le nouveau est vide mais sera probablement rempli
      setFormRubriqueSeancesPrevu(prev2 => {
        const cur = typeof prev2 === 'number' ? prev2 : 0;
        return cur < nbNonVides ? nbNonVides : cur;
      });
      return next;
    });
  };
  const supprimerTitreForm = (titreId: string) => {
    setFormTitres(prev => {
      const next = prev.filter(t => t.id !== titreId).map((t, i) => ({ ...t, ordre: i }));
      // Auto-sync : réduire nbSeances si > nbTitres et pas de saisie manuelle supérieure
      const nbNonVides = next.filter(t => t.nom.trim()).length;
      setFormRubriqueSeancesPrevu(prev2 => {
        const cur = typeof prev2 === 'number' ? prev2 : 0;
        // Si le nb de séances correspondait exactement à l'ancien nb de titres, réduire
        if (cur > 0 && nbNonVides >= 0 && cur > nbNonVides && cur === prev.filter(t => t.nom.trim()).length) {
          return nbNonVides > 0 ? nbNonVides : '';
        }
        return prev2;
      });
      return next;
    });
  };
  const modifierTitreNomForm = (titreId: string, nom: string) => {
    setFormTitres(prev => prev.map(t => t.id === titreId ? { ...t, nom } : t));
  };

  // ── Changer le statut d'un titre directement (hors formulaire) ──
  const handleChangerStatutTitre = async (rubriqueId: string, titreId: string, statut: StatutTitre) => {
    if (!cahierId) return;
    const rubrique = rubriques.find(r => r.id === rubriqueId);
    if (!rubrique) return;
    const titresMaj = (rubrique.titres ?? []).map(t =>
      t.id === titreId ? { ...t, statut } : t
    );
    try {
      const nouvelleListe = await modifierRubrique(cahierId, rubriques, rubriqueId, { titres: titresMaj });
      setRubriques(nouvelleListe);
      setCahier(prev => prev ? { ...prev, rubriques: nouvelleListe } : prev);
    } catch (err) {
      console.error('[CahierDetailPage] Erreur changement statut titre:', err);
    }
  };

  const handleSauvegarderRubrique = async () => {
    if (!formRubriqueNom.trim()) {
      setErrorRubrique('Le nom de la rubrique est obligatoire.');
      return;
    }
    if (!cahier || !cahierId) return;
    const titresClean = formTitres.filter(t => t.nom.trim()).map((t, i) => ({ ...t, nom: t.nom.trim(), ordre: i }));
    const nbPrevu = typeof formRubriqueSeancesPrevu === 'number'
      ? formRubriqueSeancesPrevu
      : parseInt(String(formRubriqueSeancesPrevu), 10) || 0;
    // Validation : nbSeances ne peut pas être inférieur au nombre de titres
    if (titresClean.length > 0 && nbPrevu > 0 && nbPrevu < titresClean.length) {
      setErrorRubrique(`Le nombre de séances prévues (${nbPrevu}) ne peut pas être inférieur au nombre de titres (${titresClean.length}).`);
      return;
    }
    setSavingRubrique(true);
    setErrorRubrique('');
    try {
      let nouvelleListe: RubriqueCahier[];
      // Si pas de saisie manuelle, le service utilisera le nb de titres
      const seancesEffectif = nbPrevu > 0 ? nbPrevu : (titresClean.length > 0 ? titresClean.length : undefined);
      if (rubriqueEnEdition) {
        nouvelleListe = await modifierRubrique(
          cahierId,
          rubriques,
          rubriqueEnEdition.id,
          {
            nom: formRubriqueNom.trim(),
            couleur: formRubriqueCouleur,
            nombreSeancesPrevu: seancesEffectif,
            titres: titresClean.length > 0 ? titresClean : undefined,
          }
        );
      } else {
        nouvelleListe = await ajouterRubrique(
          cahierId,
          rubriques,
          formRubriqueNom.trim(),
          formRubriqueCouleur,
          seancesEffectif,
          titresClean.length > 0 ? titresClean : undefined
        );
      }
      setRubriques(nouvelleListe);
      setCahier(prev => prev ? { ...prev, rubriques: nouvelleListe } : prev);
      fermerFormRubrique();
    } catch (err) {
      console.error('[CahierDetailPage] Erreur sauvegarde rubrique :', err);
      setErrorRubrique('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSavingRubrique(false);
    }
  };

  const handleSupprimerRubrique = async (rubriqueId: string, rubriqueNom: string) => {
    if (!cahierId) return;
    const ok = await confirm({ title: 'Supprimer la rubrique ?', message: `Supprimer la rubrique "${rubriqueNom}" ? Les séances liées passeront dans "Sans rubrique".`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try {
      const nouvelleListe = await supprimerRubrique(cahierId, rubriques, rubriqueId);
      setRubriques(nouvelleListe);
      setCahier(prev => prev ? { ...prev, rubriques: nouvelleListe } : prev);
    } catch (err) {
      console.error('[CahierDetailPage] Erreur suppression rubrique :', err);
      toast.error('Erreur lors de la suppression.');
    }
  };

  // ── Export PDF (modale choix période) ──────────────────────
  const handleExportPDF = useCallback(() => {
    setShowPdfModal(true);
  }, []);

  const handleConfirmExportPDF = useCallback(async (periode: PeriodeExport, moisKey?: string) => {
    if (!cahier) return;
    setPdfExporting(true);
    setShowPdfModal(false);
    try {
      const entreesFiltrees = filtrerEntreesParPeriode(entrees, periode, moisKey);
      const now = new Date();
      let periodeLabel = '';
      if (periode === 'tout') periodeLabel = 'Tout le cahier';
      else if (periode === 'mois' && moisKey) {
        const [annee, mois] = moisKey.split('-').map(Number);
        periodeLabel = new Date(annee, mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      } else if (periode === 'trimestre') {
        const t = Math.floor(now.getMonth() / 3) + 1;
        periodeLabel = `Trimestre ${t} ${now.getFullYear()}`;
      } else if (periode === 'semestre') {
        const s = now.getMonth() < 6 ? 1 : 2;
        periodeLabel = `Semestre ${s} ${now.getFullYear()}`;
      }
      const filename = `Cahier_${cahier.titre.replace(/[^a-zA-Z0-9]/g, '_')}_${now.toISOString().slice(0, 10)}`;
      await exportCahierPDF(cahier, entreesFiltrees, filename, periodeLabel);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'export PDF.');
    } finally {
      setPdfExporting(false);
    }
  }, [cahier, entrees]);

  // ── Calcul des mois disponibles ───────────────────────────
  const moisDisponibles = useMemo(() => {
    return Array.from(
      new Set(
        entrees.map(e => {
          const d = e.date.toDate();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        })
      )
    ).sort();
  }, [entrees]);

  // ── Calcul des semaines disponibles pour le mois sélectionné
  const semainesDisponibles = useMemo(() => {
    const base = filtreMois === 'tous' ? entrees : entrees.filter(e => {
      const d = e.date.toDate();
      const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mois === filtreMois;
    });

    const weekMap = new Map<string, number>();
    base.forEach(e => {
      const weekStart = getWeekStart(e.date.toDate());
      const key = weekStart.toISOString().slice(0, 10);
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    });

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([start, count]) => ({ start, count }));
  }, [entrees, filtreMois]);

  // ── Comptage par mois ─────────────────────────────────────
  const countParMois = useMemo(() => {
    const map = new Map<string, number>();
    entrees.forEach(e => {
      const d = e.date.toDate();
      const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(mois, (map.get(mois) || 0) + 1);
    });
    return map;
  }, [entrees]);

  // ── Filtrage + tri ────────────────────────────────────────
  const entreesFiltrees = useMemo(() => {
    return entrees
      .filter(e => {
        const d = e.date.toDate();
        const okStatut = filtreStatut === 'tous' || e.statut === filtreStatut;
        const okType = filtreType === 'tous' || e.typeContenu === filtreType;

        let okMois = true;
        if (filtreMois !== 'tous') {
          const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          okMois = mois === filtreMois;
        }

        let okSemaine = true;
        if (filtreSemaine) {
          const weekStartKey = getWeekStart(d).toISOString().slice(0, 10);
          okSemaine = weekStartKey === filtreSemaine;
        }

        let okRubrique = true;
        if (filtreRubrique !== 'tous') {
          const resolved = resoudreRubriqueIdPourEntree(e, rubriques);
          if (filtreRubrique === '__sans_rubrique__') {
            okRubrique = resolved === null;
          } else {
            okRubrique = resolved === filtreRubrique;
          }
        }

        return okStatut && okType && okMois && okSemaine && okRubrique;
      })
      .sort((a, b) => {
        const diff = a.date.toMillis() - b.date.toMillis();
        return sortDirection === 'asc' ? diff : -diff;
      });
  }, [entrees, filtreStatut, filtreType, filtreRubrique, filtreMois, filtreSemaine, sortDirection, rubriques]);

  // ─────────────────────────────────────────────────────────
  if (loadingCahier) {
    return <SkeletonDashboard />;
  }
  if (!cahier) return null;

  // Phase 31 — Le nombre de séances globales est le cumul des séances par rubrique
  // (si des rubriques ont un nombreSeancesPrevu défini, on utilise la somme ; sinon on utilise cahier.nombreSeancesPrevu)
  const seancesPrevuesCumul = (() => {
    const rubriquesAvecPrevu = (cahier.rubriques ?? []).filter(r => getNombreSeancesEffectif(r) > 0);
    if (rubriquesAvecPrevu.length > 0) {
      return rubriquesAvecPrevu.reduce((sum, r) => sum + getNombreSeancesEffectif(r), 0);
    }
    return cahier.nombreSeancesPrevu;
  })();

  const progressionPct = seancesPrevuesCumul > 0
    ? Math.round((entrees.filter(e => e.statut === 'realise').length / seancesPrevuesCumul) * 100)
    : 0;

  return (
    <div className="cahier-detail-page" id="cahier-detail-print-zone">

      {/* ── Fil d'Ariane ── */}
      <Breadcrumbs
        className="no-print"
        items={[
          { label: 'Cahiers de textes', path: '/prof/cahiers' },
          { label: cahier.titre || 'Cahier' },
        ]}
      />

      {/* ── En-tête ── */}
      <div className="cahier-detail-header">
        <button
          className="btn-retour no-print"
          onClick={() => navigate('/prof/cahiers')}
          title="Retour à la liste"
        >
          ← Retour
        </button>

        <div
          className="cahier-detail-couleur-barre"
          style={{ background: cahier.couleur }}
        />

        <div className="cahier-detail-info">
          <h1 className="cahier-detail-titre">{cahier.titre}</h1>
          <div className="cahier-detail-badges">
            <span className="badge-classe" title="Classe liée">📋 {cahier.classe}</span>
            <span className="badge-matiere">{cahier.matiere}</span>
            <span className="badge-annee">{cahier.anneeScolaire}</span>
            {cahier.isPartage && (
              <span className="badge-partage">👥 Partagé</span>
            )}
            {(cahier.isArchived ?? false) && (
              <span className="badge-archive">📦 Archivé</span>
            )}
          </div>
          {cahier.description && (
            <p className="cahier-detail-description">{cahier.description}</p>
          )}
          {/* Progression */}
          <div className="cahier-detail-progression">
            <div className="progression-bar-bg" style={{ width: 200 }}>
              <div
                className="progression-bar-fill"
                style={{
                  width: `${progressionPct}%`,
                  background: cahier.couleur,
                }}
              />
            </div>
            <span className="progression-pct">
              {entrees.filter(e => e.statut === 'realise').length} / {seancesPrevuesCumul} séances ({progressionPct}%)
              {seancesPrevuesCumul > 0 && seancesPrevuesCumul !== cahier.nombreSeancesPrevu && (
                <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: 4 }}>(cumul rubriques)</span>
              )}
            </span>
          </div>
        </div>

        {/* Actions en-tête */}
        <div className="cahier-detail-actions no-print">
          <button
            className="btn-secondary"
            onClick={async () => {
              const nouvelEtat = !(cahier.isArchived ?? false);
              try {
                await toggleArchiveCahier(cahier.id, nouvelEtat);
                setCahier(prev => prev ? { ...prev, isArchived: nouvelEtat } : null);
              } catch { toast.error('Erreur lors de l\'opération.'); }
            }}
            title={(cahier.isArchived ?? false) ? 'Restaurer le cahier' : 'Archiver le cahier'}
          >
            {(cahier.isArchived ?? false) ? '↩️ Restaurer' : '📦 Archiver'}
          </button>
          {pdfEnabled && (
            <button
              className="btn-pdf"
              onClick={handleExportPDF}
              disabled={pdfExporting}
              title="Télécharger en PDF"
            >
              {pdfExporting ? '⏳' : '📄'} PDF
            </button>
          )}
          {showPdfModal && cahier && (
            <div className="cahier-pdf-modal-overlay" onClick={() => setShowPdfModal(false)}>
              <div className="cahier-pdf-modal" onClick={e => e.stopPropagation()}>
                <h3>📄 Télécharger le cahier en PDF</h3>
                <p className="cahier-pdf-modal-desc">Choisissez la période à exporter :</p>
                <div className="cahier-pdf-modal-options">
                  <button className="cahier-pdf-option" onClick={() => handleConfirmExportPDF('tout')}>
                    <span className="cahier-pdf-option-icon">📚</span>
                    <span className="cahier-pdf-option-label">Tout le cahier</span>
                    <span className="cahier-pdf-option-count">{entrees.length} séance{entrees.length !== 1 ? 's' : ''}</span>
                  </button>
                  {moisDisponibles.length > 0 && moisDisponibles.map(mois => (
                    <button key={mois} className="cahier-pdf-option" onClick={() => handleConfirmExportPDF('mois', mois)}>
                      <span className="cahier-pdf-option-icon">📅</span>
                      <span className="cahier-pdf-option-label">{formatMoisLabel(mois)}</span>
                      <span className="cahier-pdf-option-count">{countParMois.get(mois) || 0} séance{(countParMois.get(mois) || 0) !== 1 ? 's' : ''}</span>
                    </button>
                  ))}
                  <button className="cahier-pdf-option" onClick={() => handleConfirmExportPDF('trimestre')}>
                    <span className="cahier-pdf-option-icon">📆</span>
                    <span className="cahier-pdf-option-label">Trimestre en cours</span>
                  </button>
                  <button className="cahier-pdf-option" onClick={() => handleConfirmExportPDF('semestre')}>
                    <span className="cahier-pdf-option-icon">📆</span>
                    <span className="cahier-pdf-option-label">Semestre en cours</span>
                  </button>
                </div>
                <div className="cahier-pdf-modal-footer">
                  <button className="btn-secondary" onClick={() => setShowPdfModal(false)}>Annuler</button>
                </div>
              </div>
            </div>
          )}
          {/* ──────────────────────────────────────────────────────────
              🆕 Lien rapide vers la FEUILLE DE NOTES du / des groupe(s)
              lié(s) au cahier. Pratique pour passer du planning de classe
              à la saisie des notes en un clic, sans repasser par le
              tableau de bord.

              Comportement :
                • 0 groupe lié    → bouton désactivé + tooltip explicite.
                • 1 groupe lié    → ouvre le tableau de bord du groupe sur
                                     l'onglet « Notes ».
                • N groupes liés  → ouvre une petite liste pour choisir le
                                     groupe (premier groupe par défaut).
             ────────────────────────────────────────────────────────── */}
          {(() => {
            const groupeIds = cahier.groupeIds ?? [];
            const groupeNoms = cahier.groupeNoms ?? [];
            const nbGroupes = groupeIds.length;

            // Aucun groupe lié → bouton informatif désactivé
            if (nbGroupes === 0) {
              return (
                <button
                  className="btn-secondary"
                  disabled
                  title="Aucun groupe classe n'est lié à ce cahier — éditez le cahier pour lier un groupe puis accédez à sa feuille de notes."
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                >
                  📝 Feuille de notes
                </button>
              );
            }

            // 1 groupe lié → navigation directe sur l'onglet Notes du groupe
            if (nbGroupes === 1) {
              return (
                <button
                  className="btn-secondary"
                  title={`Ouvrir la feuille de notes du groupe « ${groupeNoms[0] ?? 'lié'} »`}
                  onClick={() =>
                    navigate('/prof/dashboard', {
                      state: { openGroupeId: groupeIds[0], openTab: 'notes' },
                    })
                  }
                >
                  📝 Feuille de notes
                </button>
              );
            }

            // N groupes liés → menu déroulant simple via <select> stylé
            return (
              <select
                className="btn-secondary"
                title="Choisir le groupe pour ouvrir sa feuille de notes"
                defaultValue=""
                onChange={(e) => {
                  const gId = e.target.value;
                  if (!gId) return;
                  navigate('/prof/dashboard', {
                    state: { openGroupeId: gId, openTab: 'notes' },
                  });
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <option value="" disabled>📝 Feuille de notes…</option>
                {groupeIds.map((gid, i) => (
                  <option key={gid} value={gid}>
                    {groupeNoms[i] ?? `Groupe ${i + 1}`}
                  </option>
                ))}
              </select>
            );
          })()}

          <button
            className="btn-primary"
            onClick={() => navigate(`/prof/cahiers/${cahierId}/nouvelle`)}
          >
            + Nouvelle séance
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate(`/prof/cahiers/${cahierId}/planification`)}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#374151',
            }}
            title="Voir la planification complète"
          >
            📅 Planification
          </button>
        </div>
      </div>

      {/* ── Phase 29 : Widget progression + Rubriques ── */}
      <div className="cahier-phase29-section no-print">
        <CahierProgressionWidget
          entrees={entrees}
          rubriques={rubriques}
          titre="Progression du cahier"
          /* Phase 37 — Affiche la matière dans la section « Titres restants »
             pour rappel visuel quand le prof ouvre plusieurs cahiers. */
          matiere={cahier?.matiere}
        />

        <section className="cahier-rubriques-section" aria-label="Gestion des rubriques">
          <div className="cahier-rubriques-header">
            <button
              className="cahier-rubriques-toggle"
              onClick={() => setRubriquesRepliees(prev => !prev)}
              aria-expanded={!rubriquesRepliees}
              title={rubriquesRepliees ? 'Afficher les rubriques' : 'Masquer les rubriques'}
            >
              <span className={`cahier-rubriques-chevron ${rubriquesRepliees ? 'collapsed' : ''}`}>▾</span>
              <h3 className="cahier-rubriques-titre">
                📂 Rubriques
                <span className="cahier-rubriques-count">{rubriques.length}</span>
              </h3>
            </button>
            {!rubriquesRepliees && (
              <button
                className="cahier-btn-add-rubrique"
                onClick={ouvrirAjoutRubrique}
                title="Ajouter une rubrique"
              >
                + Ajouter
              </button>
            )}
          </div>

          {!rubriquesRepliees && (
            <>
              {rubriques.length === 0 ? (
                <p className="cahier-rubriques-empty">
                  Aucune rubrique définie. Créez des rubriques pour organiser et
                  suivre la progression de vos séances.
                </p>
              ) : (
                <div className="cahier-rubriques-list">
                  <div className="cahier-rubriques-list-header">
                    <span className="cahier-rubriques-col-nom">Module</span>
                    <span className="cahier-rubriques-col-seances">Séances</span>
                    <span className="cahier-rubriques-col-titres">Titres</span>
                    <span className="cahier-rubriques-col-actions" />
                  </div>
                  {rubriques.map(r => {
                    const titres = r.titres ?? [];
                    const nbAcheves = titres.filter(t => t.statut === 'acheve').length;
                    const isOpen = rubriqueOuverteId === r.id;
                    return (
                      <div key={r.id} className="cahier-rubrique-item-wrap">
                        <div className="cahier-rubrique-item">
                          <span
                            className="cahier-rubrique-badge"
                            style={{
                              backgroundColor: (r.couleur ?? '#64748b') + '1a',
                              borderColor: r.couleur ?? '#64748b',
                              color: r.couleur ?? '#64748b',
                            }}
                          >
                            {r.nom}
                          </span>
                          <span className="cahier-rubrique-seances-prevu">
                            {getNombreSeancesEffectif(r) > 0
                              ? `${getNombreSeancesEffectif(r)}`
                              : '—'}
                          </span>
                          <span className="cahier-rubrique-titres-count">
                            {titres.length > 0
                              ? <span className="titres-badge">{nbAcheves}/{titres.length}</span>
                              : '—'}
                          </span>
                          <div className="cahier-rubrique-actions">
                            {titres.length > 0 && (
                              <button
                                className="cahier-rubrique-btn-expand"
                                onClick={() => setRubriqueOuverteId(isOpen ? null : r.id)}
                                title={isOpen ? 'Replier' : 'Voir les titres'}
                                aria-label={isOpen ? 'Replier' : 'Voir les titres'}
                              >
                                {isOpen ? '▾' : '▸'}
                              </button>
                            )}
                            <button
                              className="cahier-rubrique-btn-edit"
                              onClick={() => ouvrirEditionRubrique(r)}
                              title="Modifier"
                              aria-label={`Modifier la rubrique "${r.nom}"`}
                            >
                              ✏️
                            </button>
                            <button
                              className="cahier-rubrique-btn-delete"
                              onClick={() => handleSupprimerRubrique(r.id, r.nom)}
                              title="Supprimer"
                              aria-label={`Supprimer la rubrique "${r.nom}"`}
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Organisateur de titres (leçons) */}
                        {isOpen && titres.length > 0 && (
                          <div className="cahier-titres-panel">
                            {titres.map(t => {
                              const cfg = STATUT_TITRE_CONFIG[t.statut];
                              return (
                                <div key={t.id} className="cahier-titre-row">
                                  <span className="cahier-titre-nom">{t.nom}</span>
                                  <select
                                    className="cahier-titre-statut-select"
                                    value={t.statut}
                                    onChange={e => handleChangerStatutTitre(r.id, t.id, e.target.value as StatutTitre)}
                                    style={{ backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.color + '55' }}
                                  >
                                    {(Object.entries(STATUT_TITRE_CONFIG) as [StatutTitre, typeof cfg][]).map(([k, v]) => (
                                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {afficherFormRubrique && (
            <div className="cahier-rubrique-form-wrapper">
              <h4 className="cahier-rubrique-form-titre">
                {rubriqueEnEdition ? 'Modifier la rubrique' : 'Nouvelle rubrique'}
              </h4>
              <div className="cahier-rubrique-form-field">
                <label htmlFor="rubrique-nom" className="cahier-rubrique-form-label">Nom *</label>
                <input
                  id="rubrique-nom"
                  type="text"
                  className="cahier-rubrique-form-input"
                  placeholder="Ex : Chapitre 1 – Les vecteurs"
                  value={formRubriqueNom}
                  onChange={e => setFormRubriqueNom(e.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div className="cahier-rubrique-form-field cahier-rubrique-form-row">
                <div className="cahier-rubrique-form-field">
                  <label htmlFor="rubrique-seances" className="cahier-rubrique-form-label">
                    Séances prévues pour ce module
                  </label>
                  <input
                    id="rubrique-seances"
                    type="number"
                    min={formTitres.filter(t => t.nom.trim()).length || 0}
                    max={200}
                    className="cahier-rubrique-form-input cahier-rubrique-form-input-narrow"
                    placeholder={formTitres.filter(t => t.nom.trim()).length > 0
                      ? `Min : ${formTitres.filter(t => t.nom.trim()).length}`
                      : 'Ex : 8'}
                    value={formRubriqueSeancesPrevu === '' ? '' : formRubriqueSeancesPrevu}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '') { setFormRubriqueSeancesPrevu(''); return; }
                      const parsed = Math.max(0, parseInt(v, 10) || 0);
                      const nbTitresNonVides = formTitres.filter(t => t.nom.trim()).length;
                      setFormRubriqueSeancesPrevu(nbTitresNonVides > 0 && parsed > 0 && parsed < nbTitresNonVides ? nbTitresNonVides : parsed);
                    }}
                  />
                  <span className="cahier-rubrique-form-hint">
                    {formTitres.filter(t => t.nom.trim()).length > 0
                      ? `Auto-calculé selon les titres (${formTitres.filter(t => t.nom.trim()).length}) si non renseigné`
                      : 'Optionnel — sera déduit du nombre de titres si non renseigné'}
                  </span>
                </div>
              </div>
              <div className="cahier-rubrique-form-field">
                <label className="cahier-rubrique-form-label">Couleur</label>
                <div className="cahier-couleur-swatches">
                  {COULEURS_RUBRIQUES.map(couleur => (
                    <button
                      key={couleur}
                      type="button"
                      className={`cahier-couleur-swatch${formRubriqueCouleur === couleur ? ' swatch-selected' : ''}`}
                      style={{ backgroundColor: couleur }}
                      onClick={() => setFormRubriqueCouleur(couleur)}
                      aria-label={`Couleur ${couleur}`}
                      title={couleur}
                    />
                  ))}
                </div>
                <span
                  className="cahier-couleur-apercu"
                  style={{
                    backgroundColor: formRubriqueCouleur + '1a',
                    borderColor: formRubriqueCouleur,
                    color: formRubriqueCouleur,
                  }}
                >
                  {formRubriqueNom || 'Aperçu'}
                </span>
              </div>
              {/* Phase 33 — Organisateur de titres (leçons) */}
              <div className="cahier-rubrique-form-field">
                <label className="cahier-rubrique-form-label">
                  📝 Titres / Leçons
                  <span className="cahier-rubrique-form-hint" style={{ marginLeft: '0.5rem' }}>
                    ({formTitres.length} titre{formTitres.length !== 1 ? 's' : ''})
                  </span>
                </label>
                {formTitres.length > 0 && (
                  <div className="cahier-titres-form-list">
                    {formTitres.map((t, idx) => (
                      <div key={t.id} className="cahier-titre-form-row">
                        <span className="cahier-titre-form-num">{idx + 1}.</span>
                        <input
                          type="text"
                          className="cahier-rubrique-form-input cahier-titre-form-input"
                          placeholder={`Titre ${idx + 1} — Ex : Les vecteurs du plan`}
                          value={t.nom}
                          onChange={e => modifierTitreNomForm(t.id, e.target.value)}
                          maxLength={120}
                        />
                        <button
                          type="button"
                          className="cahier-titre-form-delete"
                          onClick={() => supprimerTitreForm(t.id)}
                          title="Supprimer ce titre"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  className="cahier-titre-form-add"
                  onClick={ajouterTitreForm}
                >
                  + Ajouter un titre
                </button>
              </div>

              {errorRubrique && (
                <p className="cahier-rubrique-error" role="alert">{errorRubrique}</p>
              )}
              <div className="cahier-rubrique-form-actions">
                <button
                  className="cahier-btn-save"
                  onClick={handleSauvegarderRubrique}
                  disabled={savingRubrique}
                >
                  {savingRubrique ? 'Enregistrement…' : rubriqueEnEdition ? 'Modifier' : 'Ajouter'}
                </button>
                <button
                  className="cahier-btn-cancel"
                  onClick={fermerFormRubrique}
                  disabled={savingRubrique}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Tabs de vue ── */}
      <div className="view-tabs no-print">
        {([
          { id: 'liste', label: '📋 Liste' },
          { id: 'calendrier', label: '📅 Calendrier' },
          { id: 'travaux', label: `📝 Travaux${travauxCahier.length > 0 ? ` (${travauxCahier.length})` : ''}` },
          { id: 'signets', label: '📌 Signets' },
          { id: 'stats', label: '📊 Statistiques' },
        ] as { id: VueActive; label: string }[]).map(tab => (
          <button
            key={tab.id}
            className={`view-tab ${vue === tab.id ? 'active' : ''}`}
            onClick={() => setVue(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Vue Calendrier ── */}
      {vue === 'calendrier' && (
        <div className="cahier-detail-layout">
          <div><CahierCalendar cahierId={cahier.id} /></div>
          <div><RappelWidget profId={currentUser!.uid} cahierId={cahier.id} /></div>
        </div>
      )}

      {/* ── Vue Signets ── */}
      {vue === 'signets' && (
        <div className="cahier-detail-layout">
          <SignetFilter profId={currentUser!.uid} cahierId={cahier.id} />
          <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
        </div>
      )}

      {/* ── Vue Travaux ── */}
      {vue === 'travaux' && (() => {
        const travauxFiltres = travauxCahier.filter(t => {
          if (filtreTravCorrige !== 'tous') {
            if (filtreTravCorrige === 'corrige' && !t.corrige) return false;
            if (filtreTravCorrige === 'non_corrige' && t.corrige) return false;
          }
          if (filtreTravRubrique !== 'tous') {
            if (filtreTravRubrique === '__sans_rubrique__') {
              if (t.rubriqueId) return false;
            } else if (t.rubriqueId !== filtreTravRubrique) return false;
          }
          return true;
        });
        const rubriquesUniques = new Map<string, string>();
        travauxCahier.forEach(t => { if (t.rubriqueId && t.rubriqueNom) rubriquesUniques.set(t.rubriqueId, t.rubriqueNom); });
        return (
          <div className="cahier-detail-layout" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ width: '100%' }}>
              {loadingTravaux ? (
                <p style={{ color: '#6b7280', padding: '2rem', textAlign: 'center' }}>Chargement des travaux…</p>
              ) : travauxCahier.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280' }}>
                  <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>📝 Aucun travail lié à ce cahier</p>
                  <p style={{ fontSize: '0.85rem' }}>Les travaux assignés depuis l’onglet « Travaux » d’un groupe-classe apparaissent ici lorsqu’ils sont rattachés à ce cahier.</p>
                </div>
              ) : (
                <>
                  {/* Filtres */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>Filtrer :</span>
                    <select
                      className="filtre-select"
                      value={filtreTravCorrige}
                      onChange={e => setFiltreTravCorrige(e.target.value as any)}
                    >
                      <option value="tous">Tous statuts</option>
                      <option value="corrige">✅ Fait & corrigé</option>
                      <option value="non_corrige">⏳ Non corrigé</option>
                    </select>
                    {rubriquesUniques.size > 0 && (
                      <select
                        className="filtre-select"
                        value={filtreTravRubrique}
                        onChange={e => setFiltreTravRubrique(e.target.value)}
                      >
                        <option value="tous">Toutes rubriques</option>
                        {[...rubriquesUniques.entries()].map(([id, nom]) => (
                          <option key={id} value={id}>📂 {nom}</option>
                        ))}
                        <option value="__sans_rubrique__">— Sans rubrique</option>
                      </select>
                    )}
                    {(filtreTravCorrige !== 'tous' || filtreTravRubrique !== 'tous') && (
                      <button
                        className="btn-secondary"
                        onClick={() => { setFiltreTravCorrige('tous'); setFiltreTravRubrique('tous'); }}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      >
                        ✕ Réinitialiser
                      </button>
                    )}
                  </div>
                  {/* Liste */}
                  {travauxFiltres.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Aucun travail ne correspond aux filtres.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {travauxFiltres.map(t => (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.6rem',
                            padding: '0.75rem 1rem',
                            background: t.corrige ? '#f0fdf4' : '#f8fafc',
                            border: `1px solid ${t.corrige ? '#bbf7d0' : '#e2e8f0'}`,
                            borderRadius: 8,
                            transition: 'background 0.2s',
                            opacity: t.corrige ? 0.75 : 1,
                          }}
                        >
                          {/* Phase 36 — cellule "Corrigé" (checkbox + date/heure auto + éditable) */}
                          <CorrigeTravailCell
                            travail={t}
                            onChanged={(patch) => {
                              // Mise à jour optimiste du state local avec le patch complet
                              setTravauxCahier(prev => prev.map(x => x.id === patch.id ? {
                                ...x,
                                corrige: patch.corrige,
                                corrigeDate: patch.corrigeDate,
                                corrigeHeure: patch.corrigeHeure,
                              } : x));
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <strong style={t.corrige ? { textDecoration: 'line-through', color: '#6b7280' } : { color: '#1e293b' }}>{t.titre}</strong>
                              {t.rubriqueNom && (
                                <span style={{ fontSize: '0.7rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>📂 {t.rubriqueNom}</span>
                              )}
                            </div>
                            {t.description && (
                              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: t.description }} />
                            )}
                            <span style={{ fontSize: '0.8rem', color: '#2563eb', marginTop: '0.25rem', display: 'block' }}>
                              📅 {t.dateEcheance instanceof Date ? t.dateEcheance.toLocaleDateString('fr-FR') : new Date(t.dateEcheance).toLocaleDateString('fr-FR')}
                              {t.heureEcheance && ` à ${t.heureEcheance}`}
                              {t.groupeNom && ` • 👥 ${t.groupeNom}`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Vue Statistiques ── */}
      {vue === 'stats' && (
        <div className="cahier-detail-layout">
          <CahierStats
            cahier={{
              ...cahier,
              nombreSeancesRealise: entrees.filter(e => e.statut === 'realise').length,
            }}
          />
          <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
        </div>
      )}

      {/* ── Vue Liste (3 colonnes) ── */}
      {vue === 'liste' && (
        <div className="cahier-three-col-layout">

          {/* ─── Colonne gauche : navigation ─────────────── */}
          <aside className="cahier-nav-sidebar no-print">
            <div className="nav-sidebar-header">
              <span className="nav-sidebar-icon">🗓️</span>
              <span className="nav-sidebar-title">Navigation</span>
            </div>

            {/* Tout afficher */}
            <button
              className={`nav-month-item ${filtreMois === 'tous' ? 'active' : ''}`}
              onClick={() => { setFiltreMois('tous'); setFiltreSemaine(null); }}
            >
              <span>Tout afficher</span>
              <span className="nav-count-badge">{entrees.length}</span>
            </button>

            {/* Liste des mois */}
            {moisDisponibles.length > 0 && (
              <div className="nav-months-list">
                {moisDisponibles.map(mois => (
                  <button
                    key={mois}
                    className={`nav-month-item ${filtreMois === mois ? 'active' : ''}`}
                    onClick={() => { setFiltreMois(mois); setFiltreSemaine(null); }}
                  >
                    <span className="nav-month-label">{formatMoisLabel(mois)}</span>
                    <span className="nav-count-badge">{countParMois.get(mois) || 0}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Semaines du mois sélectionné */}
            {filtreMois !== 'tous' && semainesDisponibles.length > 0 && (
              <div className="nav-weeks-section">
                <div className="nav-weeks-header">Semaines</div>
                {/* Option "tout le mois" */}
                <button
                  className={`nav-week-item ${filtreSemaine === null ? 'active' : ''}`}
                  onClick={() => setFiltreSemaine(null)}
                >
                  <span>Tout le mois</span>
                  <span className="nav-count-badge nav-count-badge--sm">
                    {countParMois.get(filtreMois) || 0}
                  </span>
                </button>
                {semainesDisponibles.map(sem => (
                  <button
                    key={sem.start}
                    className={`nav-week-item ${filtreSemaine === sem.start ? 'active' : ''}`}
                    onClick={() => setFiltreSemaine(sem.start)}
                  >
                    <span className="nav-week-label">{formatWeekLabel(sem.start)}</span>
                    <span className="nav-count-badge nav-count-badge--sm">{sem.count}</span>
                  </button>
                ))}
              </div>
            )}

            {entrees.length === 0 && (
              <p className="nav-sidebar-empty">Aucune séance pour l'instant</p>
            )}
          </aside>

          {/* ─── Colonne centrale : liste des entrées ─────── */}
          <div className="cahier-content-col">
            {/* Barre filtres + tri */}
            <div className="entrees-controls no-print">
              {/* Filtres statut */}
              <div className="entrees-statut-filters">
                {(['tous', 'realise', 'planifie', 'annule', 'reporte'] as const).map(s => {
                  const cfg = s === 'tous' ? null : STATUT_CONFIG[s];
                  return (
                    <button
                      key={s}
                      className={`statut-chip ${filtreStatut === s ? 'active' : ''}`}
                      style={filtreStatut === s && cfg ? {
                        borderColor: cfg.color,
                        background: cfg.bg,
                        color: cfg.color,
                      } : {}}
                      onClick={() => setFiltreStatut(s)}
                    >
                      {s === 'tous' ? 'Tous' : cfg?.label}
                    </button>
                  );
                })}
              </div>

              {/* Filtre type + rubrique + sort */}
              <div className="entrees-right-controls">
                <select
                  className="filtre-select"
                  value={filtreType}
                  onChange={e => setFiltreType(e.target.value)}
                >
                  <option value="tous">Tous types</option>
                  {Object.entries(TYPE_CONTENU_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>{cfg.emoji} {cfg.label}</option>
                  ))}
                </select>

                {rubriques.length > 0 && (
                  <select
                    className="filtre-select"
                    value={filtreRubrique}
                    onChange={e => setFiltreRubrique(e.target.value)}
                  >
                    <option value="tous">Toutes rubriques</option>
                    {rubriques.map(r => (
                      <option key={r.id} value={r.id}>📂 {r.nom}</option>
                    ))}
                    <option value="__sans_rubrique__">— Sans rubrique</option>
                  </select>
                )}

                {/* Bouton tri chronologique */}
                <button
                  className="btn-sort"
                  onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                  title={sortDirection === 'asc' ? 'Ordre croissant (cliquer pour inverser)' : 'Ordre décroissant (cliquer pour inverser)'}
                >
                  {sortDirection === 'asc' ? '↑ Plus ancien' : '↓ Plus récent'}
                </button>
              </div>
            </div>

            {/* Indicateur de filtre actif */}
            {(filtreMois !== 'tous' || filtreSemaine || filtreStatut !== 'tous' || filtreType !== 'tous') && (
              <div className="filtre-actif-bar no-print">
                <span className="filtre-actif-label">
                  {entreesFiltrees.length} séance{entreesFiltrees.length !== 1 ? 's' : ''}
                  {filtreSemaine ? ` • Semaine du ${formatWeekLabel(filtreSemaine)}` : ''}
                  {filtreMois !== 'tous' && !filtreSemaine ? ` • ${formatMoisLabel(filtreMois)}` : ''}
                </span>
                <button
                  className="filtre-actif-reset"
                  onClick={() => {
                    setFiltreStatut('tous');
                    setFiltreType('tous');
                    setFiltreMois('tous');
                    setFiltreSemaine(null);
                  }}
                >
                  ✕ Réinitialiser
                </button>
              </div>
            )}

            {/* ── Liste des entrées ── */}
            {loadingEntrees && entreesFiltrees.length === 0 ? (
              <div className="loading-spinner"><div className="spinner-circle" /></div>
            ) : entreesFiltrees.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '2.5rem', opacity: 0.3, marginBottom: '0.5rem' }}>📝</div>
                <h3>
                  {filtreStatut !== 'tous' || filtreType !== 'tous' || filtreMois !== 'tous'
                    ? 'Aucune séance correspondant aux filtres'
                    : 'Aucune séance pour l\'instant'}
                </h3>
                {filtreStatut === 'tous' && filtreType === 'tous' && filtreMois === 'tous' && (
                  <button
                    className="btn-primary"
                    onClick={() => navigate(`/prof/cahiers/${cahierId}/nouvelle`)}
                    style={{ marginTop: '1rem' }}
                  >
                    + Ajouter la première séance
                  </button>
                )}
              </div>
            ) : (() => {
              // Phase 31 — Groupement par jour : toujours construire la map,
              // puis activer le mode groupé dès qu'un jour contient 2+ séances
              // (ou si seancesParJour est explicitement > 1).
              const map = new Map<string, { entree: EntreeCahier; globalIdx: number }[]>();
              entreesFiltrees.forEach((entree, idx) => {
                const d = entree.date.toDate();
                const cle = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (!map.has(cle)) map.set(cle, []);
                map.get(cle)!.push({ entree, globalIdx: idx });
              });

              const groupesParJour: { cleJour: string; labelJour: string; entrees: { entree: EntreeCahier; globalIdx: number }[] }[] = [];
              map.forEach((items, cleJour) => {
                const d = items[0].entree.date.toDate();
                const labelJour = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                groupesParJour.push({ cleJour, labelJour, entrees: items });
              });

              // Activer le groupement si le cahier le demande OU si au moins un jour a 2+ entrées
              const seancesParJourSetting = cahier.seancesParJour ?? 1;
              const auMoinsUnJourMultiple = groupesParJour.some(g => g.entrees.length > 1);
              const doitGrouper = seancesParJourSetting > 1 || auMoinsUnJourMultiple;

              const toggleJour = (cle: string) => {
                setJoursReplies(prev => {
                  const next = new Set(prev);
                  if (next.has(cle)) next.delete(cle); else next.add(cle);
                  return next;
                });
              };

              // Rendu d'une carte d'entrée (réutilisé dans les deux modes)
              const renderEntreeCard = (entree: EntreeCahier, idx: number, showDate: boolean) => {
                const typeCfg = TYPE_CONTENU_CONFIG[entree.typeContenu];
                const statutCfg = STATUT_CONFIG[entree.statut];
                const dateSeance = entree.date.toDate();

                return (
                  <div
                    key={entree.id}
                    className="entree-card"
                    style={{ borderLeftColor: typeCfg.color }}
                    onClick={() => navigate(`/prof/cahiers/${cahierId}/modifier/${entree.id}`)}
                  >
                    <div className="entree-num">
                      <span style={{ background: typeCfg.color }}>
                        {sortDirection === 'asc' ? idx + 1 : entreesFiltrees.length - idx}
                      </span>
                    </div>

                    <div className="entree-card-inner">
                      <div className="entree-card-top">
                        <div className="entree-card-gauche">
                          {showDate && (
                            <div className="entree-date">
                              📅 {dateSeance.toLocaleDateString('fr-FR', {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                              })}
                              {entree.heureDebut && (
                                <span className="entree-heure">
                                  🕐 {entree.heureDebut}{entree.heureFin ? ` → ${entree.heureFin}` : ''}
                                </span>
                              )}
                            </div>
                          )}
                          {!showDate && entree.heureDebut && (
                            <div className="entree-date" style={{ fontSize: '0.78rem' }}>
                              🕐 {entree.heureDebut}{entree.heureFin ? ` → ${entree.heureFin}` : ''}
                            </div>
                          )}
                          <h3 className="entree-chapitre">{entree.chapitre}</h3>
                          <div className="entree-badges">
                            <span className="entree-type-badge" style={{ background: typeCfg.color }}>
                              {typeCfg.emoji} {typeCfg.label}
                            </span>
                            <span className="entree-statut-badge" style={{ background: statutCfg.bg, color: statutCfg.color }}>
                              {statutCfg.label}
                            </span>
                            {(() => {
                              const rid = resoudreRubriqueIdPourEntree(entree, rubriques);
                              const r = rid ? rubriques.find(x => x.id === rid) : null;
                              if (r) {
                                return (
                                  <span
                                    className="entree-card-rubrique-badge"
                                    style={{
                                      backgroundColor: (r.couleur ?? '#64748b') + '1a',
                                      borderColor: r.couleur ?? '#64748b',
                                      color: r.couleur ?? '#64748b',
                                    }}
                                  >
                                    {r.nom}
                                  </span>
                                );
                              }
                              if (entree.rubrique?.trim()) {
                                return <span className="entree-rubrique-badge">{entree.rubrique}</span>;
                              }
                              return null;
                            })()}
                            {entree.isMarqueEvaluation && (
                              <span className="signet-badge">📌 Évaluation</span>
                            )}
                            {entree.piecesJointes && entree.piecesJointes.length > 0 && (
                              <span className="badge-pj">📎 {entree.piecesJointes.length}</span>
                            )}
                          </div>
                          {/* Phase 34 — pastilles "Exercices liés" (jour / domicile) */}
                          {(entree.exerciceJour || entree.exerciceDomicile) && (
                            <div className="entree-exos-inline" aria-label="Exercices liés à la leçon">
                              {entree.exerciceJour && (
                                <span className="entree-exos-inline__badge" title="Exercice du jour renseigné">
                                  🎯 Exercice du jour
                                </span>
                              )}
                              {entree.exerciceDomicile && (
                                <span className="entree-exos-inline__badge entree-exos-inline__badge--domicile" title="Exercice à domicile renseigné">
                                  🏠 Exercice à domicile
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="entree-actions no-print">
                          <button className="btn-icon" onClick={e => { e.stopPropagation(); navigate(`/prof/cahiers/${cahierId}/modifier/${entree.id}`); }} title="Modifier la séance">✏️</button>
                          {/* Phase 34 — Dupliquer : raccourci pour créer une séance similaire */}
                          <button className="btn-icon btn-icon--duplicate" onClick={e => handleDuplicateEntree(entree, e)} title="Dupliquer la séance (raccourci de mise à jour)">🗐</button>
                          <button className="btn-icon btn-icon--danger" onClick={e => { e.stopPropagation(); handleDeleteEntree(entree); }} title="Supprimer la séance">🗑️</button>
                        </div>
                      </div>
                      {entree.contenu && (
                        <div className="entree-contenu-preview" dangerouslySetInnerHTML={{ __html: entree.contenu }} />
                      )}
                      {entree.objectifs && (
                        <div className="entree-objectifs">🎯 <em>{entree.objectifs}</em></div>
                      )}
                      <div className="entree-card-footer no-print">
                        <div className="entree-statuts-rapides">
                          {(['realise', 'planifie', 'annule'] as StatutSeance[]).map(s => {
                            const cfg = STATUT_CONFIG[s];
                            const isActive = entree.statut === s;
                            return (
                              <button
                                key={s}
                                className={`statut-quick-btn ${isActive ? 'active' : ''}`}
                                style={isActive ? { borderColor: cfg.color, background: cfg.bg, color: cfg.color } : {}}
                                onClick={e => { e.stopPropagation(); handleStatutChange(entree, s); }}
                              >
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                        {entree.notesPrivees && (
                          <span className="entree-has-notes" title="Contient des notes privées">🔒 Notes privées</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              return doitGrouper ? (
                <div className="entrees-list">
                  {groupesParJour.map(groupe => {
                    const nbSeances = groupe.entrees.length;

                    // Jour avec une seule séance → rendu normal (pas de header réductible)
                    if (nbSeances === 1) {
                      const { entree, globalIdx } = groupe.entrees[0];
                      return <React.Fragment key={groupe.cleJour}>{renderEntreeCard(entree, globalIdx, true)}</React.Fragment>;
                    }

                    // Jour avec 2+ séances → header réductible
                    const estReplie = joursReplies.has(groupe.cleJour);
                    return (
                      <div key={groupe.cleJour} className="entrees-jour-groupe" style={{ marginBottom: '0.75rem' }}>
                        <button
                          type="button"
                          className="entrees-jour-header"
                          onClick={() => toggleJour(groupe.cleJour)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.6rem 1rem',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: estReplie ? '8px' : '8px 8px 0 0',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: '#1e293b',
                            textAlign: 'left',
                          }}
                          aria-expanded={!estReplie}
                        >
                          <span style={{
                            display: 'inline-block',
                            transition: 'transform 0.2s',
                            transform: estReplie ? 'rotate(-90deg)' : 'rotate(0)',
                            fontSize: '0.85rem',
                          }}>
                            ▾
                          </span>
                          <span>📅 {groupe.labelJour}</span>
                          <span style={{
                            marginLeft: 'auto',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: '#6b7280',
                            background: '#e2e8f0',
                            padding: '2px 8px',
                            borderRadius: 9999,
                          }}>
                            {nbSeances} séances
                          </span>
                        </button>
                        {!estReplie && (
                          <div style={{ borderLeft: '2px solid #cbd5e1', marginLeft: '0.75rem', paddingLeft: '0.75rem', paddingTop: '0.25rem' }}>
                            {groupe.entrees.map(({ entree, globalIdx }) =>
                              renderEntreeCard(entree, globalIdx, false)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="entrees-list">
                  {entreesFiltrees.map((entree, idx) => renderEntreeCard(entree, idx, true))}
                </div>
              );
            })()}
          </div>

          {/* ─── Colonne droite : planification + rappels ─── */}
          <div className="cahier-sidebar-right no-print">
            <PlanificationWidget cahier={cahier} entrees={entrees} compact />
            <RappelWidget profId={currentUser!.uid} cahierId={cahier.id} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CahierDetailPage;

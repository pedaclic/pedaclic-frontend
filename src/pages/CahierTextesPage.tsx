// ============================================================
// PHASE 21 + 22 — PAGE : CahierTextesPage
// Liste de tous les cahiers d'un enseignant Premium
// Phase 22 : liaison groupes classes + badge partagé
// Route : /prof/cahiers
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

/* ─────────────────────────────────────────────────────────────
   PHASE 40 — Reprise sur la dernière activité
   ─────────────────────────────────────────────────────────────
   Clé localStorage où l'on persiste le couple (cahierId, entreeId)
   ouvert par l'utilisateur. À l'arrivée sur /prof/cahiers, si
   cette clé existe ET que le cahier existe toujours, on redirige
   automatiquement vers la dernière activité consultée.

   ESCAPE : la redirection est désactivée si l'URL contient
   `?vue=liste` (paramètre passé par les boutons « Retour aux cahiers »
   du détail/éditeur d'entrée). Cela permet à l'utilisateur de
   revenir à la liste sans rebondir indéfiniment vers le dernier
   cahier ouvert.
   ───────────────────────────────────────────────────────────── */
const LS_LAST_CAHIER_KEY = 'pedaclic.cahier.lastActivity';

interface LastCahierActivity {
  cahierId: string;
  entreeId?: string;
  /** Timestamp ISO — utilisé pour expirer la reprise après 14 jours. */
  visitedAt: string;
}

/** Lit la dernière activité Cahier — null si vide ou expirée (>14 j). */
function readLastCahierActivity(): LastCahierActivity | null {
  try {
    const raw = localStorage.getItem(LS_LAST_CAHIER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LastCahierActivity;
    if (!data?.cahierId) return null;
    // Expire après 14 jours pour éviter de rouvrir un cahier oublié
    const ageMs = Date.now() - new Date(data.visitedAt).getTime();
    if (ageMs > 14 * 24 * 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

import {
  subscribeToCahiers,
  createCahier,
  updateCahier,
  deleteCahier,
  toggleArchiveCahier,
  getGroupesProf,
} from '../services/cahierTextesService';
// Phase 48 — emploi du temps PERSONNEL par établissement
import { emploiPersonnelExiste } from '../services/emploiDuTempsService';
import EmploiDuTempsDrawer, { type OuvrirCahierInfo, type VueEmploi } from '../components/prof/EmploiDuTempsDrawer';
import EdtAujourdhui from '../components/prof/EdtAujourdhui';
// Phase 52 — résolution « créneau → cahier » partagée avec le bandeau Aujourd'hui
import { trouverCahierPourCreneau } from '../utils/liensSeances';

import {
  COULEURS_CAHIER,
  CLASSES,
} from '../types/cahierTextes.types';

import type {
  CahierTextes, CahierFormData, GroupeProf,
  Classe, Matiere, AnneeScolaire,
} from '../types/cahierTextes.types';
import '../styles/CahierTextes.css';
import '../styles/CahierEnrichi.css';

// ── Phase 46 — Organisateur (établissements, division, étiquettes, filtres) ──
import '../styles/Organisateur.css';
import { useEtablissements } from '../hooks/useEtablissements';
import { basculerEpingleCahier } from '../services/etablissementsService';
import OrganisateurFiltres from '../components/prof/OrganisateurFiltres';
import EtablissementManager from '../components/prof/EtablissementManager';
import ClassementLotModal from '../components/prof/ClassementLotModal';
import EtiquettesInput from '../components/prof/EtiquettesInput';
import {
  FILTRE_SANS_ETABLISSEMENT,
  libelleCourtEtablissement,
} from '../types/etablissement.types';
import {
  filtrerCahiers,
  grouperCahiers,
  etiquettesConnues,
  libelleClasse,
  lireFiltresMemorises,
  memoriserFiltres,
  lireDernierEtablissement,
  memoriserDernierEtablissement,
  nettoyerEtiquettes,
  filtresVides,
  type FiltresOrganisateur,
} from '../utils/organisateurCahiers';

import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
// Phase 45 — années scolaires administrables (/admin/annees-scolaires)
import { useAnneesScolaires } from '../hooks/useAnneesScolaires';
import { anneesPourSelect, calculerAnneeScolaireEnCours } from '../types/anneesScolaires.types';

// ─── Formulaire vide ─────────────────────────────────────────
// Phase 45 : l'année par défaut est l'année scolaire EN COURS
// (paramètre fourni par le hook ; calcul local en repli).
const emptyForm = (anneeScolaire: string = calculerAnneeScolaireEnCours()): CahierFormData => ({
  classe:               '3ème',
  matiere:              'Mathématiques',
  anneeScolaire,
  titre:                '',
  description:          '',
  couleur:              '#2563eb',
  nombreSeancesPrevu:   30,
  // Phase 22
  groupeIds:            [],
  groupeNoms:           [],
  isPartage:            false,
  // Phase 31
  seancesParJour:       1,
  // Phase 46 — valeurs neutres (jamais undefined pour Firestore)
  etablissementId:      null,
  etablissementNom:     '',
  division:             '',
  etiquettes:           [],
});

// ─── Composant principal ─────────────────────────────────────
const CahierTextesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirmDialog = useConfirm();
  const [searchParams] = useSearchParams(); // Phase 22 — pré-remplissage depuis widget groupe

  // ── États principaux ─────────────────────────────────────
  const [cahiers, setCahiers]       = useState<CahierTextes[]>([]);
  const [loading, setLoading]       = useState(true);
  // Phase 45 : filtre initialisé sur l'année scolaire EN COURS (et non plus figé)
  const [filtreAnnee, setFiltreAnnee] = useState<string>(() => calculerAnneeScolaireEnCours());
  // true dès que l'enseignant choisit lui-même une année → on ne l'écrase plus
  const filtreAnneeChoisi = useRef(false);
  const [filtreArchive, setFiltreArchive] = useState<'actif' | 'archive' | 'tous'>('actif');
  const [vueMode, setVueMode]       = useState<'grille' | 'liste'>('grille');
  const [showModal, setShowModal]   = useState(false);
  // Emploi du temps (fenêtre flottante) + conditionnement de la création
  const [edtOpen, setEdtOpen]       = useState(false);
  const [edtClasse, setEdtClasse]   = useState<Classe | undefined>(undefined);
  // Phase 48 — établissement et onglet pré-sélectionnés à l'ouverture
  const [edtEtab, setEdtEtab]       = useState<string | null | undefined>(undefined);
  const [edtVue, setEdtVue]         = useState<VueEmploi | undefined>(undefined);
  const [besoinEmploi, setBesoinEmploi] = useState(false);
  const [editCahier, setEditCahier] = useState<CahierTextes | null>(null);
  const [form, setForm]             = useState<CahierFormData>(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  // Matières et niveaux dynamiques depuis Firestore
  const { matieres: matieresDispos, niveaux: niveauxDispos, loading: loadingDisciplines } = useDisciplinesOptions();

  // ── Phase 45 — années scolaires (config admin, temps réel) ──
  const { config: anneesConfig, anneeCourante, charge: anneesChargees } = useAnneesScolaires();

  /* Si l'admin a imposé une autre année en cours (mode manuel) ou un
     autre mois de rentrée, on aligne le filtre ET le formulaire vierge
     — uniquement tant que l'enseignant n'a rien choisi lui-même. */
  useEffect(() => {
    if (!anneesChargees) return;
    const anneeAuto = calculerAnneeScolaireEnCours();
    if (!filtreAnneeChoisi.current) setFiltreAnnee(anneeCourante);
    setForm(f => (f.anneeScolaire === anneeAuto ? { ...f, anneeScolaire: anneeCourante } : f));
  }, [anneesChargees, anneeCourante]);

  /* ─────────────────────────────────────────────────────────────
     Reprise sur la dernière activité — ne s'exécute QU'UNE fois
     par chargement de page (ref pour éviter les redirections en
     boucle si l'utilisateur revient avec ?vue=liste).
     ───────────────────────────────────────────────────────────── */
  const reprisefaite = useRef(false);



  // ── Phase 22 — états groupes ─────────────────────────────
  const [groupesDispos, setGroupesDispos]             = useState<GroupeProf[]>([]);
  const [groupesSelectionnes, setGroupesSelectionnes] = useState<string[]>([]);

  // ── Phase 46 — Organisateur ──────────────────────────────
  // (déclaré AVANT le contrôle Premium : ordre des hooks constant)
  const { etablissements, actifs: etabsActifs, parId: etabsParId } = useEtablissements(currentUser?.uid);
  const [filtresOrg, setFiltresOrg] = useState<FiltresOrganisateur>(() => lireFiltresMemorises());
  const [showEtabManager, setShowEtabManager] = useState(false);
  /** true = gestionnaire ouvert depuis la modale de cahier (présélection au retour) */
  const [etabDepuisForm, setEtabDepuisForm] = useState(false);
  const [showClassementLot, setShowClassementLot] = useState(false);
  const [sectionsRepliees, setSectionsRepliees] = useState<Set<string>>(new Set());
  const [bandeauMasque, setBandeauMasque] = useState<boolean>(() => {
    try { return sessionStorage.getItem('pedaclic.cahier.bandeauClassement') === 'masque'; }
    catch { return false; }
  });

  // Mémorise les filtres à chaque changement (localStorage, pas l'URL)
  useEffect(() => { memoriserFiltres(filtresOrg); }, [filtresOrg]);

  // ── Vérification Premium (les admins sont toujours exemptés) ─
  if (!currentUser?.isPremium && currentUser?.role !== 'admin') {
    return (
      <div className="cahier-textes-page">
        <div className="premium-gate">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📒</div>
          <h2>Cahier de Textes Numérique</h2>
          <p>
            Cette fonctionnalité est réservée aux enseignants Premium.<br />
            Passez au Premium pour organiser, planifier et suivre votre enseignement.
          </p>
          <button className="btn-primary" onClick={() => navigate('/premium')}>
            🚀 Passer au Premium — 2 000 FCFA/mois
          </button>
        </div>
      </div>
    );
  }

  // ── Abonnement temps réel aux cahiers ────────────────────
  // onSnapshot contourne le cache IndexedDB de persistentLocalCache :
  // toute écriture Firestore (changement de statut, etc.) déclenche
  // immédiatement une mise à jour de la liste et des barres de progression.
  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    const unsubscribe = subscribeToCahiers(
      currentUser.uid,
      filtreAnnee || undefined,
      (data) => {
        setCahiers(data);
        setLoading(false);

        /* ─────────────────────────────────────────────────────────────
           PHASE 40 — Auto-redirection sur la dernière activité
           ─────────────────────────────────────────────────────────────
           Conditions strictes pour éviter les surprises :
             • Pas déjà fait dans cette navigation (ref)
             • Pas de paramètres URL (création/lien direct, ?vue=liste, etc.)
             • Une dernière activité valide ET correspondant à un cahier
               toujours présent (sinon on nettoie le storage)
           Si toutes les conditions sont réunies → on redirige.
           ───────────────────────────────────────────────────────────── */
        if (reprisefaite.current) return;
        reprisefaite.current = true;          // verrou local (cet effet)

        /* ESCAPE — l'utilisateur veut explicitement la liste.
           Détecté via `?vue=liste` (ajouté par les boutons « Retour »
           des sous-pages cahier) ou tout autre paramètre URL non vide
           (création depuis widget : ?groupeId=…, etc.). */
        const aDesParams = Array.from(searchParams.keys()).length > 0;
        if (aDesParams) return;

        const last = readLastCahierActivity();
        if (!last) return;

        const cahierExisteToujours = data.some(c => c.id === last.cahierId);
        if (!cahierExisteToujours) {
          // Cahier supprimé/archivé entre-temps : on nettoie le pointeur.
          try { localStorage.removeItem(LS_LAST_CAHIER_KEY); } catch { /* noop */ }
          return;
        }

        // ✅ Toutes les conditions réunies : on rebondit sur le dernier
        //    cahier ouvert, en `replace` pour ne pas polluer l'historique.
        navigate(`/prof/cahiers/${last.cahierId}`, { replace: true });
      },
      (err) => {
        console.error('Erreur chargement cahiers:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser?.uid, filtreAnnee, navigate, searchParams]);

  // ── Phase 22 — chargement des groupes + pré-remplissage ──
  useEffect(() => {
    if (!currentUser?.uid) return;
    // Charge les groupes disponibles pour le sélecteur
    getGroupesProf(currentUser.uid)
      .then(setGroupesDispos)
      .catch(err => console.error('Erreur chargement groupes:', err));

    // Pré-remplissage si on vient depuis CahierGroupeWidget
    const groupeIdParam  = searchParams.get('groupeId');
    const groupeNomParam = searchParams.get('groupeNom');
    const classeParam    = searchParams.get('classe');

    if (groupeIdParam && groupeNomParam) {
      // Ouvre directement la modale pré-remplie
      setGroupesSelectionnes([groupeIdParam]);
      setForm(f => ({
        ...f,
        classe:     (classeParam as Classe) || f.classe,
        groupeIds:  [groupeIdParam],
        groupeNoms: [groupeNomParam],
      }));
      setEditCahier(null);
      setError('');
      setShowModal(true);
    }
  }, [currentUser?.uid]);

  // ── Ouvrir modal création ─────────────────────────────────
  const handleNouveauCahier = () => {
    setEditCahier(null);
    // Phase 46 — établissement pré-rempli : celui du filtre s'il n'y en
    // a qu'un, sinon le dernier utilisé (s'il est toujours actif)
    const filtreUnique = filtresOrg.etablissements.length === 1 ? filtresOrg.etablissements[0] : '';
    const dernier = lireDernierEtablissement();
    const etabParDefaut = etabsActifs.find(e => e.id === filtreUnique)
                       ?? etabsActifs.find(e => e.id === dernier)
                       ?? null;
    setForm({
      ...emptyForm(anneeCourante), // Phase 45
      etablissementId:  etabParDefaut?.id  ?? null,
      etablissementNom: etabParDefaut?.nom ?? '',
    });
    setGroupesSelectionnes([]);
    setError('');
    setBesoinEmploi(false);
    setShowModal(true);
  };

  // ── Clic sur un créneau de l'emploi du temps → saisie du cahier (point 4) ──
  const handleOuvrirCahierDepuisCreneau = (info: OuvrirCahierInfo) => {
    // Liaison rigoureuse (bug 2) : cahier du GROUPE exact, puis (classe + matière)
    // du même établissement. Phase 52 : logique déplacée dans utils/liensSeances
    // (partagée avec le bandeau « Aujourd'hui »), comportement identique.
    const found = (info.cahierId ? cahiers.find(c => c.id === info.cahierId) : undefined)
               ?? trouverCahierPourCreneau(cahiers, info);
    setEdtOpen(false);
    if (found && info.entreeId) {
      // Phase 52 — séance déjà saisie pour ce cours → on l'ouvre directement
      navigate(`/prof/cahiers/${found.id}/modifier/${info.entreeId}`);
    } else if (found) {
      // Nouvelle séance ; Phase 52 : date + horaires du créneau pré-remplis si connus
      const params = new URLSearchParams();
      if (info.date)       params.set('date', info.date);
      if (info.heureDebut) params.set('debut', info.heureDebut);
      if (info.heureFin)   params.set('fin', info.heureFin);
      const qs = params.toString();
      navigate(`/prof/cahiers/${found.id}/nouvelle${qs ? `?${qs}` : ''}`);
    } else {
      // Pas encore de cahier : pré-remplit la modale de création (classe + groupe + matière)
      setEditCahier(null);
      setForm(f => ({
        ...f,
        classe: info.classe,
        ...(info.matiere ? { matiere: info.matiere as Matiere } : {}),
        ...(info.groupeId
          ? { groupeIds: [info.groupeId], groupeNoms: info.groupeNom ? [info.groupeNom] : [] }
          : {}),
        // Phase 48 — le nouveau cahier hérite de l'établissement du créneau
        ...(info.etablissementId !== undefined
          ? {
              etablissementId:  info.etablissementId,
              etablissementNom: info.etablissementId ? (etabsParId.get(info.etablissementId)?.nom ?? '') : '',
            }
          : {}),
      }));
      setBesoinEmploi(false);
      setError('');
      setShowModal(true);
    }
  };

  // ── Ouvrir modal édition ──────────────────────────────────
  const handleEditCahier = (cahier: CahierTextes, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCahier(cahier);
    setBesoinEmploi(false);
    setGroupesSelectionnes(cahier.groupeIds ?? []);
    setForm({
      classe:               cahier.classe as Classe,
      matiere:              cahier.matiere as Matiere,
      anneeScolaire:        cahier.anneeScolaire as AnneeScolaire,
      titre:                cahier.titre,
      description:          cahier.description || '',
      couleur:              cahier.couleur,
      nombreSeancesPrevu:   cahier.nombreSeancesPrevu,
      // Phase 22
      groupeIds:            cahier.groupeIds  ?? [],
      groupeNoms:           cahier.groupeNoms ?? [],
      isPartage:            cahier.isPartage  ?? false,
      // Phase 31
      seancesParJour:       cahier.seancesParJour ?? 1,
      // Phase 46 — un ID d'établissement supprimé est traité comme « aucun »
      etablissementId:      cahier.etablissementId && etabsParId.has(cahier.etablissementId)
                              ? cahier.etablissementId : null,
      etablissementNom:     cahier.etablissementNom ?? '',
      division:             cahier.division ?? '',
      etiquettes:           cahier.etiquettes ?? [],
    });
    setError('');
    setShowModal(true);
  };

  // ── Phase 22 — toggle groupe dans la sélection ───────────
  const handleToggleGroupe = (groupeId: string) => {
    setGroupesSelectionnes(prev => {
      const next = prev.includes(groupeId)
        ? prev.filter(id => id !== groupeId)
        : [...prev, groupeId];
      // Synchronise aussi dans le form
      const noms = next
        .map(id => groupesDispos.find(g => g.id === id)?.nom ?? '')
        .filter(Boolean);
      setForm(f => ({ ...f, groupeIds: next, groupeNoms: noms }));
      return next;
    });
  };

  // ── Soumettre le formulaire ───────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;
    setSaving(true);
    setError('');
    setBesoinEmploi(false);
    // Phase 46 — normalisation des champs de l'organisateur
    const etabChoisi = form.etablissementId ? etabsParId.get(form.etablissementId) : undefined;
    const formFinal: CahierFormData = {
      ...form,
      etablissementId:  etabChoisi?.id  ?? null,
      etablissementNom: etabChoisi?.nom ?? '',
      division:         (form.division ?? '').trim().slice(0, 12),
      etiquettes:       nettoyerEtiquettes(form.etiquettes ?? []),
    };
    if (etabChoisi) memoriserDernierEtablissement(etabChoisi.id);
    try {
      if (editCahier) {
        await updateCahier(editCahier.id, formFinal);
      } else {
        // Conditionnement (point 1) : un emploi du temps de la classe est requis.
        // Les cahiers déjà existants ne sont pas affectés (grandfathering).
        // Phase 48 : emploi du temps PERSONNEL de cet établissement
        // (ou anciens créneaux du professeur dans l'emploi du temps commun).
        const emploiOk = await emploiPersonnelExiste(
          currentUser.uid, formFinal.etablissementId ?? null, form.classe, form.anneeScolaire
        );
        if (!emploiOk) {
          setBesoinEmploi(true);
          setSaving(false);
          return;
        }
        await createCahier(currentUser.uid, formFinal);
      }
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Erreur : ' + msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer un cahier ───────────────────────────────────
  const handleDelete = async (cahier: CahierTextes, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirmDialog({ title: 'Supprimer le cahier ?', message: `Supprimer le cahier "${cahier.titre}" et toutes ses entrées ?`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try {
      await deleteCahier(cahier.id);
      setCahiers(prev => prev.filter(c => c.id !== cahier.id));
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const handleToggleArchive = async (cahier: CahierTextes, e: React.MouseEvent) => {
    e.stopPropagation();
    const nouvelEtat = !(cahier.isArchived ?? false);
    try {
      await toggleArchiveCahier(cahier.id, nouvelEtat);
      setCahiers(prev => prev.map(c =>
        c.id === cahier.id ? { ...c, isArchived: nouvelEtat } : c
      ));
    } catch {
      toast.error('Erreur lors de l\'opération.');
    }
  };

  // ── Filtrage par statut archive ───────────────────────────
  const cahiersFiltres = cahiers.filter(c => {
    const archived = c.isArchived ?? false;
    if (filtreArchive === 'actif') return !archived;
    if (filtreArchive === 'archive') return archived;
    return true;
  });

  // ── Phase 46 — Organisateur : filtres, regroupement, compteurs ──
  // Calculs locaux sur les cahiers déjà chargés (aucune requête en plus).
  const cahiersAffiches = filtrerCahiers(cahiersFiltres, filtresOrg, etabsParId);
  const groupesCahiers  = grouperCahiers(cahiersAffiches, filtresOrg.regroupement, etablissements);

  /** Nombre de cahiers par établissement (+ « non classés ») */
  const compteursEtab = new Map<string, number>();
  for (const c of cahiersFiltres) {
    const cle = c.etablissementId && etabsParId.has(c.etablissementId)
      ? c.etablissementId : FILTRE_SANS_ETABLISSEMENT;
    compteursEtab.set(cle, (compteursEtab.get(cle) ?? 0) + 1);
  }
  const nbNonClasses = compteursEtab.get(FILTRE_SANS_ETABLISSEMENT) ?? 0;
  /** Pastilles : établissements actifs + archivés qui ont encore des cahiers */
  const etabsPourFiltre = etablissements.filter(e => !e.isArchived || compteursEtab.has(e.id));
  const matieresPresentes = Array.from(new Set(cahiers.map(c => c.matiere))).sort((a, b) => a.localeCompare(b, 'fr'));
  const etiquettesPresentes = etiquettesConnues(cahiers);

  const basculerSection = (cle: string) => setSectionsRepliees(prev => {
    const s = new Set(prev);
    if (s.has(cle)) s.delete(cle); else s.add(cle);
    return s;
  });

  const masquerBandeau = () => {
    setBandeauMasque(true);
    try { sessionStorage.setItem('pedaclic.cahier.bandeauClassement', 'masque'); } catch { /* noop */ }
  };

  const handleToggleEpingle = async (cahier: CahierTextes, e: React.MouseEvent) => {
    e.stopPropagation();
    try { await basculerEpingleCahier(cahier.id, !cahier.epingle); }
    catch { toast.error('Impossible d\'épingler ce cahier.'); }
  };

  /** Badges ajoutés aux cartes : établissement + 3 premières étiquettes */
  const renderBadgesOrganisateur = (cahier: CahierTextes) => {
    const etab = cahier.etablissementId ? etabsParId.get(cahier.etablissementId) : undefined;
    const tags = cahier.etiquettes ?? [];
    return (
      <>
        {etab && (
          <span className="badge-etab" title={etab.nom} style={{ '--org-couleur': etab.couleur } as React.CSSProperties}>
            <span className="org-point" aria-hidden="true" />
            {libelleCourtEtablissement(etab)}
          </span>
        )}
        {tags.slice(0, 3).map(t => <span key={t} className="org-puce-etiquette">#{t}</span>)}
        {tags.length > 3 && <span className="org-puce-etiquette">+{tags.length - 3}</span>}
      </>
    );
  };

  // ── Progression ───────────────────────────────────────────
  const progressionPct = (cahier: CahierTextes) =>
    cahier.nombreSeancesPrevu > 0
      ? Math.min(100, Math.round((cahier.nombreSeancesRealise / cahier.nombreSeancesPrevu) * 100))
      : 0;

  // ─────────────────────────────────────────────────────────
  return (
    <div className="cahier-textes-page">
      {/* ── En-tête ── */}
      <div className="cahier-page-header">
        <div>
          <h1 className="cahier-page-title">📒 Cahier de Textes</h1>
          <p className="cahier-page-subtitle">Organisez et planifiez votre enseignement</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn-secondary"
            onClick={() => { setEdtClasse(undefined); setEdtEtab(undefined); setEdtVue(undefined); setEdtOpen(true); }}
          >
            📅 Emploi du temps
          </button>
          {/* Phase 54 — Espace classe : annonces, forum, messages privés */}
          <button
            className="btn-secondary"
            onClick={() => navigate('/prof/communication')}
            title="Communiquer avec vos élèves (annonces, forum, messages privés)"
          >
            💬 Espace classe
          </button>
          <button className="btn-primary" onClick={handleNouveauCahier}>
            + Nouveau cahier
          </button>
        </div>
      </div>

      {/* ── Phase 48 — Mes cours d'aujourd'hui (tous établissements) ── */}
      {currentUser?.uid && (
        <EdtAujourdhui
          profId={currentUser.uid}
          annee={anneeCourante}
          etablissements={etablissements}
          cahiers={cahiers} /* Phase 52 — séance saisie ou à saisir */
          onOuvrirCahier={handleOuvrirCahierDepuisCreneau}
          onVoirSemaine={() => { setEdtClasse(undefined); setEdtEtab(undefined); setEdtVue('ma-semaine'); setEdtOpen(true); }}
        />
      )}

      {/* ── Filtres ── */}
      <div className="cahier-filtres">
        <label style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>Année scolaire :</label>
        <select
          className="filtre-select"
          value={filtreAnnee}
          onChange={e => { filtreAnneeChoisi.current = true; setFiltreAnnee(e.target.value); }}
        >
          <option value="">Toutes les années</option>
          {/* Phase 45 : années actives (admin) + année en cours + sélection actuelle */}
          {anneesPourSelect(anneesConfig, anneeCourante, [filtreAnnee]).map(a => (
            <option key={a} value={a}>{a}{a === anneeCourante ? ' (en cours)' : ''}</option>
          ))}
        </select>
        <div className="cahier-filtres-archive" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginLeft: '1.5rem' }}>
          <button
            type="button"
            className={`filtre-btn ${filtreArchive === 'actif' ? 'active' : ''}`}
            onClick={() => setFiltreArchive('actif')}
          >
            Actifs ({cahiers.filter(c => !(c.isArchived ?? false)).length})
          </button>
          <button
            type="button"
            className={`filtre-btn ${filtreArchive === 'archive' ? 'active' : ''}`}
            onClick={() => setFiltreArchive('archive')}
          >
            Archivés ({cahiers.filter(c => c.isArchived ?? false).length})
          </button>
          <button
            type="button"
            className={`filtre-btn ${filtreArchive === 'tous' ? 'active' : ''}`}
            onClick={() => setFiltreArchive('tous')}
          >
            Tous ({cahiers.length})
          </button>
        </div>
        {/* Toggle grille / liste */}
        <div className="cahier-vue-toggle">
          <button
            type="button"
            className={`vue-toggle-btn ${vueMode === 'grille' ? 'active' : ''}`}
            onClick={() => setVueMode('grille')}
            title="Vue grille"
            aria-label="Vue grille"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
          </button>
          <button
            type="button"
            className={`vue-toggle-btn ${vueMode === 'liste' ? 'active' : ''}`}
            onClick={() => setVueMode('liste')}
            title="Vue liste"
            aria-label="Vue liste"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1.5" width="14" height="3" rx="1"/><rect x="1" y="6.5" width="14" height="3" rx="1"/><rect x="1" y="11.5" width="14" height="3" rx="1"/></svg>
          </button>
        </div>
      </div>

      {/* ── Phase 46 — Organisateur : filtres établissement / niveau / étiquettes ── */}
      <OrganisateurFiltres
        filtres={filtresOrg}
        onChange={setFiltresOrg}
        etablissements={etabsPourFiltre}
        compteurs={compteursEtab}
        matieres={matieresPresentes}
        etiquettes={etiquettesPresentes}
        onGererEtablissements={() => { setEtabDepuisForm(false); setShowEtabManager(true); }}
        onClasserEnLot={() => setShowClassementLot(true)}
      />

      {/* ── Phase 46 — Bandeau de rattrapage des cahiers non classés ── */}
      {!loading && !bandeauMasque && nbNonClasses > 0 && (
        <div className="org-bandeau" role="status">
          <span>
            🗂️ <strong>{nbNonClasses} cahier{nbNonClasses > 1 ? 's' : ''}</strong>{' '}
            {nbNonClasses > 1 ? 'ne sont rattachés' : 'n\'est rattaché'} à aucun établissement.
          </span>
          <div className="org-bandeau-actions">
            <button type="button" className="btn-primary" onClick={() => setShowClassementLot(true)}>
              Les classer
            </button>
            <button type="button" className="org-bandeau-fermer" onClick={masquerBandeau}>
              Plus tard
            </button>
          </div>
        </div>
      )}

      {/* ── Contenu ── */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner-circle" /></div>
      ) : cahiersFiltres.length > 0 && cahiersAffiches.length === 0 ? (
        /* Phase 46 — des cahiers existent mais aucun ne correspond aux filtres */
        <div className="empty-state">
          <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '0.75rem' }}>🔎</div>
          <h3>Aucun cahier ne correspond à ces filtres</h3>
          <button
            className="btn-secondary"
            style={{ marginTop: '1rem' }}
            onClick={() => setFiltresOrg({ ...filtresVides(), regroupement: filtresOrg.regroupement })}
          >
            ✕ Réinitialiser les filtres
          </button>
        </div>
      ) : cahiersFiltres.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '0.75rem' }}>📒</div>
          <h3>{filtreArchive === 'archive' ? 'Aucun cahier archivé' : 'Aucun cahier pour ' + (filtreAnnee || 'cette période')}</h3>
          <p>{filtreArchive === 'archive'
            ? 'Vos cahiers archivés apparaîtront ici.'
            : 'Créez votre premier cahier de textes pour commencer à planifier votre enseignement.'}</p>
          <button className="btn-primary" onClick={handleNouveauCahier} style={{ marginTop: '1rem' }}>
            + Créer mon premier cahier
          </button>
        </div>
      ) : (
        /* Phase 46 — une section repliable par établissement / niveau */
        <div className="org-groupes">
        {groupesCahiers.map(groupe => {
          const replie = sectionsRepliees.has(groupe.cle);
          return (
          <section
            key={groupe.cle}
            className={`org-section ${replie ? 'org-section--repliee' : ''}`}
            style={{ '--org-couleur': groupe.couleur } as React.CSSProperties}
          >
            {/* En-tête masqué en mode « Aucun » regroupement */}
            {groupe.titre && (
              <button
                type="button"
                className="org-section-entete"
                onClick={() => basculerSection(groupe.cle)}
                aria-expanded={!replie}
              >
                <span className="org-chevron" aria-hidden="true">▾</span>
                <h2>{groupe.titre}</h2>
                {groupe.sousTitre && <span className="org-section-sous-titre">{groupe.sousTitre}</span>}
                <span className="org-section-nb">
                  {groupe.cahiers.length} cahier{groupe.cahiers.length > 1 ? 's' : ''}
                </span>
              </button>
            )}
            {!replie && (
        <div className={vueMode === 'grille' ? 'cahiers-grid' : 'cahiers-liste'}>
          {groupe.cahiers.map(cahier => {
            const pct = progressionPct(cahier);
            const isArchived = cahier.isArchived ?? false;

            /* ══════ Vue Liste ══════ */
            if (vueMode === 'liste') {
              return (
                <div
                  key={cahier.id}
                  className={`cahier-row ${isArchived ? 'cahier-row--archived' : ''}`}
                  onClick={() => navigate(`/prof/cahiers/${cahier.id}`)}
                >
                  <div className="cahier-row-color" style={{ background: cahier.couleur }} />
                  <div className="cahier-row-main">
                    <div className="cahier-row-top">
                      <h3 className="cahier-row-titre">{cahier.epingle && <span className="org-epingle-marque" aria-label="Épinglé">📌</span>}{cahier.titre}</h3>
                      <div className="cahier-row-badges">
                        <span className="badge-classe">{libelleClasse(cahier)}</span>
                        <span className="badge-matiere">{cahier.matiere}</span>
                        {renderBadgesOrganisateur(cahier)}
                        <span className="badge-annee">{cahier.anneeScolaire}</span>
                        {isArchived && <span className="badge-archive">📦 Archivé</span>}
                        {(cahier.groupeIds?.length ?? 0) > 0 && (
                          <span className={`badge-partage ${cahier.isPartage ? 'actif' : ''}`}>
                            {cahier.isPartage ? '👁️' : '🔒'} {cahier.groupeIds.length} gr.
                          </span>
                        )}
                      </div>
                    </div>
                    {cahier.description && (
                      <p className="cahier-row-desc">
                        {cahier.description.substring(0, 100)}{cahier.description.length > 100 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <div className="cahier-row-progress">
                    <div className="cahier-row-progress-bar-bg">
                      <div className="cahier-row-progress-bar-fill" style={{ width: `${pct}%`, background: cahier.couleur }} />
                    </div>
                    <span className="cahier-row-progress-label">{pct}% · {cahier.nombreSeancesRealise}/{cahier.nombreSeancesPrevu}</span>
                  </div>
                  <div className="cahier-row-date">
                    {cahier.updatedAt?.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) || '—'}
                  </div>
                  <div className="cahier-row-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className={`btn-icon-sm ${cahier.epingle ? 'org-epingle--active' : ''}`}
                      onClick={e => handleToggleEpingle(cahier, e)}
                      title={cahier.epingle ? 'Désépingler' : 'Épingler en tête'}
                      aria-pressed={!!cahier.epingle}
                    >
                      📌
                    </button>
                    <button className="btn-icon-sm" onClick={e => handleToggleArchive(cahier, e)} title={isArchived ? 'Restaurer' : 'Archiver'}>
                      {isArchived ? '↩️' : '📦'}
                    </button>
                    <button className="btn-icon-sm" onClick={e => handleEditCahier(cahier, e)} title="Modifier">✏️</button>
                    <button className="btn-icon-sm btn-icon-sm--danger" onClick={e => handleDelete(cahier, e)} title="Supprimer">🗑️</button>
                  </div>
                </div>
              );
            }

            /* ══════ Vue Grille (compacte) ══════ */
            return (
              <div
                key={cahier.id}
                className={`cahier-card cahier-card--compact ${isArchived ? 'cahier-card-archived' : ''}`}
                onClick={() => navigate(`/prof/cahiers/${cahier.id}`)}
              >
                <div className="cahier-card-color-bar" style={{ background: cahier.couleur }} />

                <div className="cahier-card-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="cahier-card-titre">{cahier.epingle && <span className="org-epingle-marque" aria-label="Épinglé">📌</span>}{cahier.titre}</h3>
                    <div className="cahier-card-meta">
                      <span className="badge-classe">{libelleClasse(cahier)}</span>
                      <span className="badge-matiere">{cahier.matiere}</span>
                        {renderBadgesOrganisateur(cahier)}
                      <span className="badge-annee">{cahier.anneeScolaire}</span>
                      {isArchived && <span className="badge-archive">📦</span>}
                    </div>
                    {(cahier.groupeIds?.length ?? 0) > 0 && (
                      <span className={`badge-partage ${cahier.isPartage ? 'actif' : ''}`} style={{ marginTop: 4, display: 'inline-flex', fontSize: '0.68rem' }}>
                        {cahier.isPartage ? '👁️' : '🔒'} {cahier.groupeIds.length} groupe{cahier.groupeIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="cahier-card-body cahier-card-body--compact">
                  {cahier.description && (
                    <p className="cahier-card-desc-compact">
                      {cahier.description.substring(0, 60)}{cahier.description.length > 60 ? '…' : ''}
                    </p>
                  )}
                  <div className="progression-bar-wrap">
                    <div className="progression-label">
                      <span>Progression</span>
                      <span style={{ fontWeight: 700, color: cahier.couleur }}>{pct}%</span>
                    </div>
                    <div className="progression-bar-bg">
                      <div className="progression-bar-fill" style={{ width: `${pct}%`, background: cahier.couleur }} />
                    </div>
                    <div className="progression-seances-label">
                      {cahier.nombreSeancesRealise} / {cahier.nombreSeancesPrevu} séances
                    </div>
                  </div>
                </div>

                <div className="cahier-card-footer cahier-card-footer--compact">
                  <span className="cahier-card-date">
                    {cahier.updatedAt?.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) || '—'}
                  </span>
                  <div className="cahier-actions">
                    <button
                      className={`btn-icon-sm ${cahier.epingle ? 'org-epingle--active' : ''}`}
                      onClick={e => handleToggleEpingle(cahier, e)}
                      title={cahier.epingle ? 'Désépingler' : 'Épingler en tête'}
                      aria-pressed={!!cahier.epingle}
                    >
                      📌
                    </button>
                    <button className="btn-icon-sm" onClick={e => handleToggleArchive(cahier, e)} title={isArchived ? 'Restaurer' : 'Archiver'}>
                      {isArchived ? '↩️' : '📦'}
                    </button>
                    <button className="btn-icon-sm" onClick={e => handleEditCahier(cahier, e)} title="Modifier">✏️</button>
                    <button className="btn-icon-sm btn-icon-sm--danger" onClick={e => handleDelete(cahier, e)} title="Supprimer">🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
            )}
          </section>
          );
        })}
        </div>
      )}

      {/* ── Modal création/édition ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">
              📒 {editCahier ? 'Modifier le cahier' : 'Nouveau cahier de textes'}
            </h2>

            <form onSubmit={handleSubmit}>
              {/* Classe + Matière */}
              
              {/* Classe + Matière */}
<div className="form-row">
  {/* Classe : liste STATIQUE (référentiel fixe) */}
  <div className="form-group">
    <label className="form-label">Classe *</label>
    <select
      className="form-select"
      value={form.classe}
      onChange={e => setForm(f => ({ ...f, classe: e.target.value as Classe }))}
      required
    >
      {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  </div>

  {/* Matière : liste DYNAMIQUE depuis Firestore (admin) */}
  <div className="form-group">
    <label className="form-label">Matière *</label>
    <select
      className="form-select"
      value={form.matiere}
      onChange={e => setForm(f => ({ ...f, matiere: e.target.value as Matiere }))}
      required
      disabled={loadingDisciplines}
    >
      <option value="">
        {loadingDisciplines ? 'Chargement…' : '— Sélectionner —'}
      </option>
      {matieresDispos.map(o => (
        <option key={o.valeur} value={o.valeur}>{o.label}</option>
      ))}
      {/* Fallback : matière existante absente de Firestore */}
      {form.matiere && !matieresDispos.find(o => o.valeur === form.matiere) && (
        <option value={form.matiere}>{form.matiere}</option>
      )}
    </select>
  </div>
</div>

              {/* Année scolaire */}
              <div className="form-group">
                <label className="form-label">Année scolaire *</label>
                <select
                  className="form-select"
                  value={form.anneeScolaire}
                  onChange={e => setForm(f => ({ ...f, anneeScolaire: e.target.value as AnneeScolaire }))}
                >
                  {/* Phase 45 : on conserve l'année d'un cahier existant même si elle a été désactivée */}
                  {anneesPourSelect(anneesConfig, anneeCourante, [form.anneeScolaire]).map(a => (
                    <option key={a} value={a}>{a}{a === anneeCourante ? ' (en cours)' : ''}</option>
                  ))}
                </select>
              </div>

              {/* ── Phase 46 : Établissement + division ── */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="cahier-etab">Établissement</label>
                  <select
                    id="cahier-etab"
                    className="form-select"
                    value={form.etablissementId ?? ''}
                    onChange={e => {
                      const etab = etabsParId.get(e.target.value);
                      setForm(f => ({ ...f, etablissementId: etab?.id ?? null, etablissementNom: etab?.nom ?? '' }));
                    }}
                  >
                    <option value="">— Non classé —</option>
                    {etabsActifs.map(et => <option key={et.id} value={et.id}>{et.nom}</option>)}
                    {/* Établissement archivé déjà rattaché : reste affiché */}
                    {form.etablissementId && !etabsActifs.some(et => et.id === form.etablissementId) && (
                      <option value={form.etablissementId}>{form.etablissementNom} (archivé)</option>
                    )}
                  </select>
                  <button
                    type="button"
                    className="org-lien-ajout"
                    onClick={() => { setEtabDepuisForm(true); setShowEtabManager(true); }}
                  >
                    + Nouvel établissement
                  </button>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="cahier-division">Division</label>
                  <input
                    id="cahier-division"
                    className="form-input"
                    maxLength={12}
                    placeholder="Ex : A, B, L1, S2"
                    value={form.division ?? ''}
                    onChange={e => setForm(f => ({ ...f, division: e.target.value }))}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
                    Affiché « {form.classe}{form.division?.trim() ? ` ${form.division.trim()}` : ''} »
                  </span>
                </div>
              </div>

              {/* ── Phase 46 : Étiquettes libres ── */}
              <div className="form-group">
                <label className="form-label">
                  Étiquettes <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optionnel — Entrée pour valider)</span>
                </label>
                <EtiquettesInput
                  value={form.etiquettes ?? []}
                  onChange={etiquettes => setForm(f => ({ ...f, etiquettes }))}
                  suggestions={etiquettesPresentes}
                />
              </div>

              {/* Titre */}
              <div className="form-group">
                <label className="form-label">Titre personnalisé</label>
                <input
                  className="form-input"
                  placeholder={`Ex: Maths 3ème A - ${form.anneeScolaire}`}
                  value={form.titre}
                  onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                />
              </div>

              {/* Séances prévues + séances par jour */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nombre de séances prévues</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="200"
                    value={form.nombreSeancesPrevu}
                    onChange={e => setForm(f => ({ ...f, nombreSeancesPrevu: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Séances par jour</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1"
                    max="6"
                    value={form.seancesParJour ?? 1}
                    onChange={e => setForm(f => ({ ...f, seancesParJour: Math.max(1, Math.min(6, Number(e.target.value))) }))}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
                    {(form.seancesParJour ?? 1) > 1
                      ? `${form.seancesParJour} séances par jour — les entrées seront regroupées`
                      : '1 séance par jour (défaut)'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description / Objectifs (optionnel)</label>
                <textarea
                  className="form-textarea"
                  placeholder="Objectifs généraux, groupe classe, notes..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Couleur */}
              <div className="form-group">
                <label className="form-label">Couleur du cahier</label>
                <div className="couleur-picker">
                  {COULEURS_CAHIER.map(c => (
                    <div
                      key={c}
                      className={`couleur-option ${form.couleur === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setForm(f => ({ ...f, couleur: c }))}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* ── Phase 22 : Sélecteur groupes classes ── */}
              <div className="form-group">
                <label className="form-label">
                  Groupes classes liés{' '}
                  <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optionnel)</span>
                </label>

                {groupesDispos.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: 0 }}>
                    Aucun groupe créé.{' '}
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '0.82rem' }}
                      onClick={() => navigate('/prof/groupes')}
                    >
                      Créer un groupe →
                    </button>
                  </p>
                ) : (
                  /* Liste déroulante multi-sélection */
                  <div className="groupe-selector">
                    {groupesDispos.map(groupe => {
                      const selectionne = groupesSelectionnes.includes(groupe.id);
                      return (
                        <div
                          key={groupe.id}
                          className={`groupe-option ${selectionne ? 'selected' : ''}`}
                          onClick={() => handleToggleGroupe(groupe.id)}
                        >
                          <input type="checkbox" checked={selectionne} readOnly tabIndex={-1} />
                          <span>
                            <strong>{groupe.nom}</strong> — {groupe.classe} ({groupe.anneeScolaire})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tags des groupes sélectionnés */}
                {groupesSelectionnes.length > 0 && (
                  <div className="groupes-tags">
                    {groupesSelectionnes.map(gId => {
                      const g = groupesDispos.find(x => x.id === gId);
                      return g ? (
                        <span key={gId} className="groupe-tag">
                          {g.nom}
                          <button
                            type="button"
                            onClick={() => handleToggleGroupe(gId)}
                            aria-label={`Retirer ${g.nom}`}
                          >
                            ✕
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}

                {/* Toggle visibilité élèves */}
                {groupesSelectionnes.length > 0 && (
                  <label className="toggle-partage" style={{ marginTop: 10 }}>
                    <input
                      type="checkbox"
                      checked={form.isPartage ?? false}
                      onChange={e => setForm(f => ({ ...f, isPartage: e.target.checked }))}
                    />
                    <span>👁️ Rendre visible aux élèves des groupes liés</span>
                  </label>
                )}
              </div>
              {/* ── fin Phase 22 ── */}

              {/* Conditionnement : emploi du temps requis (point 1) */}
              {besoinEmploi && (
                <div className="edt-gate-warning">
                  <span>
                    ⚠️ Aucun emploi du temps pour la {form.classe}
                    {form.etablissementId ? ` — ${etabsParId.get(form.etablissementId)?.nom ?? form.etablissementNom}` : ''}.
                    Créez-le d'abord — les cahiers déjà existants ne sont pas affectés.
                  </span>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setEdtClasse(form.classe);
                      setEdtEtab(form.etablissementId ?? null); // Phase 48
                      setEdtVue('classe');
                      setEdtOpen(true);
                    }}
                  >
                    📅 Créer l'emploi du temps
                  </button>
                </div>
              )}

              {/* Erreur */}
              {error && (
                <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem', background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
                  {error}
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : editCahier ? 'Mettre à jour' : 'Créer le cahier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Phase 46 — Gestionnaire d'établissements (peut se superposer à la modale) ── */}
      {showEtabManager && currentUser?.uid && (
        <EtablissementManager
          profId={currentUser.uid}
          etablissements={etablissements}
          compteurs={compteursEtab}
          ouvrirEnAjout={etabDepuisForm}
          onClose={() => setShowEtabManager(false)}
          onCree={etab => {
            // Ouvert depuis le formulaire : on présélectionne et on y revient
            if (etabDepuisForm) {
              setForm(f => ({ ...f, etablissementId: etab.id, etablissementNom: etab.nom }));
              setShowEtabManager(false);
            }
          }}
        />
      )}

      {/* ── Phase 46 — Classement des cahiers en lot ── */}
      {showClassementLot && (
        <ClassementLotModal
          cahiers={cahiersFiltres}
          etablissements={etabsActifs}
          onClose={() => setShowClassementLot(false)}
          onGererEtablissements={() => {
            setShowClassementLot(false);
            setEtabDepuisForm(false);
            setShowEtabManager(true);
          }}
        />
      )}

      {/* Fenêtre flottante — Emploi du temps (points 2, 3, 4) */}
      <EmploiDuTempsDrawer
        open={edtOpen}
        onClose={() => setEdtOpen(false)}
        profId={currentUser?.uid || ''}
        profNom={currentUser?.displayName || ''}
        groupes={groupesDispos}
        etablissements={etabsActifs}
        initialClasse={edtClasse}
        initialAnnee={form.anneeScolaire}
        initialEtablissementId={edtEtab}
        initialVue={edtVue}
        onOuvrirCahier={handleOuvrirCahierDepuisCreneau}
      />
    </div>
  );
};

export default CahierTextesPage;

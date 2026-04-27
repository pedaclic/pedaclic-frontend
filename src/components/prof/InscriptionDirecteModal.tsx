// ============================================================
// PedaClic — InscriptionDirecteModal.tsx
// Modal permettant au prof d'inscrire directement un élève
// ayant déjà un compte PedaClic dans son groupe classe.
// www.pedaclic.sn
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  rechercherEleves,
  inscrireEleveDirect,
  desinscrireEleve,
  getAllInscriptionsGroupe,
  toggleStatutInscription,
  // Phase 34 — élève sans compte PedaClic
  inscrireEleveOffline,
  // Phase 36 — inscription en lot (saisie texte multi-lignes)
  inscrireElevesEnLot,
  // Correction / édition des noms d'élèves inscrits
  modifierInscription,
  // 🆕 Édition a posteriori du sexe d'un élève (pour les 87 élèves
  //    déjà inscrits avant l'introduction du champ).
  mettreAJourSexeInscription,
  type EleveResultat,
  type InscriptionGroupe,
  type InscriptionBulkResultat,
  type SexeEleve,
} from '../../services/inscriptionDirecteService';
import { useConfirm } from '../../contexts/ConfirmContext';
import '../../styles/InscriptionDirecte.css'; // Styles du modal

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface InscriptionDirecteModalProps {
  groupeId: string;
  groupeNom: string;
  profId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const DEBOUNCE_MS = 400;

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

const InscriptionDirecteModal: React.FC<InscriptionDirecteModalProps> = ({
  groupeId,
  groupeNom,
  profId,
  onClose,
  onSuccess,
}) => {
  const confirmDlg = useConfirm();
  // Phase 36 — 3e onglet "bulk" pour inscrire plusieurs élèves en une fois
  const [onglet, setOnglet] = useState<'recherche' | 'bulk' | 'liste'>('recherche');
  const [termeRecherche, setTermeRecherche] = useState('');
  const [resultats, setResultats] = useState<EleveResultat[]>([]);
  const [chargementRecherche, setChargementRecherche] = useState(false);
  const [erreurRecherche, setErreurRecherche] = useState<string | null>(null);
  const [inscrits, setInscrits] = useState<InscriptionGroupe[]>([]);
  const [chargementListe, setChargementListe] = useState(false);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [messageSucces, setMessageSucces] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Phase 34 — Formulaire d'inscription d'un élève sans compte PedaClic ──
  const [offlineNom, setOfflineNom] = useState('');
  const [offlineRemarque, setOfflineRemarque] = useState('');
  // 🆕 Sexe saisi par le prof pour l'élève sans compte (statistiques genrées)
  //    `undefined` = pas encore choisi ; valeur obligatoire à la saisie.
  const [offlineSexe, setOfflineSexe] = useState<SexeEleve | undefined>(undefined);
  const [offlineSexeAutre, setOfflineSexeAutre] = useState<string>('');
  const [offlineEnCours, setOfflineEnCours] = useState(false);
  const [offlineErreur, setOfflineErreur] = useState<string | null>(null);

  // ── Édition a posteriori du SEXE d'un élève inscrit ──────────────
  //   `editionSexeId` mémorise l'inscription en cours d'édition de sexe
  //   (différent de l'édition de nom). Permet au prof de saisir/corriger
  //   le sexe d'un élève pré-existant directement depuis la liste.
  const [editionSexeId, setEditionSexeId] = useState<string | null>(null);
  const [editionSexeValeur, setEditionSexeValeur] = useState<SexeEleve | undefined>(undefined);
  const [editionSexeAutre, setEditionSexeAutre] = useState<string>('');
  const [editionSexeEnCours, setEditionSexeEnCours] = useState(false);

  // ── Phase 36 — Inscription en lot (saisie texte multi-lignes) ──
  //   La zone de texte autorise le copier-coller depuis un tableur :
  //   une ligne par élève, champs séparés par ; , ou tabulation.
  const [bulkTexte, setBulkTexte] = useState('');
  const [bulkEnCours, setBulkEnCours] = useState(false);
  const [bulkResultats, setBulkResultats] = useState<InscriptionBulkResultat[] | null>(null);
  const [bulkErreur, setBulkErreur] = useState<string | null>(null);

  // ── Édition inline d'un nom/remarque existant ──
  //   On mémorise l'id de l'inscription en cours de modification + les
  //   valeurs en brouillon (nom, remarque) pour n'écrire en base qu'à la
  //   validation explicite (bouton ✓ ou Enter).
  const [editionInscriptionId, setEditionInscriptionId] = useState<string | null>(null);
  const [editionNom, setEditionNom] = useState('');
  const [editionRemarque, setEditionRemarque] = useState('');
  const [editionEnCours, setEditionEnCours] = useState(false);
  const [editionErreur, setEditionErreur] = useState<string | null>(null);

  const chargerInscrits = useCallback(async () => {
    setChargementListe(true);
    setErreurListe(null);
    try {
      const liste = await getAllInscriptionsGroupe(groupeId);
      setInscrits(liste);
    } catch (err) {
      console.error('[InscriptionDirecteModal] Erreur chargement inscrits:', err);
      setErreurListe('Impossible de charger la liste des élèves.');
    } finally {
      setChargementListe(false);
    }
  }, [groupeId]);

  useEffect(() => {
    chargerInscrits();
  }, [chargerInscrits]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (termeRecherche.trim().length < 2) {
      setResultats([]);
      setErreurRecherche(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setChargementRecherche(true);
      setErreurRecherche(null);
      try {
        const res = await rechercherEleves(termeRecherche, groupeId);
        setResultats(res);
        if (res.length === 0) {
          setErreurRecherche('Aucun élève trouvé pour cette recherche.');
        }
      } catch (err) {
        console.error('[InscriptionDirecteModal] Erreur recherche:', err);
        setErreurRecherche('Erreur lors de la recherche. Vérifiez votre connexion.');
      } finally {
        setChargementRecherche(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [termeRecherche, groupeId]);

  /**
   * Inscrit un élève existant (compte PedaClic) — sans recharger la liste.
   *
   *   ⚡ Optimistic update : on construit l'objet `InscriptionGroupe`
   *      directement à partir des données déjà connues + de l'ID retourné
   *      par `inscrireEleveDirect`, et on l'ajoute en tête de la liste
   *      `inscrits`. Le compteur 📋 « Élèves inscrits » s'incrémente,
   *      la carte de recherche passe en « ✓ Inscrit ».
   *
   *   En cas d'erreur, on retombe sur un rechargement complet pour
   *   resynchroniser proprement (rare).
   */
  const handleInscrire = async (eleve: EleveResultat) => {
    if (actionEnCours) return;
    setActionEnCours(eleve.uid);
    setMessageSucces(null);
    try {
      const inscriptionId = await inscrireEleveDirect(groupeId, eleve, profId);
      // Marqueur « déjà inscrit » sur la carte de recherche correspondante
      setResultats((prev) =>
        prev.map((e) => (e.uid === eleve.uid ? { ...e, dejaInscrit: true, inscriptionId } : e)),
      );
      // Ajout local immédiat — pas d'appel Firestore supplémentaire pour
      // recharger toute la liste. Les champs sexe/email seront pris depuis
      // le doc `users/{uid}` au prochain rechargement complet (rare).
      const nouvelleInscription: InscriptionGroupe = {
        id: inscriptionId,
        groupeId,
        eleveId: eleve.uid,
        eleveNom: eleve.displayName,
        eleveEmail: eleve.email,
        profId,
        dateInscription: { toDate: () => new Date() } as unknown as InscriptionGroupe['dateInscription'],
        statut: 'actif',
        sourceInscription: 'direct',
      };
      setInscrits((prev) => [nouvelleInscription, ...prev]);
      setMessageSucces(`✅ ${eleve.displayName} a été inscrit dans ${groupeNom}.`);
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'inscription.';
      setErreurRecherche(message);
      // Resync sécuritaire en cas d'erreur (write partiel possible)
      chargerInscrits().catch(() => {});
    } finally {
      setActionEnCours(null);
    }
  };

  const handleDesinscrire = async (inscription: InscriptionGroupe) => {
    if (actionEnCours) return;
    const confirme = await confirmDlg({ title: 'Retirer l\'\u00e9l\u00e8ve ?', message: `Retirer ${inscription.eleveNom} du groupe "${groupeNom}" ? Son historique sera conservé.`, confirmLabel: 'Retirer', variant: 'warning' });
    if (!confirme) return;

    setActionEnCours(inscription.id);
    setMessageSucces(null);
    setErreurListe(null);
    try {
      await desinscrireEleve(inscription.id, groupeId);
      setMessageSucces(`✅ ${inscription.eleveNom} a été retiré du groupe.`);
      setInscrits(prev => prev.filter(i => i.id !== inscription.id));
      setResultats(prev =>
        prev.map(e =>
          e.uid === inscription.eleveId ? { ...e, dejaInscrit: false, inscriptionId: undefined } : e
        )
      );
      onSuccess?.();
    } catch (err) {
      console.error('[InscriptionDirecteModal] Erreur désinscription:', err);
      setErreurListe('Erreur lors de la désinscription.');
    } finally {
      setActionEnCours(null);
    }
  };

  // ── Phase 34 — Ajout d'un élève "offline" (sans compte PedaClic) ──
  //   Permet au prof de tenir à jour absences et notes même si l'élève
  //   n'a pas encore créé son compte. Crée une inscription virtuelle
  //   dans inscriptions_groupe avec un id synthétique.
  //
  //   🆕 Le sexe est OBLIGATOIRE ici (pour alimenter les stats genrées) ;
  //      l'élève n'ayant pas de compte, c'est l'unique opportunité de
  //      capturer cette donnée. Si « Autre » est choisi, on exige aussi
  //      la précision libre.
  const handleInscrireOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (offlineEnCours) return;
    setOfflineErreur(null);
    const nomPropre = offlineNom.trim();
    if (nomPropre.length < 2) {
      setOfflineErreur('Le nom doit contenir au moins 2 caractères.');
      return;
    }
    if (!offlineSexe) {
      setOfflineErreur('Veuillez préciser le sexe (M / F / Autre).');
      return;
    }
    if (offlineSexe === 'autre' && !offlineSexeAutre.trim()) {
      setOfflineErreur('Veuillez préciser le libellé pour « Autre ».');
      return;
    }
    setOfflineEnCours(true);
    try {
      // Le service génère et retourne l'ID Firestore de la nouvelle inscription.
      const inscriptionId = await inscrireEleveOffline(
        groupeId,
        nomPropre,
        profId,
        offlineRemarque || undefined,
        offlineSexe,
        offlineSexe === 'autre' ? offlineSexeAutre.trim() : undefined,
      );

      // ⚡ Optimistic update : on construit localement l'objet et on
      //    l'insère en tête de liste, sans relire Firestore (gain de
      //    plusieurs centaines de ms et UX fluide pour les saisies en série).
      const remarqueFinale = offlineRemarque.trim() || undefined;
      const nouvelleInscription: InscriptionGroupe = {
        id: inscriptionId,
        groupeId,
        // L'élève offline n'a pas d'UID Firebase ; on n'en a pas besoin
        // ici puisque seules les opérations sur l'inscription comptent.
        eleveId: `offline:${inscriptionId}`,
        eleveNom: nomPropre,
        eleveEmail: '',
        eleveSexe: offlineSexe,
        eleveSexeAutre: offlineSexe === 'autre' ? offlineSexeAutre.trim() : undefined,
        profId,
        dateInscription: { toDate: () => new Date() } as unknown as InscriptionGroupe['dateInscription'],
        statut: 'actif',
        sourceInscription: 'offline',
        isOffline: true,
        ...(remarqueFinale ? { remarque: remarqueFinale } : {}),
      };
      setInscrits((prev) => [nouvelleInscription, ...prev]);

      setMessageSucces(`✅ ${nomPropre} a été ajouté dans ${groupeNom} (sans compte PedaClic).`);
      // Reset des champs pour permettre un enchaînement rapide d'inscriptions
      setOfflineNom('');
      setOfflineRemarque('');
      setOfflineSexe(undefined);
      setOfflineSexeAutre('');
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'ajout.';
      setOfflineErreur(message);
      // Resync sécuritaire si l'erreur est intervenue après l'écriture
      chargerInscrits().catch(() => {});
    } finally {
      setOfflineEnCours(false);
    }
  };

  // ── Édition a posteriori du SEXE d'un élève déjà inscrit ──────────
  //   Ouvre un mini-formulaire au-dessus de la ligne. Idempotent : si
  //   l'utilisateur valide sans changement, on évite l'écriture Firestore.
  const commencerEditionSexe = (inscription: InscriptionGroupe) => {
    setEditionSexeId(inscription.id);
    setEditionSexeValeur(inscription.eleveSexe);
    setEditionSexeAutre(inscription.eleveSexeAutre || '');
  };

  const annulerEditionSexe = () => {
    setEditionSexeId(null);
    setEditionSexeValeur(undefined);
    setEditionSexeAutre('');
  };

  const validerEditionSexe = async (inscription: InscriptionGroupe) => {
    if (editionSexeEnCours) return;
    // Validation : si « Autre », on exige une précision libre.
    if (editionSexeValeur === 'autre' && !editionSexeAutre.trim()) {
      setMessageSucces(null);
      // On réutilise l'erreur Liste (plus visible que de créer une 4e variable)
      setErreurListe('Veuillez préciser le libellé pour « Autre ».');
      return;
    }
    setEditionSexeEnCours(true);
    try {
      await mettreAJourSexeInscription(
        inscription.id,
        editionSexeValeur ?? null,
        editionSexeValeur === 'autre' ? editionSexeAutre.trim() : null,
      );
      // Mise à jour optimiste (pas de rechargement complet : économique)
      setInscrits((prev) =>
        prev.map((i) =>
          i.id === inscription.id
            ? {
                ...i,
                eleveSexe: editionSexeValeur,
                eleveSexeAutre:
                  editionSexeValeur === 'autre' ? editionSexeAutre.trim() : undefined,
              }
            : i,
        ),
      );
      setMessageSucces(`✏️ Sexe mis à jour pour ${inscription.eleveNom}.`);
      annulerEditionSexe();
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour du sexe.';
      setErreurListe(msg);
    } finally {
      setEditionSexeEnCours(false);
    }
  };

  // ── Édition inline du nom/remarque d'un élève inscrit ──
  const commencerEdition = (inscription: InscriptionGroupe) => {
    setEditionInscriptionId(inscription.id);
    setEditionNom(inscription.eleveNom || '');
    setEditionRemarque(inscription.remarque || '');
    setEditionErreur(null);
  };

  const annulerEdition = () => {
    setEditionInscriptionId(null);
    setEditionNom('');
    setEditionRemarque('');
    setEditionErreur(null);
  };

  const validerEdition = async (inscription: InscriptionGroupe) => {
    if (editionEnCours) return;
    const nomCible = editionNom.trim();
    // Sécurité : on refuse un nom quasi vide (risque de perdre l'identification)
    if (nomCible.length < 2) {
      setEditionErreur('Le nom doit contenir au moins 2 caractères.');
      return;
    }
    // Pas de modification utile → rien à faire (évite un write inutile)
    if (
      nomCible === (inscription.eleveNom || '') &&
      editionRemarque.trim() === (inscription.remarque || '').trim()
    ) {
      annulerEdition();
      return;
    }
    setEditionEnCours(true);
    setEditionErreur(null);
    try {
      await modifierInscription(inscription.id, {
        eleveNom: nomCible,
        remarque: editionRemarque,
      });
      // Mise à jour optimiste de la liste locale (pas besoin de recharger)
      setInscrits((prev) =>
        prev.map((i) =>
          i.id === inscription.id
            ? { ...i, eleveNom: nomCible, remarque: editionRemarque.trim() || undefined }
            : i,
        ),
      );
      setMessageSucces(`✏️ Nom mis à jour : ${nomCible}.`);
      annulerEdition();
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la modification.';
      setEditionErreur(msg);
    } finally {
      setEditionEnCours(false);
    }
  };

  const handleToggleStatut = async (inscription: InscriptionGroupe) => {
    if (actionEnCours) return;
    const nouveauStatut = inscription.statut === 'actif' ? 'suspendu' : 'actif';
    setActionEnCours(inscription.id);
    try {
      await toggleStatutInscription(inscription.id, nouveauStatut);
      setInscrits(prev =>
        prev.map(i => (i.id === inscription.id ? { ...i, statut: nouveauStatut } : i))
      );
      setMessageSucces(
        nouveauStatut === 'suspendu'
          ? `⚠️ Accès de ${inscription.eleveNom} suspendu.`
          : `✅ Accès de ${inscription.eleveNom} réactivé.`
      );
    } catch (err) {
      console.error('[InscriptionDirecteModal] Erreur toggle statut:', err);
    } finally {
      setActionEnCours(null);
    }
  };

  // ── Phase 36 — Lancement du traitement en lot ─────────────────
  //   Parcourt les lignes, délègue au service, puis recharge la liste
  //   des inscrits et affiche un rapport détaillé ligne par ligne.
  const handleInscrireEnLot = async () => {
    if (bulkEnCours) return;
    setBulkErreur(null);
    setBulkResultats(null);

    // Découpage en lignes, normalisation des sauts de ligne
    const lignes = bulkTexte
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+$/g, ''))
      .filter((l) => l.trim().length > 0);

    if (lignes.length === 0) {
      setBulkErreur('Aucune ligne à traiter. Saisissez au moins un élève par ligne.');
      return;
    }
    if (lignes.length > 200) {
      // Garde-fou : 200 lignes est déjà énorme ; limite raisonnable pour
      // éviter une opération très lente qui mobiliserait le modal.
      setBulkErreur(`Trop de lignes (${lignes.length}). Limite : 200 élèves par lot.`);
      return;
    }

    setBulkEnCours(true);
    try {
      const resultats = await inscrireElevesEnLot(groupeId, profId, lignes);
      setBulkResultats(resultats);

      const nbOk = resultats.filter((r) => r.statut === 'success').length;
      const nbErr = resultats.filter((r) => r.statut === 'error').length;
      const nbSkip = resultats.filter((r) => r.statut === 'skipped').length;

      setMessageSucces(
        `✅ Lot terminé : ${nbOk} inscrit(s)` +
          (nbErr > 0 ? ` · ⚠️ ${nbErr} erreur(s)` : '') +
          (nbSkip > 0 ? ` · ⏭️ ${nbSkip} ignoré(s)` : '')
      );

      // Recharger la liste et prévenir le parent dès qu'au moins un succès
      if (nbOk > 0) {
        await chargerInscrits();
        onSuccess?.();
        // On vide la saisie pour ne pas relancer accidentellement le lot ;
        // le rapport reste visible tant que l'utilisateur ne le ferme pas.
        setBulkTexte('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du traitement du lot.';
      setBulkErreur(msg);
    } finally {
      setBulkEnCours(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ── Formatage date Firestore Timestamp
  const formatDate = (ts: { toDate?: () => Date }) => {
    try {
      const d = ts?.toDate?.();
      return d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    } catch {
      return '—';
    }
  };

  return (
    <div
      className="idm-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Inscription directe d'élèves"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="idm-modal">
        <div className="idm-header">
          <div className="idm-header__titre-wrapper">
            <span className="idm-header__icone">👥</span>
            <div>
              <h2 className="idm-header__titre">Gestion des élèves</h2>
              <p className="idm-header__sous-titre">{groupeNom}</p>
            </div>
          </div>
          <button className="idm-btn-fermer" onClick={onClose} aria-label="Fermer" title="Fermer (Echap)">✕</button>
        </div>

        {messageSucces && (
          <div className="idm-alerte idm-alerte--succes" role="alert">
            {messageSucces}
            <button className="idm-alerte__fermer" onClick={() => setMessageSucces(null)} aria-label="Fermer">✕</button>
          </div>
        )}

        <div className="idm-onglets" role="tablist">
          <button
            role="tab"
            aria-selected={onglet === 'recherche'}
            className={`idm-onglet ${onglet === 'recherche' ? 'idm-onglet--actif' : ''}`}
            onClick={() => setOnglet('recherche')}
          >
            🔍 Inscrire un élève
          </button>
          {/* Phase 36 — onglet "Inscription en lot" */}
          <button
            role="tab"
            aria-selected={onglet === 'bulk'}
            className={`idm-onglet ${onglet === 'bulk' ? 'idm-onglet--actif' : ''}`}
            onClick={() => setOnglet('bulk')}
          >
            ⚡ Inscription en lot
          </button>
          <button
            role="tab"
            aria-selected={onglet === 'liste'}
            className={`idm-onglet ${onglet === 'liste' ? 'idm-onglet--actif' : ''}`}
            onClick={() => setOnglet('liste')}
          >
            📋 Élèves inscrits
            {inscrits.length > 0 && <span className="idm-badge">{inscrits.length}</span>}
          </button>
        </div>

        <div className="idm-corps">
          {onglet === 'recherche' && (
            <div className="idm-panneau-recherche">
              <div className="idm-notice">
                <span className="idm-notice__icone">ℹ️</span>
                <p className="idm-notice__texte">
                  Recherchez l'élève par son <strong>adresse email</strong> ou son <strong>nom complet</strong>.
                  Seuls les comptes ayant le rôle <em>Élève</em> apparaissent.
                </p>
              </div>

              <div className="idm-champ-recherche">
                <span className="idm-champ-recherche__icone">🔍</span>
                <input
                  type="text"
                  className="idm-input"
                  placeholder="Email ou nom de l'élève…"
                  value={termeRecherche}
                  onChange={(e) => setTermeRecherche(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  aria-label="Rechercher un élève"
                />
                {termeRecherche && (
                  <button
                    className="idm-champ-recherche__effacer"
                    onClick={() => { setTermeRecherche(''); setResultats([]); }}
                    aria-label="Effacer la recherche"
                  >✕</button>
                )}
              </div>

              {chargementRecherche && (
                <div className="idm-chargement">
                  <span className="idm-spinner" aria-hidden="true" />
                  <span>Recherche en cours…</span>
                </div>
              )}

              {erreurRecherche && !chargementRecherche && (
                <p className="idm-texte-vide">{erreurRecherche}</p>
              )}

              {resultats.length > 0 && !chargementRecherche && (
                <ul className="idm-liste-resultats" role="list">
                  {resultats.map((eleve) => (
                    <li
                      key={eleve.uid}
                      className={`idm-carte-eleve ${eleve.dejaInscrit ? 'idm-carte-eleve--inscrit' : ''}`}
                    >
                      <div className="idm-carte-eleve__avatar" aria-hidden="true">
                        {eleve.photoURL
                          ? <img src={eleve.photoURL} alt="" className="idm-avatar-img" />
                          : <span className="idm-avatar-initiales">{eleve.displayName.charAt(0).toUpperCase()}</span>
                        }
                      </div>
                      <div className="idm-carte-eleve__infos">
                        <span className="idm-carte-eleve__nom">{eleve.displayName}</span>
                        <span className="idm-carte-eleve__email">{eleve.email}</span>
                        {eleve.classe && <span className="idm-badge idm-badge--classe">{eleve.classe}</span>}
                      </div>
                      <div className="idm-carte-eleve__action">
                        {eleve.dejaInscrit ? (
                          <span className="idm-badge idm-badge--deja-inscrit">✓ Inscrit</span>
                        ) : (
                          <button
                            className="idm-btn idm-btn--inscrire"
                            onClick={() => handleInscrire(eleve)}
                            disabled={actionEnCours === eleve.uid}
                            aria-label={`Inscrire ${eleve.displayName}`}
                          >
                            {actionEnCours === eleve.uid
                              ? <><span className="idm-spinner idm-spinner--sm" /> Inscription…</>
                              : '➕ Inscrire'
                            }
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {termeRecherche.length === 0 && (
                <div className="idm-etat-vide">
                  <span className="idm-etat-vide__icone">🎓</span>
                  <p>Saisissez au moins 2 caractères pour lancer la recherche.</p>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════
                  Phase 34 — Élève sans compte PedaClic (inscription offline)
                  Permet de tenir absences & notes à jour même si l'élève
                  n'a pas encore créé son compte.
                  ══════════════════════════════════════════════════════ */}
              <div className="idm-offline-card">
                <div className="idm-offline-card__titre">
                  <span aria-hidden="true">📝</span>
                  L'élève n'a pas (encore) de compte PedaClic ?
                </div>
                <p className="idm-offline-card__desc">
                  Inscrivez-le manuellement pour continuer à suivre ses <strong>absences</strong> et
                  ses <strong>notes</strong>. Vous pourrez relier son compte plus tard, dès qu'il
                  l'aura créé, via la recherche ci-dessus.
                </p>
                <form className="idm-offline-card__form" onSubmit={handleInscrireOffline}>
                  <input
                    type="text"
                    placeholder="Nom complet de l'élève *"
                    value={offlineNom}
                    onChange={e => setOfflineNom(e.target.value)}
                    maxLength={80}
                    required
                    aria-label="Nom complet de l'élève"
                  />
                  <input
                    type="text"
                    placeholder="Remarque (tuteur, téléphone — facultatif)"
                    value={offlineRemarque}
                    onChange={e => setOfflineRemarque(e.target.value)}
                    maxLength={120}
                    aria-label="Remarque facultative"
                  />

                  {/* ──────────────────────────────────────────────────
                      🆕 Sélection du SEXE — OBLIGATOIRE pour l'inscription
                      offline (l'élève n'a pas de compte, donc on ne pourra
                      pas récupérer la donnée plus tard automatiquement).
                      ────────────────────────────────────────────────── */}
                  <div
                    role="radiogroup"
                    aria-label="Sexe de l'élève"
                    style={{
                      gridColumn: '1 / -1',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      border: '1px dashed #d1d5db',
                      borderRadius: 6,
                      background: '#fff',
                    }}
                  >
                    <strong style={{ fontSize: '0.85rem', color: '#1f2937' }}>
                      Sexe <span style={{ color: '#b91c1c' }}>*</span>
                    </strong>
                    {/* Trois options M / F / Autre, alignées sur la palette
                        utilisée dans la carte « Répartition F/M » du dashboard. */}
                    {([
                      { v: 'M' as SexeEleve, label: '♂ Masculin', color: '#3b82f6' },
                      { v: 'F' as SexeEleve, label: '♀ Féminin', color: '#ec4899' },
                      { v: 'autre' as SexeEleve, label: '✱ Autre', color: '#6b7280' },
                    ]).map((opt) => (
                      <label
                        key={opt.v}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          border: `1px solid ${offlineSexe === opt.v ? opt.color : '#e5e7eb'}`,
                          borderRadius: 4,
                          background: offlineSexe === opt.v ? `${opt.color}15` : 'white',
                          color: offlineSexe === opt.v ? opt.color : '#374151',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="radio"
                          name="offlineSexe"
                          value={opt.v}
                          checked={offlineSexe === opt.v}
                          onChange={() => setOfflineSexe(opt.v)}
                          style={{ margin: 0 }}
                        />
                        {opt.label}
                      </label>
                    ))}
                    {/* Champ libre conditionnel (« Autre ») */}
                    {offlineSexe === 'autre' && (
                      <input
                        type="text"
                        placeholder="Précisez…"
                        value={offlineSexeAutre}
                        onChange={(e) => setOfflineSexeAutre(e.target.value)}
                        maxLength={40}
                        aria-label="Précision pour « Autre »"
                        style={{
                          flex: '1 1 140px',
                          padding: '4px 8px',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          fontSize: '0.85rem',
                        }}
                      />
                    )}
                  </div>

                  {offlineErreur && (
                    <p style={{ gridColumn: '1 / -1', margin: 0, color: '#b91c1c', fontSize: '0.78rem' }} role="alert">
                      ⚠️ {offlineErreur}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={offlineEnCours || offlineNom.trim().length < 2 || !offlineSexe}
                  >
                    {offlineEnCours ? '⏳ Ajout en cours…' : '➕ Ajouter cet élève (sans compte)'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              Phase 36 — Panneau "Inscription en lot"
              Saisie libre : 1 élève / ligne, séparateurs ; , ou \t
              Le service tente d'abord une inscription directe (si email
              → compte existant) puis retombe sur une inscription offline.
              ══════════════════════════════════════════════════════ */}
          {onglet === 'bulk' && (
            <div className="idm-panneau-bulk">
              <div className="idm-notice">
                <span className="idm-notice__icone">💡</span>
                <p className="idm-notice__texte">
                  Saisissez <strong>un élève par ligne</strong>. Formats acceptés :
                  <br />
                  <code>Nom Prénom</code> &nbsp;•&nbsp;
                  <code>email@domaine</code> &nbsp;•&nbsp;
                  <code>Nom Prénom ; F</code> &nbsp;•&nbsp;
                  <code>Nom Prénom ; email ; M</code> &nbsp;•&nbsp;
                  <code>Nom Prénom ; email ; F ; remarque</code>
                  <br />
                  {/* 🆕 Le sexe est détecté automatiquement quel que soit son
                      ordre dans la ligne. Synonymes acceptés ci-dessous. */}
                  <strong>Sexe</strong> (optionnel mais recommandé) :{' '}
                  <code>M</code>, <code>F</code>, <code>Masculin</code>, <code>Féminin</code>,{' '}
                  <code>Garçon</code>, <code>Fille</code> (insensible à la casse).
                  <br />
                  Séparateurs autorisés : <code>;</code>, <code>,</code> ou tabulation
                  (copier-coller depuis un tableur supporté).
                </p>
              </div>

              <label className="form-label" htmlFor="idm-bulk-textarea">
                Liste des élèves à inscrire
              </label>
              <textarea
                id="idm-bulk-textarea"
                className="idm-bulk-textarea"
                placeholder={`Exemple :\nDiop Awa ; F ; awa.diop@exemple.sn\nFall Moussa ; M ; ; tuteur 77 123 45 67\nmoussa.fall@exemple.sn ; M\nMbaye Fatou ; F`}
                value={bulkTexte}
                onChange={(e) => setBulkTexte(e.target.value)}
                rows={10}
                disabled={bulkEnCours}
                aria-label="Saisie en lot : un élève par ligne"
              />

              {/* Compteur et actions */}
              <div className="idm-bulk-actions">
                <span className="idm-bulk-count">
                  {bulkTexte.split(/\r?\n/).filter((l) => l.trim()).length} ligne(s) à traiter
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="idm-btn idm-btn--secondaire"
                    onClick={() => { setBulkTexte(''); setBulkResultats(null); setBulkErreur(null); }}
                    disabled={bulkEnCours || (!bulkTexte && !bulkResultats)}
                  >
                    ✕ Effacer
                  </button>
                  <button
                    type="button"
                    className="idm-btn idm-btn--inscrire"
                    onClick={handleInscrireEnLot}
                    disabled={bulkEnCours || bulkTexte.trim().length === 0}
                  >
                    {bulkEnCours
                      ? <><span className="idm-spinner idm-spinner--sm" /> Inscription en cours…</>
                      : '⚡ Lancer l\'inscription en lot'}
                  </button>
                </div>
              </div>

              {bulkErreur && (
                <p className="idm-texte-erreur" role="alert" style={{ marginTop: 12 }}>
                  ⚠️ {bulkErreur}
                </p>
              )}

              {/* ── Rapport détaillé ── */}
              {bulkResultats && bulkResultats.length > 0 && (
                <div className="idm-bulk-rapport" aria-live="polite">
                  <div className="idm-bulk-rapport__titre">
                    Rapport d'inscription ({bulkResultats.length} ligne(s))
                  </div>
                  <ul className="idm-bulk-rapport__liste" role="list">
                    {bulkResultats.map((r) => (
                      <li
                        key={r.ligne}
                        className={`idm-bulk-ligne idm-bulk-ligne--${r.statut}`}
                      >
                        <span className="idm-bulk-ligne__num">L{r.ligne}</span>
                        <span className="idm-bulk-ligne__icone" aria-hidden="true">
                          {r.statut === 'success' ? '✅' : r.statut === 'error' ? '⚠️' : '⏭️'}
                        </span>
                        <span className="idm-bulk-ligne__contenu">
                          <strong>{r.nom || r.email || r.contenuBrut}</strong>
                          {r.source && (
                            <span className="idm-bulk-ligne__source">
                              {r.source === 'direct' ? ' · 🔑 compte' : ' · 📝 offline'}
                            </span>
                          )}
                          <span className="idm-bulk-ligne__msg">{r.message}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {onglet === 'liste' && (
            <div className="idm-panneau-liste">
              {chargementListe && (
                <div className="idm-chargement">
                  <span className="idm-spinner" aria-hidden="true" />
                  <span>Chargement des élèves…</span>
                </div>
              )}

              {erreurListe && !chargementListe && (
                <p className="idm-texte-erreur">{erreurListe}</p>
              )}

              {!chargementListe && !erreurListe && inscrits.length === 0 && (
                <div className="idm-etat-vide">
                  <span className="idm-etat-vide__icone">📭</span>
                  <p>Aucun élève inscrit dans ce groupe pour le moment.</p>
                  <button className="idm-btn idm-btn--secondaire" onClick={() => setOnglet('recherche')}>
                    🔍 Inscrire le premier élève
                  </button>
                </div>
              )}

              {inscrits.length > 0 && !chargementListe && (
                <>
                  <p className="idm-liste-resume">
                    {inscrits.filter(i => i.statut === 'actif').length} élève(s) actif(s) sur {inscrits.length} inscrit(s)
                  </p>
                  <ul className="idm-liste-inscrits" role="list">
                    {inscrits.map((inscription) => {
                      const enEdition = editionInscriptionId === inscription.id;
                      return (
                      <li
                        key={inscription.id}
                        className={`idm-ligne-inscrit ${inscription.statut === 'suspendu' ? 'idm-ligne-inscrit--suspendu' : ''}`}
                      >
                        <div className="idm-carte-eleve__avatar" aria-hidden="true">
                          <span className="idm-avatar-initiales">
                            {inscription.eleveNom.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="idm-carte-eleve__infos" style={{ flex: 1 }}>
                          {/*
                            Deux modes d'affichage :
                              - Lecture   : nom + badges + méta (par défaut)
                              - Édition   : champs pour corriger nom & remarque
                            On n'écrit dans inscriptions_groupe qu'au clic sur ✓.
                          */}
                          {enEdition ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <input
                                type="text"
                                value={editionNom}
                                onChange={(e) => setEditionNom(e.target.value)}
                                disabled={editionEnCours}
                                autoFocus
                                maxLength={80}
                                placeholder="Nom complet de l'élève"
                                aria-label="Nom de l'élève"
                                style={{
                                  padding: '6px 10px',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 6,
                                  fontSize: '0.9rem',
                                }}
                                onKeyDown={(e) => {
                                  // Enter = valider ; Escape = annuler (UX classique)
                                  if (e.key === 'Enter') { e.preventDefault(); validerEdition(inscription); }
                                  else if (e.key === 'Escape') { e.preventDefault(); annulerEdition(); }
                                }}
                              />
                              <input
                                type="text"
                                value={editionRemarque}
                                onChange={(e) => setEditionRemarque(e.target.value)}
                                disabled={editionEnCours}
                                maxLength={120}
                                placeholder="Remarque (tuteur, téléphone — facultatif)"
                                aria-label="Remarque facultative"
                                style={{
                                  padding: '6px 10px',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                  fontSize: '0.85rem',
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); validerEdition(inscription); }
                                  else if (e.key === 'Escape') { e.preventDefault(); annulerEdition(); }
                                }}
                              />
                              {editionErreur && (
                                <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.78rem' }} role="alert">
                                  ⚠️ {editionErreur}
                                </p>
                              )}
                              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.72rem' }}>
                                ℹ️ La correction s'applique uniquement à l'affichage dans ce groupe.
                                {!inscription.isOffline && " Le profil global de l'élève n'est pas modifié."}
                              </p>
                            </div>
                          ) : editionSexeId === inscription.id ? (
                            // ─────────────────────────────────────────
                            // ÉDITION DU SEXE (a posteriori)
                            // ─────────────────────────────────────────
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span className="idm-carte-eleve__nom">{inscription.eleveNom}</span>
                              <div
                                role="radiogroup"
                                aria-label={`Sexe de ${inscription.eleveNom}`}
                                style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
                              >
                                {([
                                  { v: 'M' as SexeEleve, label: '♂ M', color: '#3b82f6' },
                                  { v: 'F' as SexeEleve, label: '♀ F', color: '#ec4899' },
                                  { v: 'autre' as SexeEleve, label: '✱ Autre', color: '#6b7280' },
                                ]).map((opt) => (
                                  <label
                                    key={opt.v}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '3px 8px',
                                      border: `1px solid ${editionSexeValeur === opt.v ? opt.color : '#e5e7eb'}`,
                                      borderRadius: 4,
                                      background: editionSexeValeur === opt.v ? `${opt.color}15` : 'white',
                                      color: editionSexeValeur === opt.v ? opt.color : '#374151',
                                      fontWeight: 600,
                                      fontSize: '0.78rem',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`editionSexe-${inscription.id}`}
                                      value={opt.v}
                                      checked={editionSexeValeur === opt.v}
                                      onChange={() => setEditionSexeValeur(opt.v)}
                                      style={{ margin: 0 }}
                                      disabled={editionSexeEnCours}
                                    />
                                    {opt.label}
                                  </label>
                                ))}
                                {editionSexeValeur === 'autre' && (
                                  <input
                                    type="text"
                                    placeholder="Précisez…"
                                    value={editionSexeAutre}
                                    onChange={(e) => setEditionSexeAutre(e.target.value)}
                                    maxLength={40}
                                    style={{
                                      padding: '4px 8px',
                                      border: '1px solid #d1d5db',
                                      borderRadius: 4,
                                      fontSize: '0.78rem',
                                      flex: '1 1 120px',
                                    }}
                                    disabled={editionSexeEnCours}
                                  />
                                )}
                              </div>
                              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.72rem' }}>
                                ℹ️ Stocké uniquement sur cette inscription (n'affecte pas le profil de l'élève).
                              </p>
                            </div>
                          ) : (
                            <>
                              <span className="idm-carte-eleve__nom">
                                {/* 🆕 Pictogramme sexe (♂/♀/✱) AVANT le nom — invisible
                                    si non renseigné. Couleur cohérente avec le dashboard. */}
                                {inscription.eleveSexe && (
                                  <span
                                    title={
                                      inscription.eleveSexe === 'M'
                                        ? 'Masculin'
                                        : inscription.eleveSexe === 'F'
                                          ? 'Féminin'
                                          : `Autre${inscription.eleveSexeAutre ? ' — ' + inscription.eleveSexeAutre : ''}`
                                    }
                                    style={{
                                      display: 'inline-block',
                                      marginRight: 6,
                                      color:
                                        inscription.eleveSexe === 'F'
                                          ? '#ec4899'
                                          : inscription.eleveSexe === 'M'
                                            ? '#3b82f6'
                                            : '#9ca3af',
                                      fontWeight: 700,
                                      fontSize: '1rem',
                                    }}
                                  >
                                    {inscription.eleveSexe === 'F'
                                      ? '♀'
                                      : inscription.eleveSexe === 'M'
                                        ? '♂'
                                        : '✱'}
                                  </span>
                                )}
                                {inscription.eleveNom}
                                {/* Phase 34 — marqueur "sans compte" */}
                                {inscription.isOffline && (
                                  <span
                                    className="idm-badge idm-badge--offline"
                                    style={{ marginLeft: 8, fontSize: '0.68rem' }}
                                    title="Élève sans compte PedaClic"
                                  >
                                    📝 Sans compte
                                  </span>
                                )}
                                {/* 🆕 Indicateur visuel quand le sexe n'est PAS renseigné :
                                    incite le prof à le saisir (en cliquant sur ⚧). */}
                                {!inscription.eleveSexe && (
                                  <span
                                    style={{
                                      marginLeft: 8,
                                      fontSize: '0.65rem',
                                      color: '#9ca3af',
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    sexe non renseigné
                                  </span>
                                )}
                              </span>
                              <span className="idm-carte-eleve__email">
                                {inscription.eleveEmail
                                  ? inscription.eleveEmail
                                  : (inscription.remarque ? `📌 ${inscription.remarque}` : <em style={{ color: '#9ca3af' }}>Aucun email enregistré</em>)}
                              </span>
                              <div className="idm-ligne-inscrit__meta">
                                <span className={`idm-badge ${inscription.statut === 'actif' ? 'idm-badge--actif' : 'idm-badge--suspendu'}`}>
                                  {inscription.statut === 'actif' ? '✓ Actif' : '⏸ Suspendu'}
                                </span>
                                <span className="idm-badge idm-badge--source">
                                  {inscription.sourceInscription === 'direct'
                                    ? '👨‍🏫 Prof'
                                    : inscription.sourceInscription === 'offline'
                                      ? '📝 Hors-ligne'
                                      : '🔑 Code'}
                                </span>
                                <span className="idm-date">
                                  Inscrit le {formatDate(inscription.dateInscription as { toDate?: () => Date })}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="idm-ligne-inscrit__actions">
                          {enEdition ? (
                            <>
                              {/* Boutons Valider / Annuler visibles en mode édition */}
                              <button
                                className="idm-btn idm-btn--reactiver"
                                onClick={() => validerEdition(inscription)}
                                disabled={editionEnCours || editionNom.trim().length < 2}
                                title="Enregistrer les corrections"
                                aria-label="Enregistrer"
                              >
                                {editionEnCours ? <span className="idm-spinner idm-spinner--sm" /> : '✓'}
                              </button>
                              <button
                                className="idm-btn idm-btn--retirer"
                                onClick={annulerEdition}
                                disabled={editionEnCours}
                                title="Annuler la modification"
                                aria-label="Annuler"
                              >
                                ✕
                              </button>
                            </>
                          ) : editionSexeId === inscription.id ? (
                            <>
                              {/* Boutons spécifiques à l'édition du SEXE */}
                              <button
                                className="idm-btn idm-btn--reactiver"
                                onClick={() => validerEditionSexe(inscription)}
                                disabled={
                                  editionSexeEnCours ||
                                  (editionSexeValeur === 'autre' && !editionSexeAutre.trim())
                                }
                                title="Enregistrer le sexe"
                                aria-label="Enregistrer le sexe"
                              >
                                {editionSexeEnCours ? <span className="idm-spinner idm-spinner--sm" /> : '✓'}
                              </button>
                              <button
                                className="idm-btn idm-btn--retirer"
                                onClick={annulerEditionSexe}
                                disabled={editionSexeEnCours}
                                title="Annuler"
                                aria-label="Annuler"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Bouton Modifier — disponible pour TOUS les types d'inscription */}
                              <button
                                className="idm-btn"
                                onClick={() => commencerEdition(inscription)}
                                disabled={actionEnCours === inscription.id}
                                title="Modifier le nom ou la remarque"
                                aria-label={`Modifier ${inscription.eleveNom}`}
                                style={{ background: '#e0f2fe', color: '#075985', borderColor: '#bae6fd' }}
                              >
                                ✏️
                              </button>
                              {/* 🆕 Bouton ⚧ — ouvre l'édition du sexe a posteriori.
                                  Coloré rose/bleu si déjà renseigné, gris vif sinon
                                  pour attirer l'attention sur les fiches incomplètes. */}
                              <button
                                className="idm-btn"
                                onClick={() => commencerEditionSexe(inscription)}
                                disabled={actionEnCours === inscription.id}
                                title={
                                  inscription.eleveSexe
                                    ? `Modifier le sexe (actuel : ${inscription.eleveSexe === 'M' ? 'Masculin' : inscription.eleveSexe === 'F' ? 'Féminin' : 'Autre'})`
                                    : 'Renseigner le sexe (manquant)'
                                }
                                aria-label={`Sexe de ${inscription.eleveNom}`}
                                style={{
                                  background: inscription.eleveSexe ? '#f3e8ff' : '#fee2e2',
                                  color: inscription.eleveSexe ? '#6b21a8' : '#991b1b',
                                  borderColor: inscription.eleveSexe ? '#e9d5ff' : '#fecaca',
                                }}
                              >
                                ⚧
                              </button>
                              <button
                                className={`idm-btn ${inscription.statut === 'actif' ? 'idm-btn--suspendre' : 'idm-btn--reactiver'}`}
                                onClick={() => handleToggleStatut(inscription)}
                                disabled={actionEnCours === inscription.id}
                                title={inscription.statut === 'actif' ? 'Suspendre l\'accès' : 'Réactiver l\'accès'}
                                aria-label={inscription.statut === 'actif' ? `Suspendre ${inscription.eleveNom}` : `Réactiver ${inscription.eleveNom}`}
                              >
                                {actionEnCours === inscription.id
                                  ? <span className="idm-spinner idm-spinner--sm" />
                                  : inscription.statut === 'actif' ? '⏸' : '▶️'
                                }
                              </button>
                              <button
                                className="idm-btn idm-btn--retirer"
                                onClick={() => handleDesinscrire(inscription)}
                                disabled={actionEnCours === inscription.id}
                                title="Retirer du groupe"
                                aria-label={`Retirer ${inscription.eleveNom} du groupe`}
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <div className="idm-pied">
          <button className="idm-btn idm-btn--fermer" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default InscriptionDirecteModal;

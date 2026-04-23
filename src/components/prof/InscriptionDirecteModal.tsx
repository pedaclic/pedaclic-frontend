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
  type EleveResultat,
  type InscriptionGroupe,
  type InscriptionBulkResultat,
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
  const [offlineEnCours, setOfflineEnCours] = useState(false);
  const [offlineErreur, setOfflineErreur] = useState<string | null>(null);

  // ── Phase 36 — Inscription en lot (saisie texte multi-lignes) ──
  //   La zone de texte autorise le copier-coller depuis un tableur :
  //   une ligne par élève, champs séparés par ; , ou tabulation.
  const [bulkTexte, setBulkTexte] = useState('');
  const [bulkEnCours, setBulkEnCours] = useState(false);
  const [bulkResultats, setBulkResultats] = useState<InscriptionBulkResultat[] | null>(null);
  const [bulkErreur, setBulkErreur] = useState<string | null>(null);

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

  const handleInscrire = async (eleve: EleveResultat) => {
    if (actionEnCours) return;
    setActionEnCours(eleve.uid);
    setMessageSucces(null);
    try {
      await inscrireEleveDirect(groupeId, eleve, profId);
      setResultats(prev =>
        prev.map(e => (e.uid === eleve.uid ? { ...e, dejaInscrit: true } : e))
      );
      setMessageSucces(`✅ ${eleve.displayName} a été inscrit dans ${groupeNom}.`);
      await chargerInscrits();
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'inscription.';
      setErreurRecherche(message);
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
  const handleInscrireOffline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (offlineEnCours) return;
    setOfflineErreur(null);
    const nomPropre = offlineNom.trim();
    if (nomPropre.length < 2) {
      setOfflineErreur('Le nom doit contenir au moins 2 caractères.');
      return;
    }
    setOfflineEnCours(true);
    try {
      await inscrireEleveOffline(groupeId, nomPropre, profId, offlineRemarque || undefined);
      setMessageSucces(`✅ ${nomPropre} a été ajouté dans ${groupeNom} (sans compte PedaClic).`);
      setOfflineNom('');
      setOfflineRemarque('');
      await chargerInscrits();
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'ajout.';
      setOfflineErreur(message);
    } finally {
      setOfflineEnCours(false);
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
                  {offlineErreur && (
                    <p style={{ gridColumn: '1 / -1', margin: 0, color: '#b91c1c', fontSize: '0.78rem' }} role="alert">
                      ⚠️ {offlineErreur}
                    </p>
                  )}
                  <button type="submit" disabled={offlineEnCours || offlineNom.trim().length < 2}>
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
                  <code>Nom Prénom ; email@domaine</code> &nbsp;•&nbsp;
                  <code>Nom Prénom ; email ; remarque</code>
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
                placeholder={`Exemple :\nDiop Awa ; awa.diop@exemple.sn\nFall Moussa ; ; tuteur 77 123 45 67\nmoussa.fall@exemple.sn\nMbaye Fatou`}
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
                    {inscrits.map((inscription) => (
                      <li
                        key={inscription.id}
                        className={`idm-ligne-inscrit ${inscription.statut === 'suspendu' ? 'idm-ligne-inscrit--suspendu' : ''}`}
                      >
                        <div className="idm-carte-eleve__avatar" aria-hidden="true">
                          <span className="idm-avatar-initiales">
                            {inscription.eleveNom.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="idm-carte-eleve__infos">
                          <span className="idm-carte-eleve__nom">
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
                        </div>
                        <div className="idm-ligne-inscrit__actions">
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
                        </div>
                      </li>
                    ))}
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

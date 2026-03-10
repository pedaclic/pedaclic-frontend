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
  type EleveResultat,
  type InscriptionGroupe,
} from '../../services/inscriptionDirecteService';
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
  const [onglet, setOnglet] = useState<'recherche' | 'liste'>('recherche');
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
    const confirme = window.confirm(
      `Retirer ${inscription.eleveNom} du groupe "${groupeNom}" ?\n\nSon historique sera conservé.`
    );
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
                          <span className="idm-carte-eleve__nom">{inscription.eleveNom}</span>
                          <span className="idm-carte-eleve__email">{inscription.eleveEmail}</span>
                          <div className="idm-ligne-inscrit__meta">
                            <span className={`idm-badge ${inscription.statut === 'actif' ? 'idm-badge--actif' : 'idm-badge--suspendu'}`}>
                              {inscription.statut === 'actif' ? '✓ Actif' : '⏸ Suspendu'}
                            </span>
                            <span className="idm-badge idm-badge--source">
                              {inscription.sourceInscription === 'direct' ? '👨‍🏫 Prof' : '🔑 Code'}
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

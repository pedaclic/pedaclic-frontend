// ============================================================
// PedaClic — Phase 54 : ProfCommunicationPage
// Route : /prof/communication?groupe=<id>&onglet=annonce|forum|prive
//
// Espace classe du professeur, accessible depuis le Cahier de textes.
//   • colonne de gauche : ses groupes-classes actifs ;
//   • onglet Annonces  : informer tout le groupe (événement, devoir…) ;
//   • onglet Forum     : discussion publique avec les élèves (modération) ;
//   • onglet Messages privés : écrire à UN élève (sans réponse privée).
// Chaque publication déclenche une notification (cloche) côté élèves.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getGroupesProf } from '../services/cahierTextesService';
import { getElevesGroupe } from '../services/profGroupeService';
import {
  publierMessage, ecouterMessagesGroupe, ecouterMessagesPrivesProf,
  basculerEpingle, supprimerMessage,
} from '../services/communicationService';
import type { GroupeProf } from '../types/cahierTextes.types';
import type { MessageClasse, NatureMessage } from '../types/communication.types';
import FilMessages from '../components/communication/FilMessages';
import ComposerMessage, { type DonneesComposer } from '../components/communication/ComposerMessage';
import { useNonLus } from '../hooks/useNonLus';
import '../styles/CahierTextes.css';     // boutons .btn-primary / .btn-secondary
import '../styles/Communication.css';

const ONGLETS: { cle: NatureMessage; label: string }[] = [
  { cle: 'annonce', label: '📢 Annonces' },
  { cle: 'forum',   label: '💬 Forum de classe' },
  { cle: 'prive',   label: '✉️ Messages privés' },
];

const ProfCommunicationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  // ── Groupes du professeur ──
  const [groupes, setGroupes] = useState<GroupeProf[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  // ── Sélection (persistée dans l'URL : lien direct depuis une notification) ──
  const groupeId = params.get('groupe') ?? '';
  const onglet = (params.get('onglet') as NatureMessage) || 'annonce';
  const choisir = (g: string, o: NatureMessage = onglet) => setParams({ groupe: g, onglet: o }, { replace: true });

  // ── Données du groupe sélectionné ──
  const [publics, setPublics] = useState<MessageClasse[]>([]);
  const [prives, setPrives] = useState<MessageClasse[]>([]);
  const [eleves, setEleves] = useState<{ id: string; nom: string }[]>([]);
  const [filtreEleve, setFiltreEleve] = useState('');

  // 1. Chargement des groupes actifs
  useEffect(() => {
    if (!currentUser?.uid) return;
    setChargement(true);
    getGroupesProf(currentUser.uid)
      .then(liste => setGroupes(liste.filter(g => g.statut !== 'archive')))
      .catch(() => setErreur('Impossible de charger vos groupes-classes.'))
      .finally(() => setChargement(false));
  }, [currentUser?.uid]);

  // 2. Sélection automatique du premier groupe si aucun n'est choisi
  useEffect(() => {
    if (!groupeId && groupes.length > 0) choisir(groupes[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupes, groupeId]);

  const groupe = useMemo(() => groupes.find(g => g.id === groupeId), [groupes, groupeId]);

  // 3. Écoute temps réel du fil public + messages privés + élèves du groupe
  useEffect(() => {
    if (!groupe || !currentUser?.uid) return;
    setPublics([]); setPrives([]); setFiltreEleve('');
    const err = () => setErreur('Lecture des messages impossible (index Firestore en cours de création ?).');
    const u1 = ecouterMessagesGroupe(groupe.id, setPublics, err);
    const u2 = ecouterMessagesPrivesProf(currentUser.uid, groupe.id, setPrives, err);
    getElevesGroupe(groupe.id)
      .then(l => setEleves(l.map(i => ({ id: i.eleveId, nom: i.eleveNom || i.eleveEmail || 'Élève' }))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))))
      .catch(() => setEleves([]));
    return () => { u1(); u2(); };
  }, [groupe, currentUser?.uid]);

  // Répartition du fil public
  const annonces = useMemo(() => publics.filter(m => m.nature === 'annonce'), [publics]);
  const forum = useMemo(() => publics.filter(m => m.nature === 'forum'), [publics]);
  const privesFiltres = useMemo(
    () => (filtreEleve ? prives.filter(m => m.destinataireId === filtreEleve) : prives),
    [prives, filtreEleve]
  );

  // Pastilles « non lus » (le forum est le seul où les élèves écrivent)
  const nlForum = useNonLus(currentUser?.uid, groupe?.id, 'forum', forum, onglet === 'forum');

  // ── Actions ──
  const publier = async (nature: NatureMessage, d: DonneesComposer) => {
    if (!groupe || !currentUser) return;
    await publierMessage(
      { groupeId: groupe.id, groupeNom: groupe.nom, profId: currentUser.uid, nature, ...d },
      { id: currentUser.uid, nom: currentUser.displayName || 'Professeur', role: 'prof' }
    );
    toast.success(nature === 'annonce' ? 'Annonce publiée — les élèves sont notifiés.'
      : nature === 'prive' ? 'Message envoyé à l\'élève.' : 'Message publié dans le forum.');
  };

  const epingler = async (m: MessageClasse) => {
    try { await basculerEpingle(m.id, !m.epingle); }
    catch { toast.error('Action impossible.'); }
  };

  const supprimer = async (m: MessageClasse) => {
    const ok = await confirm({ title: 'Supprimer ce message ?', message: 'Il disparaîtra pour tous les élèves.', confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try { await supprimerMessage(m.id); toast.success('Message supprimé.'); }
    catch { toast.error('Suppression impossible.'); }
  };

  // ── Rendu ──
  if (chargement) return <div className="com-page"><p className="com-vide">Chargement…</p></div>;

  return (
    <div className="com-page">
      {/* ── En-tête ── */}
      <header className="com-entete">
        <Link to="/prof/cahiers" className="com-retour">← Cahier de textes</Link>
        <h1>💬 Espace classe</h1>
        <p>Informez vos élèves en groupe ou individuellement, et animez le forum de chaque classe.</p>
      </header>

      {erreur && <p className="com-erreur" role="alert">{erreur}</p>}

      {groupes.length === 0 ? (
        <div className="com-carte com-carte--info">
          <h3>Aucun groupe-classe actif</h3>
          <p className="com-texte">
            Créez un groupe-classe depuis votre <Link to="/prof/dashboard">tableau de bord</Link> et
            communiquez le code d'invitation à vos élèves : l'espace classe s'ouvrira automatiquement.
          </p>
        </div>
      ) : (
        <div className="com-layout">
          {/* ── Colonne des groupes ── */}
          <aside className="com-groupes" aria-label="Mes groupes-classes">
            {groupes.map(g => (
              <button
                key={g.id}
                type="button"
                className={`com-groupe${g.id === groupeId ? ' com-groupe--actif' : ''}`}
                onClick={() => choisir(g.id)}
                aria-current={g.id === groupeId}
              >
                <strong>{g.nom}</strong>
                <span>{g.classe} · {g.nombreInscrits ?? 0} élève{(g.nombreInscrits ?? 0) > 1 ? 's' : ''}</span>
              </button>
            ))}
          </aside>

          {/* ── Panneau du groupe sélectionné ── */}
          {groupe && (
            <section className="com-panneau">
              <nav className="com-onglets" role="tablist" aria-label="Rubriques de l'espace classe">
                {ONGLETS.map(o => (
                  <button
                    key={o.cle}
                    type="button"
                    role="tab"
                    aria-selected={onglet === o.cle}
                    className={`com-onglet${onglet === o.cle ? ' com-onglet--actif' : ''}`}
                    onClick={() => choisir(groupe.id, o.cle)}
                  >
                    {o.label}
                    {o.cle === 'forum' && nlForum.nonLus > 0 && <span className="com-compteur">{nlForum.nonLus}</span>}
                  </button>
                ))}
              </nav>

              {/* Annonces : rédaction en haut, fil en dessous */}
              {onglet === 'annonce' && (
                <>
                  <ComposerMessage
                    nature="annonce"
                    onPublier={d => publier('annonce', d)}
                    aide={`Visible par les ${groupe.nombreInscrits ?? 0} élève(s) de ${groupe.nom}, qui seront notifiés.`}
                  />
                  <FilMessages
                    messages={annonces} variante="annonces" uidCourant={currentUser?.uid ?? ''}
                    estModerateur onEpingler={epingler} onSupprimer={supprimer}
                    vide="Aucune annonce publiée pour ce groupe."
                  />
                </>
              )}

              {/* Forum : fil chronologique, rédaction en bas */}
              {onglet === 'forum' && (
                <>
                  <FilMessages
                    messages={forum} variante="forum" uidCourant={currentUser?.uid ?? ''}
                    estModerateur nouveauxDepuis={nlForum.nouveauxDepuis} onSupprimer={supprimer}
                    vide="Le forum est vide. Lancez la discussion !"
                  />
                  <ComposerMessage
                    nature="forum"
                    onPublier={d => publier('forum', d)}
                    aide="Forum public : tous les élèves du groupe lisent et peuvent répondre."
                  />
                </>
              )}

              {/* Messages privés : un élève à la fois */}
              {onglet === 'prive' && (
                <>
                  <label className="com-champ com-filtre">
                    <span>Afficher les messages envoyés à</span>
                    <select value={filtreEleve} onChange={e => setFiltreEleve(e.target.value)}>
                      <option value="">Tous les élèves</option>
                      {eleves.map(el => <option key={el.id} value={el.id}>{el.nom}</option>)}
                    </select>
                  </label>
                  <ComposerMessage
                    nature="prive"
                    eleves={eleves}
                    destinataireInitial={filtreEleve}
                    onPublier={d => publier('prive', d)}
                    aide="Seul l'élève choisi lira ce message. Il pourra vous répondre en classe ou dans le forum."
                  />
                  <FilMessages
                    messages={privesFiltres} variante="prives" uidCourant={currentUser?.uid ?? ''}
                    estModerateur onSupprimer={supprimer}
                    vide="Aucun message privé envoyé."
                  />
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfCommunicationPage;

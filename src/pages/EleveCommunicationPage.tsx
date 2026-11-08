// ============================================================
// PedaClic — Phase 54 : EleveCommunicationPage
// Route : /eleve/communication?groupe=<id>&onglet=annonce|forum|prive
//
// Espace classe de l'élève :
//   • Annonces : lecture seule (informations du professeur) ;
//   • Forum de classe : lecture ET écriture (canal PUBLIC uniquement) ;
//   • Messages du prof : messages personnels reçus (lecture seule —
//     pas de réponse privée, conformément au fonctionnement voulu).
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getGroupesEleve } from '../services/profGroupeService';
import {
  publierMessage, ecouterMessagesGroupe, ecouterMessagesPrivesEleve,
  supprimerMessage, getInscriptionsActivesEleve,
} from '../services/communicationService';
import type { GroupeProf } from '../types/prof';
import type { MessageClasse, NatureMessage } from '../types/communication.types';
import FilMessages from '../components/communication/FilMessages';
import ComposerMessage, { type DonneesComposer } from '../components/communication/ComposerMessage';
import { useNonLus } from '../hooks/useNonLus';
import '../styles/CahierTextes.css';
import '../styles/Communication.css';

const ONGLETS: { cle: NatureMessage; label: string }[] = [
  { cle: 'annonce', label: '📢 Annonces' },
  { cle: 'forum',   label: '💬 Forum de classe' },
  { cle: 'prive',   label: '✉️ Messages du prof' },
];

const EleveCommunicationPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  const [groupes, setGroupes] = useState<GroupeProf[]>([]);
  const [inscriptions, setInscriptions] = useState<Map<string, string>>(new Map());
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const groupeId = params.get('groupe') ?? '';
  const onglet = (params.get('onglet') as NatureMessage) || 'annonce';
  const choisir = (g: string, o: NatureMessage = onglet) => setParams({ groupe: g, onglet: o }, { replace: true });

  const [publics, setPublics] = useState<MessageClasse[]>([]);
  const [prives, setPrives] = useState<MessageClasse[]>([]);

  // 1. Groupes rejoints + inscriptions (preuve d'appartenance pour le forum)
  useEffect(() => {
    if (!currentUser?.uid) return;
    setChargement(true);
    Promise.all([getGroupesEleve(currentUser.uid), getInscriptionsActivesEleve(currentUser.uid)])
      .then(([g, ins]) => { setGroupes(g); setInscriptions(ins); })
      .catch(() => setErreur('Impossible de charger vos classes.'))
      .finally(() => setChargement(false));
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!groupeId && groupes.length > 0) choisir(groupes[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupes, groupeId]);

  const groupe = useMemo(() => groupes.find(g => g.id === groupeId), [groupes, groupeId]);

  // 2. Messages privés reçus (tous groupes) — une seule écoute
  useEffect(() => {
    if (!currentUser?.uid) return;
    return ecouterMessagesPrivesEleve(currentUser.uid, setPrives, () => setPrives([]));
  }, [currentUser?.uid]);

  // 3. Fil public du groupe sélectionné
  useEffect(() => {
    if (!groupe) return;
    setPublics([]);
    return ecouterMessagesGroupe(groupe.id, setPublics,
      () => setErreur('Lecture des messages impossible pour le moment.'));
  }, [groupe]);

  const annonces = useMemo(() => publics.filter(m => m.nature === 'annonce'), [publics]);
  const forum = useMemo(() => publics.filter(m => m.nature === 'forum'), [publics]);
  const privesGroupe = useMemo(() => prives.filter(m => m.groupeId === groupeId), [prives, groupeId]);

  // Pastilles « non lus » par onglet
  const nl = {
    annonce: useNonLus(currentUser?.uid, groupe?.id, 'annonce', annonces, onglet === 'annonce'),
    forum:   useNonLus(currentUser?.uid, groupe?.id, 'forum', forum, onglet === 'forum'),
    prive:   useNonLus(currentUser?.uid, groupe?.id, 'prive', privesGroupe, onglet === 'prive'),
  };

  // ── Actions ──
  const publierForum = async (d: DonneesComposer) => {
    if (!groupe || !currentUser) return;
    await publierMessage(
      {
        groupeId: groupe.id, groupeNom: groupe.nom, profId: groupe.profId,
        nature: 'forum', contenu: d.contenu, inscriptionId: inscriptions.get(groupe.id),
      },
      { id: currentUser.uid, nom: currentUser.displayName || 'Élève', role: 'eleve' }
    );
  };

  const supprimer = async (m: MessageClasse) => {
    const ok = await confirm({ title: 'Supprimer ton message ?', message: 'Il disparaîtra du forum.', confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    try { await supprimerMessage(m.id); }
    catch { toast.error('Suppression impossible.'); }
  };

  if (chargement) return <div className="com-page"><p className="com-vide">Chargement…</p></div>;

  return (
    <div className="com-page">
      <header className="com-entete">
        <Link to="/eleve/cahiers" className="com-retour">← Cahiers de textes</Link>
        <h1>💬 Espace classe</h1>
        <p>Annonces de vos professeurs, forum de classe et messages personnels.</p>
      </header>

      {erreur && <p className="com-erreur" role="alert">{erreur}</p>}

      {groupes.length === 0 ? (
        <div className="com-carte com-carte--info">
          <h3>Aucune classe rejointe</h3>
          <p className="com-texte">
            Demandez le <strong>code d'invitation</strong> à votre professeur et rejoignez votre classe
            depuis votre <Link to="/eleve/dashboard">tableau de bord</Link>.
          </p>
        </div>
      ) : (
        <div className="com-layout">
          <aside className="com-groupes" aria-label="Mes classes">
            {groupes.map(g => {
              // Messages privés non lus de ce groupe (signal visible depuis la liste)
              const nbPrives = prives.filter(m => m.groupeId === g.id).length;
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`com-groupe${g.id === groupeId ? ' com-groupe--actif' : ''}`}
                  onClick={() => choisir(g.id)}
                  aria-current={g.id === groupeId}
                >
                  <strong>{g.nom}</strong>
                  <span>{[g.matiereNom, g.profNom].filter(Boolean).join(' · ')}{nbPrives > 0 ? ` · ✉️ ${nbPrives}` : ''}</span>
                </button>
              );
            })}
          </aside>

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
                    {nl[o.cle].nonLus > 0 && <span className="com-compteur">{nl[o.cle].nonLus}</span>}
                  </button>
                ))}
              </nav>

              {onglet === 'annonce' && (
                <FilMessages
                  messages={annonces} variante="annonces" uidCourant={currentUser?.uid ?? ''}
                  nouveauxDepuis={nl.annonce.nouveauxDepuis}
                  vide="Aucune annonce pour le moment."
                />
              )}

              {onglet === 'forum' && (
                <>
                  <FilMessages
                    messages={forum} variante="forum" uidCourant={currentUser?.uid ?? ''}
                    nouveauxDepuis={nl.forum.nouveauxDepuis} onSupprimer={supprimer}
                    vide="Aucun message. Pose la première question à ta classe !"
                  />
                  {inscriptions.has(groupe.id) ? (
                    <ComposerMessage
                      nature="forum"
                      onPublier={publierForum}
                      aide="Forum public : ton professeur et tous tes camarades liront ce message. Reste courtois."
                    />
                  ) : (
                    <p className="com-vide">Ton inscription à ce groupe n'est pas active : écriture désactivée.</p>
                  )}
                </>
              )}

              {onglet === 'prive' && (
                <>
                  <p className="com-note">
                    🔒 Messages personnels de ton professeur. Pour répondre, utilise le forum de classe ou parle-lui en classe.
                  </p>
                  <FilMessages
                    messages={privesGroupe} variante="prives" uidCourant={currentUser?.uid ?? ''}
                    nouveauxDepuis={nl.prive.nouveauxDepuis}
                    vide="Aucun message personnel."
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

export default EleveCommunicationPage;

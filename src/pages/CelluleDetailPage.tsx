// ============================================================
// PedaClic — Phase 49 : détail d'une cellule pédagogique
// Route : /prof/cellules/:celluleId   (?onglet=membres possible)
// ------------------------------------------------------------
// Onglets :
//   🧭 Progressions  — progressions communes, import dans MON cahier
//   📚 Bibliothèque  — séances partagées, copie dans MON cahier
//   📈 Avancement    — avancement publié volontairement par chacun
//   👥 Membres       — code, demandes, membres (animateur) / quitter
// Phase 50 (lot 2) :
//   📅 Calendrier    — devoirs harmonisés, compositions, réunions
//   📝 Comptes rendus — réunions, commentaires, export PDF
//   🔔 Notifications — membres prévenus (cloche de l'en-tête)
// Phase 51 (lot 3) :
//   🧪 Épreuves      — épreuve commune versionnée + statistiques anonymes
//   👁️ Observateur   — censeur / inspecteur : consultation seule
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import {
  subscribeCellule, subscribeDemandes, subscribeProgressions, subscribeRessources, subscribeAvancements,
  accepterDemande, refuserDemande, retirerMembre, quitterCellule, regenererCode, modifierCellule,
  enregistrerProgression, supprimerProgression, importerProgressionDansCahier,
  partagerSeance, supprimerRessource, dupliquerRessourceDansCahier,
  publierAvancement, retirerAvancement,
  // Phase 50
  subscribeEvenements, subscribeComptesRendus, notifierMembres,
  // Phase 51
  subscribeEpreuves, changerRoleMembre,
} from '../services/cellulesService';
import { getCahiersByProf } from '../services/cahierTextesService';
import type {
  Cellule, DemandeAdhesion, ProgressionCellule, RessourceCellule, AvancementMembre, CelluleFormData,
  EvenementCellule, CompteRenduCellule, EpreuveCommune,
} from '../types/cellule.types';
import OngletEpreuves from '../components/cellules/OngletEpreuves';
import { joursAvant } from '../types/cellule.types';
import OngletCalendrier from '../components/cellules/OngletCalendrier';
import OngletComptesRendus from '../components/cellules/OngletComptesRendus';
import { PORTEES_CELLULE } from '../types/cellule.types';
import type { CahierTextes } from '../types/cahierTextes.types';
import { TYPE_CONTENU_CONFIG } from '../types/cahierTextes.types';
import { messageErreurFirestore } from '../utils/messageErreurFirestore';
import CelluleFormModal from '../components/cellules/CelluleFormModal';
import ChoisirCahierModal from '../components/cellules/ChoisirCahierModal';
import ProgressionEditorModal from '../components/cellules/ProgressionEditorModal';
import PartagerSeanceModal from '../components/cellules/PartagerSeanceModal';
import '../styles/CahierTextes.css';
import '../styles/Cellules.css';

type Onglet = 'calendrier' | 'progressions' | 'bibliotheque' | 'epreuves' | 'avancement' | 'comptes-rendus' | 'membres';
const ONGLETS_VALIDES: Onglet[] = ['calendrier', 'progressions', 'bibliotheque', 'epreuves', 'avancement', 'comptes-rendus', 'membres'];

/** Texte brut d'un contenu HTML (aperçu sûr : aucun HTML d'un collègue n'est injecté) */
function texteBrut(html: string, max = 220): string {
  const texte = new DOMParser().parseFromString(html || '', 'text/html').body.textContent ?? '';
  const propre = texte.replace(/\s+/g, ' ').trim();
  return propre.length > max ? `${propre.slice(0, max)}…` : propre;
}

/** Date courte « 04 nov. » */
const dateCourte = (t?: { toDate?: () => Date }) =>
  t?.toDate?.().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) ?? '';

const CelluleDetailPage: React.FC = () => {
  const { celluleId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const confirmDialog = useConfirm();

  const uid = currentUser?.uid ?? '';
  const auteur = { uid, nom: currentUser?.displayName || currentUser?.email || 'Professeur' };

  // ── Données ───────────────────────────────────────────────
  const [cellule, setCellule] = useState<Cellule | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [demandes, setDemandes] = useState<DemandeAdhesion[]>([]);
  const [progressions, setProgressions] = useState<ProgressionCellule[]>([]);
  const [ressources, setRessources] = useState<RessourceCellule[]>([]);
  const [avancements, setAvancements] = useState<AvancementMembre[]>([]);
  const [mesCahiers, setMesCahiers] = useState<CahierTextes[]>([]);
  // Phase 50
  const [evenements, setEvenements] = useState<EvenementCellule[]>([]);
  const [comptesRendus, setComptesRendus] = useState<CompteRenduCellule[]>([]);
  const [epreuves, setEpreuves] = useState<EpreuveCommune[]>([]);   // Phase 51

  // ── Interface ─────────────────────────────────────────────
  // Phase 50 : onglet par défaut = calendrier ; suit le paramètre ?onglet=
  // (lien d'une notification ouvert alors que la page est déjà affichée)
  const ongletUrl = searchParams.get('onglet') as Onglet | null;
  const [onglet, setOnglet] = useState<Onglet>(
    ongletUrl && ONGLETS_VALIDES.includes(ongletUrl) ? ongletUrl : 'calendrier'
  );
  useEffect(() => {
    if (ongletUrl && ONGLETS_VALIDES.includes(ongletUrl)) setOnglet(ongletUrl);
  }, [ongletUrl]);
  const [filtreClasse, setFiltreClasse] = useState('');
  const [showModifier, setShowModifier] = useState(false);
  const [progEditee, setProgEditee] = useState<ProgressionCellule | 'nouvelle' | null>(null);
  const [progAImporter, setProgAImporter] = useState<ProgressionCellule | null>(null);
  const [ressourceACopier, setRessourceACopier] = useState<RessourceCellule | null>(null);
  const [showPartager, setShowPartager] = useState(false);
  const [showPublier, setShowPublier] = useState(false);
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());

  const estAnimateur = !!cellule && cellule.animateurId === uid;
  const estMembre = !!cellule && cellule.membreIds.includes(uid);
  // Phase 51 — un observateur consulte tout mais n'écrit rien
  const estObservateurCellule = !!cellule && (cellule.observateurIds ?? []).includes(uid);
  const peutContribuer = estMembre && !estObservateurCellule;

  // ── Abonnements ───────────────────────────────────────────
  useEffect(() => {
    if (!celluleId || !uid) return;
    return subscribeCellule(
      celluleId,
      c => { setCellule(c); setIntrouvable(!c); },
      () => setIntrouvable(true)          // plus membre ou cellule supprimée
    );
  }, [celluleId, uid]);

  useEffect(() => {
    if (!estMembre) return;
    const u1 = subscribeProgressions(celluleId, setProgressions);
    const u2 = subscribeRessources(celluleId, setRessources);
    const u3 = subscribeAvancements(celluleId, setAvancements);
    const u4 = subscribeEvenements(celluleId, setEvenements);        // Phase 50
    const u5 = subscribeComptesRendus(celluleId, setComptesRendus);  // Phase 50
    const u6 = subscribeEpreuves(celluleId, setEpreuves);            // Phase 51
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [celluleId, estMembre]);

  useEffect(() => {
    if (!estAnimateur) { setDemandes([]); return; }
    return subscribeDemandes(celluleId, setDemandes);
  }, [celluleId, estAnimateur]);

  // Mes cahiers actifs (import, partage, avancement)
  const rechargerMesCahiers = () => {
    if (!uid) return;
    getCahiersByProf(uid)
      .then(liste => setMesCahiers(liste.filter(c => !c.isArchived)))
      .catch(() => setMesCahiers([]));
  };
  useEffect(rechargerMesCahiers, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Membres actifs (ceux de membreIds), animateur en premier
  const membres = useMemo(() => {
    if (!cellule) return [];
    return cellule.membreIds
      .map(id => ({ id, ...(cellule.membres[id] ?? { nom: 'Membre', role: 'membre' as const, depuis: undefined }) }))
      .sort((a, b) => Number(b.id === cellule.animateurId) - Number(a.id === cellule.animateurId) || a.nom.localeCompare(b.nom, 'fr'));
  }, [cellule]);

  const classesRessources = Array.from(new Set(ressources.map(r => r.classe))).sort();
  const ressourcesFiltrees = filtreClasse ? ressources.filter(r => r.classe === filtreClasse) : ressources;
  const monAvancement = avancements.find(a => a.id === uid);

  const basculerOuvert = (id: string) => setOuverts(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  /** Exécute une action et affiche l'erreur Firestore lisible en cas d'échec */
  const executer = async (action: () => Promise<unknown>, succes?: string, libelle = 'Opération') => {
    try {
      await action();
      if (succes) toast.success(succes);
    } catch (err) {
      toast.error(messageErreurFirestore(err, libelle), 8000);
      throw err;
    }
  };

  // ── États d'accès ─────────────────────────────────────────
  if (introuvable) {
    return (
      <div className="cahier-textes-page">
        <div className="empty-state">
          <div style={{ fontSize: '3rem', opacity: 0.3 }}>🔒</div>
          <h3>Cellule introuvable</h3>
          <p>Elle a été supprimée, ou vous n'en êtes plus membre.</p>
          <button className="btn-primary" onClick={() => navigate('/prof/cellules')}>← Mes cellules</button>
        </div>
      </div>
    );
  }
  if (!cellule) {
    return <div className="cahier-textes-page"><div className="loading-spinner"><div className="spinner-circle" /></div></div>;
  }

  const portee = PORTEES_CELLULE.find(p => p.valeur === cellule.portee)?.label ?? '';

  return (
    <div className="cahier-textes-page">
      {/* ── En-tête ── */}
      <button type="button" className="cel-retour" onClick={() => navigate('/prof/cellules')}>← Mes cellules</button>
      <div className="cahier-page-header">
        <div>
          <h1 className="cahier-page-title">👥 {cellule.nom}</h1>
          <p className="cahier-page-subtitle">
            📘 {cellule.discipline} · {cellule.anneeScolaire} · {portee}
            {cellule.etablissementNom ? ` — ${cellule.etablissementNom}` : ''}
            {cellule.ief ? ` · ${cellule.ief}` : ''}
          </p>
          {cellule.description && <p className="cel-description">{cellule.description}</p>}
        </div>
        {estAnimateur && (
          <button className="btn-secondary" onClick={() => setShowModifier(true)}>✏️ Modifier</button>
        )}
      </div>

      {/* Phase 51 — bandeau « observateur » */}
      {estObservateurCellule && (
        <p className="cel-bandeau-observateur" role="status">
          👁️ Vous consultez cette cellule en tant qu'<strong>observateur</strong> : lecture seule.
        </p>
      )}

      {/* ── Onglets ── */}
      <div className="cel-onglets" role="tablist">
        {([
          ['calendrier', '📅 Calendrier', evenements.filter(e => joursAvant(e.date) >= 0).length],
          ['progressions', '🧭 Progressions', progressions.length],
          ['bibliotheque', '📚 Bibliothèque', ressources.length],
          ['epreuves', '🧪 Épreuves', epreuves.length],
          ['avancement', '📈 Avancement', avancements.length],
          ['comptes-rendus', '📝 Comptes rendus', comptesRendus.length],
          ['membres', '👥 Membres', membres.length],
        ] as const).map(([id, label, nb]) => (
          <button key={id} type="button" role="tab" aria-selected={onglet === id}
            className={`cel-onglet ${onglet === id ? 'active' : ''}`} onClick={() => setOnglet(id)}>
            {label} <span className="cel-onglet-nb">{nb}</span>
            {id === 'membres' && demandes.length > 0 && (
              <span className="cel-onglet-alerte" title="Demandes en attente">{demandes.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Phase 50 — Calendrier et comptes rendus (composants dédiés) ── */}
      {onglet === 'calendrier' && (
        <OngletCalendrier cellule={cellule} evenements={evenements} auteur={auteur} estAnimateur={estAnimateur} />
      )}
      {onglet === 'epreuves' && (
        <OngletEpreuves cellule={cellule} epreuves={epreuves} auteur={auteur}
          estAnimateur={estAnimateur} peutContribuer={peutContribuer} />
      )}
      {onglet === 'comptes-rendus' && (
        <OngletComptesRendus
          peutCommenter={peutContribuer}
          cellule={cellule}
          comptesRendus={comptesRendus}
          auteur={auteur}
          estAnimateur={estAnimateur}
          membres={membres.map(m => ({ id: m.id, nom: m.nom }))}
        />
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 1 — PROGRESSIONS COMMUNES
          ════════════════════════════════════════════════════════ */}
      {onglet === 'progressions' && (
        <section aria-label="Progressions communes">
          <div className="cel-barre">
            <p className="cel-aide">
              La progression commune s'importe dans votre cahier : les rubriques manquantes sont
              ajoutées à la fin, rien n'est remplacé.
            </p>
            {estAnimateur && (
              <button className="btn-primary" onClick={() => setProgEditee('nouvelle')}>+ Nouvelle progression</button>
            )}
          </div>

          {progressions.length === 0 ? (
            <p className="cel-vide">
              {estAnimateur ? 'Créez la première progression harmonisée de la cellule.' : 'L\'animateur n\'a pas encore publié de progression.'}
            </p>
          ) : progressions.map(p => {
            const ouvert = ouverts.has(p.id);
            const totalSeances = p.rubriques.reduce((t, r) => t + (r.nombreSeancesPrevu ?? 0), 0);
            return (
              <article key={p.id} className="cel-bloc">
                <div className="cel-bloc-entete">
                  <button type="button" className="cel-bloc-titre" onClick={() => basculerOuvert(p.id)} aria-expanded={ouvert}>
                    <span className="cel-chevron" aria-hidden="true">{ouvert ? '▾' : '▸'}</span>
                    {p.titre}
                  </button>
                  <span className="cel-badge">{p.classe}</span>
                </div>
                <p className="cel-bloc-meta">
                  {p.rubriques.length} rubrique(s){totalSeances ? ` · ${totalSeances} séances prévues` : ''} ·
                  mise à jour le {dateCourte(p.updatedAt)} par {p.auteurNom}
                </p>

                {ouvert && (
                  <ol className="cel-rubriques">
                    {p.rubriques.map(r => (
                      <li key={r.id}>
                        <span className="cel-pastille" style={{ background: r.couleur }} aria-hidden="true" />
                        <strong>{r.nom}</strong>
                        {r.nombreSeancesPrevu ? <span className="cel-bloc-meta"> — {r.nombreSeancesPrevu} séance(s)</span> : null}
                        {!!r.titres?.length && (
                          <ul>{r.titres.map(t => <li key={t.id}>{t.nom}</li>)}</ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}

                <div className="cel-bloc-actions">
                  {peutContribuer && (
                    <button className="btn-primary" onClick={() => setProgAImporter(p)}>📥 Importer dans mon cahier</button>
                  )}
                  {estAnimateur && (
                    <>
                      <button className="btn-secondary" onClick={() => setProgEditee(p)}>✏️ Modifier</button>
                      <button className="btn-secondary cel-btn-danger" onClick={async () => {
                        const ok = await confirmDialog({ title: 'Supprimer la progression ?', message: `« ${p.titre} » sera retirée de la cellule. Les cahiers qui l'ont importée ne sont pas modifiés.`, confirmLabel: 'Supprimer', variant: 'danger' });
                        if (ok) executer(() => supprimerProgression(cellule.id, p.id), 'Progression supprimée.', 'Suppression').catch(() => {});
                      }}>🗑️</button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 2 — BIBLIOTHÈQUE DE SÉANCES
          ════════════════════════════════════════════════════════ */}
      {onglet === 'bibliotheque' && (
        <section aria-label="Bibliothèque de séances">
          <div className="cel-barre">
            {classesRessources.length > 1 ? (
              <select className="filtre-select" value={filtreClasse} onChange={e => setFiltreClasse(e.target.value)} aria-label="Filtrer par classe">
                <option value="">Toutes les classes</option>
                {classesRessources.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : <span />}
            {peutContribuer && <button className="btn-primary" onClick={() => setShowPartager(true)}>📤 Partager une séance</button>}
          </div>

          {ressourcesFiltrees.length === 0 ? (
            <p className="cel-vide">Aucune séance partagée pour l'instant. Soyez le premier !</p>
          ) : ressourcesFiltrees.map(r => {
            const type = TYPE_CONTENU_CONFIG[r.typeContenu];
            const ouvert = ouverts.has(r.id);
            const peutSupprimer = r.auteurId === uid || estAnimateur;
            return (
              <article key={r.id} className="cel-bloc">
                <div className="cel-bloc-entete">
                  <button type="button" className="cel-bloc-titre" onClick={() => basculerOuvert(r.id)} aria-expanded={ouvert}>
                    <span aria-hidden="true">{type?.emoji ?? '📘'}</span> {r.titre}
                  </button>
                  <span className="cel-badge">{r.classe}</span>
                </div>
                <p className="cel-bloc-meta">
                  {type?.label ?? r.typeContenu} · {r.matiere} · partagée par {r.auteurNom} le {dateCourte(r.createdAt)}
                </p>
                {/* Aperçu en texte brut : aucun HTML externe n'est injecté */}
                <p className="cel-apercu">{texteBrut(r.contenu, ouvert ? 2000 : 220)}</p>
                {ouvert && r.objectifs && <p className="cel-apercu"><strong>Objectifs :</strong> {texteBrut(r.objectifs, 1000)}</p>}
                {ouvert && r.exerciceJour && <p className="cel-apercu"><strong>Exercice en classe :</strong> {texteBrut(r.exerciceJour, 1000)}</p>}
                {ouvert && r.exerciceDomicile && <p className="cel-apercu"><strong>Exercice à la maison :</strong> {texteBrut(r.exerciceDomicile, 1000)}</p>}
                <div className="cel-bloc-actions">
                  {peutContribuer && (
                    <button className="btn-primary" onClick={() => setRessourceACopier(r)}>📋 Copier dans mon cahier</button>
                  )}
                  {peutSupprimer && (
                    <button className="btn-secondary cel-btn-danger" onClick={async () => {
                      const ok = await confirmDialog({ title: 'Retirer cette séance ?', message: `« ${r.titre} » sera retirée de la bibliothèque. Les copies déjà faites ne sont pas touchées.`, confirmLabel: 'Retirer', variant: 'danger' });
                      if (ok) executer(() => supprimerRessource(cellule.id, r.id), 'Séance retirée.', 'Suppression').catch(() => {});
                    }}>🗑️</button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 3 — AVANCEMENT DES MEMBRES
          ════════════════════════════════════════════════════════ */}
      {onglet === 'avancement' && (
        <section aria-label="Avancement des membres">
          <div className="cel-barre">
            <p className="cel-aide">
              Chacun publie <strong>volontairement</strong> l'avancement d'un de ses cahiers
              (pourcentages par rubrique). Le contenu des séances n'est jamais visible.
            </p>
            <div className="cel-bloc-actions">
              {peutContribuer && (
              <button className="btn-primary" onClick={() => setShowPublier(true)}>
                {monAvancement ? '🔄 Actualiser mon avancement' : '📈 Publier mon avancement'}
              </button>
              )}
              {monAvancement && (
                <button className="btn-secondary" onClick={() =>
                  executer(() => retirerAvancement(cellule.id, uid), 'Avancement retiré.', 'Retrait').catch(() => {})
                }>Retirer</button>
              )}
            </div>
          </div>

          {avancements.length === 0 ? (
            <p className="cel-vide">Aucun avancement publié.</p>
          ) : (
            <div className="cel-avancements">
              {avancements.map(a => (
                <article key={a.id} className="cel-bloc">
                  <div className="cel-bloc-entete">
                    <strong>{a.nom}{a.id === uid ? ' (moi)' : ''}</strong>
                    <span className="cel-badge">{a.classe}</span>
                  </div>
                  <p className="cel-bloc-meta">{a.cahierTitre} · actualisé le {dateCourte(a.updatedAt)}</p>

                  {/* Barre globale */}
                  <div className="cel-barre-prog" aria-label={`Avancement global ${a.global.pourcentage} %`}>
                    <div className="cel-barre-prog-remplie" style={{ width: `${a.global.pourcentage}%` }} />
                  </div>
                  <p className="cel-bloc-meta">
                    <strong>{a.global.pourcentage} %</strong> · {a.global.realise} séance(s) réalisée(s)
                    {a.global.prevu ? ` sur ${a.global.prevu}` : ''}
                  </p>

                  {/* Détail par rubrique */}
                  {a.parRubrique.length > 0 && (
                    <ul className="cel-rubriques-prog">
                      {a.parRubrique.map((r, i) => (
                        <li key={i}>
                          <span className="cel-rubrique-nom" title={r.nom}>{r.nom}</span>
                          <span className="cel-mini-barre">
                            <span style={{ width: `${r.pourcentage}%`, background: r.couleur }} />
                          </span>
                          <span className="cel-rubrique-pct">{r.pourcentage} %</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 4 — MEMBRES
          ════════════════════════════════════════════════════════ */}
      {onglet === 'membres' && (
        <section aria-label="Membres">
          {/* Code d'invitation (animateur) */}
          {estAnimateur && (
            <div className="cel-code">
              <div>
                <span className="cel-bloc-meta">Code d'invitation à communiquer à vos collègues</span>
                <div className="cel-code-valeur">{cellule.codeInvitation}</div>
              </div>
              <div className="cel-bloc-actions">
                <button className="btn-secondary" onClick={() => {
                  navigator.clipboard?.writeText(cellule.codeInvitation)
                    .then(() => toast.success('Code copié.'))
                    .catch(() => toast.success(`Code : ${cellule.codeInvitation}`));
                }}>📋 Copier</button>
                <button className="btn-secondary" onClick={async () => {
                  const ok = await confirmDialog({ title: 'Changer le code ?', message: 'L\'ancien code ne fonctionnera plus. Les membres actuels restent membres.', confirmLabel: 'Changer', variant: 'warning' });
                  if (ok) executer(() => regenererCode(cellule), 'Nouveau code généré.', 'Changement de code').catch(() => {});
                }}>🔄 Nouveau code</button>
              </div>
            </div>
          )}

          {/* Demandes en attente (animateur) */}
          {estAnimateur && demandes.length > 0 && (
            <div className="cel-bloc">
              <h3 className="cel-sous-titre">Demandes en attente ({demandes.length})</h3>
              <ul className="cel-membres">
                {demandes.map(d => (
                  <li key={d.id}>
                    <span>🙋 <strong>{d.nom}</strong> <span className="cel-bloc-meta">· {dateCourte(d.createdAt)}</span></span>
                    <span className="cel-bloc-actions">
                      <button className="btn-primary" onClick={() =>
                        executer(() => accepterDemande(cellule.id, d, auteur, cellule.nom), `${d.nom} a rejoint la cellule.`, 'Acceptation').catch(() => {})
                      }>Accepter</button>
                      {/* Phase 51 — censeur, inspecteur… : consultation seule */}
                      <button className="btn-secondary" title="Lecture seule : censeur, inspecteur…" onClick={() =>
                        executer(() => accepterDemande(cellule.id, d, auteur, cellule.nom, 'observateur'), `${d.nom} a rejoint la cellule comme observateur.`, 'Acceptation').catch(() => {})
                      }>👁️ Comme observateur</button>
                      <button className="btn-secondary" onClick={() =>
                        executer(() => refuserDemande(cellule.id, d.id), 'Demande refusée.', 'Refus').catch(() => {})
                      }>Refuser</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Liste des membres */}
          <div className="cel-bloc">
            <h3 className="cel-sous-titre">Membres ({membres.length})</h3>
            <ul className="cel-membres">
              {membres.map(m => (
                <li key={m.id}>
                  <span>
                    {m.id === cellule.animateurId ? '⭐' : (cellule.observateurIds ?? []).includes(m.id) ? '👁️' : '👤'} <strong>{m.nom}</strong>
                    {m.id === uid ? ' (moi)' : ''}
                    <span className="cel-bloc-meta"> · {m.id === cellule.animateurId ? 'animateur' : (cellule.observateurIds ?? []).includes(m.id) ? 'observateur' : 'membre'}</span>
                  </span>
                  {estAnimateur && m.id !== uid && (
                    <span className="cel-bloc-actions">
                    {/* Phase 51 — bascule membre ↔ observateur */}
                    <button className="btn-secondary" onClick={() => {
                      const obs = (cellule.observateurIds ?? []).includes(m.id);
                      executer(() => changerRoleMembre(cellule.id, m.id, obs ? 'membre' : 'observateur'),
                        obs ? `${m.nom} est de nouveau membre.` : `${m.nom} est désormais observateur.`, 'Changement de rôle').catch(() => {});
                    }}>{(cellule.observateurIds ?? []).includes(m.id) ? '👤 Rendre membre' : '👁️ Rendre observateur'}</button>
                    <button className="btn-secondary cel-btn-danger" onClick={async () => {
                      const ok = await confirmDialog({ title: 'Retirer ce membre ?', message: `${m.nom} n'aura plus accès à la cellule. Ses cahiers ne sont pas touchés.`, confirmLabel: 'Retirer', variant: 'danger' });
                      if (ok) executer(() => retirerMembre(cellule.id, m.id), 'Membre retiré.', 'Retrait').catch(() => {});
                    }}>Retirer</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {!estAnimateur && (
            <button className="btn-secondary cel-btn-danger" onClick={async () => {
              const ok = await confirmDialog({ title: 'Quitter la cellule ?', message: 'Votre avancement publié sera retiré. Vos cahiers et les copies déjà faites restent intacts.', confirmLabel: 'Quitter', variant: 'danger' });
              if (!ok) return;
              executer(() => quitterCellule(cellule.id, uid), 'Vous avez quitté la cellule.', 'Départ')
                .then(() => navigate('/prof/cellules')).catch(() => {});
            }}>🚪 Quitter la cellule</button>
          )}
        </section>
      )}

      {/* ════════════════════ MODALES ════════════════════ */}
      {showModifier && (
        <CelluleFormModal
          titre="✏️ Modifier la cellule"
          initial={{
            nom: cellule.nom, discipline: cellule.discipline, portee: cellule.portee,
            etablissementNom: cellule.etablissementNom, ief: cellule.ief,
            anneeScolaire: cellule.anneeScolaire, description: cellule.description,
          } as CelluleFormData}
          libelleValider="Enregistrer"
          onValider={async form => {
            await modifierCellule(cellule.id, form);
            toast.success('Cellule modifiée.');
            setShowModifier(false);
          }}
          onClose={() => setShowModifier(false)}
        />
      )}

      {progEditee && (
        <ProgressionEditorModal
          initiale={progEditee === 'nouvelle' ? undefined : progEditee}
          onValider={async donnees => {
            await enregistrerProgression(cellule.id, auteur, donnees, progEditee === 'nouvelle' ? undefined : progEditee.id);
            toast.success('Progression enregistrée.');
            // Phase 50 — membres prévenus (non bloquant)
            notifierMembres(cellule, auteur, {
              titre: progEditee === 'nouvelle' ? '🧭 Nouvelle progression commune' : '🧭 Progression mise à jour',
              message: `${donnees.titre} (${donnees.classe}) — à importer dans votre cahier.`,
              onglet: 'progressions',
            }).catch(() => {});
            setProgEditee(null);
          }}
          onClose={() => setProgEditee(null)}
        />
      )}

      {progAImporter && (
        <ChoisirCahierModal
          titre="📥 Importer la progression"
          explication={`Les rubriques de « ${progAImporter.titre} » absentes de votre cahier y seront ajoutées (avec leurs leçons).`}
          libelleValider="Importer"
          cahiers={mesCahiers}
          classePreferee={progAImporter.classe}
          onValider={async cahier => {
            const nb = await importerProgressionDansCahier(cahier, progAImporter);
            toast.success(nb ? `${nb} rubrique(s) ajoutée(s) à « ${cahier.titre} ».` : 'Ce cahier contient déjà toutes ces rubriques.');
            rechargerMesCahiers(); // rubriques à jour pour un prochain import
            setProgAImporter(null);
          }}
          onClose={() => setProgAImporter(null)}
        />
      )}

      {ressourceACopier && (
        <ChoisirCahierModal
          titre="📋 Copier la séance"
          explication={`« ${ressourceACopier.titre} » sera ajoutée à votre cahier comme séance planifiée, datée d'aujourd'hui. Vous pourrez l'adapter librement.`}
          libelleValider="Copier"
          cahiers={mesCahiers}
          classePreferee={ressourceACopier.classe}
          onValider={async cahier => {
            await dupliquerRessourceDansCahier(ressourceACopier, cahier, uid);
            toast.success(`Séance copiée dans « ${cahier.titre} ».`);
            setRessourceACopier(null);
          }}
          onClose={() => setRessourceACopier(null)}
        />
      )}

      {showPartager && (
        <PartagerSeanceModal
          cahiers={mesCahiers}
          onValider={async (entree, cahier) => {
            await partagerSeance(cellule.id, auteur, entree, cahier);
            toast.success('Séance partagée avec la cellule.');
            notifierMembres(cellule, auteur, {
              titre: '📚 Nouvelle séance partagée',
              message: `${auteur.nom} a partagé « ${entree.chapitre || 'une séance'} » (${cahier.classe}).`,
              onglet: 'bibliotheque',
            }).catch(() => {});
            setShowPartager(false);
          }}
          onClose={() => setShowPartager(false)}
        />
      )}

      {showPublier && (
        <ChoisirCahierModal
          titre="📈 Publier mon avancement"
          explication="Seuls les pourcentages d'avancement (global et par rubrique) de ce cahier seront visibles par les membres."
          libelleValider="Publier"
          cahiers={mesCahiers.filter(c => !cellule.discipline || c.matiere === cellule.discipline).length
            ? mesCahiers.filter(c => !cellule.discipline || c.matiere === cellule.discipline)
            : mesCahiers}
          classePreferee={monAvancement?.classe}
          onValider={async cahier => {
            await publierAvancement(cellule.id, auteur, cahier);
            toast.success('Avancement publié.');
            setShowPublier(false);
          }}
          onClose={() => setShowPublier(false)}
        />
      )}
    </div>
  );
};

export default CelluleDetailPage;

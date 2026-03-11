// ============================================================
// PedaClic — LivePage.tsx
// Phase 28 : Page publique — Catalogue + Lecteur YouTube Live
//
// Routes :
//   /live            → Catalogue de toutes les sessions
//   /live/:sessionId → Détail + iframe YouTube (live ou replay)
//
// Accès : tous les utilisateurs connectés
//         (vérification d'accès par session : public / premium / groupe)
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getGroupesEleve } from '../services/profGroupeService';
import {
  getSessionsPubliques,
  getSessionById,
  incrementerVues,
  buildEmbedUrl,
  tempsAvantDebut,
  peutAccederSession,
} from '../liveService';
import type { LiveSession, FiltresLive } from '../live_types';
import { LABELS_STATUT_LIVE, LABELS_ACCES_LIVE } from '../live_types';
import '../Live.css';

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT — Carte session dans le catalogue
// ─────────────────────────────────────────────────────────────

interface LiveCardProps {
  session:   LiveSession;
  onClick:   () => void;
  accesOk:   boolean;
}

function LiveCard({ session, onClick, accesOk }: LiveCardProps) {
  const statut      = LABELS_STATUT_LIVE[session.statut];
  const countdownTxt = tempsAvantDebut(session);
  const dateDebut   = session.dateDebut.toDate();

  return (
    /* Carte cliquable d'une session live */
    <article
      className={`live-card ${session.statut === 'en_direct' ? 'live-card--actif' : ''} ${!accesOk ? 'live-card--verrouille' : ''}`}
      onClick={accesOk ? onClick : undefined}
      role="button"
      tabIndex={accesOk ? 0 : -1}
      aria-label={`Session : ${session.titre}`}
      onKeyDown={e => e.key === 'Enter' && accesOk && onClick()}
    >
      {/* ── Badge statut ── */}
      <div
        className="live-card__badge"
        style={{ background: statut.couleur }}
        aria-label={`Statut : ${statut.label}`}
      >
        <span aria-hidden="true">{statut.icone}</span>
        {statut.label}
        {/* Pastille animée pour le live en cours */}
        {session.statut === 'en_direct' && (
          <span className="live-card__pulse" aria-hidden="true" />
        )}
      </div>

      {/* ── Corps de la carte ── */}
      <div className="live-card__body">
        {/* Matière + Classe */}
        <p className="live-card__meta">
          <span className="live-card__matiere">{session.matiere}</span>
          <span className="live-card__sep" aria-hidden="true">·</span>
          <span>{session.classe}</span>
        </p>

        {/* Titre */}
        <h3 className="live-card__titre">{session.titre}</h3>

        {/* Description */}
        {session.description && (
          <p className="live-card__description">{session.description}</p>
        )}

        {/* ── Informations bas de carte ── */}
        <div className="live-card__footer">
          {/* Prof + date */}
          <div className="live-card__infos">
            <span className="live-card__prof">👨‍🏫 {session.profNom}</span>
            <span className="live-card__date">
              {dateDebut.toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>

          {/* Durée + accès */}
          <div className="live-card__tags">
            <span className="live-card__tag">⏱ {session.dureeEstimee} min</span>
            <span className="live-card__tag">
              {LABELS_ACCES_LIVE[session.acces].icone} {LABELS_ACCES_LIVE[session.acces].label}
            </span>
            {session.nombreVues > 0 && (
              <span className="live-card__tag">👁 {session.nombreVues}</span>
            )}
          </div>

          {/* Compte à rebours si planifié */}
          {countdownTxt && (
            <p className="live-card__countdown" aria-live="polite">⏳ {countdownTxt}</p>
          )}

          {/* Verrou accès premium/groupe */}
          {!accesOk && (
            <p className="live-card__verrou">
              🔒 {session.acces === 'premium' ? 'Abonnement Premium requis' : 'Accès réservé au groupe'}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE CATALOGUE — /live
// ─────────────────────────────────────────────────────────────

function LiveCataloguePage() {
  const navigate          = useNavigate();
  const { currentUser: user } = useAuth();

  // ── État ──────────────────────────────────────────────────
  const [sessions, setSessions]       = useState<LiveSession[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [filtres, setFiltres]         = useState<FiltresLive>({});
  const [userData, setUserData]       = useState<{ isPremium: boolean; groupeIds: string[] } | null>(null);
  const [matieres, setMatieres]       = useState<string[]>([]);

  // ── Chargement profil utilisateur + groupes ───────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      let groupeIds: string[] = [];
      if (userSnap.exists()) {
        const d = userSnap.data();
        groupeIds = d.groupeIds ?? [];
        // Fallback : récupérer les groupes via inscriptions (comme ElveCahiersListePage)
        if (groupeIds.length === 0) {
          try {
            const groupes = await getGroupesEleve(user.uid);
            groupeIds = groupes.map(g => g.id);
          } catch {
            // Silencieux
          }
        }
        setUserData({
          isPremium:  d.isPremium  ?? false,
          groupeIds,
        });
      } else {
        setUserData({ isPremium: false, groupeIds: [] });
      }
    })();
  }, [user]);

  // ── Chargement des sessions ───────────────────────────────
  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSessionsPubliques(filtres);
      setSessions(data);
      // Extraire les matières uniques pour le filtre
      const ms = [...new Set(data.map(s => s.matiere))].filter(Boolean).sort();
      setMatieres(ms);
    } catch (err) {
      setError('Impossible de charger les sessions.');
      console.error('[LivePage] getSessionsPubliques:', err);
    } finally {
      setLoading(false);
    }
  }, [filtres]);

  useEffect(() => { charger(); }, [charger]);

  // ── Vérification d'accès ──────────────────────────────────
  function accesOk(session: LiveSession): boolean {
    if (!user) return session.acces === 'public';
    return peutAccederSession(
      session,
      userData?.isPremium  ?? false,
      userData?.groupeIds  ?? []
    );
  }

  // ── Sessions en direct (priorité d'affichage) ─────────────
  const enDirect  = sessions.filter(s => s.statut === 'en_direct');
  const planifies = sessions.filter(s => s.statut === 'planifie');
  const termines  = sessions.filter(s => s.statut === 'termine');

  return (
    <div className="live-catalogue">

      {/* ════════════════════════════════════════════════════
          EN-TÊTE DE LA PAGE
      ════════════════════════════════════════════════════ */}
      <header className="live-catalogue__header">
        <div className="live-catalogue__header-content">
          <h1 className="live-catalogue__titre">
            🎓 Cours en Direct
          </h1>
          <p className="live-catalogue__sous-titre">
            Rejoignez les sessions live de vos professeurs et accédez aux replays après la séance.
          </p>
        </div>

        {/* Indicateur si des sessions sont en cours */}
        {enDirect.length > 0 && (
          <div className="live-catalogue__alerte-direct" role="alert" aria-live="polite">
            <span className="live-catalogue__pulse" aria-hidden="true" />
            <strong>{enDirect.length} session{enDirect.length > 1 ? 's' : ''} en direct maintenant !</strong>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════════════════════
          FILTRES
      ════════════════════════════════════════════════════ */}
      <section className="live-catalogue__filtres" aria-label="Filtrer les sessions">
        {/* Filtre par statut */}
        <select
          value={filtres.statut ?? ''}
          onChange={e => setFiltres(f => ({ ...f, statut: e.target.value as FiltresLive['statut'] ?? '' }))}
          className="live-select"
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="en_direct">🔴 En direct</option>
          <option value="planifie">📅 Planifiés</option>
          <option value="termine">▶️ Replays</option>
        </select>

        {/* Filtre par matière */}
        {matieres.length > 0 && (
          <select
            value={filtres.matiere ?? ''}
            onChange={e => setFiltres(f => ({ ...f, matiere: e.target.value || undefined }))}
            className="live-select"
            aria-label="Filtrer par matière"
          >
            <option value="">Toutes les matières</option>
            {matieres.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

        {/* Bouton reset */}
        {(filtres.statut || filtres.matiere) && (
          <button
            className="live-btn live-btn--ghost live-btn--sm"
            onClick={() => setFiltres({})}
          >
            ✕ Effacer les filtres
          </button>
        )}
      </section>

      {/* ════════════════════════════════════════════════════
          CONTENU PRINCIPAL
      ════════════════════════════════════════════════════ */}
      <main className="live-catalogue__contenu">

        {/* Erreur */}
        {error && (
          <div className="live-error" role="alert">
            ⚠️ {error}
            <button className="live-btn live-btn--ghost live-btn--sm" onClick={charger}>
              Réessayer
            </button>
          </div>
        )}

        {/* Skeleton loader */}
        {loading && (
          <div className="live-grille">
            {[1, 2, 3].map(i => (
              <div key={i} className="live-card live-card--skeleton" aria-hidden="true">
                <div className="skeleton live-card__badge-sk" />
                <div className="live-card__body">
                  <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 20, marginBottom: 12 }} />
                  <div className="skeleton" style={{ height: 14, width: '70%' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sessions en direct */}
        {!loading && enDirect.length > 0 && (
          <section className="live-section" aria-labelledby="titre-direct">
            <h2 id="titre-direct" className="live-section__titre live-section__titre--direct">
              🔴 En direct maintenant
            </h2>
            <div className="live-grille">
              {enDirect.map(s => (
                <LiveCard
                  key={s.id}
                  session={s}
                  accesOk={accesOk(s)}
                  onClick={() => navigate(`/live/${s.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Sessions planifiées */}
        {!loading && planifies.length > 0 && (
          <section className="live-section" aria-labelledby="titre-planifie">
            <h2 id="titre-planifie" className="live-section__titre">
              📅 Sessions à venir
            </h2>
            <div className="live-grille">
              {planifies.map(s => (
                <LiveCard
                  key={s.id}
                  session={s}
                  accesOk={accesOk(s)}
                  onClick={() => navigate(`/live/${s.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Replays */}
        {!loading && termines.length > 0 && (
          <section className="live-section" aria-labelledby="titre-replay">
            <h2 id="titre-replay" className="live-section__titre">
              ▶️ Replays disponibles
            </h2>
            <div className="live-grille">
              {termines.map(s => (
                <LiveCard
                  key={s.id}
                  session={s}
                  accesOk={accesOk(s)}
                  onClick={() => navigate(`/live/${s.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* État vide */}
        {!loading && sessions.length === 0 && !error && (
          <div className="live-vide" role="status">
            <span aria-hidden="true">📺</span>
            <h3>Aucune session disponible</h3>
            <p>
              {(filtres.statut || filtres.matiere)
                ? 'Essayez de modifier vos filtres.'
                : 'Les sessions en direct seront annoncées prochainement.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE DÉTAIL SESSION — /live/:sessionId
// ─────────────────────────────────────────────────────────────

function LiveDetailPage() {
  const { sessionId }     = useParams<{ sessionId: string }>();
  const navigate          = useNavigate();
  const { currentUser: user } = useAuth();

  // ── État ──────────────────────────────────────────────────
  const [session, setSession]   = useState<LiveSession | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [accesRefuse, setAccesRefuse] = useState(false);
  const [userData, setUserData] = useState<{ isPremium: boolean; groupeIds: string[] } | null>(null);

  // ── Chargement ────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    charger();
  }, [sessionId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      let groupeIds: string[] = [];
      if (userSnap.exists()) {
        const d = userSnap.data();
        groupeIds = d.groupeIds ?? [];
        if (groupeIds.length === 0) {
          try {
            const groupes = await getGroupesEleve(user.uid);
            groupeIds = groupes.map(g => g.id);
          } catch {
            // Silencieux
          }
        }
        setUserData({
          isPremium:  d.isPremium  ?? false,
          groupeIds,
        });
      } else {
        setUserData({ isPremium: false, groupeIds: [] });
      }
    })();
  }, [user]);

  // Vérification d'accès après chargement session + userData
  useEffect(() => {
    if (!session || userData === null) return;
    const ok = peutAccederSession(session, userData.isPremium, userData.groupeIds);
    setAccesRefuse(!ok);
    // Incrémenter les vues si accès autorisé
    if (ok) incrementerVues(session.id);
  }, [session, userData]);

  async function charger() {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getSessionById(sessionId);
      if (!data) {
        setError('Session introuvable.');
        return;
      }
      setSession(data);
    } catch {
      setError('Impossible de charger cette session.');
    } finally {
      setLoading(false);
    }
  }

  // ── Rendu chargement ──────────────────────────────────────
  if (loading) {
    return (
      <div className="live-detail live-detail--loading" aria-busy="true">
        <div className="live-detail__skeleton">
          <div className="skeleton" style={{ height: 40, width: '60%', marginBottom: 16 }} />
          <div className="skeleton live-detail__player-sk" />
        </div>
      </div>
    );
  }

  // ── Rendu erreur ─────────────────────────────────────────
  if (error || !session) {
    return (
      <div className="live-detail live-vide" role="alert">
        <span aria-hidden="true">⚠️</span>
        <h3>{error ?? 'Session introuvable'}</h3>
        <Link to="/live" className="live-btn live-btn--primary">← Retour aux sessions</Link>
      </div>
    );
  }

  // ── Rendu accès refusé ────────────────────────────────────
  if (accesRefuse) {
    return (
      <div className="live-detail">
        <div className="live-detail__premium-gate">
          <span aria-hidden="true">🔒</span>
          <h3>Accès restreint</h3>
          <p>
            {session.acces === 'premium'
              ? 'Cette session est réservée aux abonnés Premium.'
              : 'Cette session est réservée aux élèves du groupe-classe.'}
          </p>
          {session.acces === 'premium' && (
            <Link to="/premium" className="live-btn live-btn--premium">
              ⭐ Passer Premium — 2 000 FCFA/mois
            </Link>
          )}
          <Link to="/live" className="live-btn live-btn--ghost">
            ← Retour aux sessions
          </Link>
        </div>
      </div>
    );
  }

  const statut   = LABELS_STATUT_LIVE[session.statut];
  const embedUrl = buildEmbedUrl(session.youtubeId);
  const dateDebut = session.dateDebut.toDate();

  return (
    <div className="live-detail">

      {/* ════════════════════════════════════════════════════
          EN-TÊTE DE LA SESSION
      ════════════════════════════════════════════════════ */}
      <header className="live-detail__header">
        {/* Fil d'Ariane */}
        <nav className="live-detail__breadcrumb" aria-label="Navigation">
          <Link to="/live">🎓 Sessions Live</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{session.titre}</span>
        </nav>

        {/* Badge statut */}
        <div
          className="live-detail__badge"
          style={{ background: statut.couleur }}
        >
          {statut.icone} {statut.label}
          {session.statut === 'en_direct' && (
            <span className="live-card__pulse" aria-hidden="true" />
          )}
        </div>

        {/* Titre + méta */}
        <h1 className="live-detail__titre">{session.titre}</h1>
        <div className="live-detail__meta">
          <span>📚 {session.matiere}</span>
          <span aria-hidden="true">·</span>
          <span>🏫 {session.classe}</span>
          <span aria-hidden="true">·</span>
          <span>👨‍🏫 {session.profNom}</span>
          <span aria-hidden="true">·</span>
          <span>
            📅 {dateDebut.toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
          <span aria-hidden="true">·</span>
          <span>⏱ {session.dureeEstimee} min</span>
        </div>

        {/* Description */}
        {session.description && (
          <p className="live-detail__description">{session.description}</p>
        )}
      </header>

      {/* ════════════════════════════════════════════════════
          LECTEUR YOUTUBE
      ════════════════════════════════════════════════════ */}
      <section className="live-detail__player-section" aria-labelledby="player-titre">
        <h2 id="player-titre" className="sr-only">
          {session.statut === 'termine' ? 'Replay de la session' : 'Session en direct'}
        </h2>

        {/* Message session planifiée (pas encore démarrée) */}
        {session.statut === 'planifie' && (
          <div className="live-detail__attente" role="status" aria-live="polite">
            <span aria-hidden="true">⏳</span>
            <h3>La session n'a pas encore commencé</h3>
            <p>
              Début prévu le{' '}
              <strong>
                {dateDebut.toLocaleDateString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long',
                  hour: '2-digit', minute: '2-digit',
                })}
              </strong>
            </p>
            <p className="live-detail__attente-tip">
              💡 Revenez à l'heure prévue. Le lecteur apparaîtra automatiquement dès que la session sera lancée.
            </p>
            {/* Prévisualisation de la miniature YouTube */}
            <a
              href={session.urlYoutube}
              target="_blank"
              rel="noopener noreferrer"
              className="live-btn live-btn--ghost"
            >
              📺 Voir sur YouTube
            </a>
          </div>
        )}

        {/* Message session annulée */}
        {session.statut === 'annule' && (
          <div className="live-detail__annule" role="alert">
            <span aria-hidden="true">❌</span>
            <h3>Session annulée</h3>
            {session.messageAnnulation && <p>{session.messageAnnulation}</p>}
          </div>
        )}

        {/* Lecteur YouTube (live en cours ou replay) */}
        {(session.statut === 'en_direct' || session.statut === 'termine') && (
          <>
            <div className="live-detail__player-wrapper">
              <iframe
                src={embedUrl}
                title={session.titre}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                className="live-detail__iframe"
              />
            </div>

            {/* Lien de repli YouTube */}
            <p className="live-detail__youtube-link">
              Problème d'affichage ?{' '}
              <a
                href={session.urlYoutube}
                target="_blank"
                rel="noopener noreferrer"
              >
                Regarder directement sur YouTube ↗
              </a>
            </p>
          </>
        )}
      </section>

      {/* ════════════════════════════════════════════════════
          RETOUR AU CATALOGUE
      ════════════════════════════════════════════════════ */}
      <footer className="live-detail__footer">
        <Link to="/live" className="live-btn live-btn--ghost">
          ← Retour aux sessions
        </Link>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EXPORT — Routage interne (catalogue ou détail)
// ─────────────────────────────────────────────────────────────

/**
 * Composant principal exporté.
 * Affiche soit le catalogue (/live) soit le détail (/live/:sessionId)
 * selon la présence de l'URL param.
 */
export default function LivePage() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  return sessionId ? <LiveDetailPage /> : <LiveCataloguePage />;
}

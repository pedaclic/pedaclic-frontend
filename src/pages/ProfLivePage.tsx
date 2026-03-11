// ============================================================
// PedaClic — ProfLivePage.tsx
// Phase 28 : Dashboard professeur — Gestion des sessions Live
//
// Route : /prof/live
// Accès : prof Premium uniquement
//
// Fonctionnalités :
//   • Créer une nouvelle session live (formulaire complet)
//   • Lister ses sessions avec actions contextuelles
//   • Démarrer / Terminer / Annuler une session
//   • Envoyer une notification manuelle aux élèves
//   • Copier le lien de partage
// www.pedaclic.sn | Auteur : Kadou / PedaClic
// ============================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
  collection,
  getDocs,
  query,
  where,
  getDoc,
  doc,
} from 'firebase/firestore';
import {
  creerSession,
  getSessionsProf,
  changerStatutSession,
  supprimerSession,
  envoyerNotifSession,
  extractYoutubeIdLive,
} from '../liveService';
import type {
  LiveSession,
  LiveSessionFormData,
  StatutLive,
} from '../live_types';
import {
  FORM_LIVE_INITIAL,
  LABELS_STATUT_LIVE,
  LABELS_ACCES_LIVE,
  OPTIONS_DUREE,
} from '../live_types';
import '../Live.css';

// ─────────────────────────────────────────────────────────────
// TYPES LOCAUX
// ─────────────────────────────────────────────────────────────

interface GroupeOption {
  id:    string;
  nom:   string;
  classe: string;
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT — Formulaire de création d'une session
// ─────────────────────────────────────────────────────────────

interface FormulaireSessionProps {
  profNom:  string;
  groupes:  GroupeOption[];
  onCreer:  (form: LiveSessionFormData) => Promise<void>;
  onAnnuler: () => void;
  loading:  boolean;
}

function FormulaireSession({ profNom, groupes, onCreer, onAnnuler, loading }: FormulaireSessionProps) {
  const [form, setForm]           = useState<LiveSessionFormData>(FORM_LIVE_INITIAL);
  const [erreurUrl, setErreurUrl] = useState<string | null>(null);
  const [erreurs, setErreurs]     = useState<Partial<Record<keyof LiveSessionFormData, string>>>({});

  // Mise à jour générique des champs
  function set<K extends keyof LiveSessionFormData>(key: K, val: LiveSessionFormData[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setErreurs(e => ({ ...e, [key]: undefined }));
  }

  // Validation URL YouTube en temps réel
  function validerUrl(url: string) {
    set('urlYoutube', url);
    if (!url) { setErreurUrl(null); return; }
    const id = extractYoutubeIdLive(url);
    setErreurUrl(id ? null : 'URL YouTube non reconnue. Exemples : https://youtu.be/XXXX, https://www.youtube.com/live/XXXX');
  }

  // Validation et soumission
  function valider(): boolean {
    const e: typeof erreurs = {};
    if (!form.titre.trim())       e.titre       = 'Le titre est obligatoire.';
    if (!form.matiere)            e.matiere     = 'Choisissez une matière.';
    if (!form.niveau)             e.niveau      = 'Choisissez un niveau.';
    if (!form.classe)             e.classe      = 'Précisez la classe.';
    if (!form.urlYoutube.trim())  e.urlYoutube  = 'L\'URL YouTube est obligatoire.';
    if (!form.dateDebut)         e.dateDebut   = 'La date de début est obligatoire.';
    if (form.acces === 'groupe' && !form.groupeId) e.groupeId = 'Choisissez un groupe.';
    setErreurs(e);
    return Object.keys(e).length === 0 && !erreurUrl;
  }

  async function handleSoumettre() {
    if (!valider()) return;
    await onCreer(form);
  }

  return (
    /* Formulaire de création d'une session live */
    <div className="live-form" role="form" aria-label="Créer une session live">
      <div className="live-form__header">
        <h2 className="live-form__titre">📺 Nouvelle session live</h2>
        <p className="live-form__sous-titre">
          Créez votre session YouTube Live. Vos élèves pourront la rejoindre directement depuis PedaClic.
        </p>
      </div>

      <div className="live-form__body">

        {/* ── Titre ── */}
        <div className="live-form__groupe">
          <label htmlFor="lf-titre" className="live-form__label">
            Titre de la session <span aria-hidden="true">*</span>
          </label>
          <input
            id="lf-titre"
            type="text"
            className={`live-form__input ${erreurs.titre ? 'live-form__input--erreur' : ''}`}
            placeholder="Ex: Révision BFEM — Équations du 2nd degré"
            value={form.titre}
            onChange={e => set('titre', e.target.value)}
            maxLength={120}
          />
          {erreurs.titre && <p className="live-form__erreur">{erreurs.titre}</p>}
        </div>

        {/* ── Description ── */}
        <div className="live-form__groupe">
          <label htmlFor="lf-desc" className="live-form__label">
            Description <span className="live-form__optionnel">(optionnelle)</span>
          </label>
          <textarea
            id="lf-desc"
            className="live-form__textarea"
            placeholder="Résumez le programme de la session, les prérequis, etc."
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
            maxLength={400}
          />
        </div>

        {/* ── Matière / Niveau / Classe ── */}
        <div className="live-form__row">
          <div className="live-form__groupe">
            <label htmlFor="lf-matiere" className="live-form__label">Matière *</label>
            <input
              id="lf-matiere"
              type="text"
              className={`live-form__input ${erreurs.matiere ? 'live-form__input--erreur' : ''}`}
              placeholder="Ex: Mathématiques"
              value={form.matiere}
              onChange={e => set('matiere', e.target.value)}
            />
            {erreurs.matiere && <p className="live-form__erreur">{erreurs.matiere}</p>}
          </div>
          <div className="live-form__groupe">
            <label htmlFor="lf-niveau" className="live-form__label">Niveau *</label>
            <select
              id="lf-niveau"
              className={`live-form__select ${erreurs.niveau ? 'live-form__input--erreur' : ''}`}
              value={form.niveau}
              onChange={e => set('niveau', e.target.value)}
            >
              <option value="">— Choisir —</option>
              {['6ème','5ème','4ème','3ème','2nde','1ère','Terminale'].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            {erreurs.niveau && <p className="live-form__erreur">{erreurs.niveau}</p>}
          </div>
          <div className="live-form__groupe">
            <label htmlFor="lf-classe" className="live-form__label">Classe *</label>
            <input
              id="lf-classe"
              type="text"
              className={`live-form__input ${erreurs.classe ? 'live-form__input--erreur' : ''}`}
              placeholder="Ex: Terminale S"
              value={form.classe}
              onChange={e => set('classe', e.target.value)}
            />
            {erreurs.classe && <p className="live-form__erreur">{erreurs.classe}</p>}
          </div>
        </div>

        {/* ── URL YouTube Live ── */}
        <div className="live-form__groupe">
          <label htmlFor="lf-url" className="live-form__label">
            URL YouTube Live *
          </label>
          <input
            id="lf-url"
            type="url"
            className={`live-form__input ${(erreurs.urlYoutube || erreurUrl) ? 'live-form__input--erreur' : ''}`}
            placeholder="https://www.youtube.com/live/XXXX ou https://youtu.be/XXXX"
            value={form.urlYoutube}
            onChange={e => validerUrl(e.target.value)}
          />
          {(erreurs.urlYoutube || erreurUrl) && (
            <p className="live-form__erreur">{erreurs.urlYoutube ?? erreurUrl}</p>
          )}
          <p className="live-form__aide">
            💡 Créez d'abord votre live sur YouTube Studio, puis copiez-collez l'URL ici.
            <a
              href="https://studio.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="live-form__lien-externe"
            >
              Ouvrir YouTube Studio ↗
            </a>
          </p>
        </div>

        {/* ── Date / Durée ── */}
        <div className="live-form__row">
          <div className="live-form__groupe live-form__groupe--lg">
            <label htmlFor="lf-date" className="live-form__label">Date et heure de début *</label>
            <input
              id="lf-date"
              type="datetime-local"
              className={`live-form__input ${erreurs.dateDebut ? 'live-form__input--erreur' : ''}`}
              value={form.dateDebut}
              onChange={e => set('dateDebut', e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            {erreurs.dateDebut && <p className="live-form__erreur">{erreurs.dateDebut}</p>}
          </div>
          <div className="live-form__groupe">
            <label htmlFor="lf-duree" className="live-form__label">Durée estimée</label>
            <select
              id="lf-duree"
              className="live-form__select"
              value={form.dureeEstimee}
              onChange={e => set('dureeEstimee', Number(e.target.value))}
            >
              {OPTIONS_DUREE.map(o => (
                <option key={o.valeur} value={o.valeur}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Restriction d'accès ── */}
        <div className="live-form__groupe">
          <label className="live-form__label">Accès à la session</label>
          <div className="live-form__radio-groupe">
            {(['public', 'premium', 'groupe'] as const).map(a => (
              <label key={a} className={`live-form__radio-label ${form.acces === a ? 'live-form__radio-label--actif' : ''}`}>
                <input
                  type="radio"
                  name="acces"
                  value={a}
                  checked={form.acces === a}
                  onChange={() => set('acces', a)}
                />
                <span>{LABELS_ACCES_LIVE[a].icone} {LABELS_ACCES_LIVE[a].label}</span>
              </label>
            ))}
          </div>

          {/* Sélecteur de groupe si acces === 'groupe' */}
          {form.acces === 'groupe' && (
            <div className="live-form__groupe-select">
              <label htmlFor="lf-groupe" className="live-form__label">Groupe-classe *</label>
              {groupes.length > 0 ? (
                <select
                  id="lf-groupe"
                  className={`live-form__select ${erreurs.groupeId ? 'live-form__input--erreur' : ''}`}
                  value={form.groupeId}
                  onChange={e => {
                    const g = groupes.find(x => x.id === e.target.value);
                    set('groupeId', e.target.value);
                    set('groupeNom', g?.nom ?? '');
                  }}
                >
                  <option value="">— Choisir un groupe —</option>
                  {groupes.map(g => (
                    <option key={g.id} value={g.id}>{g.nom} ({g.classe})</option>
                  ))}
                </select>
              ) : (
                <p className="live-form__aide">
                  ⚠️ Vous n'avez pas encore de groupe-classe.{' '}
                  <Link to="/prof/dashboard">Créer un groupe →</Link>
                </p>
              )}
              {erreurs.groupeId && <p className="live-form__erreur">{erreurs.groupeId}</p>}
            </div>
          )}
        </div>

        {/* ── Notification ── */}
        <div className="live-form__groupe">
          <label className="live-form__checkbox-label">
            <input
              type="checkbox"
              checked={form.envoyerNotif}
              onChange={e => set('envoyerNotif', e.target.checked)}
            />
            <span>
              🔔 Notifier les élèves par email et notification in-app à la création
            </span>
          </label>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="live-form__actions">
        <button
          type="button"
          className="live-btn live-btn--ghost"
          onClick={onAnnuler}
          disabled={loading}
        >
          Annuler
        </button>
        <button
          type="button"
          className="live-btn live-btn--primary"
          onClick={handleSoumettre}
          disabled={loading || !!erreurUrl}
        >
          {loading ? '⏳ Création…' : '📺 Créer la session'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANT — Carte session du prof
// ─────────────────────────────────────────────────────────────

interface ProfLiveCardProps {
  session:         LiveSession;
  onDemarrer:      (id: string) => void;
  onTerminer:      (id: string) => void;
  onAnnuler:       (id: string) => void;
  onSupprimer:     (id: string) => void;
  onNotifier:      (session: LiveSession) => void;
  onCopierLien:    (id: string) => void;
}

function ProfLiveCard({
  session, onDemarrer, onTerminer, onAnnuler, onSupprimer, onNotifier, onCopierLien
}: ProfLiveCardProps) {
  const statut  = LABELS_STATUT_LIVE[session.statut];
  const dateStr = session.dateDebut.toDate().toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    /* Carte session dans le dashboard prof */
    <article className="prof-live-card">
      {/* En-tête */}
      <div className="prof-live-card__header">
        <div
          className="live-card__badge"
          style={{ background: statut.couleur }}
        >
          {statut.icone} {statut.label}
          {session.statut === 'en_direct' && (
            <span className="live-card__pulse" aria-hidden="true" />
          )}
        </div>
        <span className="prof-live-card__vues">👁 {session.nombreVues} vue{session.nombreVues > 1 ? 's' : ''}</span>
      </div>

      {/* Contenu */}
      <div className="prof-live-card__body">
        <p className="live-card__meta">
          <span className="live-card__matiere">{session.matiere}</span>
          <span aria-hidden="true"> · </span>
          <span>{session.classe}</span>
          <span aria-hidden="true"> · </span>
          <span>{LABELS_ACCES_LIVE[session.acces].icone} {LABELS_ACCES_LIVE[session.acces].label}</span>
        </p>
        <h3 className="prof-live-card__titre">{session.titre}</h3>
        <p className="prof-live-card__date">📅 {dateStr} — ⏱ {session.dureeEstimee} min</p>
        {session.notificationEnvoyee && (
          <p className="prof-live-card__notif-ok">✅ Notification envoyée</p>
        )}
      </div>

      {/* Actions */}
      <div className="prof-live-card__actions">
        {/* Voir la session (côté élève) */}
        <a
          href={`/live/${session.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="live-btn live-btn--ghost live-btn--sm"
          aria-label="Aperçu de la session"
        >
          👁 Aperçu
        </a>

        {/* Copier le lien de partage */}
        <button
          className="live-btn live-btn--ghost live-btn--sm"
          onClick={() => onCopierLien(session.id)}
          aria-label="Copier le lien de partage"
        >
          🔗 Lien
        </button>

        {/* Notifier manuellement */}
        {!session.notificationEnvoyee && session.statut === 'planifie' && (
          <button
            className="live-btn live-btn--ghost live-btn--sm"
            onClick={() => onNotifier(session)}
            aria-label="Envoyer notification"
          >
            🔔 Notifier
          </button>
        )}

        {/* Démarrer le live */}
        {session.statut === 'planifie' && (
          <button
            className="live-btn live-btn--danger live-btn--sm"
            onClick={() => onDemarrer(session.id)}
            aria-label="Démarrer le live"
          >
            🔴 Démarrer
          </button>
        )}

        {/* Terminer le live */}
        {session.statut === 'en_direct' && (
          <button
            className="live-btn live-btn--success live-btn--sm"
            onClick={() => onTerminer(session.id)}
            aria-label="Terminer le live"
          >
            ✅ Terminer
          </button>
        )}

        {/* Annuler */}
        {(session.statut === 'planifie' || session.statut === 'en_direct') && (
          <button
            className="live-btn live-btn--ghost live-btn--sm"
            onClick={() => onAnnuler(session.id)}
            aria-label="Annuler la session"
          >
            ❌ Annuler
          </button>
        )}

        {/* Supprimer (sessions terminées/annulées) */}
        {(session.statut === 'annule' || session.statut === 'termine') && (
          <button
            className="live-btn live-btn--ghost live-btn--sm live-btn--danger-ghost"
            onClick={() => onSupprimer(session.id)}
            aria-label="Supprimer la session"
          >
            🗑 Supprimer
          </button>
        )}
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE PRINCIPALE — Dashboard Prof
// ─────────────────────────────────────────────────────────────

export default function ProfLivePage() {
  const { currentUser: user } = useAuth();

  // ── État ──────────────────────────────────────────────────
  const [sessions, setSessions]     = useState<LiveSession[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [profNom, setProfNom]       = useState('Professeur');
  const [groupes, setGroupes]       = useState<GroupeOption[]>([]);
  const [filtreStatut, setFiltreStatut] = useState<StatutLive | ''>('');

  // ── Chargement initial ────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    chargerTout();
  }, [user]);

  async function chargerTout() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Profil prof (nom)
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        setProfNom(userSnap.data()?.nom ?? 'Professeur');
      }

      // Groupes du prof (groupes_prof — convention PedaClic)
      const gQuery = query(
        collection(db, 'groupes_prof'),
        where('profId', '==', user.uid)
      );
      const gSnap = await getDocs(gQuery);
      setGroupes(gSnap.docs.map(d => {
        const data = d.data();
        return {
          id:     d.id,
          nom:    data.nom    as string,
          classe: (data.classeNiveau ?? data.classe ?? '') as string,
        };
      }));

      // Sessions live du prof
      const data = await getSessionsProf(user.uid);
      setSessions(data);
    } catch (err) {
      setError('Impossible de charger vos sessions.');
      console.error('[ProfLivePage] chargerTout:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Affichage temporaire du message succès ─────────────────
  function afficherSucces(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  }

  // ── Création d'une session ────────────────────────────────
  async function handleCreer(form: LiveSessionFormData) {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const session = await creerSession(form, user.uid, profNom);
      setSessions(prev => [session, ...prev]);
      setShowForm(false);
      afficherSucces('🎉 Session créée avec succès !');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la création.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  // ── Démarrer un live ──────────────────────────────────────
  async function handleDemarrer(sessionId: string) {
    if (!confirm('Passer cette session en "En direct" ?')) return;
    try {
      await changerStatutSession(sessionId, 'en_direct');
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, statut: 'en_direct' } : s
      ));
      afficherSucces('🔴 Session en direct !');
    } catch {
      setError('Impossible de démarrer la session.');
    }
  }

  // ── Terminer un live ──────────────────────────────────────
  async function handleTerminer(sessionId: string) {
    if (!confirm('Terminer la session ? Le replay sera automatiquement disponible.')) return;
    try {
      await changerStatutSession(sessionId, 'termine');
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, statut: 'termine', replayDisponible: true } : s
      ));
      afficherSucces('✅ Session terminée — replay disponible !');
    } catch {
      setError('Impossible de terminer la session.');
    }
  }

  // ── Annuler une session ───────────────────────────────────
  async function handleAnnuler(sessionId: string) {
    const msg = prompt('Motif d\'annulation (optionnel) :');
    if (msg === null) return; // L'utilisateur a cliqué "Annuler"
    try {
      await changerStatutSession(sessionId, 'annule', msg || undefined);
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, statut: 'annule', messageAnnulation: msg || undefined } : s
      ));
      afficherSucces('Session annulée.');
    } catch {
      setError('Impossible d\'annuler la session.');
    }
  }

  // ── Supprimer une session ─────────────────────────────────
  async function handleSupprimer(sessionId: string) {
    if (!confirm('Supprimer définitivement cette session ?')) return;
    try {
      await supprimerSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      afficherSucces('Session supprimée.');
    } catch {
      setError('Impossible de supprimer la session.');
    }
  }

  // ── Notifier manuellement ─────────────────────────────────
  async function handleNotifier(session: LiveSession) {
    if (!user) return;
    if (!confirm('Envoyer une notification de rappel aux élèves ?')) return;
    try {
      await envoyerNotifSession(session, user.uid, profNom);
      setSessions(prev => prev.map(s =>
        s.id === session.id ? { ...s, notificationEnvoyee: true } : s
      ));
      afficherSucces('🔔 Notification envoyée !');
    } catch {
      setError('Erreur lors de l\'envoi de la notification.');
    }
  }

  // ── Copier le lien ────────────────────────────────────────
  function handleCopierLien(sessionId: string) {
    const url = `${window.location.origin}/live/${sessionId}`;
    navigator.clipboard.writeText(url).then(() => {
      afficherSucces('🔗 Lien copié !');
    });
  }

  // ── Filtrage local ────────────────────────────────────────
  const sessionsFiltrees = filtreStatut
    ? sessions.filter(s => s.statut === filtreStatut)
    : sessions;

  // ── Statistiques rapides ──────────────────────────────────
  const stats = {
    total:     sessions.length,
    enDirect:  sessions.filter(s => s.statut === 'en_direct').length,
    planifies: sessions.filter(s => s.statut === 'planifie').length,
    replays:   sessions.filter(s => s.statut === 'termine').length,
    vues:      sessions.reduce((acc, s) => acc + s.nombreVues, 0),
  };

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────
  return (
    <div className="prof-live-page">

      {/* ════════════════════════════════════════════════════
          EN-TÊTE
      ════════════════════════════════════════════════════ */}
      <header className="prof-live-page__header">
        <div>
          <h1 className="prof-live-page__titre">📺 Mes Sessions Live</h1>
          <p className="prof-live-page__sous-titre">
            Planifiez et gérez vos cours en direct YouTube. Vos élèves peuvent les rejoindre sur PedaClic.
          </p>
        </div>
        {!showForm && (
          <button
            className="live-btn live-btn--primary"
            onClick={() => setShowForm(true)}
          >
            + Nouvelle session
          </button>
        )}
      </header>

      {/* ════════════════════════════════════════════════════
          MESSAGES FEEDBACK
      ════════════════════════════════════════════════════ */}
      {success && (
        <div className="live-feedback live-feedback--success" role="status" aria-live="polite">
          {success}
        </div>
      )}
      {error && (
        <div className="live-feedback live-feedback--error" role="alert">
          ⚠️ {error}
          <button className="live-btn live-btn--ghost live-btn--sm" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          STATISTIQUES RAPIDES
      ════════════════════════════════════════════════════ */}
      {!showForm && (
        <div className="prof-live-stats">
          <div className="prof-live-stat">
            <span className="prof-live-stat__val">{stats.total}</span>
            <span className="prof-live-stat__label">Total</span>
          </div>
          <div className="prof-live-stat prof-live-stat--direct">
            <span className="prof-live-stat__val">{stats.enDirect}</span>
            <span className="prof-live-stat__label">En direct</span>
          </div>
          <div className="prof-live-stat">
            <span className="prof-live-stat__val">{stats.planifies}</span>
            <span className="prof-live-stat__label">Planifiés</span>
          </div>
          <div className="prof-live-stat">
            <span className="prof-live-stat__val">{stats.replays}</span>
            <span className="prof-live-stat__label">Replays</span>
          </div>
          <div className="prof-live-stat">
            <span className="prof-live-stat__val">{stats.vues}</span>
            <span className="prof-live-stat__label">Total vues</span>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          FORMULAIRE DE CRÉATION
      ════════════════════════════════════════════════════ */}
      {showForm && (
        <FormulaireSession
          profNom={profNom}
          groupes={groupes}
          onCreer={handleCreer}
          onAnnuler={() => setShowForm(false)}
          loading={saving}
        />
      )}

      {/* ════════════════════════════════════════════════════
          LISTE DES SESSIONS
      ════════════════════════════════════════════════════ */}
      {!showForm && (
        <>
          {/* Filtres par statut */}
          <nav className="prof-live-filtres" aria-label="Filtrer les sessions">
            {[
              { val: '',          label: `Toutes (${stats.total})` },
              { val: 'en_direct', label: `🔴 En direct (${stats.enDirect})` },
              { val: 'planifie',  label: `📅 Planifiées (${stats.planifies})` },
              { val: 'termine',   label: `▶️ Replays (${stats.replays})` },
              { val: 'annule',    label: 'Annulées' },
            ].map(f => (
              <button
                key={f.val}
                className={`prof-live-filtre-btn ${filtreStatut === f.val ? 'prof-live-filtre-btn--actif' : ''}`}
                onClick={() => setFiltreStatut(f.val as StatutLive | '')}
              >
                {f.label}
              </button>
            ))}
          </nav>

          {/* Skeleton */}
          {loading && (
            <div className="prof-live-grille">
              {[1, 2].map(i => (
                <div key={i} className="prof-live-card prof-live-card--skeleton" aria-hidden="true">
                  <div className="skeleton" style={{ height: 24, width: '30%', marginBottom: 12 }} />
                  <div className="skeleton" style={{ height: 20, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 14, width: '50%' }} />
                </div>
              ))}
            </div>
          )}

          {/* Grille des sessions */}
          {!loading && sessionsFiltrees.length > 0 && (
            <div className="prof-live-grille">
              {sessionsFiltrees.map(s => (
                <ProfLiveCard
                  key={s.id}
                  session={s}
                  onDemarrer={handleDemarrer}
                  onTerminer={handleTerminer}
                  onAnnuler={handleAnnuler}
                  onSupprimer={handleSupprimer}
                  onNotifier={handleNotifier}
                  onCopierLien={handleCopierLien}
                />
              ))}
            </div>
          )}

          {/* État vide */}
          {!loading && sessionsFiltrees.length === 0 && (
            <div className="live-vide" role="status">
              <span aria-hidden="true">📺</span>
              <h3>Aucune session {filtreStatut ? `"${LABELS_STATUT_LIVE[filtreStatut as StatutLive]?.label}"` : ''}</h3>
              <p>Créez votre première session live pour commencer.</p>
              <button
                className="live-btn live-btn--primary"
                onClick={() => setShowForm(true)}
              >
                + Créer une session
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

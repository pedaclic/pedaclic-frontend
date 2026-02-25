// ============================================================
// PedaClic — NotificationComposer.tsx
// Phase 26 : Interface d'envoi de notifications (prof / admin)
//
// Route prof  : /prof/notifications/nouvelle
// Route admin : /admin/notifications/nouvelle
//
// Fonctionnalités :
//   • Choix du type de notification
//   • Sélection du/des destinataire(s) :
//       - Utilisateur unique (UID ou email)
//       - Tous les élèves d'un groupe-classe
//       - Tous les utilisateurs d'un rôle
//   • Canal : in-app / email / les deux
//   • Pré-remplissage des templates
//   • Confirmation d'envoi avec résumé
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext';
import {
  envoyerNotification,
  envoyerNotificationGroupe,
  envoyerNotificationRole,
} from './notificationService';
import type {
  TypeNotification,
  CanalNotification,
  RoleDestinataire,
  CreateNotificationPayload,
} from './notification_types';
import {
  TEMPLATES_NOTIFICATION,
  LABELS_TYPE_NOTIFICATION,
  LABELS_ROLE,
} from './notification_types';

// ─── Types internes ──────────────────────────────────────────

type ModeDestinataire = 'individuel' | 'groupe' | 'role';

interface GroupeOption {
  id: string;
  nom: string;
  classe: string;
  nombreInscrits: number;
}

interface EtatFormulaire {
  type:              TypeNotification;
  titre:             string;
  message:           string;
  lienAction:        string;
  labelAction:       string;
  modeDestinataire:  ModeDestinataire;
  destinataireEmail: string;          // Mode individuel
  destinataireId:    string;          // Mode individuel
  groupeId:          string;          // Mode groupe
  roleDestinataire:  RoleDestinataire; // Mode rôle
  canal:             CanalNotification;
}

const ETAT_INITIAL: EtatFormulaire = {
  type:              'annonce',
  titre:             '',
  message:           '',
  lienAction:        '',
  labelAction:       '',
  modeDestinataire:  'role',
  destinataireEmail: '',
  destinataireId:    '',
  groupeId:          '',
  roleDestinataire:  'eleve',
  canal:             'les_deux',
};

// ─── Composant principal ─────────────────────────────────────

const NotificationComposer: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // ── États ──
  const [form, setForm]               = useState<EtatFormulaire>(ETAT_INITIAL);
  const [groupes, setGroupes]         = useState<GroupeOption[]>([]);
  const [envoi, setEnvoi]             = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const [nbEnvoyes, setNbEnvoyes]     = useState(0);

  // ── Charger les groupes du prof ──
  useEffect(() => {
    if (!currentUser) return;
    const isAdmin = currentUser.role === 'admin';

    const q = isAdmin
      ? query(collection(db, 'groupes_prof'))
      : query(collection(db, 'groupes_prof'), where('profId', '==', currentUser.uid));

    getDocs(q).then(snap => {
      setGroupes(snap.docs.map(d => ({
        id:              d.id,
        nom:             d.data().nom as string,
        classe:          d.data().classe as string,
        nombreInscrits:  d.data().nombreInscrits as number ?? 0,
      })));
    });
  }, [currentUser]);

  // ── Mise à jour d'un champ ──
  const setField = <K extends keyof EtatFormulaire>(key: K, value: EtatFormulaire[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ── Appliquer un template ──
  const appliquerTemplate = (type: TypeNotification) => {
    const t = TEMPLATES_NOTIFICATION[type];
    setForm(prev => ({
      ...prev,
      type,
      titre:   t.titreDefaut,
      message: t.messageDefaut,
    }));
  };

  // ── Validation ──
  const isFormValide = () => {
    if (!form.titre.trim() || !form.message.trim()) return false;
    if (form.modeDestinataire === 'individuel' && !form.destinataireEmail.trim()) return false;
    if (form.modeDestinataire === 'groupe' && !form.groupeId) return false;
    return true;
  };

  // ── Envoi ──
  const handleEnvoyer = async () => {
    if (!currentUser || !isFormValide()) return;
    setEnvoi('sending');
    setErreurEnvoi(null);

    try {
      const basePayload: Omit<CreateNotificationPayload, 'destinataireId' | 'destinataireRole' | 'groupeId'> = {
        type:        form.type,
        titre:       form.titre,
        message:     form.message,
        lienAction:  form.lienAction || undefined,
        labelAction: form.labelAction || undefined,
        emetteurId:  currentUser.uid,
        emetteurNom: currentUser.displayName || currentUser.email || 'PedaClic',
        canal:       form.canal,
      };

      if (form.modeDestinataire === 'individuel') {
        // Envoi à un utilisateur unique
        await envoyerNotification({
          ...basePayload,
          destinataireId:      form.destinataireId || form.destinataireEmail,
          destinataireRole:    'eleve',
          emailDestinataire:   form.canal !== 'in_app' ? form.destinataireEmail : undefined,
          emailDestinatairNom: form.destinataireEmail,
        });
        setNbEnvoyes(1);

      } else if (form.modeDestinataire === 'groupe') {
        // Envoi à tout un groupe-classe
        const count = await envoyerNotificationGroupe(form.groupeId, {
          ...basePayload,
          destinataireRole: 'eleve',
        });
        setNbEnvoyes(count);

      } else {
        // Envoi à tous les utilisateurs d'un rôle
        const count = await envoyerNotificationRole(form.roleDestinataire, basePayload);
        setNbEnvoyes(count);
      }

      setEnvoi('success');

    } catch (err) {
      setErreurEnvoi(err instanceof Error ? err.message : 'Erreur inconnue');
      setEnvoi('error');
    }
  };

  // ── Réinitialiser ──
  const handleReset = () => {
    setForm(ETAT_INITIAL);
    setEnvoi('idle');
    setErreurEnvoi(null);
    setNbEnvoyes(0);
  };

  // ─── Rendu succès ────────────────────────────────────────

  if (envoi === 'success') {
    return (
      <div className="notif-composer notif-composer--success">
        <div className="notif-composer__success-card">
          <span className="notif-composer__success-icon">🎉</span>
          <h2>Notification envoyée !</h2>
          <p>
            <strong>{nbEnvoyes}</strong> destinataire{nbEnvoyes > 1 ? 's' : ''} notifié{nbEnvoyes > 1 ? 's' : ''}.
          </p>
          <div className="notif-composer__success-actions">
            <button className="notif-composer__btn notif-composer__btn--primary" onClick={handleReset}>
              ✉️ Nouvelle notification
            </button>
            <button className="notif-composer__btn notif-composer__btn--secondary" onClick={() => navigate(-1)}>
              ← Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Rendu principal ─────────────────────────────────────

  return (
    /* Formulaire de composition de notification */
    <div className="notif-composer">

      {/* En-tête */}
      <div className="notif-composer__header">
        <button className="notif-composer__back-btn" onClick={() => navigate(-1)}>
          ← Retour
        </button>
        <h1 className="notif-composer__title">📢 Envoyer une notification</h1>
      </div>

      <div className="notif-composer__form">

        {/* ── Section 1 : Type de notification ── */}
        <section className="notif-composer__section">
          <h2 className="notif-composer__section-title">1. Type de notification</h2>

          <div className="notif-composer__type-grid">
            {(Object.entries(LABELS_TYPE_NOTIFICATION) as [TypeNotification, string][])
              .filter(([type]) => !['bienvenue', 'nouveau_abonnement', 'resultat_quiz'].includes(type))
              .map(([type, label]) => {
                const t = TEMPLATES_NOTIFICATION[type];
                return (
                  <button
                    key={type}
                    className={`notif-composer__type-card ${form.type === type ? 'notif-composer__type-card--active' : ''}`}
                    onClick={() => appliquerTemplate(type)}
                    style={form.type === type ? { borderColor: t.couleur, background: t.couleur + '12' } : {}}
                  >
                    <span className="notif-composer__type-icon">{t.icone}</span>
                    <span className="notif-composer__type-label">{label}</span>
                  </button>
                );
              })}
          </div>
        </section>

        {/* ── Section 2 : Destinataires ── */}
        <section className="notif-composer__section">
          <h2 className="notif-composer__section-title">2. Destinataires</h2>

          {/* Sélecteur de mode */}
          <div className="notif-composer__mode-tabs">
            {([
              { value: 'role',        label: '🌍 Par rôle' },
              { value: 'groupe',      label: '👥 Groupe-classe' },
              { value: 'individuel',  label: '👤 Individuel' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                className={`notif-composer__mode-tab ${form.modeDestinataire === value ? 'notif-composer__mode-tab--active' : ''}`}
                onClick={() => setField('modeDestinataire', value)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Mode rôle ── */}
          {form.modeDestinataire === 'role' && (
            <div className="notif-composer__field">
              <label className="notif-composer__label">Envoyer à :</label>
              <div className="notif-composer__role-grid">
                {(Object.entries(LABELS_ROLE) as [RoleDestinataire, string][]).map(([role, label]) => (
                  <button
                    key={role}
                    className={`notif-composer__role-card ${form.roleDestinataire === role ? 'notif-composer__role-card--active' : ''}`}
                    onClick={() => setField('roleDestinataire', role)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Mode groupe ── */}
          {form.modeDestinataire === 'groupe' && (
            <div className="notif-composer__field">
              <label className="notif-composer__label">Groupe-classe :</label>
              {groupes.length === 0 ? (
                <p className="notif-composer__hint">Aucun groupe-classe disponible.</p>
              ) : (
                <select
                  className="notif-composer__select"
                  value={form.groupeId}
                  onChange={e => setField('groupeId', e.target.value)}
                >
                  <option value="">— Choisir un groupe —</option>
                  {groupes.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.nom} — {g.classe} ({g.nombreInscrits} élèves)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── Mode individuel ── */}
          {form.modeDestinataire === 'individuel' && (
            <div className="notif-composer__field">
              <label className="notif-composer__label">Email du destinataire :</label>
              <input
                type="email"
                className="notif-composer__input"
                placeholder="eleve@exemple.sn"
                value={form.destinataireEmail}
                onChange={e => setField('destinataireEmail', e.target.value)}
              />
              <p className="notif-composer__hint">
                L'utilisateur doit être inscrit sur PedaClic.
              </p>
            </div>
          )}
        </section>

        {/* ── Section 3 : Contenu ── */}
        <section className="notif-composer__section">
          <h2 className="notif-composer__section-title">3. Contenu</h2>

          {/* Titre */}
          <div className="notif-composer__field">
            <label className="notif-composer__label" htmlFor="notif-titre">
              Titre <span className="notif-composer__required">*</span>
            </label>
            <input
              id="notif-titre"
              type="text"
              className="notif-composer__input"
              placeholder="Ex : Nouveau devoir de mathématiques"
              value={form.titre}
              onChange={e => setField('titre', e.target.value)}
              maxLength={100}
            />
            <span className="notif-composer__char-count">{form.titre.length}/100</span>
          </div>

          {/* Message */}
          <div className="notif-composer__field">
            <label className="notif-composer__label" htmlFor="notif-message">
              Message <span className="notif-composer__required">*</span>
            </label>
            <textarea
              id="notif-message"
              className="notif-composer__textarea"
              placeholder="Rédigez votre message ici…"
              value={form.message}
              onChange={e => setField('message', e.target.value)}
              rows={4}
              maxLength={500}
            />
            <span className="notif-composer__char-count">{form.message.length}/500</span>
          </div>

          {/* Lien d'action (optionnel) */}
          <div className="notif-composer__field-row">
            <div className="notif-composer__field">
              <label className="notif-composer__label" htmlFor="notif-lien">
                Lien d'action <span className="notif-composer__optional">(optionnel)</span>
              </label>
              <input
                id="notif-lien"
                type="text"
                className="notif-composer__input"
                placeholder="/cours/abc123"
                value={form.lienAction}
                onChange={e => setField('lienAction', e.target.value)}
              />
            </div>
            <div className="notif-composer__field">
              <label className="notif-composer__label" htmlFor="notif-label">
                Texte du bouton <span className="notif-composer__optional">(optionnel)</span>
              </label>
              <input
                id="notif-label"
                type="text"
                className="notif-composer__input"
                placeholder="Voir le cours"
                value={form.labelAction}
                onChange={e => setField('labelAction', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ── Section 4 : Canal d'envoi ── */}
        <section className="notif-composer__section">
          <h2 className="notif-composer__section-title">4. Canal d'envoi</h2>

          <div className="notif-composer__canal-grid">
            {([
              { value: 'in_app',   label: '🔔 In-app seulement',    desc: 'Cloche dans l\'interface' },
              { value: 'email',    label: '📧 Email seulement',      desc: 'Via Resend' },
              { value: 'les_deux', label: '🔔📧 In-app + Email',     desc: 'Les deux canaux' },
            ] as const).map(({ value, label, desc }) => (
              <button
                key={value}
                className={`notif-composer__canal-card ${form.canal === value ? 'notif-composer__canal-card--active' : ''}`}
                onClick={() => setField('canal', value)}
              >
                <span className="notif-composer__canal-label">{label}</span>
                <span className="notif-composer__canal-desc">{desc}</span>
              </button>
            ))}
          </div>

          {(form.canal === 'email' || form.canal === 'les_deux') && form.modeDestinataire !== 'individuel' && (
            <p className="notif-composer__canal-warning">
              ⚠️ Pour l'envoi par email en mode groupe/rôle, assurez-vous que Railway est bien déployé et que la clé API Resend est configurée.
            </p>
          )}
        </section>

        {/* ── Erreur d'envoi ── */}
        {envoi === 'error' && erreurEnvoi && (
          <div className="notif-composer__error">
            ⚠️ {erreurEnvoi}
          </div>
        )}

        {/* ── Boutons d'action ── */}
        <div className="notif-composer__footer">
          <button
            className="notif-composer__btn notif-composer__btn--secondary"
            onClick={() => navigate(-1)}
            disabled={envoi === 'sending'}
          >
            Annuler
          </button>
          <button
            className="notif-composer__btn notif-composer__btn--primary"
            onClick={handleEnvoyer}
            disabled={!isFormValide() || envoi === 'sending'}
          >
            {envoi === 'sending' ? '⏳ Envoi en cours…' : '📢 Envoyer la notification'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default NotificationComposer;

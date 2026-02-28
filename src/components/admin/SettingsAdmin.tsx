/**
 * ============================================================================
 * COMPOSANT SETTINGS ADMIN - PedaClic
 * ============================================================================
 * Page de configuration de la plateforme.
 * Permet de gérer :
 *   - Informations de la plateforme
 *   - Tarifs Premium (mensuel / annuel)
 *   - Mode maintenance
 *   - Paramètres des quiz
 * 
 * Les paramètres sont stockés dans Firestore : collection "settings",
 * document "platform".
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';

// ==================== INTERFACES ====================

/** Configuration de la plateforme stockée dans Firestore */
interface PlatformSettings {
  /* Informations générales */
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  contactPhone: string;

  /* Tarifs Premium (FCFA) — Accès illimité */
  premium3m: number;
  premium6m: number;
  premium1an: number;

  /* Paramètres des quiz */
  quizDureeDefaut: number;         /* Durée par défaut en minutes */
  quizNoteMinimale: number;        /* Note minimale pour réussir (/20) */
  quizTentativesMax: number;       /* Nombre max de tentatives par quiz */

  /* Mode maintenance */
  maintenanceMode: boolean;
  maintenanceMessage: string;

  /* Cahier de textes */
  cahierPdfExport: boolean;   /* Autoriser l'export PDF du cahier */

  /* Métadonnées */
  updatedAt?: any;
  updatedBy?: string;
}

/** Valeurs par défaut */
const DEFAULT_SETTINGS: PlatformSettings = {
  siteName: 'PedaClic',
  siteDescription: "L'école en un clic — Plateforme éducative sénégalaise",
  contactEmail: 'contact@pedaclic.sn',
  contactPhone: '+221 XX XXX XX XX',
  premium3m: 10000,
  premium6m: 20000,
  premium1an: 30000,
  quizDureeDefaut: 15,
  quizNoteMinimale: 10,
  quizTentativesMax: 3,
  maintenanceMode: false,
  maintenanceMessage: 'PedaClic est en maintenance. Nous revenons bientôt !',
  cahierPdfExport: true,
};

// ==================== COMPOSANT PRINCIPAL ====================

const SettingsAdmin: React.FC = () => {
  // ==================== ÉTAT ====================

  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // ==================== CHARGEMENT ====================

  /**
   * Charge les paramètres depuis Firestore
   * Si le document n'existe pas, on utilise les valeurs par défaut
   */
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const docRef = doc(db, 'settings', 'platform');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as Record<string, unknown>;
        const merged = { ...DEFAULT_SETTINGS, ...data } as PlatformSettings;
        setSettings(merged);
        setOriginalSettings(merged);
      } else {
        /* Premier lancement : utiliser les valeurs par défaut */
        setSettings(DEFAULT_SETTINGS);
        setOriginalSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('Erreur chargement paramètres:', err);
      setError('Impossible de charger les paramètres.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  /* Auto-dismiss du message de succès */
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  /* Détecter les changements non sauvegardés */
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  // ==================== HANDLERS ====================

  /** Met à jour un champ dans les settings */
  const handleChange = (field: keyof PlatformSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  /** Sauvegarde les paramètres dans Firestore */
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      /* Validation basique */
      if (settings.premium3m < 0 || settings.premium6m < 0 || settings.premium1an < 0) {
        setError('Les tarifs ne peuvent pas être négatifs.');
        return;
      }

      if (settings.quizNoteMinimale < 0 || settings.quizNoteMinimale > 20) {
        setError('La note minimale doit être entre 0 et 20.');
        return;
      }

      const docRef = doc(db, 'settings', 'platform');
      await setDoc(docRef, {
        ...settings,
        updatedAt: serverTimestamp(),
      });

      setOriginalSettings(settings);
      setHasChanges(false);
      setSuccessMessage('Paramètres sauvegardés avec succès !');
    } catch (err) {
      console.error('Erreur sauvegarde paramètres:', err);
      setError('Impossible de sauvegarder les paramètres.');
    } finally {
      setSaving(false);
    }
  };

  /** Annuler les modifications (revenir aux valeurs d'origine) */
  const handleCancel = () => {
    setSettings(originalSettings);
    setHasChanges(false);
  };

  /** Réinitialiser aux valeurs par défaut */
  const handleReset = () => {
    if (window.confirm('Réinitialiser tous les paramètres aux valeurs par défaut ?')) {
      setSettings(DEFAULT_SETTINGS);
    }
  };

  // ==================== RENDU ====================

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Chargement des paramètres...</p>
      </div>
    );
  }

  return (
    <div className="settings-admin">
      {/* ==================== EN-TÊTE ==================== */}
      <div className="admin-page-header">
        <div className="admin-page-header__info">
          <h1 className="admin-page-header__title">⚙️ Configuration</h1>
          <p className="admin-page-header__subtitle">
            Paramètres généraux de la plateforme PedaClic
          </p>
        </div>
        <div className="admin-page-header__actions">
          {hasChanges && (
            <button className="admin-btn admin-btn-ghost" onClick={handleCancel}>
              Annuler
            </button>
          )}
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Bannière changements non sauvegardés */}
      {hasChanges && (
        <div className="settings-unsaved-banner">
          ⚠️ Vous avez des modifications non sauvegardées.
        </div>
      )}

      {/* Messages d'erreur / succès */}
      {error && <div className="admin-alert admin-alert--error">❌ {error}</div>}
      {successMessage && <div className="admin-alert admin-alert--success">✅ {successMessage}</div>}

      {/* ==================== SECTION : INFORMATIONS GÉNÉRALES ==================== */}
      <div className="settings-section">
        <div className="settings-section__header">
          <h2 className="settings-section__title">🏫 Informations générales</h2>
          <p className="settings-section__description">
            Informations de base de la plateforme
          </p>
        </div>

        <div className="settings-grid">
          {/* Nom du site */}
          <div className="settings-field">
            <label className="settings-label">Nom du site</label>
            <input
              type="text"
              className="admin-input"
              value={settings.siteName}
              onChange={(e) => handleChange('siteName', e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="settings-field settings-field--full">
            <label className="settings-label">Description</label>
            <input
              type="text"
              className="admin-input"
              value={settings.siteDescription}
              onChange={(e) => handleChange('siteDescription', e.target.value)}
            />
          </div>

          {/* Email de contact */}
          <div className="settings-field">
            <label className="settings-label">Email de contact</label>
            <input
              type="email"
              className="admin-input"
              value={settings.contactEmail}
              onChange={(e) => handleChange('contactEmail', e.target.value)}
            />
          </div>

          {/* Téléphone */}
          <div className="settings-field">
            <label className="settings-label">Téléphone</label>
            <input
              type="tel"
              className="admin-input"
              value={settings.contactPhone}
              onChange={(e) => handleChange('contactPhone', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ==================== SECTION : TARIFS PREMIUM ==================== */}
      <div className="settings-section">
        <div className="settings-section__header">
          <h2 className="settings-section__title">💰 Tarifs Premium</h2>
          <p className="settings-section__description">
            Montants des abonnements en FCFA
          </p>
        </div>

        <div className="settings-grid">
          <div className="settings-field">
            <label className="settings-label">Accès illimité 3 mois (FCFA)</label>
            <input
              type="number"
              className="admin-input"
              value={settings.premium3m}
              onChange={(e) => handleChange('premium3m', parseInt(e.target.value) || 0)}
              min={0}
              step={500}
            />
          </div>
          <div className="settings-field">
            <label className="settings-label">Accès illimité 6 mois (FCFA)</label>
            <input
              type="number"
              className="admin-input"
              value={settings.premium6m}
              onChange={(e) => handleChange('premium6m', parseInt(e.target.value) || 0)}
              min={0}
              step={1000}
            />
            <span className="settings-hint">Économie vs 2×3 mois : {(settings.premium3m * 2 - settings.premium6m).toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div className="settings-field">
            <label className="settings-label">Accès illimité 1 an (FCFA)</label>
            <input
              type="number"
              className="admin-input"
              value={settings.premium1an}
              onChange={(e) => handleChange('premium1an', parseInt(e.target.value) || 0)}
              min={0}
              step={1000}
            />
            <span className="settings-hint">Économie vs 4×3 mois : {(settings.premium3m * 4 - settings.premium1an).toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>
      </div>

      {/* ==================== SECTION : PARAMÈTRES DES QUIZ ==================== */}
      <div className="settings-section">
        <div className="settings-section__header">
          <h2 className="settings-section__title">🧩 Paramètres des Quiz</h2>
          <p className="settings-section__description">
            Valeurs par défaut pour la création de quiz
          </p>
        </div>

        <div className="settings-grid">
          {/* Durée par défaut */}
          <div className="settings-field">
            <label className="settings-label">Durée par défaut (minutes)</label>
            <input
              type="number"
              className="admin-input"
              value={settings.quizDureeDefaut}
              onChange={(e) => handleChange('quizDureeDefaut', parseInt(e.target.value) || 0)}
              min={1}
              max={120}
            />
          </div>

          {/* Note minimale */}
          <div className="settings-field">
            <label className="settings-label">Note minimale pour réussir (/20)</label>
            <input
              type="number"
              className="admin-input"
              value={settings.quizNoteMinimale}
              onChange={(e) => handleChange('quizNoteMinimale', parseInt(e.target.value) || 0)}
              min={0}
              max={20}
            />
          </div>

          {/* Tentatives max */}
          <div className="settings-field">
            <label className="settings-label">Tentatives max par quiz</label>
            <input
              type="number"
              className="admin-input"
              value={settings.quizTentativesMax}
              onChange={(e) => handleChange('quizTentativesMax', parseInt(e.target.value) || 0)}
              min={1}
              max={10}
            />
            <span className="settings-hint">0 = illimité</span>
          </div>
        </div>
      </div>

      {/* ==================== SECTION : CAHIER DE TEXTES ==================== */}
      <div className="settings-section">
        <div className="settings-section__header">
          <h2 className="settings-section__title">📓 Cahier de Textes</h2>
          <p className="settings-section__description">
            Options des fonctionnalités du cahier de textes pour les professeurs
          </p>
        </div>

        <div className="settings-grid">
          <div className="settings-field">
            <label className="settings-label">Export PDF du cahier</label>
            <div className="settings-toggle-wrapper">
              <button
                className={`settings-toggle ${settings.cahierPdfExport ? 'settings-toggle--active' : ''}`}
                onClick={() => handleChange('cahierPdfExport', !settings.cahierPdfExport)}
              >
                <span className="settings-toggle__knob" />
              </button>
              <span className={`settings-toggle-label ${settings.cahierPdfExport ? 'settings-toggle-label--active' : ''}`}>
                {settings.cahierPdfExport ? '🟢 Export PDF activé' : '🔴 Export PDF désactivé'}
              </span>
            </div>
            <span className="settings-hint">
              Affiche le bouton "📄 PDF" dans les cahiers de textes des professeurs
            </span>
          </div>
        </div>
      </div>

      {/* ==================== SECTION : MODE MAINTENANCE ==================== */}
      <div className="settings-section">
        <div className="settings-section__header">
          <h2 className="settings-section__title">🔧 Mode Maintenance</h2>
          <p className="settings-section__description">
            Activer pour bloquer l'accès au site pendant les mises à jour
          </p>
        </div>

        <div className="settings-grid">
          {/* Toggle maintenance */}
          <div className="settings-field">
            <label className="settings-label">Mode maintenance</label>
            <div className="settings-toggle-wrapper">
              <button
                className={`settings-toggle ${settings.maintenanceMode ? 'settings-toggle--active' : ''}`}
                onClick={() => handleChange('maintenanceMode', !settings.maintenanceMode)}
              >
                <span className="settings-toggle__knob" />
              </button>
              <span className={`settings-toggle-label ${settings.maintenanceMode ? 'settings-toggle-label--active' : ''}`}>
                {settings.maintenanceMode ? '🔴 Maintenance activée' : '🟢 Site en ligne'}
              </span>
            </div>
          </div>

          {/* Message de maintenance */}
          <div className="settings-field settings-field--full">
            <label className="settings-label">Message affiché aux visiteurs</label>
            <textarea
              className="admin-input admin-textarea"
              rows={3}
              value={settings.maintenanceMessage}
              onChange={(e) => handleChange('maintenanceMessage', e.target.value)}
              disabled={!settings.maintenanceMode}
            />
          </div>
        </div>
      </div>

      {/* ==================== ACTIONS ==================== */}
      <div className="settings-actions">
        <button className="admin-btn admin-btn-ghost" onClick={handleReset}>
          🔄 Réinitialiser aux valeurs par défaut
        </button>
        <button
          className="admin-btn admin-btn-primary"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder les modifications'}
        </button>
      </div>
    </div>
  );
};

export default SettingsAdmin;

// ============================================================
// PedaClic — Phase 45 : AnneesScolairesManager.tsx
// Route admin : /admin/annees-scolaires
//   (menu « Paramètres » → « Années scolaires »)
// ------------------------------------------------------------
// Permet à l'administrateur de :
//   • choisir comment est déterminée l'année EN COURS :
//       - automatique (date du jour + mois de rentrée, défaut octobre)
//       - manuelle (année imposée, ex. rentrée décalée) ;
//   • ajouter, activer/désactiver, supprimer les années proposées
//     dans les listes déroulantes (Cahier de textes, Emploi du temps).
//
// Garanties « zéro perturbation » :
//   • désactiver/supprimer une année ne touche AUCUN cahier existant
//     (seule la liste proposée change ; l'année d'un cahier existant
//     reste toujours affichée dans son formulaire d'édition) ;
//   • l'année en cours est toujours proposée, même désactivée.
//
// Stockage : settings/annees_scolaires (lecture publique, écriture admin).
// Styles   : admin.css (settings-*, admin-*) + AnneesScolaires.css.
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import {
  MOIS_LIBELLES,
  configParDefaut,
  debutAnnee,
  estAnneeScolaireValide,
  libelleDepuisDebut,
  resoudreAnneeCourante,
  type AnneesScolairesConfig,
} from '../../types/anneesScolaires.types';
import {
  getAnneesScolairesConfig,
  saveAnneesScolairesConfig,
} from '../../services/anneesScolairesService';
import '../../styles/AnneesScolaires.css';

const AnneesScolairesManager: React.FC = () => {
  const { currentUser } = useAuth();
  const confirmDlg = useConfirm();

  // ── État ──────────────────────────────────────────────────
  const [config, setConfig] = useState<AnneesScolairesConfig>(() => configParDefaut());
  const [original, setOriginal] = useState<AnneesScolairesConfig>(() => configParDefaut());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nouvelle, setNouvelle] = useState('');            // champ « Ajouter une année »
  const [message, setMessage] = useState<{ type: 'success' | 'error'; texte: string } | null>(null);

  // ── Chargement initial ────────────────────────────────────
  useEffect(() => {
    getAnneesScolairesConfig().then((c) => {
      setConfig(c);
      setOriginal(c);
      setLoading(false);
    });
  }, []);

  /** Vrai si des modifications ne sont pas encore enregistrées */
  const modifie = useMemo(() => JSON.stringify(config) !== JSON.stringify(original), [config, original]);

  /** Année en cours effective (aperçu en direct, avant sauvegarde) */
  const anneeEffective = useMemo(() => resoudreAnneeCourante(config), [config]);

  /** Année proposée par le bouton « Ajouter l'année suivante » */
  const anneeSuivante = useMemo(() => {
    const debuts = config.annees.map((a) => debutAnnee(a.libelle));
    const max = debuts.length ? Math.max(...debuts) : debutAnnee(anneeEffective);
    return libelleDepuisDebut(max + 1);
  }, [config.annees, anneeEffective]);

  // ── Mises à jour ──────────────────────────────────────────
  const maj = (partiel: Partial<AnneesScolairesConfig>) => {
    setConfig((prev) => ({ ...prev, ...partiel }));
    setMessage(null);
  };

  /** Ajoute une année (validation du format + doublon), puis trie */
  const ajouter = (libelle: string) => {
    const l = libelle.trim();
    if (!estAnneeScolaireValide(l)) {
      setMessage({ type: 'error', texte: `« ${l || '(vide)'} » n'est pas valide. Format attendu : AAAA-AAAA (ex. 2027-2028).` });
      return;
    }
    if (config.annees.some((a) => a.libelle === l)) {
      setMessage({ type: 'error', texte: `L'année ${l} existe déjà.` });
      return;
    }
    maj({
      annees: [...config.annees, { libelle: l, active: true }]
        .sort((a, b) => debutAnnee(a.libelle) - debutAnnee(b.libelle)),
    });
    setNouvelle('');
  };

  /** Active / désactive une année dans les listes déroulantes */
  const basculer = (libelle: string) =>
    maj({ annees: config.annees.map((a) => (a.libelle === libelle ? { ...a, active: !a.active } : a)) });

  /** Supprime une année de la liste (les cahiers existants ne sont PAS modifiés) */
  const supprimer = async (libelle: string) => {
    const ok = await confirmDlg({
      title: `Retirer l'année ${libelle} ?`,
      message:
        "Elle ne sera plus proposée dans les listes. Les cahiers, groupes et emplois du temps déjà rattachés à cette année ne sont ni modifiés ni supprimés.",
      confirmLabel: 'Retirer',
      variant: 'danger',
    });
    if (!ok) return;
    const reste = config.annees.filter((a) => a.libelle !== libelle);
    // Si l'année imposée est retirée, on repasse en automatique (cohérence)
    const imposeeRetiree = config.mode === 'manuel' && config.anneeCouranteManuelle === libelle;
    maj({
      annees: reste,
      ...(imposeeRetiree ? { mode: 'auto' as const, anneeCouranteManuelle: null } : {}),
    });
  };

  // ── Enregistrement ────────────────────────────────────────
  const enregistrer = async () => {
    if (config.annees.length === 0) {
      setMessage({ type: 'error', texte: 'Conservez au moins une année scolaire.' });
      return;
    }
    if (config.mode === 'manuel' && !estAnneeScolaireValide(config.anneeCouranteManuelle)) {
      setMessage({ type: 'error', texte: "Choisissez l'année à imposer, ou repassez en mode automatique." });
      return;
    }
    setSaving(true);
    try {
      await saveAnneesScolairesConfig(config, currentUser?.uid);
      setOriginal(config);
      setMessage({ type: 'success', texte: `Enregistré. Année en cours : ${anneeEffective} (appliquée immédiatement aux enseignants).` });
    } catch (err) {
      console.error('[AnneesScolairesManager] Sauvegarde :', err);
      setMessage({ type: 'error', texte: "Erreur lors de l'enregistrement. Vérifiez votre connexion et vos droits admin." });
    } finally {
      setSaving(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Chargement des années scolaires...</p>
      </div>
    );
  }

  return (
    <div className="settings-admin">
      {/* ===== EN-TÊTE ===== */}
      <div className="admin-page-header">
        <div className="admin-page-header__info">
          <h1 className="admin-page-header__title">📅 Années scolaires</h1>
          <p className="admin-page-header__subtitle">
            Année en cours par défaut et années proposées aux enseignants (Cahier de textes, Emploi du temps)
          </p>
        </div>
        <div className="admin-page-header__actions">
          {modifie && (
            <button className="admin-btn admin-btn-ghost" onClick={() => { setConfig(original); setMessage(null); }}>
              Annuler
            </button>
          )}
          <button className="admin-btn admin-btn-primary" onClick={enregistrer} disabled={!modifie || saving}>
            {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder'}
          </button>
        </div>
      </div>

      {modifie && <div className="settings-unsaved-banner">⚠️ Vous avez des modifications non sauvegardées.</div>}
      {message && (
        <div className={`admin-alert admin-alert--${message.type}`} role="status">
          {message.type === 'success' ? '✅' : '❌'} {message.texte}
        </div>
      )}

      {/* ===== SECTION 1 : ANNÉE EN COURS ===== */}
      <div className="settings-section">
        <div className="settings-section__header">
          <h2 className="settings-section__title">🎯 Année en cours</h2>
          <p className="settings-section__description">
            Année sélectionnée par défaut à l'ouverture du Cahier de textes et proposée à la création d'un cahier.
          </p>
        </div>

        {/* Choix du mode : deux cartes radio */}
        <div className="annees-modes" role="radiogroup" aria-label="Mode de calcul de l'année en cours">
          <label className={`annees-mode ${config.mode === 'auto' ? 'annees-mode--active' : ''}`}>
            <input
              type="radio"
              name="mode-annee"
              checked={config.mode === 'auto'}
              onChange={() => maj({ mode: 'auto' })}
            />
            <div>
              <strong>Automatique (recommandé)</strong>
              <span>Bascule seule chaque année au mois de rentrée.</span>
            </div>
          </label>
          <label className={`annees-mode ${config.mode === 'manuel' ? 'annees-mode--active' : ''}`}>
            <input
              type="radio"
              name="mode-annee"
              checked={config.mode === 'manuel'}
              onChange={() => maj({
                mode: 'manuel',
                // Pré-sélection : l'année actuellement effective
                anneeCouranteManuelle: config.anneeCouranteManuelle ?? anneeEffective,
              })}
            />
            <div>
              <strong>Manuelle</strong>
              <span>Vous imposez l'année (ex. rentrée décalée).</span>
            </div>
          </label>
        </div>

        <div className="settings-grid" style={{ marginTop: 'var(--spacing-lg)' }}>
          {config.mode === 'auto' ? (
            /* Mois de rentrée (mode automatique) */
            <div className="settings-field">
              <label className="settings-label" htmlFor="mois-rentree">Mois de rentrée</label>
              <select
                id="mois-rentree"
                className="admin-select"
                value={config.moisRentree}
                onChange={(e) => maj({ moisRentree: Number(e.target.value) })}
              >
                {MOIS_LIBELLES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <span className="settings-hint">
                À partir du 1er {MOIS_LIBELLES[config.moisRentree - 1].toLowerCase()}, la nouvelle année devient l'année en cours.
              </span>
            </div>
          ) : (
            /* Année imposée (mode manuel) */
            <div className="settings-field">
              <label className="settings-label" htmlFor="annee-imposee">Année imposée *</label>
              <select
                id="annee-imposee"
                className="admin-select"
                value={config.anneeCouranteManuelle ?? ''}
                onChange={(e) => maj({ anneeCouranteManuelle: e.target.value || null })}
              >
                <option value="">— Choisir —</option>
                {config.annees.map((a) => <option key={a.libelle} value={a.libelle}>{a.libelle}</option>)}
              </select>
              <span className="settings-hint">
                Pensez à repasser en automatique ensuite : l'année imposée ne change plus d'elle-même.
              </span>
            </div>
          )}
        </div>

        {/* Aperçu en direct */}
        <div className="annees-effective" aria-live="polite">
          Année en cours effective : <strong>{anneeEffective}</strong>
          {/* Signale un changement non encore enregistré */}
          {modifie && anneeEffective !== resoudreAnneeCourante(original) && ` (actuellement : ${resoudreAnneeCourante(original)} — après sauvegarde)`}
        </div>
      </div>

      {/* ===== SECTION 2 : ANNÉES PROPOSÉES ===== */}
      <div className="settings-section">
        <div className="settings-section__header">
          <h2 className="settings-section__title">🗂️ Années proposées</h2>
          <p className="settings-section__description">
            Années affichées dans les listes déroulantes. Désactiver ou retirer une année ne modifie aucune donnée existante.
          </p>
        </div>

        <div className="annees-table-wrap">
          <table className="admin-table annees-table">
            <thead>
              <tr>
                <th scope="col">Année</th>
                <th scope="col">Proposée aux enseignants</th>
                <th scope="col" className="annees-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {config.annees.map((a) => {
                const estCourante = a.libelle === anneeEffective;
                return (
                  <tr key={a.libelle} className={a.active ? '' : 'annees-row--inactive'}>
                    <td>
                      <span className="annees-table__libelle">{a.libelle}</span>
                      {estCourante && <span className="annees-badge-courante">En cours</span>}
                    </td>
                    <td>
                      <div className="settings-toggle-wrapper">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={a.active}
                          aria-label={`Proposer l'année ${a.libelle}`}
                          className={`settings-toggle ${a.active ? 'settings-toggle--active' : ''}`}
                          onClick={() => basculer(a.libelle)}
                        >
                          <span className="settings-toggle__knob" />
                        </button>
                        <span className={`settings-toggle-label ${a.active ? 'settings-toggle-label--active' : ''}`}>
                          {a.active ? 'Oui' : estCourante ? 'Non (reste proposée : année en cours)' : 'Non'}
                        </span>
                      </div>
                    </td>
                    <td className="annees-table__actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-sm"
                        onClick={() => supprimer(a.libelle)}
                        disabled={config.annees.length <= 1}
                        title={config.annees.length <= 1 ? 'Au moins une année est requise' : 'Retirer de la liste'}
                        aria-label={`Retirer l'année ${a.libelle}`}
                      >
                        🗑️ Retirer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Ajout d'une année */}
        <form
          className="annees-ajout"
          onSubmit={(e) => { e.preventDefault(); ajouter(nouvelle); }}
        >
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => ajouter(anneeSuivante)}>
            + Ajouter {anneeSuivante}
          </button>
          <span className="settings-hint">ou</span>
          <input
            type="text"
            className="admin-input"
            placeholder="AAAA-AAAA"
            maxLength={9}
            value={nouvelle}
            aria-label="Nouvelle année scolaire"
            onChange={(e) => setNouvelle(e.target.value)}
          />
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" disabled={!nouvelle.trim()}>
            Ajouter
          </button>
        </form>
        <p className="settings-hint" style={{ marginTop: 8 }}>
          N'oubliez pas de cliquer sur « Sauvegarder » pour appliquer les changements.
        </p>
      </div>
    </div>
  );
};

export default AnneesScolairesManager;

// ============================================================
// PedaClic — Phase 44 : NiveauxManager.tsx
// Route admin : /admin/niveaux   (menu « Principal » → « Niveaux (accueil) »)
// ------------------------------------------------------------
// Permet à l'administrateur de modifier, pour chacun des 5 niveaux :
//   • l'affichage (actif / masqué) et l'ordre sur l'accueil ;
//   • l'icône, le titre, la ligne des classes, les points forts,
//     le libellé du lien de la carte ;
//   • le texte d'introduction de la page /niveaux/:slug.
// Les DISCIPLINES et COURS affichés dans ces pages restent gérés
// dans leurs écrans habituels (liens rapides en bas de chaque bloc).
//
// Stockage : settings/niveaux (lecture publique, écriture admin).
// Styles   : classes existantes de admin.css (settings-*, admin-*)
//            → aspect identique à l'écran « Configuration ».
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import type { Niveau } from '../../types';
import {
  NIVEAUX_CONTENU_DEFAUT,
  NIVEAUX_ORDONNES,
  niveauVersSlug,
  type NiveauContenu,
  type NiveauxContenuMap,
} from '../../types/niveauxContenu.types';
import { getNiveauxContenu, saveNiveauxContenu } from '../../services/niveauxService';

/** Nombre maximum de points forts par carte (au-delà, la carte devient trop haute) */
const MAX_POINTS = 4;

const NiveauxManager: React.FC = () => {
  const { currentUser } = useAuth();
  const confirmDlg = useConfirm();

  // ── État ──────────────────────────────────────────────────
  const [contenu, setContenu] = useState<NiveauxContenuMap>(NIVEAUX_CONTENU_DEFAUT);
  const [original, setOriginal] = useState<NiveauxContenuMap>(NIVEAUX_CONTENU_DEFAUT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; texte: string } | null>(null);

  // ── Chargement initial ────────────────────────────────────
  useEffect(() => {
    getNiveauxContenu().then((c) => {
      setContenu(c);
      setOriginal(c);
      setLoading(false);
    });
  }, []);

  /** Vrai si des modifications ne sont pas encore enregistrées */
  const modifie = useMemo(
    () => JSON.stringify(contenu) !== JSON.stringify(original),
    [contenu, original],
  );

  // ── Mise à jour d'un champ d'un niveau ────────────────────
  const maj = <K extends keyof NiveauContenu>(niveau: Niveau, champ: K, valeur: NiveauContenu[K]) => {
    setContenu((prev) => ({ ...prev, [niveau]: { ...prev[niveau], [champ]: valeur } }));
    setMessage(null);
  };

  /** Modifie le point fort n° index */
  const majPoint = (niveau: Niveau, index: number, valeur: string) => {
    const points = [...contenu[niveau].pointsForts];
    points[index] = valeur;
    maj(niveau, 'pointsForts', points);
  };

  // ── Enregistrement ────────────────────────────────────────
  const enregistrer = async () => {
    // Validation minimale : titre obligatoire, au moins un niveau actif
    const sansTitre = NIVEAUX_ORDONNES.find((n) => !contenu[n].titre.trim());
    if (sansTitre) {
      setMessage({ type: 'error', texte: `Le titre du niveau « ${NIVEAUX_CONTENU_DEFAUT[sansTitre].titre} » est obligatoire.` });
      return;
    }
    if (!NIVEAUX_ORDONNES.some((n) => contenu[n].actif)) {
      setMessage({ type: 'error', texte: "Au moins un niveau doit rester affiché sur l'accueil." });
      return;
    }

    // Nettoyage : espaces superflus, points forts vides retirés
    const propre = {} as NiveauxContenuMap;
    NIVEAUX_ORDONNES.forEach((n) => {
      const c = contenu[n];
      propre[n] = {
        ...c,
        icone: c.icone.trim() || NIVEAUX_CONTENU_DEFAUT[n].icone,
        titre: c.titre.trim(),
        sousTitre: c.sousTitre.trim(),
        ctaLabel: c.ctaLabel.trim() || 'Découvrir',
        introduction: c.introduction.trim(),
        pointsForts: c.pointsForts.map((p) => p.trim()).filter(Boolean),
        ordre: Number.isFinite(c.ordre) ? c.ordre : NIVEAUX_CONTENU_DEFAUT[n].ordre,
      };
    });

    setSaving(true);
    try {
      await saveNiveauxContenu(propre, currentUser?.uid);
      setContenu(propre);
      setOriginal(propre);
      setMessage({ type: 'success', texte: "Niveaux enregistrés. L'accueil est à jour." });
    } catch (err) {
      console.error('[NiveauxManager] Sauvegarde :', err);
      setMessage({ type: 'error', texte: "Erreur lors de l'enregistrement. Vérifiez votre connexion et vos droits admin." });
    } finally {
      setSaving(false);
    }
  };

  /** Restaure le contenu d'origine (celui codé initialement sur l'accueil) */
  const reinitialiser = async () => {
    const ok = await confirmDlg({
      title: 'Réinitialiser les niveaux ?',
      message: "Les textes d'origine seront restaurés dans le formulaire. Cliquez ensuite sur « Sauvegarder » pour appliquer.",
      confirmLabel: 'Réinitialiser',
      variant: 'warning',
    });
    if (ok) setContenu(NIVEAUX_CONTENU_DEFAUT);
  };

  // ── Rendu ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
        <p>Chargement des niveaux...</p>
      </div>
    );
  }

  return (
    <div className="settings-admin">
      {/* ===== EN-TÊTE ===== */}
      <div className="admin-page-header">
        <div className="admin-page-header__info">
          <h1 className="admin-page-header__title">🏫 Niveaux (page d'accueil)</h1>
          <p className="admin-page-header__subtitle">
            Cartes « Tous les niveaux, toutes les matières » et en-têtes des pages de niveau
          </p>
        </div>
        <div className="admin-page-header__actions">
          <button className="admin-btn admin-btn-ghost" onClick={reinitialiser}>
            ↺ Textes d'origine
          </button>
          {modifie && (
            <button className="admin-btn admin-btn-ghost" onClick={() => setContenu(original)}>
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
        <div className={`admin-alert admin-alert--${message.type}`}>
          {message.type === 'success' ? '✅' : '❌'} {message.texte}
        </div>
      )}

      {/* ===== UN BLOC PAR NIVEAU ===== */}
      {NIVEAUX_ORDONNES.map((niveau) => {
        const c = contenu[niveau];
        const slug = niveauVersSlug(niveau);
        // Points forts affichés : ceux saisis + une ligne vide pour en ajouter (dans la limite)
        const lignesPoints = c.pointsForts.length < MAX_POINTS ? [...c.pointsForts, ''] : c.pointsForts;

        return (
          <div key={niveau} className="settings-section" style={{ opacity: c.actif ? 1 : 0.75 }}>
            <div className="settings-section__header">
              <h2 className="settings-section__title">
                {c.icone} {c.titre || NIVEAUX_CONTENU_DEFAUT[niveau].titre}
              </h2>
              <p className="settings-section__description">
                Page publique : <Link to={`/niveaux/${slug}`} target="_blank">/niveaux/{slug} ↗</Link>
              </p>
            </div>

            <div className="settings-grid">
              {/* Affichage actif / masqué */}
              <div className="settings-field">
                <label className="settings-label">Affichage</label>
                <div className="settings-toggle-wrapper">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.actif}
                    aria-label={`Afficher le niveau ${c.titre}`}
                    className={`settings-toggle ${c.actif ? 'settings-toggle--active' : ''}`}
                    onClick={() => maj(niveau, 'actif', !c.actif)}
                  >
                    <span className="settings-toggle__knob" />
                  </button>
                  <span className={`settings-toggle-label ${c.actif ? 'settings-toggle-label--active' : ''}`}>
                    {c.actif ? 'Visible sur l’accueil' : 'Masqué (page « bientôt disponible »)'}
                  </span>
                </div>
              </div>

              {/* Ordre */}
              <div className="settings-field">
                <label className="settings-label" htmlFor={`ordre-${niveau}`}>Ordre sur l'accueil</label>
                <input
                  id={`ordre-${niveau}`}
                  type="number"
                  min={1}
                  max={9}
                  className="admin-input"
                  value={c.ordre}
                  onChange={(e) => maj(niveau, 'ordre', Number(e.target.value))}
                />
              </div>

              {/* Icône */}
              <div className="settings-field">
                <label className="settings-label" htmlFor={`icone-${niveau}`}>Icône (emoji)</label>
                <input
                  id={`icone-${niveau}`}
                  type="text"
                  maxLength={8}
                  className="admin-input"
                  value={c.icone}
                  onChange={(e) => maj(niveau, 'icone', e.target.value)}
                />
              </div>

              {/* Titre */}
              <div className="settings-field">
                <label className="settings-label" htmlFor={`titre-${niveau}`}>Titre *</label>
                <input
                  id={`titre-${niveau}`}
                  type="text"
                  maxLength={40}
                  className="admin-input"
                  value={c.titre}
                  onChange={(e) => maj(niveau, 'titre', e.target.value)}
                />
              </div>

              {/* Sous-titre (classes) */}
              <div className="settings-field">
                <label className="settings-label" htmlFor={`sous-${niveau}`}>Ligne sous le titre</label>
                <input
                  id={`sous-${niveau}`}
                  type="text"
                  maxLength={60}
                  className="admin-input"
                  value={c.sousTitre}
                  onChange={(e) => maj(niveau, 'sousTitre', e.target.value)}
                />
                <span className="settings-hint">Ex. : 6ème · 5ème · 4ème · 3ème</span>
              </div>

              {/* Libellé du lien */}
              <div className="settings-field">
                <label className="settings-label" htmlFor={`cta-${niveau}`}>Libellé du lien</label>
                <input
                  id={`cta-${niveau}`}
                  type="text"
                  maxLength={30}
                  className="admin-input"
                  value={c.ctaLabel}
                  onChange={(e) => maj(niveau, 'ctaLabel', e.target.value)}
                />
                <span className="settings-hint">Ex. : Découvrir, Voir les cours</span>
              </div>

              {/* Points forts */}
              <div className="settings-field settings-field--full">
                <label className="settings-label">Points forts (coches vertes, {MAX_POINTS} max.)</label>
                <div className="cahier-rubriques-editor">
                  {lignesPoints.map((point, i) => (
                    <div key={i} className="cahier-rubrique-row">
                      <input
                        type="text"
                        maxLength={50}
                        className="admin-input"
                        placeholder={i >= c.pointsForts.length ? '+ Ajouter un point fort' : ''}
                        value={point}
                        aria-label={`Point fort ${i + 1}`}
                        onChange={(e) => majPoint(niveau, i, e.target.value)}
                      />
                      {i < c.pointsForts.length && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          aria-label={`Supprimer le point fort ${i + 1}`}
                          onClick={() => maj(niveau, 'pointsForts', c.pointsForts.filter((_, j) => j !== i))}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Introduction de la page */}
              <div className="settings-field settings-field--full">
                <label className="settings-label" htmlFor={`intro-${niveau}`}>Introduction de la page du niveau</label>
                <textarea
                  id={`intro-${niveau}`}
                  className="admin-input admin-textarea"
                  maxLength={400}
                  value={c.introduction}
                  onChange={(e) => maj(niveau, 'introduction', e.target.value)}
                />
                <span className="settings-hint">{c.introduction.length}/400 caractères</span>
              </div>
            </div>

            {/* Raccourcis vers la gestion du contenu réel du niveau */}
            <p className="settings-hint" style={{ marginTop: 12 }}>
              Contenus de ce niveau : <Link to="/admin/disciplines">Disciplines</Link> ·{' '}
              <Link to="/admin/chapitres">Chapitres</Link> · <Link to="/admin/ressources">Ressources</Link> ·{' '}
              <Link to="/prof/cours">Cours en ligne</Link>
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default NiveauxManager;

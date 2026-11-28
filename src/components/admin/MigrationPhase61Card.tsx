// ============================================================
// PedaClic — Phase 61 : carte « Maintenance » du tableau de bord admin
// ------------------------------------------------------------
// Bouton de migration IDEMPOTENT (relançable sans risque) :
//   • crée / nettoie les appartenances `membres_groupe` à partir des
//     inscriptions actives ;
//   • normalise les quiz (groupeId: null, status: 'published' pour les
//     quiz classiques sans statut).
// Affiche ensuite un compte rendu chiffré.
// ============================================================

import React, { useState } from 'react';
import {
  migrerMembresEtQuiz,
  type CompteRenduMigration61,
} from '../../services/membresGroupeService';
import '../../styles/MigrationPhase61.css';

const MigrationPhase61Card: React.FC = () => {
  // ── États ──
  const [enCours, setEnCours] = useState(false);
  const [rapport, setRapport] = useState<CompteRenduMigration61 | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // ── Lancement (avec confirmation) ──
  const lancer = async () => {
    const ok = window.confirm(
      'Lancer la migration Phase 61 ?\n\n' +
        '• Appartenances aux classes recalculées depuis les inscriptions actives\n' +
        '• Quiz sans classe → « groupeId: null » ; quiz classiques sans statut → « publié »\n\n' +
        'Opération sans danger et relançable : rien n\'est supprimé hormis les appartenances obsolètes.'
    );
    if (!ok) return;
    setEnCours(true);
    setErreur(null);
    setRapport(null);
    try {
      setRapport(await migrerMembresEtQuiz());
    } catch (e: any) {
      setErreur(e?.message || 'Erreur inattendue pendant la migration.');
    } finally {
      setEnCours(false);
    }
  };

  // ── Ligne du compte rendu ──
  const Ligne: React.FC<{ libelle: string; valeur: number }> = ({ libelle, valeur }) => (
    <li className="mig61-ligne">
      <span>{libelle}</span>
      <strong>{valeur}</strong>
    </li>
  );

  return (
    <section className="content-card mig61-carte" style={{ marginTop: 'var(--spacing-xl)' }}>
      {/* En-tête */}
      <div className="content-card__header">
        <h2>🛠️ Maintenance — Accès aux quiz par classe (Phase 61)</h2>
      </div>

      <div className="content-card__body">
        <p className="mig61-aide">
          À lancer une fois après le déploiement de la Phase 61, puis autant de fois que
          nécessaire (par exemple si un avertissement « Appartenance non écrite » apparaît
          dans la console). Une deuxième exécution doit afficher 0 création et 0 quiz normalisé.
        </p>

        {/* Bouton principal */}
        <button
          type="button"
          className="mig61-bouton"
          onClick={lancer}
          disabled={enCours}
          aria-busy={enCours}
        >
          {enCours ? '⏳ Migration en cours…' : '▶ Lancer la migration'}
        </button>

        {/* Erreur bloquante */}
        {erreur && <p className="mig61-erreur" role="alert">❌ {erreur}</p>}

        {/* Compte rendu */}
        {rapport && (
          <div className="mig61-rapport" role="status">
            <h3>
              {rapport.erreurs.length === 0 ? '✅ Migration terminée' : '⚠️ Migration terminée avec erreurs'}
              <span className="mig61-duree"> ({(rapport.dureeMs / 1000).toFixed(1)} s)</span>
            </h3>

            <div className="mig61-colonnes">
              <ul>
                <li className="mig61-titre-liste">Appartenances</li>
                <Ligne libelle="Inscriptions actives lues" valeur={rapport.inscriptionsActives} />
                <Ligne libelle="Élèves sans compte (ignorés)" valeur={rapport.inscriptionsSansCompte} />
                <Ligne libelle="Appartenances créées" valeur={rapport.membresCrees} />
                <Ligne libelle="Déjà présentes" valeur={rapport.membresDejaPresents} />
                <Ligne libelle="Obsolètes supprimées" valeur={rapport.membresObsoletesSupprimes} />
              </ul>
              <ul>
                <li className="mig61-titre-liste">Quiz</li>
                <Ligne libelle="Quiz classiques lus" valeur={rapport.quizClassiquesLus} />
                <Ligne libelle="Quiz classiques normalisés" valeur={rapport.quizClassiquesNormalises} />
                <Ligne libelle="Quiz avancés lus" valeur={rapport.quizAvancesLus} />
                <Ligne libelle="Quiz avancés normalisés" valeur={rapport.quizAvancesNormalises} />
                <Ligne libelle="Quiz avancés sans statut (inchangés)" valeur={rapport.quizAvancesSansStatut} />
              </ul>
            </div>

            {rapport.erreurs.length > 0 && (
              <ul className="mig61-liste-erreurs">
                {rapport.erreurs.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default MigrationPhase61Card;

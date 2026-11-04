// ============================================================
// PedaClic — Phase 47 : bloc « Sécurité des séances » (Paramètres admin)
// ------------------------------------------------------------
// Lance la migration des séances existantes et affiche le rapport.
// À exécuter juste après le déploiement de la Phase 47, puis une
// seconde fois quelques jours plus tard (séances enregistrées par
// d'anciennes versions encore en cache chez certains utilisateurs).
// Réutilise les classes .settings-* existantes de la page.
// ============================================================

import React, { useState } from 'react';
import { useConfirm } from '../../contexts/ConfirmContext';
import { migrerSeancesPhase47, type RapportMigration47 } from '../../services/migrationPhase47Service';
import { messageErreurFirestore } from '../../utils/messageErreurFirestore';

const MigrationSeancesPhase47: React.FC = () => {
  const confirmDialog = useConfirm();
  const [enCours, setEnCours] = useState(false);
  const [rapport, setRapport] = useState<RapportMigration47 | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const lancer = async () => {
    const ok = await confirmDialog({
      title: 'Sécuriser les séances existantes ?',
      message: 'Toutes les séances vont être parcourues : la visibilité élèves sera alignée sur le partage de chaque cahier et les notes privées seront déplacées dans un espace réservé au professeur. Opération sans perte, relançable.',
      confirmLabel: 'Lancer',
      variant: 'warning',
    });
    if (!ok) return;
    setEnCours(true);
    setErreur(null);
    setRapport(null);
    try {
      await migrerSeancesPhase47(setRapport);
    } catch (err) {
      setErreur(messageErreurFirestore(err, 'Migration'));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="settings-section">
      <div className="settings-section__header">
        <h2 className="settings-section__title">🔐 Sécurité des séances (Phase 47)</h2>
        <p className="settings-section__description">
          Met en conformité les séances créées avant la Phase 47 : visibilité élèves
          et notes privées. À lancer après chaque déploiement de cette phase.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
        <button type="button" className="admin-btn admin-btn-primary" onClick={lancer} disabled={enCours}>
          {enCours ? '⏳ Migration en cours…' : '🔐 Sécuriser les séances existantes'}
        </button>

        {/* Rapport (mis à jour à chaque lot de 200 séances) */}
        {rapport && (
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', lineHeight: 1.7 }} aria-live="polite">
            <li><strong>{rapport.seancesAnalysees}</strong> séance(s) analysée(s)</li>
            <li><strong>{rapport.visibiliteCorrigee}</strong> visibilité(s) élèves corrigée(s)</li>
            <li><strong>{rapport.notesDeplacees}</strong> note(s) privée(s) mise(s) à l'abri</li>
            <li><strong>{rapport.champsVidesRetires}</strong> champ(s) vide(s) nettoyé(s)</li>
            {rapport.terminee && <li style={{ color: '#059669', fontWeight: 600 }}>✅ Migration terminée</li>}
          </ul>
        )}

        {erreur && (
          <p style={{ color: '#dc2626', margin: 0, fontSize: '0.88rem' }} role="alert">{erreur}</p>
        )}
      </div>
    </div>
  );
};

export default MigrationSeancesPhase47;

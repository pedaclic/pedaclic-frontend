/**
 * ============================================================
 * COMPOSANT REJOINDRE GROUPE — PedaClic Phase 11
 * ============================================================
 * 
 * Permet à un élève de rejoindre un groupe-classe en saisissant
 * le code d'invitation PROF-XXXX-XXXX donné par son professeur.
 * Ce composant s'intègre dans le dashboard élève existant.
 * 
 * Fichier : src/components/student/RejoindreGroupe.tsx
 * Dépendances :
 *   - ../../services/profGroupeService (rejoindreGroupe, getGroupesEleve)
 *   - ../../hooks/useAuth
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  rejoindreGroupe,
  getGroupesEleve
} from '../../services/profGroupeService';
import type { GroupeProf } from '../../types/prof';


// ==================== COMPOSANT PRINCIPAL ====================

const RejoindreGroupe: React.FC = () => {

  // ===== Hooks =====
  const { currentUser } = useAuth();

  // ===== États =====
  const [mesGroupes, setMesGroupes] = useState<GroupeProf[]>([]);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [codeInvitation, setCodeInvitation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingRejoindre, setLoadingRejoindre] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  // ==================== CHARGEMENT ====================

  /**
   * Charge les groupes auxquels l'élève est inscrit
   */
  const chargerMesGroupes = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      setLoading(true);
      const groupes = await getGroupesEleve(currentUser.uid);
      setMesGroupes(groupes);
    } catch (err) {
      console.error('Erreur chargement groupes:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    chargerMesGroupes();
  }, [chargerMesGroupes]);


  // ==================== HANDLER ====================

  /**
   * Soumet le code d'invitation pour rejoindre un groupe
   */
  const handleRejoindre = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.uid || !codeInvitation.trim()) return;

    try {
      setLoadingRejoindre(true);
      setError(null);
      setSuccess(null);

      await rejoindreGroupe(
        currentUser.uid,
        currentUser.displayName || currentUser.email || 'Élève',
        currentUser.email || '',
        codeInvitation
      );

      setSuccess('Tu as rejoint le groupe avec succès ! 🎉');
      setCodeInvitation('');
      setShowForm(false);

      // Recharger la liste
      await chargerMesGroupes();

      // Effacer le message de succès après 5 secondes
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Impossible de rejoindre le groupe.');
    } finally {
      setLoadingRejoindre(false);
    }
  };


  // ==================== RENDU ====================

  return (
    <div className="rejoindre-groupe-section">

      {/* ===== TITRE ===== */}
      <div className="rejoindre-groupe-header">
        <h3>📚 Mes groupes-classes</h3>
        <button
          className="prof-btn prof-btn-primary prof-btn-sm"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Annuler' : '➕ Rejoindre un groupe'}
        </button>
      </div>

      {/* ===== MESSAGES ===== */}
      {error && (
        <div className="prof-alert prof-alert-error">
          ❌ {error}
          <button onClick={() => setError(null)} className="prof-alert-close">✕</button>
        </div>
      )}
      {success && (
        <div className="prof-alert" style={{ background: '#d1fae5', border: '1px solid #a7f3d0', color: '#065f46' }}>
          {success}
        </div>
      )}

      {/* ===== FORMULAIRE REJOINDRE ===== */}
      {showForm && (
        <div className="groupe-form-container" style={{ marginBottom: '1rem' }}>
          <p style={{ marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Saisis le code donné par ton professeur (format: PROF-XXXX-XXXX)
          </p>
          <form onSubmit={handleRejoindre} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Champ code */}
            <input
              type="text"
              placeholder="PROF-XXXX-XXXX"
              value={codeInvitation}
              onChange={(e) => setCodeInvitation(e.target.value.toUpperCase())}
              maxLength={14}
              disabled={loadingRejoindre}
              className="prof-input"
              style={{ flex: 1, maxWidth: '280px', fontFamily: 'monospace', letterSpacing: '2px' }}
            />
            <button
              type="submit"
              className="prof-btn prof-btn-primary"
              disabled={loadingRejoindre || codeInvitation.length < 14}
            >
              {loadingRejoindre ? '⏳ Vérification...' : '✅ Rejoindre'}
            </button>
          </form>
        </div>
      )}

      {/* ===== LISTE DES GROUPES ===== */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>
          Chargement...
        </p>
      ) : mesGroupes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
          <p>Tu n'es inscrit(e) dans aucun groupe-classe.</p>
          <p style={{ fontSize: '0.875rem' }}>
            Demande à ton professeur un code d'invitation pour rejoindre son groupe.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {mesGroupes.map(groupe => (
            <div
              key={groupe.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}
            >
              <div>
                <strong style={{ color: '#1f2937' }}>{groupe.nom}</strong>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>
                  {groupe.matiereNom} • Prof: {groupe.profNom}
                </span>
              </div>
              <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 600 }}>
                ✅ Inscrit(e)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RejoindreGroupe;

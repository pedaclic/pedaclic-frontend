// ============================================================
// PHASE 21 — COMPOSANT : RappelWidget
// Widget sidebar des rappels d'un professeur
// PedaClic — www.pedaclic.sn
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  getRappelsActifs, createRappel, marquerRappelDone, deleteRappel,
} from '../../services/rappelService';
import {
  TYPE_RAPPEL_CONFIG,
  ANNEES_SCOLAIRES,
} from '../../types/cahierTextes.types';
import type { RappelProf, RappelFormData, TypeRappel, Recurrence, Priorite } from '../../types/cahierTextes.types';
import '../../styles/CahierTextes.css';

// ─── Props ───────────────────────────────────────────────────
interface RappelWidgetProps {
  profId: string;
  cahierId?: string; // Optionnel : lier au cahier courant
}

// ─── Formulaire vide ─────────────────────────────────────────
const emptyForm = (): RappelFormData => ({
  titre: '',
  description: '',
  typeRappel: 'personnalise',
  dateRappel: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
  recurrence: 'unique',
  priorite: 'normale',
});

// ─── Composant ───────────────────────────────────────────────
const RappelWidget: React.FC<RappelWidgetProps> = ({ profId, cahierId }) => {
  const [rappels, setRappels] = useState<RappelProf[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RappelFormData>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Charger les rappels actifs
  const chargerRappels = async () => {
    try {
      setLoading(true);
      const data = await getRappelsActifs(profId);
      setRappels(data);
    } catch (err) {
      console.error('Erreur rappels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { chargerRappels(); }, [profId]);

  // Créer un rappel
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titre.trim()) return;
    setSaving(true);
    try {
      await createRappel(profId, { ...form, cahierId });
      setShowForm(false);
      setForm(emptyForm());
      await chargerRappels();
    } catch (err) {
      console.error('Erreur création rappel:', err);
    } finally {
      setSaving(false);
    }
  };

  // Marquer fait
  const handleDone = async (rappelId: string) => {
    await marquerRappelDone(rappelId, true);
    setRappels(prev => prev.filter(r => r.id !== rappelId));
  };

  // Supprimer
  const handleDelete = async (rappelId: string) => {
    if (!confirm('Supprimer ce rappel ?')) return;
    await deleteRappel(rappelId);
    setRappels(prev => prev.filter(r => r.id !== rappelId));
  };

  // Rappels en retard (date passée)
  const maintenant = new Date();
  const rappelsEnRetard = rappels.filter(r => r.dateRappel.toDate() <= maintenant);
  const rappelsAVenir = rappels.filter(r => r.dateRappel.toDate() > maintenant);

  return (
    <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🔔</span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1f2937' }}>Rappels</span>
          {rappelsEnRetard.length > 0 && (
            <span style={{ background: '#dc2626', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700 }}>
              {rappelsEnRetard.length}
            </span>
          )}
        </div>
        <button
          className="btn-primary"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
          onClick={() => setShowForm(v => !v)}
        >
          + Ajouter
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <form onSubmit={handleCreate} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
          <div className="form-group">
            <input
              className="form-input"
              placeholder="Titre du rappel *"
              value={form.titre}
              onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <select
              className="form-select"
              value={form.typeRappel}
              onChange={e => setForm(f => ({ ...f, typeRappel: e.target.value as TypeRappel }))}
            >
              {Object.entries(TYPE_RAPPEL_CONFIG).map(([k, cfg]) => (
                <option key={k} value={k}>{cfg.emoji} {cfg.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <input
              type="datetime-local"
              className="form-input"
              value={form.dateRappel}
              onChange={e => setForm(f => ({ ...f, dateRappel: e.target.value }))}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              className="form-select"
              value={form.priorite}
              onChange={e => setForm(f => ({ ...f, priorite: e.target.value as Priorite }))}
            >
              <option value="normale">Normale</option>
              <option value="urgente">🚨 Urgente</option>
            </select>
            <select
              className="form-select"
              value={form.recurrence}
              onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as Recurrence }))}
            >
              <option value="unique">Une fois</option>
              <option value="hebdomadaire">Hebdo</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? '...' : 'Enregistrer'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Liste des rappels */}
      <div style={{ padding: '0.75rem 1.25rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '1rem', fontSize: '0.85rem' }}>Chargement...</div>
        ) : rappels.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '1rem', fontSize: '0.85rem' }}>
            <div>🔕</div>
            <div>Aucun rappel actif</div>
          </div>
        ) : (
          <>
            {/* Rappels en retard */}
            {rappelsEnRetard.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  ⚠️ En retard
                </div>
                {rappelsEnRetard.map(r => (
                  <RappelItem key={r.id} rappel={r} onDone={handleDone} onDelete={handleDelete} />
                ))}
              </div>
            )}

            {/* Rappels à venir */}
            {rappelsAVenir.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  À venir
                </div>
                {rappelsAVenir.slice(0, 5).map(r => (
                  <RappelItem key={r.id} rappel={r} onDone={handleDone} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Sous-composant : un rappel ───────────────────────────────
interface RappelItemProps {
  rappel: RappelProf;
  onDone: (id: string) => void;
  onDelete: (id: string) => void;
}

const RappelItem: React.FC<RappelItemProps> = ({ rappel, onDone, onDelete }) => {
  const cfg = TYPE_RAPPEL_CONFIG[rappel.typeRappel];
  const date = rappel.dateRappel.toDate();
  const isUrgent = rappel.priorite === 'urgente';
  const isEnRetard = date <= new Date();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
      padding: '0.5rem 0',
      borderBottom: '1px solid #f9fafb',
    }}>
      {/* Checkbox */}
      <button
        onClick={() => onDone(rappel.id)}
        style={{
          width: 20, height: 20,
          border: `2px solid ${isUrgent ? '#dc2626' : '#d1d5db'}`,
          borderRadius: 4,
          background: 'white',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}
        title="Marquer terminé"
      />

      {/* Infos */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.82rem',
          fontWeight: 600,
          color: isEnRetard ? '#dc2626' : '#1f2937',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}>
          {cfg.emoji} {rappel.titre}
          {isUrgent && <span style={{ fontSize: '0.65rem', color: '#dc2626' }}>🚨</span>}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
          {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Supprimer */}
      <button
        onClick={() => onDelete(rappel.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.9rem', flexShrink: 0 }}
        title="Supprimer"
      >
        ✕
      </button>
    </div>
  );
};

export default RappelWidget;

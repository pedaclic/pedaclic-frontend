// ============================================================
// src/pages/disciplines/DisciplineDetailPage.tsx — PedaClic (Phase 13)
// Page de détail d'une discipline
// Adapte les badges et l'affichage selon le niveau :
// - Collège (bleu), Lycée (jaune), Formation libre (vert)
// Compatible avec la structure Discipline existante (classe singulier)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Discipline,
  Niveau,
  getClasseLabel,
  NIVEAUX_LABELS,
} from '../../types';

// --- Configuration des couleurs par niveau ---
const NIVEAU_STYLES: Record<
  Niveau,
  { color: string; bg: string; icon: string; border: string }
> = {
  college: {
    color: '#2b6cb0',
    bg: '#ebf8ff',
    icon: '🏫',
    border: '#90cdf4',
  },
  lycee: {
    color: '#975a16',
    bg: '#fefcbf',
    icon: '🎓',
    border: '#f6e05e',
  },
  formation_libre: {
    color: '#276749',
    bg: '#f0fff4',
    icon: '🌍',
    border: '#9ae6b4',
  },
};

const DisciplineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Écoute temps réel du document Firestore ---
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'disciplines', id), (snapshot) => {
      if (snapshot.exists()) {
        setDiscipline({
          id: snapshot.id,
          ...snapshot.data(),
          createdAt: snapshot.data().createdAt?.toDate() || new Date(),
          updatedAt: snapshot.data().updatedAt?.toDate() || new Date(),
        } as Discipline);
      } else {
        setDiscipline(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  // --- Chargement ---
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '64px', color: '#a0aec0' }}>
        Chargement de la discipline...
      </div>
    );
  }

  // --- Discipline non trouvée ---
  if (!discipline) {
    return (
      <div style={{ textAlign: 'center', padding: '64px' }}>
        <p style={{ fontSize: '2rem', marginBottom: '12px' }}>😕</p>
        <p style={{ color: '#718096', marginBottom: '20px' }}>Discipline introuvable.</p>
        <button
          onClick={() => navigate('/disciplines')}
          style={{
            padding: '10px 24px',
            background: '#3182ce',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ← Retour aux disciplines
        </button>
      </div>
    );
  }

  // --- Style du niveau actuel ---
  const niveauStyle = NIVEAU_STYLES[discipline.niveau];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      {/* ====== Bouton retour ====== */}
      <button
        onClick={() => navigate('/disciplines')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          background: 'transparent',
          color: '#3182ce',
          border: '1px solid #3182ce',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 500,
          marginBottom: '24px',
        }}
      >
        ← Retour aux disciplines
      </button>

      {/* ====== Card principale ====== */}
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* --- Bandeau coloré en haut --- */}
        {/* Utilise la couleur custom de la discipline ou la couleur du niveau */}
        <div
          style={{
            background: `linear-gradient(135deg, ${discipline.couleur || niveauStyle.color}, ${discipline.couleur || niveauStyle.color}cc)`,
            padding: '32px 28px',
            color: '#fff',
          }}
        >
          {/* Icône + Nom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <span style={{ fontSize: '2.5rem' }}>{discipline.icone || '📘'}</span>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
              {discipline.nom}
            </h1>
          </div>

          {/* Badges : niveau + classe */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {/* Badge niveau */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 600,
              }}
            >
              {niveauStyle.icon} {NIVEAUX_LABELS[discipline.niveau]}
            </span>
            {/* Badge classe */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 16px',
                borderRadius: '20px',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: '0.9rem',
                fontWeight: 500,
              }}
            >
              {getClasseLabel(discipline.classe)}
            </span>
          </div>
        </div>

        {/* --- Corps de la card --- */}
        <div style={{ padding: '28px' }}>
          {/* Description */}
          {discipline.description && (
            <div style={{ marginBottom: '24px' }}>
              <h3
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#4a5568',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Description
              </h3>
              <p style={{ fontSize: '1rem', color: '#4a5568', lineHeight: 1.7 }}>
                {discipline.description}
              </p>
            </div>
          )}

          {/* --- Grille d'informations --- */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
              marginBottom: '24px',
            }}
          >
            {/* Classe / Niveau de formation */}
            <div
              style={{
                background: '#f7fafc',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #e2e8f0',
              }}
            >
              <h4 style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '12px', fontWeight: 600 }}>
                {discipline.niveau === 'formation_libre' ? '📊 Niveau' : '📋 Classe'}
              </h4>
              <span
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background: niveauStyle.bg,
                  color: niveauStyle.color,
                  border: `1px solid ${niveauStyle.border}`,
                }}
              >
                {getClasseLabel(discipline.classe)}
              </span>
            </div>

            {/* Coefficient (affiché uniquement s'il existe) */}
            {discipline.coefficient !== undefined && (
              <div
                style={{
                  background: '#f7fafc',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <h4 style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '12px', fontWeight: 600 }}>
                  ⚖️ Coefficient
                </h4>
                <p style={{ fontSize: '1.8rem', fontWeight: 700, color: '#2d3748', margin: 0 }}>
                  {discipline.coefficient}
                </p>
              </div>
            )}
          </div>

          {/* --- Message spécifique Formation libre --- */}
          {discipline.niveau === 'formation_libre' && (
            <div
              style={{
                background: '#f0fff4',
                borderRadius: '12px',
                padding: '16px 20px',
                border: '1px solid #c6f6d5',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>💡</span>
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#276749', marginBottom: '4px' }}>
                  Formation libre
                </p>
                <p style={{ fontSize: '0.85rem', color: '#48bb78', lineHeight: 1.5 }}>
                  Cette formation est ouverte à tous, sans prérequis scolaires.
                  Progressez à votre rythme du niveau Débutant au niveau Avancé.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisciplineDetailPage;

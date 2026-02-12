// ============================================================
// src/pages/DisciplinesPage.tsx — PedaClic (Phase 13)
// Page publique de consultation des disciplines
// 3 onglets : Collège (🏫), Lycée (🎓), Formation libre (🌍)
// Compatible avec la structure Discipline existante (classe singulier)
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Discipline,
  Niveau,
  getClasseLabel,
  NIVEAUX_LABELS,
} from '../types';

// --- Configuration des onglets ---
// Chaque onglet a son icône, label et couleur associée
const TABS: {
  niveau: Niveau;
  icon: string;
  label: string;
  color: string;
  bgLight: string;
}[] = [
  {
    niveau: 'college',
    icon: '🏫',
    label: 'Collège',
    color: '#2b6cb0',
    bgLight: '#ebf8ff',
  },
  {
    niveau: 'lycee',
    icon: '🎓',
    label: 'Lycée',
    color: '#975a16',
    bgLight: '#fefcbf',
  },
  {
    niveau: 'formation_libre',
    icon: '🌍',
    label: 'Formation libre',
    color: '#276749',
    bgLight: '#f0fff4',
  },
];

const DisciplinesPage: React.FC = () => {
  // --- États ---
  const [activeTab, setActiveTab] = useState<Niveau>('college');
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // --- Écoute temps réel des disciplines ---
  useEffect(() => {
    const q = query(
      collection(db, 'disciplines'),
      orderBy('ordre')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
      })) as Discipline[];
      setDisciplines(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- Filtrage par onglet actif ---
  const filteredDisciplines = disciplines.filter((d) => d.niveau === activeTab);

  // --- Onglet actif (pour récupérer la couleur) ---
  const currentTab = TABS.find((t) => t.niveau === activeTab)!;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      {/* ====== En-tête de page ====== */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a365d', marginBottom: '8px' }}>
          📚 Disciplines
        </h1>
        <p style={{ color: '#718096', fontSize: '1rem' }}>
          Explorez les disciplines disponibles sur PedaClic
        </p>
      </div>

      {/* ====== Onglets de niveau ====== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '32px',
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.niveau;
          return (
            <button
              key={tab.niveau}
              onClick={() => setActiveTab(tab.niveau)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                borderRadius: '12px',
                border: `2px solid ${isActive ? tab.color : '#e2e8f0'}`,
                background: isActive ? tab.bgLight : '#fff',
                color: isActive ? tab.color : '#718096',
                fontSize: '1rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: isActive ? `0 2px 8px ${tab.color}20` : 'none',
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ====== Chargement ====== */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#a0aec0' }}>
          Chargement des disciplines...
        </div>
      )}

      {/* ====== Liste vide ====== */}
      {!loading && filteredDisciplines.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            background: '#f7fafc',
            borderRadius: '12px',
            border: '1px dashed #e2e8f0',
          }}
        >
          <p style={{ fontSize: '2rem', marginBottom: '8px' }}>📭</p>
          <p style={{ color: '#a0aec0', fontSize: '1rem' }}>
            Aucune discipline disponible en {NIVEAUX_LABELS[activeTab]} pour le moment.
          </p>
        </div>
      )}

      {/* ====== Grille de cards ====== */}
      {!loading && filteredDisciplines.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredDisciplines.map((discipline) => (
            <div
              key={discipline.id}
              onClick={() => navigate(`/disciplines/${discipline.id}`)}
              style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                /* Barre colorée : couleur custom ou couleur de l'onglet */
                borderTop: `3px solid ${discipline.couleur || currentTab.color}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
              }}
            >
              {/* Icône et nom */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '1.8rem' }}>{discipline.icone || '📘'}</span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#2d3748', margin: 0 }}>
                  {discipline.nom}
                </h3>
              </div>

              {/* Description (tronquée) */}
              {discipline.description && (
                <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '12px', lineHeight: 1.5 }}>
                  {discipline.description.length > 100
                    ? `${discipline.description.slice(0, 100)}...`
                    : discipline.description}
                </p>
              )}

              {/* Badge classe */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 10px',
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    background: currentTab.bgLight,
                    color: currentTab.color,
                  }}
                >
                  {getClasseLabel(discipline.classe)}
                </span>
              </div>

              {/* Coefficient */}
              {discipline.coefficient !== undefined && (
                <p style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                  Coefficient : {discipline.coefficient}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DisciplinesPage;

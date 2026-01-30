/**
 * Page Dashboard - Tableau de bord PedaClic
 */

import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { BookOpen, Award, TrendingUp } from 'lucide-react';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <header className="dashboard-header">
          <h1>Tableau de bord</h1>
          <p>Bienvenue, {user?.displayName || user?.email} !</p>
        </header>

        <div className="stats-grid">
          <div className="stat-card">
            <BookOpen size={32} />
            <h3>Cours suivis</h3>
            <p className="stat-value">0</p>
          </div>
          <div className="stat-card">
            <Award size={32} />
            <h3>Quiz complétés</h3>
            <p className="stat-value">0</p>
          </div>
          <div className="stat-card">
            <TrendingUp size={32} />
            <h3>Progression</h3>
            <p className="stat-value">0%</p>
          </div>
        </div>

        <section className="dashboard-section">
          <h2>Activités récentes</h2>
          <p>Aucune activité pour le moment.</p>
        </section>
      </div>
    </div>
  );
};

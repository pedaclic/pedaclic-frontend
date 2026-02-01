/**
 * ============================================================
 * PAGE SEED ADMIN - INITIALISATION DES DONNÉES
 * ============================================================
 * 
 * Page temporaire pour initialiser la base de données
 * avec des données de test.
 * 
 * Route : /admin/seed
 * 
 * ⚠️ À SUPPRIMER EN PRODUCTION !
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

import { useState } from 'react';
import { seedDatabase, clearDatabase } from '../utils/seedDatabase';

// ==================== COMPOSANT PRINCIPAL ====================

const SeedPage = () => {
  // ===== États =====
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // ===== Ajouter un log =====
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // ===== Exécuter le seed =====
  const handleSeed = async () => {
    if (!confirm('⚠️ Voulez-vous créer les données de test ?\n\nCela va ajouter des disciplines et ressources dans Firestore.')) {
      return;
    }

    setIsLoading(true);
    setStatus('idle');
    setLogs([]);
    
    addLog('🚀 Démarrage du seed...');

    try {
      // Override console.log pour capturer les logs
      const originalLog = console.log;
      console.log = (...args) => {
        originalLog(...args);
        addLog(args.join(' '));
      };

      await seedDatabase();

      // Restaurer console.log
      console.log = originalLog;

      setStatus('success');
      addLog('✅ Seed terminé avec succès !');
      
    } catch (error) {
      setStatus('error');
      addLog(`❌ Erreur : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== Supprimer les données =====
  const handleClear = async () => {
    if (!confirm('⚠️ ATTENTION !\n\nVoulez-vous SUPPRIMER toutes les données de test ?\n\nCette action est irréversible.')) {
      return;
    }

    setIsLoading(true);
    setStatus('idle');
    setLogs([]);
    
    addLog('🗑️ Suppression des données...');

    try {
      await clearDatabase();
      setStatus('success');
      addLog('✅ Données supprimées !');
      
    } catch (error) {
      setStatus('error');
      addLog(`❌ Erreur : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ===== Rendu =====
  return (
    <div style={styles.container}>
      {/* En-tête */}
      <div style={styles.header}>
        <h1 style={styles.title}>🌱 Seed Database</h1>
        <p style={styles.subtitle}>Initialisation des données de test PedaClic</p>
      </div>

      {/* Avertissement */}
      <div style={styles.warning}>
        <strong>⚠️ Page réservée aux administrateurs</strong>
        <p>Cette page permet d'initialiser ou supprimer les données de test dans Firestore.</p>
        <p><em>À supprimer en production !</em></p>
      </div>

      {/* Boutons d'action */}
      <div style={styles.actions}>
        <button 
          onClick={handleSeed}
          disabled={isLoading}
          style={{
            ...styles.button,
            ...styles.buttonPrimary,
            ...(isLoading ? styles.buttonDisabled : {})
          }}
        >
          {isLoading ? '⏳ En cours...' : '🌱 Créer les données de test'}
        </button>

        <button 
          onClick={handleClear}
          disabled={isLoading}
          style={{
            ...styles.button,
            ...styles.buttonDanger,
            ...(isLoading ? styles.buttonDisabled : {})
          }}
        >
          {isLoading ? '⏳ En cours...' : '🗑️ Supprimer les données'}
        </button>
      </div>

      {/* Données créées */}
      <div style={styles.infoBox}>
        <h3 style={styles.infoTitle}>📋 Données qui seront créées :</h3>
        
        <div style={styles.infoGrid}>
          <div style={styles.infoCard}>
            <span style={styles.infoEmoji}>📚</span>
            <strong>8 Disciplines</strong>
            <ul style={styles.infoList}>
              <li>Mathématiques 3ème</li>
              <li>Français 3ème</li>
              <li>SVT 3ème</li>
              <li>Histoire-Géo 3ème</li>
              <li>Physique-Chimie 3ème</li>
              <li>Anglais 3ème</li>
              <li>Mathématiques Tle</li>
              <li>Philosophie Tle</li>
            </ul>
          </div>

          <div style={styles.infoCard}>
            <span style={styles.infoEmoji}>📝</span>
            <strong>12+ Ressources</strong>
            <ul style={styles.infoList}>
              <li>Cours détaillés</li>
              <li>Exercices progressifs</li>
              <li>Vidéos explicatives</li>
              <li>Quiz interactifs</li>
              <li>Contenu Premium</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Console de logs */}
      {logs.length > 0 && (
        <div style={styles.console}>
          <div style={styles.consoleHeader}>
            <span>📟 Console</span>
            {status === 'success' && <span style={styles.statusSuccess}>✓ Succès</span>}
            {status === 'error' && <span style={styles.statusError}>✗ Erreur</span>}
          </div>
          <div style={styles.consoleLogs}>
            {logs.map((log, index) => (
              <div key={index} style={styles.logLine}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Lien retour */}
      <div style={styles.footer}>
        <a href="/" style={styles.link}>← Retour à l'accueil</a>
        <a href="/disciplines" style={styles.link}>📚 Voir les disciplines</a>
      </div>
    </div>
  );
};

// ==================== STYLES ====================

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem'
  },
  title: {
    fontSize: '2.5rem',
    color: '#1f2937',
    marginBottom: '0.5rem'
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#6b7280'
  },
  warning: {
    background: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: '8px',
    padding: '1rem 1.5rem',
    marginBottom: '2rem'
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap'
  },
  button: {
    padding: '1rem 2rem',
    fontSize: '1rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  buttonPrimary: {
    background: '#2563eb',
    color: 'white'
  },
  buttonDanger: {
    background: '#dc2626',
    color: 'white'
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  infoBox: {
    background: '#f9fafb',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '2rem'
  },
  infoTitle: {
    margin: '0 0 1rem 0',
    color: '#374151'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem'
  },
  infoCard: {
    background: 'white',
    borderRadius: '8px',
    padding: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  infoEmoji: {
    fontSize: '2rem',
    display: 'block',
    marginBottom: '0.5rem'
  },
  infoList: {
    margin: '0.5rem 0 0 1.5rem',
    padding: 0,
    fontSize: '0.9rem',
    color: '#6b7280'
  },
  console: {
    background: '#1f2937',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '2rem'
  },
  consoleHeader: {
    background: '#374151',
    padding: '0.75rem 1rem',
    color: '#9ca3af',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  consoleLogs: {
    padding: '1rem',
    maxHeight: '300px',
    overflowY: 'auto'
  },
  logLine: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    color: '#d1d5db',
    marginBottom: '0.25rem'
  },
  statusSuccess: {
    color: '#34d399',
    fontWeight: '600'
  },
  statusError: {
    color: '#f87171',
    fontWeight: '600'
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e5e7eb'
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '500'
  }
};

export default SeedPage;

// gestion-contenus-standalone.tsx
// Composant standalone pour la gestion de contenus pédagogiques
// Compatible avec votre workflow GitHub Pages + esbuild

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { firebaseService, Niveau } from './src/services/FirebaseService';

const GestionContenus: React.FC = () => {
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNiveaux();
  }, []);

  const loadNiveaux = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📡 Chargement des niveaux...');
      const data = await firebaseService.getNiveaux();
      console.log('✅ Niveaux chargés:', data);
      setNiveaux(data);
    } catch (err: any) {
      console.error('❌ Erreur:', err);
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const createTestNiveau = async () => {
    try {
      console.log('➕ Création d\'un niveau de test...');
      const nouveauNiveau = await firebaseService.createNiveau({
        nom: '6ème',
        ordre: 1
      });
      console.log('✅ Niveau créé:', nouveauNiveau);
      await loadNiveaux();
      alert('Niveau créé avec succès !');
    } catch (err: any) {
      console.error('❌ Erreur création:', err);
      alert('Erreur: ' + err.message);
    }
  };

  const deleteNiveau = async (id: string, nom: string) => {
    if (!window.confirm(`Supprimer "${nom}" et tout son contenu ?`)) return;
    try {
      console.log(`🗑️ Suppression de ${nom}...`);
      await firebaseService.deleteNiveau(id);
      console.log('✅ Niveau supprimé');
      await loadNiveaux();
    } catch (err: any) {
      console.error('❌ Erreur suppression:', err);
      alert('Erreur: ' + err.message);
    }
  };

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '30px',
        borderRadius: '12px',
        marginBottom: '30px'
      }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '32px' }}>
          🎓 Gestion de Contenus Pédagogiques
        </h1>
        <p style={{ margin: 0, opacity: 0.9 }}>
          PedaClic - Module de gestion des niveaux, classes, matières et ressources
        </p>
      </div>

      {/* État de chargement */}
      {loading && (
        <div style={{
          padding: '30px',
          background: '#e3f2fd',
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '18px'
        }}>
          ⏳ Chargement en cours...
        </div>
      )}

      {/* Erreurs */}
      {error && (
        <div style={{
          padding: '20px',
          background: '#ffebee',
          borderRadius: '8px',
          color: '#c62828',
          marginBottom: '20px'
        }}>
          <strong>❌ Erreur:</strong> {error}
          <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
            Vérifiez la console (F12) pour plus de détails
          </div>
        </div>
      )}

      {/* Actions */}
      {!loading && (
        <div style={{ marginBottom: '30px', display: 'flex', gap: '10px' }}>
          <button
            onClick={createTestNiveau}
            style={{
              padding: '12px 24px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#45a049'}
            onMouseOut={(e) => e.currentTarget.style.background = '#4caf50'}
          >
            ➕ Créer un niveau de test (6ème)
          </button>

          <button
            onClick={loadNiveaux}
            style={{
              padding: '12px 24px',
              background: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#1976d2'}
            onMouseOut={(e) => e.currentTarget.style.background = '#2196f3'}
          >
            🔄 Recharger
          </button>
        </div>
      )}

      {/* Liste des niveaux */}
      {!loading && !error && (
        <div>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>
            📚 Niveaux dans Firestore ({niveaux.length})
          </h2>

          {niveaux.length === 0 ? (
            <div style={{
              padding: '40px',
              background: '#fff3e0',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>📭</div>
              <p style={{ fontSize: '18px', color: '#e65100' }}>
                Aucun niveau trouvé dans la base de données
              </p>
              <p style={{ color: '#666', marginTop: '10px' }}>
                Cliquez sur "Créer un niveau de test" pour commencer
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {niveaux.map((niveau) => (
                <div
                  key={niveau.id}
                  style={{
                    padding: '20px',
                    background: 'white',
                    border: '2px solid #e0e0e0',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = '#667eea';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = '#e0e0e0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>
                      {niveau.nom}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                      Ordre: {niveau.ordre} • ID: {niveau.id}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteNiveau(niveau.id!, niveau.nom)}
                    style={{
                      padding: '10px 20px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#d32f2f'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#f44336'}
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div style={{
        marginTop: '40px',
        padding: '25px',
        background: '#f5f5f5',
        borderRadius: '8px',
        borderLeft: '4px solid #2196f3'
      }}>
        <h3 style={{ marginTop: 0, color: '#1976d2' }}>📋 Instructions</h3>
        <ol style={{ color: '#555', lineHeight: '1.8' }}>
          <li>Ouvrez la console de votre navigateur (F12)</li>
          <li>Cliquez sur "Créer un niveau de test"</li>
          <li>Vérifiez que le niveau apparaît dans la liste ci-dessus</li>
          <li>Allez dans Firebase Console → Firestore Database</li>
          <li>Vérifiez que la collection "niveaux" a été créée</li>
        </ol>
        <p style={{ marginTop: '20px', color: '#2e7d32', fontWeight: 'bold' }}>
          ✅ Si tout fonctionne, votre configuration Firebase est correcte !
        </p>
      </div>
    </div>
  );
};

// Point d'entrée pour le montage du composant
const mountApp = () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<GestionContenus />);
  } else {
    console.error('Element #root not found');
  }
};

// Auto-montage si DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}

export default GestionContenus;

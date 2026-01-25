// src/components/TestFirebase.tsx
// Composant simple pour tester la connexion Firebase

import React, { useEffect, useState } from 'react';
import { firebaseService, Niveau } from '../services/FirebaseService';

const TestFirebase: React.FC = () => {
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les niveaux au montage du composant
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

  // Fonction pour créer un niveau de test
  const createTestNiveau = async () => {
    try {
      console.log('➕ Création d\'un niveau de test...');
      
      const nouveauNiveau = await firebaseService.createNiveau({
        nom: '6ème',
        ordre: 1
      });
      
      console.log('✅ Niveau créé:', nouveauNiveau);
      
      // Recharger la liste
      await loadNiveaux();
      
      alert('Niveau créé avec succès !');
      
    } catch (err: any) {
      console.error('❌ Erreur création:', err);
      alert('Erreur: ' + err.message);
    }
  };

  // Fonction pour supprimer un niveau
  const deleteNiveau = async (id: string, nom: string) => {
    if (!window.confirm(`Supprimer "${nom}" ?`)) return;
    
    try {
      console.log(`🗑️ Suppression de ${nom}...`);
      
      await firebaseService.deleteNiveau(id);
      
      console.log('✅ Niveau supprimé');
      
      // Recharger la liste
      await loadNiveaux();
      
    } catch (err: any) {
      console.error('❌ Erreur suppression:', err);
      alert('Erreur: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🧪 Test Firebase - PedaClic</h1>
      
      {/* Indicateur de chargement */}
      {loading && (
        <div style={{ padding: '20px', background: '#e3f2fd', borderRadius: '8px' }}>
          <p>⏳ Chargement...</p>
        </div>
      )}
      
      {/* Affichage des erreurs */}
      {error && (
        <div style={{ padding: '20px', background: '#ffebee', borderRadius: '8px', color: '#c62828' }}>
          <p>❌ Erreur: {error}</p>
          <p style={{ fontSize: '12px', marginTop: '10px' }}>
            Vérifiez la console pour plus de détails
          </p>
        </div>
      )}
      
      {/* Bouton pour créer un niveau de test */}
      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <button 
          onClick={createTestNiveau}
          style={{
            padding: '10px 20px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ➕ Créer un niveau de test (6ème)
        </button>
        
        <button 
          onClick={loadNiveaux}
          style={{
            padding: '10px 20px',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            marginLeft: '10px'
          }}
        >
          🔄 Recharger
        </button>
      </div>
      
      {/* Liste des niveaux */}
      {!loading && !error && (
        <div>
          <h2>📚 Niveaux dans Firestore ({niveaux.length})</h2>
          
          {niveaux.length === 0 ? (
            <div style={{ padding: '20px', background: '#fff3e0', borderRadius: '8px' }}>
              <p>Aucun niveau trouvé. Cliquez sur "Créer un niveau de test" pour commencer.</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {niveaux.map((niveau) => (
                <li 
                  key={niveau.id}
                  style={{
                    padding: '15px',
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong>{niveau.nom}</strong>
                    <span style={{ marginLeft: '10px', color: '#666' }}>
                      (Ordre: {niveau.ordre})
                    </span>
                    <br />
                    <small style={{ color: '#999' }}>ID: {niveau.id}</small>
                  </div>
                  
                  <button
                    onClick={() => deleteNiveau(niveau.id!, niveau.nom)}
                    style={{
                      padding: '8px 15px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {/* Instructions */}
      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        background: '#f5f5f5', 
        borderRadius: '8px',
        borderLeft: '4px solid #2196f3'
      }}>
        <h3>📋 Instructions</h3>
        <ol>
          <li>Ouvrez la console de votre navigateur (F12)</li>
          <li>Cliquez sur "Créer un niveau de test"</li>
          <li>Vérifiez que le niveau apparaît dans la liste</li>
          <li>Allez dans Firebase Console &gt; Firestore Database</li>
          <li>Vérifiez que la collection "niveaux" a été créée</li>
        </ol>
        
        <p style={{ marginTop: '15px', color: '#666' }}>
          ✅ Si tout fonctionne, Firebase est correctement configuré !
        </p>
      </div>
    </div>
  );
};

export default TestFirebase;

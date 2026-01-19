import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, BookOpen, GraduationCap, Book, Calendar } from 'lucide-react';
import PlanificationContenus from './PlanificationContenus';
declare const firebase: any;
/**
 * PANNEAU D'ADMINISTRATION PEDACLIC
 * Gestion de la structure pédagogique : Niveaux, Classes, Matières et Planification
 */

const AdminPanel = () => {
  /* ========================================
     ÉTATS PRINCIPAUX
  ======================================== */
  const [activeTab, setActiveTab] = useState('niveaux');
  const [niveaux, setNiveaux] = useState([]);
  const [classes, setClasses] = useState([]);
  const [matieres, setMatieres] = useState([]);
  
  /* ========================================
     ÉTATS DES MODALES
  ======================================== */
  const [showAddNiveau, setShowAddNiveau] = useState(false);
  const [showAddClasse, setShowAddClasse] = useState(false);
  const [showAddMatiere, setShowAddMatiere] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  /* ========================================
     ÉTATS DES FORMULAIRES
  ======================================== */
  const [newNiveau, setNewNiveau] = useState('');
  const [newClasse, setNewClasse] = useState({ nom: '', niveauId: '' });
  const [newMatiere, setNewMatiere] = useState({ nom: '', classeIds: [] });

  /* ========================================
     CHARGEMENT DES DONNÉES
  ======================================== */
  useEffect(() => {
    if (typeof firebase !== 'undefined') {
      loadNiveaux();
      loadClasses();
      loadMatieres();
    }
  }, []);

  const loadNiveaux = async () => {
    try {
      const db = firebase.firestore();
      const snapshot = await db.collection('config_niveaux').orderBy('ordre').get();
      setNiveaux(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Erreur chargement niveaux:', error);
    }
  };

  const loadClasses = async () => {
    try {
      const db = firebase.firestore();
      const snapshot = await db.collection('config_classes').orderBy('ordre').get();
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Erreur chargement classes:', error);
    }
  };

  const loadMatieres = async () => {
    try {
      const db = firebase.firestore();
      const snapshot = await db.collection('config_matieres').get();
      setMatieres(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Erreur chargement matières:', error);
    }
  };

  /* ========================================
     CRUD - NIVEAUX
  ======================================== */
  const ajouterNiveau = async () => {
    if (!newNiveau.trim()) return;
    
    try {
      const db = firebase.firestore();
      await db.collection('config_niveaux').add({
        nom: newNiveau,
        ordre: niveaux.length + 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      setNewNiveau('');
      setShowAddNiveau(false);
      loadNiveaux();
    } catch (error) {
      console.error('Erreur ajout niveau:', error);
      alert('Erreur lors de l\'ajout du niveau');
    }
  };

  const modifierNiveau = async (id, nouveauNom) => {
    try {
      const db = firebase.firestore();
      await db.collection('config_niveaux').doc(id).update({ nom: nouveauNom });
      setEditingItem(null);
      loadNiveaux();
    } catch (error) {
      console.error('Erreur modification niveau:', error);
      alert('Erreur lors de la modification');
    }
  };

  const supprimerNiveau = async (id) => {
    if (!confirm('Supprimer ce niveau ? Les classes associées seront aussi supprimées.')) return;
    
    try {
      const db = firebase.firestore();
      await db.collection('config_niveaux').doc(id).delete();
      
      // Supprimer les classes associées
      const classesSnap = await db.collection('config_classes').where('niveauId', '==', id).get();
      classesSnap.docs.forEach(doc => doc.ref.delete());
      
      loadNiveaux();
      loadClasses();
    } catch (error) {
      console.error('Erreur suppression niveau:', error);
      alert('Erreur lors de la suppression');
    }
  };

  /* ========================================
     CRUD - CLASSES
  ======================================== */
  const ajouterClasse = async () => {
    if (!newClasse.nom.trim() || !newClasse.niveauId) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    
    try {
      const db = firebase.firestore();
      const classesInNiveau = classes.filter(c => c.niveauId === newClasse.niveauId);
      
      await db.collection('config_classes').add({
        nom: newClasse.nom,
        niveauId: newClasse.niveauId,
        ordre: classesInNiveau.length + 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      setNewClasse({ nom: '', niveauId: '' });
      setShowAddClasse(false);
      loadClasses();
    } catch (error) {
      console.error('Erreur ajout classe:', error);
      alert('Erreur lors de l\'ajout');
    }
  };

  const modifierClasse = async (id, nouveauNom) => {
    try {
      const db = firebase.firestore();
      await db.collection('config_classes').doc(id).update({ nom: nouveauNom });
      setEditingItem(null);
      loadClasses();
    } catch (error) {
      console.error('Erreur modification classe:', error);
      alert('Erreur lors de la modification');
    }
  };

  const supprimerClasse = async (id) => {
    if (!confirm('Supprimer cette classe ?')) return;
    
    try {
      const db = firebase.firestore();
      await db.collection('config_classes').doc(id).delete();
      
      // Mettre à jour les matières qui référencent cette classe
      const matieresSnap = await db.collection('config_matieres').get();
      matieresSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.classeIds && data.classeIds.includes(id)) {
          const newClasseIds = data.classeIds.filter(cId => cId !== id);
          doc.ref.update({ classeIds: newClasseIds });
        }
      });
      
      loadClasses();
      loadMatieres();
    } catch (error) {
      console.error('Erreur suppression classe:', error);
      alert('Erreur lors de la suppression');
    }
  };

  /* ========================================
     CRUD - MATIÈRES
  ======================================== */
  const ajouterMatiere = async () => {
    if (!newMatiere.nom.trim() || newMatiere.classeIds.length === 0) {
      alert('Veuillez remplir tous les champs et sélectionner au moins une classe');
      return;
    }
    
    try {
      const db = firebase.firestore();
      await db.collection('config_matieres').add({
        nom: newMatiere.nom,
        classeIds: newMatiere.classeIds,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      setNewMatiere({ nom: '', classeIds: [] });
      setShowAddMatiere(false);
      loadMatieres();
    } catch (error) {
      console.error('Erreur ajout matière:', error);
      alert('Erreur lors de l\'ajout');
    }
  };

  const supprimerMatiere = async (id) => {
    if (!confirm('Supprimer cette matière ?')) return;
    
    try {
      const db = firebase.firestore();
      await db.collection('config_matieres').doc(id).delete();
      loadMatieres();
    } catch (error) {
      console.error('Erreur suppression matière:', error);
      alert('Erreur lors de la suppression');
    }
  };

  /* ========================================
     FONCTIONS UTILITAIRES
  ======================================== */
  const toggleClasseForMatiere = (classeId) => {
    setNewMatiere(prev => ({
      ...prev,
      classeIds: prev.classeIds.includes(classeId)
        ? prev.classeIds.filter(id => id !== classeId)
        : [...prev.classeIds, classeId]
    }));
  };

  const getClassesByNiveau = (niveauId) => {
    return classes.filter(c => c.niveauId === niveauId);
  };

  /* ========================================
     STYLES RÉUTILISABLES
  ======================================== */
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    },
    header: {
      background: 'white',
      borderRadius: '15px',
      padding: '30px',
      marginBottom: '30px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
    },
    tabButton: (isActive) => ({
      padding: '15px 30px',
      background: isActive ? 'white' : 'rgba(255,255,255,0.3)',
      color: isActive ? '#667eea' : 'white',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 'bold',
      fontSize: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      transition: 'all 0.3s ease'
    }),
    contentCard: {
      background: 'white',
      borderRadius: '15px',
      padding: '30px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
    },
    addButton: {
      background: '#667eea',
      color: 'white',
      border: 'none',
      padding: '10px 15px',
      borderRadius: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      fontWeight: 'bold',
      transition: 'all 0.3s ease'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: 'white',
      padding: '30px',
      borderRadius: '15px',
      width: '90%',
      maxWidth: '500px'
    }
  };

  /* ========================================
     RENDU DU COMPOSANT
  ======================================== */
  return (
    <div style={styles.container}>
      {/* En-tête */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Settings size={40} color="#667eea" />
          <div>
            <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '28px' }}>
              Panneau d'Administration
            </h1>
            <p style={{ color: '#7f8c8d', margin: '5px 0 0 0', fontSize: '15px' }}>
              Configuration de la structure pédagogique
            </p>
          </div>
        </div>
      </div>

      {/* Navigation entre les onglets */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setActiveTab('niveaux')} 
          style={styles.tabButton(activeTab === 'niveaux')}
        >
          <GraduationCap size={20} /> Niveaux
        </button>
        
        <button 
          onClick={() => setActiveTab('classes')} 
          style={styles.tabButton(activeTab === 'classes')}
        >
          <BookOpen size={20} /> Classes
        </button>
        
        <button 
          onClick={() => setActiveTab('matieres')} 
          style={styles.tabButton(activeTab === 'matieres')}
        >
          <Book size={20} /> Matières
        </button>
        
        {/* NOUVEAU : Onglet Planification */}
        <button 
          onClick={() => setActiveTab('planification')} 
          style={styles.tabButton(activeTab === 'planification')}
        >
          <Calendar size={20} /> Planification
        </button>
      </div>

      {/* ========================================
          CONTENU DES ONGLETS
      ======================================== */}

      {/* Tab Niveaux */}
      {activeTab === 'niveaux' && (
        <div style={styles.contentCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#2c3e50' }}>
              Niveaux d'enseignement
            </h2>
            <button onClick={() => setShowAddNiveau(true)} style={styles.addButton}>
              <Plus size={18} /> Ajouter un niveau
            </button>
          </div>

          <div style={{ display: 'grid', gap: '15px' }}>
            {niveaux.map(niveau => (
              <div 
                key={niveau.id} 
                style={{ 
                  border: '2px solid #e0e0e0', 
                  borderRadius: '10px', 
                  padding: '20px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: '#fafafa',
                  transition: 'all 0.3s ease'
                }}
              >
                {editingItem?.id === niveau.id ? (
                  <input 
                    type="text" 
                    defaultValue={niveau.nom} 
                    onBlur={(e) => modifierNiveau(niveau.id, e.target.value)} 
                    autoFocus 
                    style={{ 
                      flex: 1, 
                      padding: '10px', 
                      border: '2px solid #667eea', 
                      borderRadius: '5px', 
                      fontSize: '16px', 
                      fontWeight: 'bold' 
                    }} 
                  />
                ) : (
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2c3e50' }}>
                      {niveau.nom}
                    </div>
                    <div style={{ fontSize: '14px', color: '#7f8c8d', marginTop: '5px' }}>
                      {getClassesByNiveau(niveau.id).length} classe(s)
                    </div>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setEditingItem(niveau)} 
                    style={{ 
                      background: '#3498db', 
                      color: 'white', 
                      border: 'none', 
                      padding: '8px 12px', 
                      borderRadius: '5px', 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => supprimerNiveau(niveau.id)} 
                    style={{ 
                      background: '#e74c3c', 
                      color: 'white', 
                      border: 'none', 
                      padding: '8px 12px', 
                      borderRadius: '5px', 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Classes */}
      {activeTab === 'classes' && (
        <div style={styles.contentCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#2c3e50' }}>
              Classes par niveau
            </h2>
            <button onClick={() => setShowAddClasse(true)} style={styles.addButton}>
              <Plus size={18} /> Ajouter une classe
            </button>
          </div>

          {niveaux.map(niveau => {
            const classesNiveau = getClassesByNiveau(niveau.id);
            if (classesNiveau.length === 0) return null;
            
            return (
              <div key={niveau.id} style={{ marginBottom: '30px' }}>
                <h3 style={{ 
                  color: '#667eea', 
                  marginBottom: '15px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  fontSize: '18px'
                }}>
                  <GraduationCap size={24} /> {niveau.nom}
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                  gap: '15px' 
                }}>
                  {classesNiveau.map(classe => (
                    <div 
                      key={classe.id} 
                      style={{ 
                        border: '2px solid #e0e0e0', 
                        borderRadius: '10px', 
                        padding: '15px', 
                        background: '#fafafa',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {editingItem?.id === classe.id ? (
                        <input 
                          type="text" 
                          defaultValue={classe.nom} 
                          onBlur={(e) => modifierClasse(classe.id, e.target.value)} 
                          autoFocus 
                          style={{ 
                            width: '100%', 
                            padding: '8px', 
                            border: '2px solid #667eea', 
                            borderRadius: '5px', 
                            fontWeight: 'bold' 
                          }} 
                        />
                      ) : (
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: 'bold', 
                          color: '#2c3e50', 
                          marginBottom: '10px' 
                        }}>
                          {classe.nom}
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                        <button 
                          onClick={() => setEditingItem(classe)} 
                          style={{ 
                            flex: 1, 
                            background: '#3498db', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px', 
                            borderRadius: '5px', 
                            cursor: 'pointer', 
                            fontSize: '12px',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => supprimerClasse(classe.id)} 
                          style={{ 
                            flex: 1, 
                            background: '#e74c3c', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px', 
                            borderRadius: '5px', 
                            cursor: 'pointer', 
                            fontSize: '12px',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Matières */}
      {activeTab === 'matieres' && (
        <div style={styles.contentCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#2c3e50' }}>
              Matières
            </h2>
            <button onClick={() => setShowAddMatiere(true)} style={styles.addButton}>
              <Plus size={18} /> Ajouter une matière
            </button>
          </div>

          <div style={{ display: 'grid', gap: '15px' }}>
            {matieres.map(matiere => (
              <div 
                key={matiere.id} 
                style={{ 
                  border: '2px solid #e0e0e0', 
                  borderRadius: '10px', 
                  padding: '20px', 
                  background: '#fafafa',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'start', 
                  marginBottom: '15px' 
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      color: '#2c3e50', 
                      marginBottom: '10px' 
                    }}>
                      {matiere.nom}
                    </div>
                    <div style={{ fontSize: '14px', color: '#7f8c8d' }}>
                      Disponible pour : {matiere.classeIds.map(cId => {
                        const classe = classes.find(c => c.id === cId);
                        return classe ? classe.nom : '';
                      }).filter(Boolean).join(', ')}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => supprimerMatiere(matiere.id)} 
                    style={{ 
                      background: '#e74c3c', 
                      color: 'white', 
                      border: 'none', 
                      padding: '8px 12px', 
                      borderRadius: '5px', 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NOUVEAU : Tab Planification */}
      {activeTab === 'planification' && (
        <div style={{ 
          background: 'white', 
          borderRadius: '15px', 
          padding: '0',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }}>
          <PlanificationContenus />
        </div>
      )}

      {/* ========================================
          MODALES
      ======================================== */}

      {/* Modal Ajouter Niveau */}
      {showAddNiveau && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Ajouter un niveau</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Nom du niveau
              </label>
              <input 
                type="text" 
                value={newNiveau} 
                onChange={(e) => setNewNiveau(e.target.value)} 
                placeholder="Ex: Primaire, Collège, Lycée" 
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '2px solid #e0e0e0', 
                  borderRadius: '8px',
                  fontSize: '14px'
                }} 
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { 
                  setShowAddNiveau(false); 
                  setNewNiveau(''); 
                }} 
                style={{ 
                  padding: '10px 20px', 
                  background: '#95a5a6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Annuler
              </button>
              <button 
                onClick={ajouterNiveau} 
                style={{ 
                  padding: '10px 20px', 
                  background: '#667eea', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajouter Classe */}
      {showAddClasse && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Ajouter une classe</h2>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Niveau
              </label>
              <select 
                value={newClasse.niveauId} 
                onChange={(e) => setNewClasse({ ...newClasse, niveauId: e.target.value })} 
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '2px solid #e0e0e0', 
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="">Sélectionner un niveau</option>
                {niveaux.map(n => (
                  <option key={n.id} value={n.id}>{n.nom}</option>
                ))}
              </select>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Nom de la classe
              </label>
              <input 
                type="text" 
                value={newClasse.nom} 
                onChange={(e) => setNewClasse({ ...newClasse, nom: e.target.value })} 
                placeholder="Ex: 6ème, 5ème, Seconde" 
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '2px solid #e0e0e0', 
                  borderRadius: '8px',
                  fontSize: '14px'
                }} 
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { 
                  setShowAddClasse(false); 
                  setNewClasse({ nom: '', niveauId: '' }); 
                }} 
                style={{ 
                  padding: '10px 20px', 
                  background: '#95a5a6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Annuler
              </button>
              <button 
                onClick={ajouterClasse} 
                style={{ 
                  padding: '10px 20px', 
                  background: '#667eea', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajouter Matière */}
      {showAddMatiere && (
        <div style={styles.modal}>
          <div style={{ 
            ...styles.modalContent, 
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Ajouter une matière</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Nom de la matière
              </label>
              <input 
                type="text" 
                value={newMatiere.nom} 
                onChange={(e) => setNewMatiere({ ...newMatiere, nom: e.target.value })} 
                placeholder="Ex: Français, Mathématiques" 
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  border: '2px solid #e0e0e0', 
                  borderRadius: '8px',
                  fontSize: '14px'
                }} 
              />
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '10px', 
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Classes concernées
              </label>
              
              {niveaux.map(niveau => {
                const classesNiveau = getClassesByNiveau(niveau.id);
                if (classesNiveau.length === 0) return null;
                
                return (
                  <div 
                    key={niveau.id} 
                    style={{ 
                      marginBottom: '15px', 
                      padding: '15px', 
                      background: '#f8f9fa', 
                      borderRadius: '8px' 
                    }}
                  >
                    <div style={{ 
                      fontWeight: 'bold', 
                      marginBottom: '10px', 
                      color: '#667eea',
                      fontSize: '15px'
                    }}>
                      {niveau.nom}
                    </div>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {classesNiveau.map(classe => (
                        <label 
                          key={classe.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '5px', 
                            cursor: 'pointer', 
                            padding: '8px 12px', 
                            background: newMatiere.classeIds.includes(classe.id) ? '#667eea' : 'white', 
                            color: newMatiere.classeIds.includes(classe.id) ? 'white' : '#2c3e50', 
                            border: '2px solid #667eea', 
                            borderRadius: '8px', 
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={newMatiere.classeIds.includes(classe.id)} 
                            onChange={() => toggleClasseForMatiere(classe.id)} 
                            style={{ cursor: 'pointer' }} 
                          />
                          {classe.nom}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => { 
                  setShowAddMatiere(false); 
                  setNewMatiere({ nom: '', classeIds: [] }); 
                }} 
                style={{ 
                  padding: '10px 20px', 
                  background: '#95a5a6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Annuler
              </button>
              <button 
                onClick={ajouterMatiere} 
                style={{ 
                  padding: '10px 20px', 
                  background: '#667eea', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
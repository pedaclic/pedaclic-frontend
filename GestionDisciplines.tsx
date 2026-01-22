import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Book, GraduationCap, Award, Clock } from 'lucide-react';

declare const firebase: any;

const CATEGORIES = ['Langues', 'Sciences', 'Sciences humaines & sociales', 'Gestion', 'Sports', 'Éveil'];
const NIVEAUX = ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'];

interface Discipline {
  id: string;
  nom: string;
  categorie: string;
  isOptionnelle: boolean;
  niveauxCibles: string[];
  ordre: number;
  coefficients: Record<string, number>;
  volumeHoraire: Record<string, string>;
}

const GestionDisciplinesAvancee: React.FC = () => {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCoefficients, setShowCoefficients] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<Discipline>>({
    nom: '', categorie: 'Langues', isOptionnelle: false, niveauxCibles: NIVEAUX, ordre: 0,
    coefficients: NIVEAUX.reduce((acc, n) => ({ ...acc, [n]: 1 }), {}),
    volumeHoraire: NIVEAUX.reduce((acc, n) => ({ ...acc, [n]: '1h' }), {})
  });

  useEffect(() => { loadDisciplines(); }, []);

  const loadDisciplines = async () => {
    setIsLoading(true);
    try {
      const db = firebase.firestore();
      const snapshot = await db.collection('disciplines').orderBy('ordre', 'asc').get();
      const disciplinesData: Discipline[] = [];
      snapshot.forEach((doc: any) => {
        disciplinesData.push({ id: doc.id, ...doc.data() } as Discipline);
      });
      setDisciplines(disciplinesData);
      console.log('✅ Disciplines chargées:', disciplinesData.length);
    } catch (error) {
      console.error('❌ Erreur chargement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addDiscipline = async () => {
    if (!formData.nom || !formData.categorie) {
      alert('Veuillez remplir tous les champs');
      return;
    }
    try {
      const db = firebase.firestore();
      const id = formData.nom.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      await db.collection('disciplines').doc(id).set({
        nom: formData.nom,
        categorie: formData.categorie,
        isOptionnelle: formData.isOptionnelle || false,
        niveauxCibles: formData.niveauxCibles || NIVEAUX,
        ordre: disciplines.length,
        coefficients: formData.coefficients,
        volumeHoraire: formData.volumeHoraire,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('✅ Discipline ajoutée !');
      setShowAddForm(false);
      resetForm();
      loadDisciplines();
    } catch (error) {
      console.error('❌ Erreur ajout:', error);
      alert('Erreur lors de l\'ajout');
    }
  };

  const updateDiscipline = async (id: string) => {
    try {
      const db = firebase.firestore();
      const discipline = disciplines.find(d => d.id === id);
      if (!discipline) return;
      await db.collection('disciplines').doc(id).update({
        nom: discipline.nom,
        categorie: discipline.categorie,
        isOptionnelle: discipline.isOptionnelle,
        niveauxCibles: discipline.niveauxCibles,
        coefficients: discipline.coefficients,
        volumeHoraire: discipline.volumeHoraire,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('✅ Mise à jour !');
      setEditMode(null);
      setShowCoefficients(null);
      loadDisciplines();
    } catch (error) {
      console.error('❌ Erreur:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  const deleteDiscipline = async (id: string, nom: string) => {
    if (!confirm(`Supprimer "${nom}" ?`)) return;
    try {
      const db = firebase.firestore();
      await db.collection('disciplines').doc(id).delete();
      alert('✅ Supprimée !');
      loadDisciplines();
    } catch (error) {
      console.error('❌ Erreur:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '', categorie: 'Langues', isOptionnelle: false, niveauxCibles: NIVEAUX, ordre: 0,
      coefficients: NIVEAUX.reduce((acc, n) => ({ ...acc, [n]: 1 }), {}),
      volumeHoraire: NIVEAUX.reduce((acc, n) => ({ ...acc, [n]: '1h' }), {})
    });
  };

  const updateLocalDiscipline = (id: string, field: keyof Discipline, value: any) => {
    setDisciplines(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const updateCoefficient = (id: string, niveau: string, value: number) => {
    setDisciplines(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, coefficients: { ...d.coefficients, [niveau]: value } };
      }
      return d;
    }));
  };

  const updateVolumeHoraire = (id: string, niveau: string, value: string) => {
    setDisciplines(prev => prev.map(d => {
      if (d.id === id) {
        return { ...d, volumeHoraire: { ...d.volumeHoraire, [niveau]: value } };
      }
      return d;
    }));
  };

  const disciplinesParCategorie = CATEGORIES.map(cat => ({
    categorie: cat,
    disciplines: disciplines.filter(d => d.categorie === cat)
  })).filter(group => group.disciplines.length > 0);

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>⏳ Chargement...</div>;
  }

  return (
    <div style={{ background: 'white', borderRadius: '15px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Book size={32} style={{ color: '#6676ea' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#2c3e50' }}>
              Gestion des Disciplines
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
              {disciplines.length} discipline{disciplines.length > 1 ? 's' : ''} • Coefficients & Volumes horaires
            </p>
          </div>
        </div>
        <button onClick={() => setShowAddForm(true)} style={{
          padding: '12px 24px', background: '#6676ea', color: 'white', border: 'none',
          borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex',
          alignItems: 'center', gap: '8px'
        }}>
          <Plus size={18} /> Ajouter
        </button>
      </div>

      {disciplinesParCategorie.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#7f8c8d' }}>
          <GraduationCap size={48} style={{ marginBottom: '15px' }} />
          <p>Aucune discipline.</p>
        </div>
      ) : (
        disciplinesParCategorie.map(group => (
          <div key={group.categorie} style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#6676ea', marginBottom: '15px', paddingBottom: '10px', borderBottom: '2px solid #e0e0e0' }}>
              {group.categorie}
            </h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {group.disciplines.map(disc => (
                <div key={disc.id} style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>{disc.nom}</span>
                        {disc.isOptionnelle && (
                          <span style={{ padding: '3px 8px', background: '#f4a261', color: 'white', fontSize: '11px', borderRadius: '4px' }}>
                            Optionnelle
                          </span>
                        )}
                      </div>
                      
                      {/* Résumé coefficients/volumes */}
                      <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          <span>
                            <Award size={14} style={{ display: 'inline', marginRight: '5px' }} />
                            Coef 6ème: {disc.coefficients?.['6ème'] || '-'}
                          </span>
                          <span>
                            <Clock size={14} style={{ display: 'inline', marginRight: '5px' }} />
                            Volume 6ème: {disc.volumeHoraire?.['6ème'] || '-'}
                          </span>
                          <span>
                            <Award size={14} style={{ display: 'inline', marginRight: '5px' }} />
                            Coef Term: {disc.coefficients?.['Terminale'] || '-'}
                          </span>
                          <span>
                            <Clock size={14} style={{ display: 'inline', marginRight: '5px' }} />
                            Volume Term: {disc.volumeHoraire?.['Terminale'] || '-'}
                          </span>
                        </div>
                      </div>

                      {/* Tableau détaillé si ouvert */}
                      {showCoefficients === disc.id && (
                        <div style={{ marginTop: '15px', background: 'white', padding: '15px', borderRadius: '8px' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
                            Configuration par niveau
                          </h4>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#f8f9fa' }}>
                                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #e0e0e0' }}>Niveau</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>Coefficient</th>
                                  <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #e0e0e0' }}>Volume horaire</th>
                                </tr>
                              </thead>
                              <tbody>
                                {NIVEAUX.map(niveau => (
                                  <tr key={niveau}>
                                    <td style={{ padding: '8px', border: '1px solid #e0e0e0', fontWeight: '600' }}>{niveau}</td>
                                    <td style={{ padding: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                                      {editMode === disc.id ? (
                                        <input
                                          type="number"
                                          min="0"
                                          max="10"
                                          value={disc.coefficients?.[niveau] || 0}
                                          onChange={e => updateCoefficient(disc.id, niveau, parseInt(e.target.value) || 0)}
                                          style={{ width: '60px', padding: '4px', textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: '4px' }}
                                        />
                                      ) : (
                                        <span style={{ fontWeight: 'bold', color: '#6676ea' }}>
                                          {disc.coefficients?.[niveau] || 0}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #e0e0e0', textAlign: 'center' }}>
                                      {editMode === disc.id ? (
                                        <input
                                          type="text"
                                          value={disc.volumeHoraire?.[niveau] || '0h'}
                                          onChange={e => updateVolumeHoraire(disc.id, niveau, e.target.value)}
                                          placeholder="Ex: 4h"
                                          style={{ width: '80px', padding: '4px', textAlign: 'center', border: '1px solid #e0e0e0', borderRadius: '4px' }}
                                        />
                                      ) : (
                                        <span style={{ fontWeight: 'bold', color: '#10b981' }}>
                                          {disc.volumeHoraire?.[niveau] || '0h'}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '20px' }}>
                      <button
                        onClick={() => setShowCoefficients(showCoefficients === disc.id ? null : disc.id)}
                        style={{
                          padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none',
                          borderRadius: '6px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap'
                        }}
                      >
                        {showCoefficients === disc.id ? '▲ Masquer' : '▼ Détails'}
                      </button>
                      
                      {editMode === disc.id ? (
                        <>
                          <button onClick={() => updateDiscipline(disc.id)} style={{
                            padding: '6px 12px', background: '#10b981', color: 'white', border: 'none',
                            borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                          }}>
                            <Save size={14} style={{ display: 'inline' }} /> Sauver
                          </button>
                          <button onClick={() => { setEditMode(null); setShowCoefficients(null); loadDisciplines(); }} style={{
                            padding: '6px 12px', background: '#95a5a6', color: 'white', border: 'none',
                            borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                          }}>
                            <X size={14} style={{ display: 'inline' }} /> Annuler
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditMode(disc.id); setShowCoefficients(disc.id); }} style={{
                            padding: '6px 12px', background: '#6676ea', color: 'white', border: 'none',
                            borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                          }}>
                            <Edit2 size={14} style={{ display: 'inline' }} /> Modifier
                          </button>
                          <button onClick={() => deleteDiscipline(disc.id, disc.nom)} style={{
                            padding: '6px 12px', background: '#e74c3c', color: 'white', border: 'none',
                            borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
                          }}>
                            <Trash2 size={14} style={{ display: 'inline' }} /> Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default GestionDisciplinesAvancee;

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Book, GraduationCap } from 'lucide-react';

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
}

const GestionDisciplines: React.FC = () => {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Discipline>>({
    nom: '', categorie: 'Langues', isOptionnelle: false, niveauxCibles: NIVEAUX, ordre: 0
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
    } catch (error) {
      console.error('Erreur chargement:', error);
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
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('✅ Discipline ajoutée !');
      setShowAddForm(false);
      resetForm();
      loadDisciplines();
    } catch (error) {
      console.error('Erreur ajout:', error);
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
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert('✅ Mise à jour !');
      setEditMode(null);
      loadDisciplines();
    } catch (error) {
      console.error('Erreur:', error);
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
      console.error('Erreur:', error);
    }
  };

  const resetForm = () => {
    setFormData({ nom: '', categorie: 'Langues', isOptionnelle: false, niveauxCibles: NIVEAUX, ordre: 0 });
  };

  const updateLocalDiscipline = (id: string, field: keyof Discipline, value: any) => {
    setDisciplines(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const toggleNiveau = (disciplineId: string, niveau: string) => {
    setDisciplines(prev => prev.map(d => {
      if (d.id === disciplineId) {
        const niveaux = d.niveauxCibles.includes(niveau)
          ? d.niveauxCibles.filter(n => n !== niveau)
          : [...d.niveauxCibles, niveau];
        return { ...d, niveauxCibles: niveaux };
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
              {disciplines.length} discipline{disciplines.length > 1 ? 's' : ''}
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

      {showAddForm && (
        <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', marginBottom: '25px', border: '2px solid #e0e0e0' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#6676ea' }}>Nouvelle discipline</h3>
          <div style={{ display: 'grid', gap: '15px' }}>
            <input type="text" value={formData.nom} onChange={e => setFormData({ ...formData, nom: e.target.value })}
              placeholder="Nom" style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }} />
            <select value={formData.categorie} onChange={e => setFormData({ ...formData, categorie: e.target.value })}
              style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }}>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={formData.isOptionnelle}
                onChange={e => setFormData({ ...formData, isOptionnelle: e.target.checked })} />
              <span>Optionnelle</span>
            </label>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAddForm(false); resetForm(); }}
                style={{ padding: '10px 20px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={addDiscipline}
                style={{ padding: '10px 20px', background: '#6676ea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={16} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {disciplinesParCategorie.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#7f8c8d' }}>
          <GraduationCap size={48} style={{ marginBottom: '15px' }} />
          <p>Aucune discipline. Cliquez sur "Ajouter".</p>
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
                  {editMode === disc.id ? (
                    <div style={{ display: 'grid', gap: '15px' }}>
                      <input type="text" value={disc.nom}
                        onChange={e => updateLocalDiscipline(disc.id, 'nom', e.target.value)}
                        style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" checked={disc.isOptionnelle}
                          onChange={e => updateLocalDiscipline(disc.id, 'isOptionnelle', e.target.checked)} />
                        <span>Optionnelle</span>
                      </label>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditMode(null)}
                          style={{ padding: '8px 16px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <X size={16} /> Annuler
                        </button>
                        <button onClick={() => updateDiscipline(disc.id)}
                          style={{ padding: '8px 16px', background: '#00a896', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Save size={16} /> OK
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2c3e50' }}>{disc.nom}</span>
                          {disc.isOptionnelle && (
                            <span style={{ padding: '3px 8px', background: '#f4a261', color: 'white', fontSize: '11px', borderRadius: '4px' }}>
                              Optionnelle
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#7f8c8d' }}>
                          Niveaux : {disc.niveauxCibles.join(', ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setEditMode(disc.id)}
                          style={{ padding: '8px 12px', background: '#6676ea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Edit2 size={14} /> Modifier
                        </button>
                        <button onClick={() => deleteDiscipline(disc.id, disc.nom)}
                          style={{ padding: '8px 12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Trash2 size={14} /> Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default GestionDisciplines;

import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, TrendingUp, CheckCircle2, Clock, Download, FileSpreadsheet, BarChart3, Save, CloudUpload, AlertCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Déclarer Firebase
declare const firebase: any;

// Configuration
const NIVEAUX = ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'];
const TRIMESTRES = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
const DISCIPLINES = [
  'Français', 'Mathématiques', 'Histoire-Géo', 'SVT', 
  'Physique-Chimie', 'Anglais', 'EPS', 'Arts', 'Technologie'
];

const COULEURS = ['#6676ea', '#4a7ba7', '#00a896', '#f4a261', '#e76f51', '#e63946', '#8e44ad', '#2e5077', '#6fa8dc'];

// Types
interface ContenuData {
  themes: string;
  objectifs: string;
  competences: string;
  evaluations: string;
  ressources: string;
  statut: 'non-commence' | 'en-cours' | 'termine';
  progression: number;
}

interface ContenusState {
  [niveau: string]: {
    [trimestre: string]: {
      [discipline: string]: ContenuData;
    };
  };
}

const PlanificationContenus: React.FC = () => {
  const [contenus, setContenus] = useState<ContenusState>({});
  const [niveauActif, setNiveauActif] = useState('6ème');
  const [trimestreActif, setTrimestreActif] = useState('Trimestre 1');
  const [disciplineActive, setDisciplineActive] = useState('Français');
  const [vueActive, setVueActive] = useState<'planification' | 'tableauDeBord'>('planification');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialiser les données vides
  const initEmptyData = (): ContenusState => {
    const initialData: ContenusState = {};
    NIVEAUX.forEach(niveau => {
      initialData[niveau] = {};
      TRIMESTRES.forEach(trimestre => {
        initialData[niveau][trimestre] = {};
        DISCIPLINES.forEach(discipline => {
          initialData[niveau][trimestre][discipline] = {
            themes: '',
            objectifs: '',
            competences: '',
            evaluations: '',
            ressources: '',
            statut: 'non-commence',
            progression: 0
          };
        });
      });
    });
    return initialData;
  };

  // Chargement initial depuis Firebase
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setSaveError(null);
      
      try {
        if (typeof firebase === 'undefined') {
          throw new Error('Firebase non initialisé');
        }

        const db = firebase.firestore();
        const doc = await db.collection('planifications').doc('contenus').get();
        
        if (doc.exists) {
          const data = doc.data();
          setContenus(data.data);
          setLastSaved(data.lastUpdated?.toDate() || null);
          console.log('✅ Planifications chargées depuis Firebase');
        } else {
          // Initialiser avec données vides
          const emptyData = initEmptyData();
          setContenus(emptyData);
          console.log('ℹ️ Aucune planification trouvée, données initialisées');
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement:', error);
        setSaveError('Erreur de chargement. Vérifiez vos permissions Firestore.');
        // Initialiser quand même
        setContenus(initEmptyData());
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Sauvegarde automatique avec debounce
  useEffect(() => {
    if (isLoading) return; // Ne pas sauvegarder pendant le chargement initial

    const timeoutId = setTimeout(async () => {
      try {
        setIsSaving(true);
        setSaveError(null);

        if (typeof firebase === 'undefined') {
          throw new Error('Firebase non initialisé');
        }

        const db = firebase.firestore();
        
        await db.collection('planifications').doc('contenus').set({
          data: contenus,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
          version: 1
        });
        
        setLastSaved(new Date());
        console.log('✅ Sauvegarde automatique réussie');
      } catch (error: any) {
        console.error('❌ Erreur de sauvegarde automatique:', error);
        setSaveError(error.message || 'Erreur de sauvegarde');
      } finally {
        setIsSaving(false);
      }
    }, 2000); // Debounce de 2 secondes

    return () => clearTimeout(timeoutId);
  }, [contenus, isLoading]);

  // Sauvegarde manuelle
  const sauvegarderManuellement = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      if (typeof firebase === 'undefined') {
        throw new Error('Firebase non initialisé');
      }

      const db = firebase.firestore();
      
      await db.collection('planifications').doc('contenus').set({
        data: contenus,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        version: 1
      });
      
      setLastSaved(new Date());
      alert('✅ Planifications sauvegardées avec succès !');
    } catch (error: any) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      setSaveError(error.message || 'Erreur de sauvegarde');
      alert('❌ Erreur lors de la sauvegarde. Vérifiez la console et vos permissions Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  // Mise à jour d'un contenu
  const updateContenu = (niveau: string, trimestre: string, discipline: string, champ: keyof ContenuData, valeur: any) => {
    setContenus(prev => ({
      ...prev,
      [niveau]: {
        ...prev[niveau],
        [trimestre]: {
          ...prev[niveau][trimestre],
          [discipline]: {
            ...prev[niveau][trimestre][discipline],
            [champ]: valeur
          }
        }
      }
    }));
  };

  // Calcul des statistiques
  const calculerStatistiques = () => {
    let total = 0;
    let termines = 0;
    let enCours = 0;
    let nonCommences = 0;
    
    Object.values(contenus).forEach(niveau => {
      Object.values(niveau).forEach(trimestre => {
        Object.values(trimestre).forEach(contenu => {
          total++;
          if (contenu.statut === 'termine') termines++;
          else if (contenu.statut === 'en-cours') enCours++;
          else nonCommences++;
        });
      });
    });

    return { total, termines, enCours, nonCommences, tauxCompletion: total > 0 ? Math.round((termines / total) * 100) : 0 };
  };

  const prepareDataNiveaux = () => {
    return NIVEAUX.map(niveau => {
      let termine = 0, enCours = 0, nonCommence = 0;
      
      if (contenus[niveau]) {
        Object.values(contenus[niveau]).forEach(trimestre => {
          Object.values(trimestre).forEach(contenu => {
            if (contenu.statut === 'termine') termine++;
            else if (contenu.statut === 'en-cours') enCours++;
            else nonCommence++;
          });
        });
      }
      
      return { niveau, 'Terminé': termine, 'En cours': enCours, 'Non commencé': nonCommence };
    });
  };

  const prepareDataDisciplines = () => {
    return DISCIPLINES.map(discipline => {
      let count = 0;
      Object.values(contenus).forEach(niveau => {
        Object.values(niveau).forEach(trimestre => {
          if (trimestre[discipline] && trimestre[discipline].statut === 'termine') count++;
        });
      });
      return { name: discipline, value: count };
    });
  };

  const prepareDataTrimestres = () => {
    return TRIMESTRES.map(trimestre => {
      let total = 0, termine = 0;
      
      Object.values(contenus).forEach(niveau => {
        if (niveau[trimestre]) {
          Object.values(niveau[trimestre]).forEach(contenu => {
            total++;
            if (contenu.statut === 'termine') termine++;
          });
        }
      });
      
      return { trimestre, progression: total > 0 ? Math.round((termine / total) * 100) : 0 };
    });
  };

  const exporterVersExcel = () => {
    let csv = 'Niveau,Trimestre,Discipline,Thèmes,Objectifs,Compétences,Évaluations,Ressources,Statut,Progression (%)\n';
    
    NIVEAUX.forEach(niveau => {
      TRIMESTRES.forEach(trimestre => {
        DISCIPLINES.forEach(discipline => {
          const contenu = contenus[niveau]?.[trimestre]?.[discipline] || {};
          const row = [
            niveau, trimestre, discipline,
            `"${(contenu.themes || '').replace(/"/g, '""')}"`,
            `"${(contenu.objectifs || '').replace(/"/g, '""')}"`,
            `"${(contenu.competences || '').replace(/"/g, '""')}"`,
            `"${(contenu.evaluations || '').replace(/"/g, '""')}"`,
            `"${(contenu.ressources || '').replace(/"/g, '""')}"`,
            contenu.statut === 'termine' ? 'Terminé' : contenu.statut === 'en-cours' ? 'En cours' : 'Non commencé',
            contenu.progression || 0
          ];
          csv += row.join(',') + '\n';
        });
      });
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `planification-contenus-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = calculerStatistiques();
  const contenuActif = contenus[niveauActif]?.[trimestreActif]?.[disciplineActive] || {
    themes: '', objectifs: '', competences: '', evaluations: '', ressources: '', statut: 'non-commence', progression: 0
  };

  // Écran de chargement
  if (isLoading) {
    return (
      <div style={{ background: 'white', borderRadius: '15px', padding: '50px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        <CloudUpload size={48} style={{ color: '#6676ea', marginBottom: '20px' }} />
        <div style={{ fontSize: '18px', color: '#2c3e50', marginBottom: '10px' }}>Chargement des planifications...</div>
        <div style={{ fontSize: '14px', color: '#7f8c8d' }}>Connexion à Firebase</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: '15px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
      {/* En-tête avec indicateur de sauvegarde */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <BookOpen size={32} style={{ color: '#6676ea' }} />
            <div>
              <h2 style={{ margin: 0, color: '#2c3e50', fontSize: '24px', fontWeight: 'bold' }}>
                Planification de Contenus Pédagogiques
              </h2>
              <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
                Gérez vos programmes de la 6ème à la Terminale
              </p>
            </div>
          </div>
          
          {/* Indicateur de sauvegarde */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              {isSaving ? (
                <>
                  <CloudUpload size={16} style={{ color: '#6676ea' }} />
                  <span style={{ color: '#6676ea' }}>Sauvegarde...</span>
                </>
              ) : saveError ? (
                <>
                  <AlertCircle size={16} style={{ color: '#e74c3c' }} />
                  <span style={{ color: '#e74c3c' }}>Erreur</span>
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle2 size={16} style={{ color: '#00a896' }} />
                  <span style={{ color: '#00a896' }}>Sauvegardé</span>
                </>
              ) : null}
            </div>
            {lastSaved && (
              <div style={{ fontSize: '12px', color: '#95a5a6' }}>
                {lastSaved.toLocaleTimeString('fr-FR')}
              </div>
            )}
          </div>
        </div>

        {/* Message d'erreur */}
        {saveError && (
          <div style={{ 
            background: '#fff5f5', 
            border: '1px solid #feb2b2', 
            borderRadius: '8px', 
            padding: '12px', 
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={20} style={{ color: '#e74c3c' }} />
            <span style={{ color: '#c53030', fontSize: '14px' }}>{saveError}</span>
          </div>
        )}

        {/* Statistiques */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <StatCard icon={<CheckCircle2 size={20} />} titre="Taux de complétion" valeur={`${stats.tauxCompletion}%`} couleur="#00a896" />
          <StatCard icon={<Clock size={20} />} titre="En cours" valeur={stats.enCours} couleur="#f4a261" />
          <StatCard icon={<TrendingUp size={20} />} titre="Terminés" valeur={stats.termines} couleur="#6676ea" />
          <StatCard icon={<Calendar size={20} />} titre="Total" valeur={stats.total} couleur="#8e44ad" />
        </div>
      </div>

      {/* Navigation avec boutons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <button onClick={() => setVueActive('planification')} style={{ padding: '10px 20px', background: vueActive === 'planification' ? '#6676ea' : '#f0f0f0', color: vueActive === 'planification' ? 'white' : '#2c3e50', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' }}>
          <BookOpen size={18} /> Planification
        </button>
        <button onClick={() => setVueActive('tableauDeBord')} style={{ padding: '10px 20px', background: vueActive === 'tableauDeBord' ? '#6676ea' : '#f0f0f0', color: vueActive === 'tableauDeBord' ? 'white' : '#2c3e50', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' }}>
          <BarChart3 size={18} /> Tableau de bord
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={sauvegarderManuellement} disabled={isSaving} style={{ padding: '10px 20px', background: '#8e44ad', color: 'white', border: 'none', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', opacity: isSaving ? 0.6 : 1, transition: 'all 0.3s' }}>
          <Save size={18} /> {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
        <button onClick={exporterVersExcel} style={{ padding: '10px 20px', background: '#00a896', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' }}>
          <FileSpreadsheet size={18} /> Export Excel
        </button>
      </div>

      {/* Contenu */}
      {vueActive === 'planification' ? (
        <VuePlanification
          niveauActif={niveauActif}
          setNiveauActif={setNiveauActif}
          trimestreActif={trimestreActif}
          setTrimestreActif={setTrimestreActif}
          disciplineActive={disciplineActive}
          setDisciplineActive={setDisciplineActive}
          contenuActif={contenuActif}
          updateContenu={updateContenu}
        />
      ) : (
        <VueTableauDeBord
          prepareDataNiveaux={prepareDataNiveaux}
          prepareDataDisciplines={prepareDataDisciplines}
          prepareDataTrimestres={prepareDataTrimestres}
        />
      )}
    </div>
  );
};

// Composants helpers
const StatCard: React.FC<{ icon: React.ReactNode; titre: string; valeur: string | number; couleur: string }> = ({ icon, titre, valeur, couleur }) => (
  <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ color: couleur }}>{icon}</div>
      <div>
        <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px' }}>{titre}</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: couleur }}>{valeur}</div>
      </div>
    </div>
  </div>
);

const VuePlanification: React.FC<any> = ({ niveauActif, setNiveauActif, trimestreActif, setTrimestreActif, disciplineActive, setDisciplineActive, contenuActif, updateContenu }) => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '25px' }}>
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>Niveau scolaire</label>
        <select value={niveauActif} onChange={e => setNiveauActif(e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
          {NIVEAUX.map(niveau => <option key={niveau} value={niveau}>{niveau}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>Trimestre</label>
        <select value={trimestreActif} onChange={e => setTrimestreActif(e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
          {TRIMESTRES.map(trimestre => <option key={trimestre} value={trimestre}>{trimestre}</option>)}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>Discipline</label>
        <select value={disciplineActive} onChange={e => setDisciplineActive(e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
          {DISCIPLINES.map(discipline => <option key={discipline} value={discipline}>{discipline}</option>)}
        </select>
      </div>
    </div>

    <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold', color: '#6676ea' }}>
        {niveauActif} - {trimestreActif} - {disciplineActive}
      </h3>

      <div style={{ display: 'grid', gap: '20px' }}>
        <ChampTexte label="Thèmes et chapitres" placeholder="Ex: L'accord du participe passé, Les figures de style..." value={contenuActif.themes} onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'themes', val)} />
        <ChampTexte label="Objectifs d'apprentissage" placeholder="Ex: Maîtriser les règles d'accord, Identifier les métaphores..." value={contenuActif.objectifs} onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'objectifs', val)} rows={3} />
        <ChampTexte label="Compétences visées" placeholder="Ex: Analyse critique, Rédaction argumentée..." value={contenuActif.competences} onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'competences', val)} rows={3} />
        <ChampTexte label="Évaluations prévues" placeholder="Ex: Contrôle continu, Dissertation finale..." value={contenuActif.evaluations} onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'evaluations', val)} />
        <ChampTexte label="Ressources pédagogiques" placeholder="Ex: Manuel Hatier p.45-78, Vidéo Lumni, Exercices PedaClic..." value={contenuActif.ressources} onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'ressources', val)} rows={2} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>Statut</label>
            <select value={contenuActif.statut} onChange={e => updateContenu(niveauActif, trimestreActif, disciplineActive, 'statut', e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <option value="non-commence">Non commencé</option>
              <option value="en-cours">En cours</option>
              <option value="termine">Terminé</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>Progression (%)</label>
            <input type="number" min="0" max="100" value={contenuActif.progression} onChange={e => updateContenu(niveauActif, trimestreActif, disciplineActive, 'progression', parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px' }} />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ChampTexte: React.FC<any> = ({ label, placeholder, value, onChange, rows = 1 }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>{label}</label>
    {rows > 1 ? (
      <textarea placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} rows={rows} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit' }} />
    ) : (
      <input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px' }} />
    )}
  </div>
);

const VueTableauDeBord: React.FC<any> = ({ prepareDataNiveaux, prepareDataDisciplines, prepareDataTrimestres }) => {
  const dataNiveaux = prepareDataNiveaux();
  const dataDisciplines = prepareDataDisciplines();
  const dataTrimestres = prepareDataTrimestres();

  return (
    <div>
      <h3 style={{ margin: '0 0 25px 0', fontSize: '20px', fontWeight: 'bold', color: '#2c3e50' }}>Visualisations et Statistiques</h3>
      <div style={{ display: 'grid', gap: '25px' }}>
        <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
          <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>Progression par niveau</h4>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dataNiveaux}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="niveau" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Terminé" fill="#00a896" />
              <Bar dataKey="En cours" fill="#f4a261" />
              <Bar dataKey="Non commencé" fill="#95a5a6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '25px' }}>
          <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
            <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>Contenus terminés par discipline</h4>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie data={dataDisciplines} cx="50%" cy="50%" labelLine={false} label={entry => entry.name} outerRadius={100} fill="#8884d8" dataKey="value">
                  {dataDisciplines.map((entry, index) => <Cell key={`cell-${index}`} fill={COULEURS[index % COULEURS.length]} />)}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
            <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>Taux de complétion par trimestre</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dataTrimestres}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="trimestre" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="progression" stroke="#6676ea" strokeWidth={3} dot={{ fill: '#6676ea', r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanificationContenus;

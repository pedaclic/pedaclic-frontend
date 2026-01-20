import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Download, FileSpreadsheet, BarChart3, Home, ArrowLeft } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

declare const firebase: any;

const NIVEAUX = ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'];
const TRIMESTRES = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
const DISCIPLINES = [
  'Français', 'Mathématiques', 'Histoire-Géo', 'SVT', 
  'Physique-Chimie', 'Anglais', 'EPS', 'Arts', 'Technologie'
];
const COULEURS = ['#6676ea', '#4a7ba7', '#00a896', '#f4a261', '#e76f51', '#e63946', '#8e44ad', '#2e5077', '#6fa8dc'];

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

const PlanificationConsultation: React.FC = () => {
  const [contenus, setContenus] = useState<ContenusState>({});
  const [niveauActif, setNiveauActif] = useState('6ème');
  const [trimestreActif, setTrimestreActif] = useState('Trimestre 1');
  const [disciplineActive, setDisciplineActive] = useState('Français');
  const [vueActive, setVueActive] = useState<'consultation' | 'statistiques'>('consultation');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        if (typeof firebase === 'undefined') {
          throw new Error('Firebase non initialisé');
        }

        const db = firebase.firestore();
        const doc = await db.collection('planifications').doc('contenus').get();
        
        if (doc.exists) {
          const data = doc.data();
          setContenus(data.data);
          console.log('✅ Planifications chargées');
        } else {
          console.log('ℹ️ Aucune planification disponible');
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

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

  const contenuActif = contenus[niveauActif]?.[trimestreActif]?.[disciplineActive] || {
    themes: '', objectifs: '', competences: '', evaluations: '', ressources: '', statut: 'non-commence', progression: 0
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: '15px', padding: '50px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
          <BookOpen size={48} style={{ color: '#6676ea', marginBottom: '20px' }} />
          <div style={{ fontSize: '18px', color: '#2c3e50' }}>Chargement des planifications...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '30px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* En-tête avec bouton retour */}
        <div style={{ background: 'white', borderRadius: '15px', padding: '30px', marginBottom: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <BookOpen size={32} style={{ color: '#6676ea' }} />
              <div>
                <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '28px', fontWeight: 'bold' }}>
                  Planifications Pédagogiques
                </h1>
                <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
                  Consultez les programmes de la 6ème à la Terminale
                </p>
              </div>
            </div>
            
            <a href="../index.html" style={{ padding: '12px 24px', background: '#6676ea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', transition: 'all 0.3s' }}>
              <Home size={18} /> Retour à l'accueil
            </a>
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setVueActive('consultation')} style={{ padding: '10px 20px', background: vueActive === 'consultation' ? '#6676ea' : '#f0f0f0', color: vueActive === 'consultation' ? 'white' : '#2c3e50', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} /> Programmes
            </button>
            <button onClick={() => setVueActive('statistiques')} style={{ padding: '10px 20px', background: vueActive === 'statistiques' ? '#6676ea' : '#f0f0f0', color: vueActive === 'statistiques' ? 'white' : '#2c3e50', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} /> Statistiques
            </button>
            <div style={{ flex: 1 }} />
            <button onClick={exporterVersExcel} style={{ padding: '10px 20px', background: '#00a896', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={18} /> Télécharger
            </button>
          </div>
        </div>

        {/* Contenu */}
        {vueActive === 'consultation' ? (
          <div style={{ background: 'white', borderRadius: '15px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '25px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>Niveau scolaire</label>
                <select value={niveauActif} onChange={e => setNiveauActif(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  {NIVEAUX.map(niveau => <option key={niveau} value={niveau}>{niveau}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>Trimestre</label>
                <select value={trimestreActif} onChange={e => setTrimestreActif(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  {TRIMESTRES.map(trimestre => <option key={trimestre} value={trimestre}>{trimestre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>Discipline</label>
                <select value={disciplineActive} onChange={e => setDisciplineActive(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  {DISCIPLINES.map(discipline => <option key={discipline} value={discipline}>{discipline}</option>)}
                </select>
              </div>
            </div>

            <div style={{ background: '#f8f9fa', padding: '30px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
              <h2 style={{ margin: '0 0 25px 0', fontSize: '22px', fontWeight: 'bold', color: '#6676ea', borderBottom: '3px solid #6676ea', paddingBottom: '10px' }}>
                {niveauActif} - {trimestreActif} - {disciplineActive}
              </h2>

              <div style={{ display: 'grid', gap: '25px' }}>
                <ChampLecture label="📚 Thèmes et chapitres" value={contenuActif.themes} />
                <ChampLecture label="🎯 Objectifs d'apprentissage" value={contenuActif.objectifs} />
                <ChampLecture label="⭐ Compétences visées" value={contenuActif.competences} />
                <ChampLecture label="📝 Évaluations prévues" value={contenuActif.evaluations} />
                <ChampLecture label="📖 Ressources pédagogiques" value={contenuActif.ressources} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: 'white', padding: '20px', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px', fontWeight: '600' }}>Statut</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: contenuActif.statut === 'termine' ? '#00a896' : contenuActif.statut === 'en-cours' ? '#f4a261' : '#95a5a6' }}>
                      {contenuActif.statut === 'termine' ? '✅ Terminé' : contenuActif.statut === 'en-cours' ? '🔄 En cours' : '⏸️ Non commencé'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d', marginBottom: '5px', fontWeight: '600' }}>Progression</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, background: '#e0e0e0', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: `${contenuActif.progression}%`, background: '#6676ea', height: '100%', transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#6676ea' }}>{contenuActif.progression}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '15px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 25px 0', fontSize: '22px', fontWeight: 'bold', color: '#2c3e50' }}>Statistiques globales</h2>
            <div style={{ display: 'grid', gap: '25px' }}>
              <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>Progression par niveau</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={prepareDataNiveaux()}>
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
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>Contenus terminés par discipline</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie data={prepareDataDisciplines()} cx="50%" cy="50%" labelLine={false} label={entry => entry.name} outerRadius={100} fill="#8884d8" dataKey="value">
                        {prepareDataDisciplines().map((entry, index) => <Cell key={`cell-${index}`} fill={COULEURS[index % COULEURS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600', color: '#2c3e50' }}>Taux de complétion par trimestre</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={prepareDataTrimestres()}>
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
        )}
      </div>
    </div>
  );
};

const ChampLecture: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
    <div style={{ fontSize: '14px', fontWeight: '600', color: '#2c3e50', marginBottom: '10px' }}>{label}</div>
    <div style={{ fontSize: '15px', color: '#34495e', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
      {value || <span style={{ color: '#95a5a6', fontStyle: 'italic' }}>Aucun contenu disponible</span>}
    </div>
  </div>
);

export default PlanificationConsultation;

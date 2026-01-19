import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, TrendingUp, BookOpen, Calendar, BarChart3, PieChart, CheckCircle2, Clock } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/* === TABLEAU DE BORD DE PLANIFICATION DE CONTENUS === */

// Configuration des niveaux, trimestres et disciplines
const NIVEAUX = ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'];
const TRIMESTRES = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
const DISCIPLINES = [
  'Français', 'Mathématiques', 'Histoire-Géo', 'SVT', 
  'Physique-Chimie', 'Anglais', 'EPS', 'Arts', 'Technologie'
];

// Palette de couleurs professionnelle pour les graphiques
const COULEURS = ['#2E5077', '#4A7BA7', '#6FA8DC', '#93C5FD', '#00A896', '#F4A261', '#E76F51', '#E63946', '#8E44AD'];

const PlanificationContenus = () => {
  /* === ÉTAT DE L'APPLICATION === */
  const [contenus, setContenus] = useState({});
  const [niveauActif, setNiveauActif] = useState('6ème');
  const [trimestreActif, setTrimestreActif] = useState('Trimestre 1');
  const [disciplineActive, setDisciplineActive] = useState('Français');
  const [vueActive, setVueActive] = useState('planification');
  const [recherche, setRecherche] = useState('');

  /* === INITIALISATION DES DONNÉES === */
  useEffect(() => {
    const initialData = {};
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
            statut: 'non-commence', // non-commence, en-cours, termine
            progression: 0
          };
        });
      });
    });
    setContenus(initialData);
  }, []);

  /* === GESTION DES CONTENUS === */
  const updateContenu = (niveau, trimestre, discipline, champ, valeur) => {
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

  /* === CALCUL DES STATISTIQUES === */
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

    return {
      total,
      termines,
      enCours,
      nonCommences,
      tauxCompletion: total > 0 ? Math.round((termines / total) * 100) : 0
    };
  };

  /* === DONNÉES POUR LES GRAPHIQUES === */
  const prepareDataNiveaux = () => {
    return NIVEAUX.map(niveau => {
      let termine = 0;
      let enCours = 0;
      let nonCommence = 0;
      
      if (contenus[niveau]) {
        Object.values(contenus[niveau]).forEach(trimestre => {
          Object.values(trimestre).forEach(contenu => {
            if (contenu.statut === 'termine') termine++;
            else if (contenu.statut === 'en-cours') enCours++;
            else nonCommence++;
          });
        });
      }
      
      return {
        niveau,
        'Terminé': termine,
        'En cours': enCours,
        'Non commencé': nonCommence
      };
    });
  };

  const prepareDataDisciplines = () => {
    return DISCIPLINES.map(discipline => {
      let count = 0;
      Object.values(contenus).forEach(niveau => {
        Object.values(niveau).forEach(trimestre => {
          if (trimestre[discipline] && trimestre[discipline].statut === 'termine') {
            count++;
          }
        });
      });
      return { name: discipline, value: count };
    });
  };

  const prepareDataTrimestres = () => {
    return TRIMESTRES.map(trimestre => {
      let total = 0;
      let termine = 0;
      
      Object.values(contenus).forEach(niveau => {
        if (niveau[trimestre]) {
          Object.values(niveau[trimestre]).forEach(contenu => {
            total++;
            if (contenu.statut === 'termine') termine++;
          });
        }
      });
      
      return {
        trimestre,
        progression: total > 0 ? Math.round((termine / total) * 100) : 0
      };
    });
  };

  /* === EXPORT VERS EXCEL === */
  const exporterVersExcel = () => {
    // Création du contenu CSV enrichi pour Excel
    let csv = 'Niveau,Trimestre,Discipline,Thèmes,Objectifs,Compétences,Évaluations,Ressources,Statut,Progression (%)\n';
    
    NIVEAUX.forEach(niveau => {
      TRIMESTRES.forEach(trimestre => {
        DISCIPLINES.forEach(discipline => {
          const contenu = contenus[niveau]?.[trimestre]?.[discipline] || {};
          const row = [
            niveau,
            trimestre,
            discipline,
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

    // Conversion en Blob et téléchargement
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `planification-contenus-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* === EXPORT VERS GOOGLE SHEETS === */
  const exporterVersGoogleSheets = () => {
    exporterVersExcel(); // Même format CSV compatible avec Google Sheets
    alert('✅ Fichier CSV téléchargé !\n\n📝 Pour l\'importer dans Google Sheets :\n1. Ouvrez Google Sheets\n2. Fichier > Importer\n3. Sélectionnez le fichier téléchargé\n4. Choisissez "Remplacer la feuille de calcul"');
  };

  const stats = calculerStatistiques();
  const contenuActif = contenus[niveauActif]?.[trimestreActif]?.[disciplineActive] || {
    themes: '', objectifs: '', competences: '', evaluations: '', ressources: '', statut: 'non-commence', progression: 0
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      fontFamily: "'Archivo', sans-serif",
      color: '#f1f5f9',
      padding: '2rem'
    }}>
      {/* === EN-TÊTE === */}
      <header style={{
        marginBottom: '2rem',
        animation: 'fadeInDown 0.8s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <BookOpen size={40} style={{ color: '#60a5fa' }} />
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '2.5rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #60a5fa, #34d399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em'
            }}>
              Planification de Contenus Pédagogiques
            </h1>
            <p style={{
              margin: '0.5rem 0 0 0',
              fontSize: '1.1rem',
              color: '#94a3b8',
              fontWeight: 400
            }}>
              Gérez vos programmes de la 6ème à la Terminale
            </p>
          </div>
        </div>

        {/* Statistiques rapides */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem'
        }}>
          <StatCard
            icon={<CheckCircle2 size={24} />}
            titre="Taux de complétion"
            valeur={`${stats.tauxCompletion}%`}
            couleur="#34d399"
          />
          <StatCard
            icon={<Clock size={24} />}
            titre="En cours"
            valeur={stats.enCours}
            couleur="#fbbf24"
          />
          <StatCard
            icon={<TrendingUp size={24} />}
            titre="Terminés"
            valeur={stats.termines}
            couleur="#60a5fa"
          />
          <StatCard
            icon={<Calendar size={24} />}
            titre="Total"
            valeur={stats.total}
            couleur="#a78bfa"
          />
        </div>
      </header>

      {/* === NAVIGATION === */}
      <nav style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap'
      }}>
        <NavButton
          active={vueActive === 'planification'}
          onClick={() => setVueActive('planification')}
          icon={<BookOpen size={20} />}
          texte="Planification"
        />
        <NavButton
          active={vueActive === 'tableauDeBord'}
          onClick={() => setVueActive('tableauDeBord')}
          icon={<BarChart3 size={20} />}
          texte="Tableau de bord"
        />
        <div style={{ flex: 1 }} />
        <button
          onClick={exporterVersExcel}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none',
            borderRadius: '0.75rem',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.3s ease',
            fontSize: '0.95rem'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <FileSpreadsheet size={20} />
          Export Excel
        </button>
        <button
          onClick={exporterVersGoogleSheets}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none',
            borderRadius: '0.75rem',
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.3s ease',
            fontSize: '0.95rem'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Download size={20} />
          Export Google Sheets
        </button>
      </nav>

      {/* === CONTENU PRINCIPAL === */}
      <main style={{
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(20px)',
        borderRadius: '1.5rem',
        padding: '2rem',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
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
      </main>

      {/* === STYLES D'ANIMATION === */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap');
        
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        * {
          box-sizing: border-box;
        }

        input, textarea, select {
          font-family: 'Archivo', sans-serif;
        }

        button:active {
          transform: scale(0.98) !important;
        }
      `}</style>
    </div>
  );
};

/* === COMPOSANT : CARTE DE STATISTIQUE === */
const StatCard = ({ icon, titre, valeur, couleur }) => (
  <div style={{
    background: 'rgba(30, 41, 59, 0.8)',
    backdropFilter: 'blur(10px)',
    padding: '1.5rem',
    borderRadius: '1rem',
    border: '1px solid rgba(148, 163, 184, 0.1)',
    animation: 'scaleIn 0.5s ease-out',
    transition: 'all 0.3s ease'
  }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = `0 20px 40px -10px ${couleur}40`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ color: couleur }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
          {titre}
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: couleur }}>
          {valeur}
        </div>
      </div>
    </div>
  </div>
);

/* === COMPOSANT : BOUTON DE NAVIGATION === */
const NavButton = ({ active, onClick, icon, texte }) => (
  <button
    onClick={onClick}
    style={{
      padding: '0.75rem 1.5rem',
      background: active 
        ? 'linear-gradient(135deg, #60a5fa, #3b82f6)' 
        : 'rgba(30, 41, 59, 0.6)',
      border: active ? 'none' : '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: '0.75rem',
      color: active ? 'white' : '#94a3b8',
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      transition: 'all 0.3s ease',
      fontSize: '0.95rem'
    }}
    onMouseEnter={e => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
        e.currentTarget.style.color = '#f1f5f9';
      }
    }}
    onMouseLeave={e => {
      if (!active) {
        e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
        e.currentTarget.style.color = '#94a3b8';
      }
    }}
  >
    {icon}
    {texte}
  </button>
);

/* === VUE : PLANIFICATION === */
const VuePlanification = ({
  niveauActif,
  setNiveauActif,
  trimestreActif,
  setTrimestreActif,
  disciplineActive,
  setDisciplineActive,
  contenuActif,
  updateContenu
}) => (
  <div style={{ animation: 'slideInRight 0.6s ease-out' }}>
    {/* Sélecteurs */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '1.5rem',
      marginBottom: '2rem'
    }}>
      {/* Sélecteur de niveau */}
      <div>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#cbd5e1'
        }}>
          Niveau scolaire
        </label>
        <select
          value={niveauActif}
          onChange={e => setNiveauActif(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.5rem',
            color: '#f1f5f9',
            fontSize: '0.95rem',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          {NIVEAUX.map(niveau => (
            <option key={niveau} value={niveau}>{niveau}</option>
          ))}
        </select>
      </div>

      {/* Sélecteur de trimestre */}
      <div>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#cbd5e1'
        }}>
          Trimestre
        </label>
        <select
          value={trimestreActif}
          onChange={e => setTrimestreActif(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.5rem',
            color: '#f1f5f9',
            fontSize: '0.95rem',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          {TRIMESTRES.map(trimestre => (
            <option key={trimestre} value={trimestre}>{trimestre}</option>
          ))}
        </select>
      </div>

      {/* Sélecteur de discipline */}
      <div>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#cbd5e1'
        }}>
          Discipline
        </label>
        <select
          value={disciplineActive}
          onChange={e => setDisciplineActive(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.5rem',
            color: '#f1f5f9',
            fontSize: '0.95rem',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          {DISCIPLINES.map(discipline => (
            <option key={discipline} value={discipline}>{discipline}</option>
          ))}
        </select>
      </div>
    </div>

    {/* Formulaire de saisie */}
    <div style={{
      background: 'rgba(30, 41, 59, 0.4)',
      padding: '2rem',
      borderRadius: '1rem',
      border: '1px solid rgba(148, 163, 184, 0.1)'
    }}>
      <h2 style={{
        margin: '0 0 1.5rem 0',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#60a5fa'
      }}>
        {niveauActif} - {trimestreActif} - {disciplineActive}
      </h2>

      {/* Champs de saisie */}
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <ChampTexte
          label="Thèmes et chapitres"
          placeholder="Ex: L'accord du participe passé, Les figures de style..."
          value={contenuActif.themes}
          onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'themes', val)}
        />

        <ChampTexte
          label="Objectifs d'apprentissage"
          placeholder="Ex: Maîtriser les règles d'accord, Identifier les métaphores..."
          value={contenuActif.objectifs}
          onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'objectifs', val)}
          rows={3}
        />

        <ChampTexte
          label="Compétences visées"
          placeholder="Ex: Analyse critique, Rédaction argumentée..."
          value={contenuActif.competences}
          onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'competences', val)}
          rows={3}
        />

        <ChampTexte
          label="Évaluations prévues"
          placeholder="Ex: Contrôle continu, Dissertation finale..."
          value={contenuActif.evaluations}
          onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'evaluations', val)}
        />

        <ChampTexte
          label="Ressources pédagogiques"
          placeholder="Ex: Manuel Hatier p.45-78, Vidéo Lumni, Exercices PedaClic..."
          value={contenuActif.ressources}
          onChange={val => updateContenu(niveauActif, trimestreActif, disciplineActive, 'ressources', val)}
          rows={2}
        />

        {/* Statut et progression */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#cbd5e1'
            }}>
              Statut
            </label>
            <select
              value={contenuActif.statut}
              onChange={e => updateContenu(niveauActif, trimestreActif, disciplineActive, 'statut', e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '0.5rem',
                color: '#f1f5f9',
                fontSize: '0.95rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="non-commence">Non commencé</option>
              <option value="en-cours">En cours</option>
              <option value="termine">Terminé</option>
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#cbd5e1'
            }}>
              Progression (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={contenuActif.progression}
              onChange={e => updateContenu(niveauActif, trimestreActif, disciplineActive, 'progression', parseInt(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '0.5rem',
                color: '#f1f5f9',
                fontSize: '0.95rem',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* === COMPOSANT : CHAMP DE TEXTE === */
const ChampTexte = ({ label, placeholder, value, onChange, rows = 1 }) => (
  <div>
    <label style={{
      display: 'block',
      marginBottom: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      color: '#cbd5e1'
    }}>
      {label}
    </label>
    {rows > 1 ? (
      <textarea
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '0.5rem',
          color: '#f1f5f9',
          fontSize: '0.95rem',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit'
        }}
      />
    ) : (
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '0.5rem',
          color: '#f1f5f9',
          fontSize: '0.95rem',
          outline: 'none'
        }}
      />
    )}
  </div>
);

/* === VUE : TABLEAU DE BORD === */
const VueTableauDeBord = ({ prepareDataNiveaux, prepareDataDisciplines, prepareDataTrimestres }) => {
  const dataNiveaux = prepareDataNiveaux();
  const dataDisciplines = prepareDataDisciplines();
  const dataTrimestres = prepareDataTrimestres();

  return (
    <div style={{ animation: 'slideInRight 0.6s ease-out' }}>
      <h2 style={{
        margin: '0 0 2rem 0',
        fontSize: '1.75rem',
        fontWeight: 700,
        color: '#60a5fa'
      }}>
        Visualisations et Statistiques
      </h2>

      {/* Graphiques */}
      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* Graphique par niveaux */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.4)',
          padding: '2rem',
          borderRadius: '1rem',
          border: '1px solid rgba(148, 163, 184, 0.1)'
        }}>
          <h3 style={{
            margin: '0 0 1.5rem 0',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#cbd5e1'
          }}>
            Progression par niveau
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dataNiveaux}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis dataKey="niveau" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '0.5rem',
                  color: '#f1f5f9'
                }}
              />
              <Legend />
              <Bar dataKey="Terminé" fill="#34d399" />
              <Bar dataKey="En cours" fill="#fbbf24" />
              <Bar dataKey="Non commencé" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Graphiques côte à côte */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '2rem'
        }}>
          {/* Graphique par disciplines */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.4)',
            padding: '2rem',
            borderRadius: '1rem',
            border: '1px solid rgba(148, 163, 184, 0.1)'
          }}>
            <h3 style={{
              margin: '0 0 1.5rem 0',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#cbd5e1'
            }}>
              Contenus terminés par discipline
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={dataDisciplines}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={entry => entry.name}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dataDisciplines.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COULEURS[index % COULEURS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '0.5rem',
                    color: '#f1f5f9'
                  }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>

          {/* Graphique par trimestres */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.4)',
            padding: '2rem',
            borderRadius: '1rem',
            border: '1px solid rgba(148, 163, 184, 0.1)'
          }}>
            <h3 style={{
              margin: '0 0 1.5rem 0',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#cbd5e1'
            }}>
              Taux de complétion par trimestre
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dataTrimestres}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis dataKey="trimestre" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '0.5rem',
                    color: '#f1f5f9'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="progression"
                  stroke="#60a5fa"
                  strokeWidth={3}
                  dot={{ fill: '#60a5fa', r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanificationContenus;

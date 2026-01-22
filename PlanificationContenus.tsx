import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, TrendingUp, CheckCircle2, Clock, Download, FileSpreadsheet, BarChart3, Save, CloudUpload, AlertCircle, Award } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Déclarer Firebase
declare const firebase: any;

// Configuration
const NIVEAUX = ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale'];
const TRIMESTRES = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

// ⚠️ DISCIPLINES SUPPRIMÉ - Maintenant chargé dynamiquement depuis Firebase
// const DISCIPLINES = [...]; // ← ANCIENNE VERSION

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

// 🆕 Type pour les disciplines enrichies
interface DisciplineEnrichie {
  id: string;
  nom: string;
  isOptionnelle: boolean;
  coefficient: number;
  volumeHoraire: string;
  categorie: string;
  niveauxCibles: string[];
}

const PlanificationContenus: React.FC = () => {
  const [contenus, setContenus] = useState<ContenusState>({});
  const [niveauActif, setNiveauActif] = useState('6ème');
  const [trimestreActif, setTrimestreActif] = useState('Trimestre 1');
  const [disciplineActive, setDisciplineActive] = useState('');
  const [vueActive, setVueActive] = useState<'planification' | 'tableauDeBord'>('planification');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 🆕 États pour les disciplines dynamiques
  const [disciplines, setDisciplines] = useState<DisciplineEnrichie[]>([]);
  const [isLoadingDisciplines, setIsLoadingDisciplines] = useState(true);
  const [disciplinesParNom, setDisciplinesParNom] = useState<string[]>([]);

  // 🆕 Charger les disciplines depuis Firebase
  useEffect(() => {
    loadDisciplines();
  }, [niveauActif]); // Recharger quand le niveau change

  const loadDisciplines = async () => {
    setIsLoadingDisciplines(true);
    try {
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase non initialisé');
      }

      const db = firebase.firestore();
      const snapshot = await db.collection('disciplines')
        .orderBy('ordre', 'asc')
        .get();
      
      const disciplinesData: DisciplineEnrichie[] = [];
      const nomsOnly: string[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Filtrer par niveau actif
        if (data.niveauxCibles && data.niveauxCibles.includes(niveauActif)) {
          const disc: DisciplineEnrichie = {
            id: doc.id,
            nom: data.nom,
            isOptionnelle: data.isOptionnelle || false,
            coefficient: data.coefficients?.[niveauActif] || 1,
            volumeHoraire: data.volumeHoraire?.[niveauActif] || '1h',
            categorie: data.categorie || '',
            niveauxCibles: data.niveauxCibles || []
          };
          
          disciplinesData.push(disc);
          nomsOnly.push(data.nom);
        }
      });
      
      setDisciplines(disciplinesData);
      setDisciplinesParNom(nomsOnly);
      
      // Sélectionner la première discipline si aucune n'est active
      if (!disciplineActive && disciplinesData.length > 0) {
        setDisciplineActive(disciplinesData[0].nom);
      }
      
      console.log(`✅ ${disciplinesData.length} disciplines chargées pour ${niveauActif}`);
    } catch (error) {
      console.error('❌ Erreur chargement disciplines:', error);
      // Fallback sur disciplines par défaut si erreur
      const fallback = ['Français', 'Mathématiques', 'Histoire-Géo', 'SVT', 'Physique-Chimie', 'Anglais', 'EPS'];
      setDisciplinesParNom(fallback);
      if (!disciplineActive) {
        setDisciplineActive(fallback[0]);
      }
    } finally {
      setIsLoadingDisciplines(false);
    }
  };

  // Initialiser les données vides
  const initEmptyData = (): ContenusState => {
    const initialData: ContenusState = {};
    NIVEAUX.forEach(niveau => {
      initialData[niveau] = {};
      TRIMESTRES.forEach(trimestre => {
        initialData[niveau][trimestre] = {};
        // 🆕 Utiliser disciplinesParNom au lieu de DISCIPLINES
        disciplinesParNom.forEach(discipline => {
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

    // Charger seulement après avoir les disciplines
    if (!isLoadingDisciplines && disciplinesParNom.length > 0) {
      loadData();
    }
  }, [isLoadingDisciplines, disciplinesParNom]);

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

  // Helper pour obtenir le contenu actif
  const contenuActif = contenus[niveauActif]?.[trimestreActif]?.[disciplineActive] || {
    themes: '',
    objectifs: '',
    competences: '',
    evaluations: '',
    ressources: '',
    statut: 'non-commence',
    progression: 0
  };

  // Helper pour mettre à jour un contenu
  const updateContenu = (niveau: string, trimestre: string, discipline: string, champ: keyof ContenuData, valeur: any) => {
    setContenus(prev => {
      const nouveauContenus = { ...prev };
      
      if (!nouveauContenus[niveau]) {
        nouveauContenus[niveau] = {};
      }
      if (!nouveauContenus[niveau][trimestre]) {
        nouveauContenus[niveau][trimestre] = {};
      }
      if (!nouveauContenus[niveau][trimestre][discipline]) {
        nouveauContenus[niveau][trimestre][discipline] = {
          themes: '',
          objectifs: '',
          competences: '',
          evaluations: '',
          ressources: '',
          statut: 'non-commence',
          progression: 0
        };
      }
      
      nouveauContenus[niveau][trimestre][discipline] = {
        ...nouveauContenus[niveau][trimestre][discipline],
        [champ]: valeur
      };
      
      return nouveauContenus;
    });
  };

  // Calculs pour les statistiques
  const calculerStatistiques = () => {
    let totalContenus = 0;
    let contenusTermines = 0;
    let contenusEnCours = 0;

    Object.values(contenus).forEach(niveauData => {
      Object.values(niveauData).forEach(trimestreData => {
        Object.values(trimestreData).forEach(contenu => {
          totalContenus++;
          if (contenu.statut === 'termine') contenusTermines++;
          if (contenu.statut === 'en-cours') contenusEnCours++;
        });
      });
    });

    return {
      total: totalContenus,
      termines: contenusTermines,
      enCours: contenusEnCours,
      nonCommences: totalContenus - contenusTermines - contenusEnCours,
      tauxCompletion: totalContenus > 0 ? Math.round((contenusTermines / totalContenus) * 100) : 0
    };
  };

  const stats = calculerStatistiques();

  // Préparer les données pour les graphiques
  const prepareDataNiveaux = () => {
    return NIVEAUX.map(niveau => {
      const niveauData = contenus[niveau] || {};
      let termine = 0, enCours = 0, nonCommence = 0;

      Object.values(niveauData).forEach(trimestreData => {
        Object.values(trimestreData).forEach(contenu => {
          if (contenu.statut === 'termine') termine++;
          else if (contenu.statut === 'en-cours') enCours++;
          else nonCommence++;
        });
      });

      return {
        niveau,
        'Terminé': termine,
        'En cours': enCours,
        'Non commencé': nonCommence
      };
    });
  };

  const prepareDataDisciplines = () => {
    const disciplineStats: Record<string, number> = {};

    disciplinesParNom.forEach(discipline => {
      disciplineStats[discipline] = 0;
    });

    Object.values(contenus).forEach(niveauData => {
      Object.values(niveauData).forEach(trimestreData => {
        Object.entries(trimestreData).forEach(([discipline, contenu]) => {
          if (contenu.statut === 'termine') {
            disciplineStats[discipline] = (disciplineStats[discipline] || 0) + 1;
          }
        });
      });
    });

    return Object.entries(disciplineStats).map(([name, value]) => ({ name, value }));
  };

  const prepareDataTrimestres = () => {
    return TRIMESTRES.map(trimestre => {
      let totalProgression = 0;
      let count = 0;

      Object.values(contenus).forEach(niveauData => {
        const trimestreData = niveauData[trimestre] || {};
        Object.values(trimestreData).forEach(contenu => {
          totalProgression += contenu.progression;
          count++;
        });
      });

      return {
        trimestre,
        progression: count > 0 ? Math.round(totalProgression / count) : 0
      };
    });
  };

  // Export Excel
  const exporterVersExcel = () => {
    alert('🚧 Fonctionnalité d\'export Excel en cours de développement...');
  };

  if (isLoading || isLoadingDisciplines) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
          <div style={{ fontSize: '18px', color: '#7f8c8d' }}>
            Chargement des {isLoadingDisciplines ? 'disciplines' : 'planifications'}...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: '15px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
      {/* En-tête avec stats */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#2c3e50' }}>
              📚 Planification des Contenus
            </h2>
            <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
              Organisez vos programmes pédagogiques par niveau, trimestre et discipline
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setVueActive('planification')} style={{ padding: '10px 20px', background: vueActive === 'planification' ? '#6676ea' : 'white', color: vueActive === 'planification' ? 'white' : '#2c3e50', border: '2px solid #6676ea', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
              <BookOpen size={18} style={{ display: 'inline', marginRight: '8px' }} /> Planification
            </button>
            <button onClick={() => setVueActive('tableauDeBord')} style={{ padding: '10px 20px', background: vueActive === 'tableauDeBord' ? '#6676ea' : 'white', color: vueActive === 'tableauDeBord' ? 'white' : '#2c3e50', border: '2px solid #6676ea', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
              <BarChart3 size={18} style={{ display: 'inline', marginRight: '8px' }} /> Tableau de bord
            </button>
          </div>
        </div>

        {/* Statistiques */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <StatCard icon={<BookOpen size={24} />} titre="Total contenus" valeur={stats.total} couleur="#6676ea" />
          <StatCard icon={<CheckCircle2 size={24} />} titre="Terminés" valeur={stats.termines} couleur="#00a896" />
          <StatCard icon={<Clock size={24} />} titre="En cours" valeur={stats.enCours} couleur="#f4a261" />
          <StatCard icon={<TrendingUp size={24} />} titre="Taux complétion" valeur={`${stats.tauxCompletion}%`} couleur="#e76f51" />
        </div>

        {/* Infos sauvegarde */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 15px', background: saveError ? '#fee2e2' : '#f0fdf4', borderRadius: '8px', fontSize: '13px' }}>
          {saveError ? (
            <>
              <AlertCircle size={16} style={{ color: '#dc2626' }} />
              <span style={{ color: '#dc2626' }}>{saveError}</span>
            </>
          ) : (
            <>
              {isSaving ? (
                <>
                  <CloudUpload size={16} style={{ color: '#6676ea' }} />
                  <span style={{ color: '#6676ea' }}>Sauvegarde en cours...</span>
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                  <span style={{ color: '#16a34a' }}>
                    Dernière sauvegarde : {lastSaved.toLocaleTimeString('fr-FR')}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                  <span style={{ color: '#16a34a' }}>Sauvegarde automatique activée</span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
        <button onClick={sauvegarderManuellement} disabled={isSaving} style={{ padding: '10px 20px', background: '#6676ea', color: 'white', border: 'none', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s', opacity: isSaving ? 0.6 : 1 }}>
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
          disciplines={disciplines}
          disciplinesParNom={disciplinesParNom}
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

// 🆕 Composant VuePlanification MODIFIÉ avec disciplines dynamiques
const VuePlanification: React.FC<any> = ({ 
  niveauActif, setNiveauActif, trimestreActif, setTrimestreActif, 
  disciplineActive, setDisciplineActive, contenuActif, updateContenu,
  disciplines, disciplinesParNom 
}) => {
  
  // 🆕 Trouver les infos de la discipline active
  const disciplineInfo = disciplines.find((d: any) => d.nom === disciplineActive);

  return (
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
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#2c3e50' }}>
            Discipline {disciplinesParNom.length > 0 && `(${disciplinesParNom.length})`}
          </label>
          <select value={disciplineActive} onChange={e => setDisciplineActive(e.target.value)} style={{ width: '100%', padding: '10px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}>
            {disciplinesParNom.map(discipline => {
              const info = disciplines.find((d: any) => d.nom === discipline);
              return (
                <option key={discipline} value={discipline}>
                  {discipline}
                  {info?.isOptionnelle ? ' (Optionnelle)' : ''}
                  {info?.coefficient ? ` • Coef ${info.coefficient}` : ''}
                  {info?.volumeHoraire ? ` • ${info.volumeHoraire}` : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* 🆕 Panneau d'informations sur la discipline */}
      {disciplineInfo && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '25px',
          color: 'white'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '20px', fontWeight: 'bold' }}>
            📚 {disciplineInfo.nom}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>Statut</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {disciplineInfo.isOptionnelle ? '⚪ Optionnelle' : '✅ Obligatoire'}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>Coefficient</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Award size={20} /> {disciplineInfo.coefficient}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>Volume horaire</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={20} /> {disciplineInfo.volumeHoraire}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '5px' }}>Catégorie</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                {disciplineInfo.categorie}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#f8f9fa', padding: '25px', borderRadius: '10px', border: '2px solid #e0e0e0' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold', color: '#6676ea' }}>
          {niveauActif} - {trimestreActif} - {disciplineActive}
        </h3>

        <div style={{ display: 'grid', gap: '20px' }}>
          <ChampTexte label="Thèmes et chapitres" placeholder="Ex: L'accord du participe passé, Les figures de style..." value={contenuActif.themes} onChange={(val: string) => updateContenu(niveauActif, trimestreActif, disciplineActive, 'themes', val)} />
          <ChampTexte label="Objectifs d'apprentissage" placeholder="Ex: Maîtriser les règles d'accord, Identifier les métaphores..." value={contenuActif.objectifs} onChange={(val: string) => updateContenu(niveauActif, trimestreActif, disciplineActive, 'objectifs', val)} rows={3} />
          <ChampTexte label="Compétences visées" placeholder="Ex: Analyse critique, Rédaction argumentée..." value={contenuActif.competences} onChange={(val: string) => updateContenu(niveauActif, trimestreActif, disciplineActive, 'competences', val)} rows={3} />
          <ChampTexte label="Évaluations prévues" placeholder="Ex: Contrôle continu, Dissertation finale..." value={contenuActif.evaluations} onChange={(val: string) => updateContenu(niveauActif, trimestreActif, disciplineActive, 'evaluations', val)} />
          <ChampTexte label="Ressources pédagogiques" placeholder="Ex: Manuel Hatier p.45-78, Vidéo Lumni, Exercices PedaClic..." value={contenuActif.ressources} onChange={(val: string) => updateContenu(niveauActif, trimestreActif, disciplineActive, 'ressources', val)} rows={2} />

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
};

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
                <Pie data={dataDisciplines} cx="50%" cy="50%" labelLine={false} label={(entry: any) => entry.name} outerRadius={100} fill="#8884d8" dataKey="value">
                  {dataDisciplines.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={COULEURS[index % COULEURS.length]} />)}
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

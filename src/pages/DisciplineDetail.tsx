/**
 * ============================================================
 * DISCIPLINE DETAIL — PedaClic
 * ============================================================
 * 
 * Page publique affichant le détail d'une discipline :
 * - Informations de la discipline (nom, niveau, classe)
 * - Liste des chapitres triés par ordre
 * - Ressources par chapitre (cours, exercices, vidéos)
 * - Gating Premium : badge 🔒 sur les ressources payantes
 * 
 * Route : /disciplines/:id
 * Fichier : src/pages/DisciplineDetail.tsx
 * Dépendances :
 *   - ../services/disciplineService (DisciplineService)
 *   - ../services/ResourceService (ResourceService)
 *   - ../types (Discipline, Resource, Chapitre)
 *   - react-router-dom (useParams, useNavigate, Link)
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DisciplineService } from '../services/disciplineService';
import { ResourceService } from '../services/ResourceService';
import type { Discipline, Resource } from '../types';

/* ==================== INTERFACES LOCALES ==================== */

/** Chapitre avec ses ressources regroupées */
interface ChapitreAvecRessources {
  chapitreNom: string;
  ressources: Resource[];
}


/* ==================== COMPOSANT PRINCIPAL ==================== */

const DisciplineDetail: React.FC = () => {

  /* ===== Hooks de navigation ===== */
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  /* ===== États ===== */
  const [discipline, setDiscipline] = useState<Discipline | null>(null);
  const [chapitresMap, setChapitresMap] = useState<ChapitreAvecRessources[]>([]);
  const [ressourcesSansChapitre, setRessourcesSansChapitre] = useState<Resource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /* ===== État : filtre par type de ressource ===== */
  const [filtreType, setFiltreType] = useState<string>('tous');

  /* ===== État : chapitre ouvert (accordéon) ===== */
  const [chapitresOuverts, setChapitresOuverts] = useState<Set<string>>(new Set());


  /* ==================== CHARGEMENT DES DONNÉES ==================== */

  /**
   * Charge la discipline et ses ressources depuis Firestore.
   * Regroupe les ressources par chapitre pour l'affichage en accordéon.
   */
  const chargerDonnees = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      /* --- 1. Charger la discipline --- */
      const disc = await DisciplineService.getById(id);
      if (!disc) {
        setError('Discipline introuvable.');
        setLoading(false);
        return;
      }
      setDiscipline(disc);

      /* --- 2. Charger les ressources de cette discipline --- */
      const ressources = await ResourceService.getAll({ disciplineId: id });

      /* --- 3. Regrouper par chapitre --- */
      const groupeParChapitre = new Map<string, Resource[]>();
      const sansChap: Resource[] = [];

      for (const res of ressources) {
        const chapNom = res.chapitre || res.chapitreId;
        if (chapNom) {
          if (!groupeParChapitre.has(chapNom)) {
            groupeParChapitre.set(chapNom, []);
          }
          groupeParChapitre.get(chapNom)!.push(res);
        } else {
          sansChap.push(res);
        }
      }

      /* --- 4. Convertir en tableau trié --- */
      const chapitresArr: ChapitreAvecRessources[] = Array.from(groupeParChapitre.entries())
        .map(([nom, ressources]) => ({
          chapitreNom: nom,
          ressources: ressources.sort((a, b) => a.ordre - b.ordre)
        }))
        .sort((a, b) => a.chapitreNom.localeCompare(b.chapitreNom, 'fr'));

      setChapitresMap(chapitresArr);
      setRessourcesSansChapitre(sansChap);

      /* --- 5. Ouvrir le premier chapitre par défaut --- */
      if (chapitresArr.length > 0) {
        setChapitresOuverts(new Set([chapitresArr[0].chapitreNom]));
      }

    } catch (err) {
      console.error('Erreur chargement discipline:', err);
      setError('Impossible de charger les données. Réessayez plus tard.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);


  /* ==================== HANDLERS ==================== */

  /** Basculer l'état ouvert/fermé d'un chapitre */
  const toggleChapitre = (chapNom: string) => {
    setChapitresOuverts(prev => {
      const next = new Set(prev);
      if (next.has(chapNom)) {
        next.delete(chapNom);
      } else {
        next.add(chapNom);
      }
      return next;
    });
  };

  /** Filtrer les ressources par type */
  const filtrerRessources = (ressources: Resource[]): Resource[] => {
    if (filtreType === 'tous') return ressources;
    return ressources.filter(r => r.type === filtreType);
  };


  /* ==================== HELPERS DE RENDU ==================== */

  /** Icône selon le type de ressource */
  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'cours': return '📖';
      case 'exercice': return '✏️';
      case 'video': return '🎬';
      case 'document': return '📄';
      case 'quiz': return '❓';
      default: return '📌';
    }
  };

  /** Label français du type */
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'cours': return 'Cours';
      case 'exercice': return 'Exercice';
      case 'video': return 'Vidéo';
      case 'document': return 'Document';
      case 'quiz': return 'Quiz';
      default: return type;
    }
  };

  /** Couleur du badge type */
  const getTypeBadgeColor = (type: string): string => {
    switch (type) {
      case 'cours': return '#3b82f6';
      case 'exercice': return '#10b981';
      case 'video': return '#f59e0b';
      case 'document': return '#8b5cf6';
      case 'quiz': return '#ef4444';
      default: return '#6b7280';
    }
  };

  /** Niveau formaté pour affichage */
  const getNiveauLabel = (niveau: string): string => {
    return niveau === 'college' ? 'Collège' : 'Lycée';
  };


  /* ==================== RENDU : LOADING ==================== */

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1rem',
        minHeight: '50vh'
      }}>
        {/* Spinner */}
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e5e7eb',
          borderTopColor: '#2563eb',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <p style={{ marginTop: '1rem', color: '#6b7280' }}>
          Chargement de la discipline...
        </p>
        {/* Animation CSS inline */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }


  /* ==================== RENDU : ERREUR ==================== */

  if (error || !discipline) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '3rem auto',
        padding: '2rem',
        textAlign: 'center',
        background: '#fef2f2',
        borderRadius: '12px',
        border: '1px solid #fecaca'
      }}>
        <span style={{ fontSize: '3rem' }}>😕</span>
        <h2 style={{ color: '#991b1b', margin: '1rem 0 0.5rem' }}>
          {error || 'Discipline introuvable'}
        </h2>
        <p style={{ color: '#b91c1c', marginBottom: '1.5rem' }}>
          Vérifiez le lien ou retournez à la liste des disciplines.
        </p>
        <button
          onClick={() => navigate('/disciplines')}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600
          }}
        >
          ← Retour aux disciplines
        </button>
      </div>
    );
  }


  /* ==================== RENDU : TOUTES LES RESSOURCES (pour filtre) ==================== */

  const toutesLesRessources = [
    ...chapitresMap.flatMap(c => c.ressources),
    ...ressourcesSansChapitre
  ];
  const typesDisponibles = [...new Set(toutesLesRessources.map(r => r.type))];


  /* ==================== RENDU PRINCIPAL ==================== */

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem' }}>

      {/* ===== BREADCRUMB ===== */}
      <nav style={{ marginBottom: '1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
        <Link to="/" style={{ color: '#2563eb', textDecoration: 'none' }}>Accueil</Link>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        <Link to="/disciplines" style={{ color: '#2563eb', textDecoration: 'none' }}>Disciplines</Link>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        <span style={{ color: '#374151' }}>{discipline.nom}</span>
      </nav>

      {/* ===== EN-TÊTE DISCIPLINE ===== */}
      <header style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        borderRadius: '16px',
        padding: '2rem',
        color: '#fff',
        marginBottom: '2rem'
      }}>
        {/* Icône + Nom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '2.5rem' }}>{discipline.icone || '📚'}</span>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
              {discipline.nom}
            </h1>
            {discipline.description && (
              <p style={{ margin: '0.25rem 0 0', opacity: 0.9, fontSize: '0.95rem' }}>
                {discipline.description}
              </p>
            )}
          </div>
        </div>

        {/* Badges info */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {/* Badge niveau */}
          <span style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '0.35rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600
          }}>
            🎓 {getNiveauLabel(discipline.niveau)} — {discipline.classe}
          </span>
          {/* Badge nombre de ressources */}
          <span style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '0.35rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600
          }}>
            📦 {toutesLesRessources.length} ressource{toutesLesRessources.length !== 1 ? 's' : ''}
          </span>
          {/* Badge coefficient */}
          {discipline.coefficient && (
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600
            }}>
              ⚖️ Coeff. {discipline.coefficient}
            </span>
          )}
        </div>
      </header>


      {/* ===== FILTRES PAR TYPE ===== */}
      {typesDisponibles.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem'
        }}>
          {/* Bouton Tous */}
          <button
            onClick={() => setFiltreType('tous')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              border: filtreType === 'tous' ? '2px solid #2563eb' : '1px solid #d1d5db',
              background: filtreType === 'tous' ? '#2563eb' : '#fff',
              color: filtreType === 'tous' ? '#fff' : '#374151',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            Tous ({toutesLesRessources.length})
          </button>

          {/* Boutons par type */}
          {typesDisponibles.map(type => {
            const count = toutesLesRessources.filter(r => r.type === type).length;
            const isActive = filtreType === type;
            return (
              <button
                key={type}
                onClick={() => setFiltreType(type)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  border: isActive ? `2px solid ${getTypeBadgeColor(type)}` : '1px solid #d1d5db',
                  background: isActive ? getTypeBadgeColor(type) : '#fff',
                  color: isActive ? '#fff' : '#374151',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {getTypeIcon(type)} {getTypeLabel(type)} ({count})
              </button>
            );
          })}
        </div>
      )}


      {/* ===== CONTENU : CHAPITRES EN ACCORDÉON ===== */}
      {chapitresMap.length === 0 && ressourcesSansChapitre.length === 0 ? (
        /* --- État vide --- */
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          background: '#f9fafb',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <span style={{ fontSize: '3rem' }}>📭</span>
          <h3 style={{ color: '#374151', margin: '1rem 0 0.5rem' }}>
            Aucune ressource disponible
          </h3>
          <p style={{ color: '#6b7280' }}>
            Les cours et exercices pour cette discipline seront bientôt ajoutés.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* --- Chapitres --- */}
          {chapitresMap.map((chapitre) => {
            const ressourcesFiltrees = filtrerRessources(chapitre.ressources);
            if (ressourcesFiltrees.length === 0 && filtreType !== 'tous') return null;

            const isOuvert = chapitresOuverts.has(chapitre.chapitreNom);
            const ressourcesAffichees = filtreType === 'tous'
              ? chapitre.ressources
              : ressourcesFiltrees;

            return (
              <div
                key={chapitre.chapitreNom}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.2s',
                  boxShadow: isOuvert ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {/* En-tête chapitre (cliquable) */}
                <button
                  onClick={() => toggleChapitre(chapitre.chapitreNom)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    background: isOuvert ? '#f0f5ff' : '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      fontSize: '1.25rem',
                      transform: isOuvert ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s'
                    }}>
                      ▶
                    </span>
                    <div>
                      <span style={{ fontWeight: 700, color: '#1f2937', fontSize: '1rem' }}>
                        {chapitre.chapitreNom}
                      </span>
                      <span style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        marginTop: '2px'
                      }}>
                        {chapitre.ressources.length} ressource{chapitre.ressources.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Corps du chapitre (ressources) */}
                {isOuvert && (
                  <div style={{
                    padding: '0 1.25rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    {ressourcesAffichees.map(res => (
                      <div
                        key={res.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: '#f9fafb',
                          borderRadius: '8px',
                          border: '1px solid #f3f4f6',
                          transition: 'background 0.15s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#eef2ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      >
                        {/* Gauche : icône + titre */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                          <span style={{ fontSize: '1.2rem' }}>{getTypeIcon(res.type)}</span>
                          <div>
                            <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9rem' }}>
                              {res.titre}
                            </span>
                            {res.description && (
                              <span style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                color: '#9ca3af',
                                marginTop: '2px'
                              }}>
                                {res.description}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Droite : badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          {/* Badge type */}
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: '#fff',
                            background: getTypeBadgeColor(res.type)
                          }}>
                            {getTypeLabel(res.type)}
                          </span>

                          {/* Badge Premium */}
                          {res.isPremium && (
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '12px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: '#92400e',
                              background: '#fef3c7',
                              border: '1px solid #fde68a'
                            }}>
                              🔒 Premium
                            </span>
                          )}

                          {/* Durée estimée */}
                          {res.dureeEstimee && (
                            <span style={{
                              fontSize: '0.75rem',
                              color: '#6b7280'
                            }}>
                              ⏱ {res.dureeEstimee} min
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* --- Ressources sans chapitre --- */}
          {filtrerRessources(ressourcesSansChapitre).length > 0 && (
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              padding: '1rem 1.25rem'
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem' }}>
                📌 Autres ressources
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filtrerRessources(ressourcesSansChapitre).map(res => (
                  <div
                    key={res.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #f3f4f6'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>{getTypeIcon(res.type)}</span>
                      <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.9rem' }}>
                        {res.titre}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#fff',
                        background: getTypeBadgeColor(res.type)
                      }}>
                        {getTypeLabel(res.type)}
                      </span>
                      {res.isPremium && (
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: '#92400e',
                          background: '#fef3c7',
                          border: '1px solid #fde68a'
                        }}>
                          🔒 Premium
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      {/* ===== BOUTON RETOUR ===== */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link
          to="/disciplines"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: '#f3f4f6',
            color: '#374151',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            transition: 'background 0.2s'
          }}
        >
          ← Retour aux disciplines
        </Link>
      </div>
    </div>
  );
};

export default DisciplineDetail;

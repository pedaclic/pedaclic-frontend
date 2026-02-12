// ============================================================
// src/components/admin/DisciplineManager.tsx — PedaClic (Phase 13)
// Panneau d'administration des disciplines
// Gère Collège, Lycée et Formation libre
// Le select "Classe" s'adapte dynamiquement au niveau choisi
// Le coefficient est optionnel pour les formations libres
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Discipline,
  DisciplineFormData,
  Niveau,
  Classe,
  getClassesByNiveau,
  getClasseLabel,
  NIVEAUX_LABELS,
} from '../../types';

// --- Styles en ligne conformes au design PedaClic ---
const styles = {
  /* Conteneur principal du gestionnaire */
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '24px',
  } as React.CSSProperties,

  /* Titre de la section */
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1a365d',
    marginBottom: '24px',
  } as React.CSSProperties,

  /* Formulaire d'ajout/édition */
  form: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    marginBottom: '32px',
    border: '1px solid #e2e8f0',
  } as React.CSSProperties,

  /* Titre du formulaire */
  formTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#2d3748',
    marginBottom: '20px',
    paddingBottom: '12px',
    borderBottom: '2px solid #3182ce',
  } as React.CSSProperties,

  /* Grille du formulaire : 2 colonnes sur desktop */
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '20px',
  } as React.CSSProperties,

  /* Groupe de champ (label + input) */
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  } as React.CSSProperties,

  /* Label de champ */
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#4a5568',
  } as React.CSSProperties,

  /* Label optionnel (grisé) */
  labelOptional: {
    fontSize: '0.75rem',
    fontWeight: 400,
    color: '#a0aec0',
    marginLeft: '4px',
  } as React.CSSProperties,

  /* Champ de saisie */
  input: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  } as React.CSSProperties,

  /* Select (menu déroulant) */
  select: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.95rem',
    background: '#fff',
    cursor: 'pointer',
  } as React.CSSProperties,

  /* Zone de description (textarea) */
  textarea: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.95rem',
    minHeight: '80px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  } as React.CSSProperties,

  /* Bouton principal (ajouter / mettre à jour) */
  btnPrimary: {
    padding: '12px 28px',
    background: '#3182ce',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  } as React.CSSProperties,

  /* Bouton secondaire (annuler) */
  btnSecondary: {
    padding: '12px 28px',
    background: '#e2e8f0',
    color: '#4a5568',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginLeft: '12px',
  } as React.CSSProperties,

  /* Bouton supprimer */
  btnDanger: {
    padding: '6px 14px',
    background: '#fed7d7',
    color: '#c53030',
    border: '1px solid #fc8181',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: 'pointer',
  } as React.CSSProperties,

  /* Bouton éditer */
  btnEdit: {
    padding: '6px 14px',
    background: '#ebf8ff',
    color: '#2b6cb0',
    border: '1px solid #90cdf4',
    borderRadius: '6px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    marginRight: '8px',
  } as React.CSSProperties,

  /* Card de discipline dans la liste */
  card: {
    background: '#fff',
    borderRadius: '10px',
    padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    border: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  } as React.CSSProperties,

  /* Badge de niveau */
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 600,
  } as React.CSSProperties,

  /* Couleurs des badges par niveau */
  badgeCollege: { background: '#ebf8ff', color: '#2b6cb0' } as React.CSSProperties,
  badgeLycee: { background: '#fefcbf', color: '#975a16' } as React.CSSProperties,
  badgeFormationLibre: { background: '#f0fff4', color: '#276749' } as React.CSSProperties,

  /* Onglets de filtrage */
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  tab: {
    padding: '8px 20px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
    transition: 'all 0.2s',
  } as React.CSSProperties,

  tabActive: {
    background: '#3182ce',
    color: '#fff',
    borderColor: '#3182ce',
  } as React.CSSProperties,
};

// --- Valeurs par défaut du formulaire ---
const defaultFormData: DisciplineFormData = {
  nom: '',
  niveau: 'college',
  classe: '6eme',
  ordre: 0,
  coefficient: undefined,
  couleur: '',
  icone: '',
  description: '',
};

const DisciplineManager: React.FC = () => {
  // --- États ---
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [formData, setFormData] = useState<DisciplineFormData>(defaultFormData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterNiveau, setFilterNiveau] = useState<Niveau | 'all'>('all');

  // --- Écoute temps réel des disciplines dans Firestore ---
  useEffect(() => {
    const q = query(collection(db, 'disciplines'), orderBy('nom'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
      })) as Discipline[];
      setDisciplines(data);
    });
    return () => unsubscribe();
  }, []);

  // --- Réinitialiser la classe quand le niveau change ---
  // La première classe du nouveau niveau est sélectionnée par défaut
  const handleNiveauChange = useCallback((niveau: Niveau) => {
    const premiereclasse = getClassesByNiveau(niveau)[0]?.value || '6eme';
    setFormData((prev) => ({
      ...prev,
      niveau,
      classe: premiereclasse as Classe,
      // Reset du coefficient pour formation libre (optionnel)
      coefficient: niveau === 'formation_libre' ? undefined : prev.coefficient,
    }));
  }, []);

  // --- Soumission du formulaire (ajout ou mise à jour) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom.trim()) return;

    setLoading(true);
    try {
      const dataToSave = {
        nom: formData.nom.trim(),
        niveau: formData.niveau,
        classe: formData.classe,
        ordre: formData.ordre,
        // Le coefficient n'est sauvegardé que s'il est défini
        ...(formData.coefficient !== undefined && { coefficient: formData.coefficient }),
        couleur: formData.couleur || '',
        icone: formData.icone || '',
        description: formData.description || '',
        updatedAt: Timestamp.now(),
      };

      if (editingId) {
        // --- Mode édition ---
        await updateDoc(doc(db, 'disciplines', editingId), dataToSave);
      } else {
        // --- Mode création ---
        await addDoc(collection(db, 'disciplines'), {
          ...dataToSave,
          createdAt: Timestamp.now(),
        });
      }

      // Réinitialiser le formulaire
      setFormData(defaultFormData);
      setEditingId(null);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde :', error);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  // --- Remplir le formulaire pour édition ---
  const handleEdit = (discipline: Discipline) => {
    setFormData({
      nom: discipline.nom,
      niveau: discipline.niveau,
      classe: discipline.classe,
      ordre: discipline.ordre,
      coefficient: discipline.coefficient,
      couleur: discipline.couleur || '',
      icone: discipline.icone || '',
      description: discipline.description || '',
    });
    setEditingId(discipline.id);
  };

  // --- Supprimer une discipline ---
  const handleDelete = async (id: string, nom: string) => {
    if (!window.confirm(`Supprimer la discipline "${nom}" ? Cette action est irréversible.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'disciplines', id));
    } catch (error) {
      console.error('Erreur lors de la suppression :', error);
    }
  };

  // --- Annuler l'édition ---
  const handleCancel = () => {
    setFormData(defaultFormData);
    setEditingId(null);
  };

  // --- Classes disponibles selon le niveau actuellement sélectionné ---
  const classesDisponibles = getClassesByNiveau(formData.niveau);

  // --- Filtrage des disciplines affichées ---
  const disciplinesFiltrees =
    filterNiveau === 'all'
      ? disciplines
      : disciplines.filter((d) => d.niveau === filterNiveau);

  // --- Fonction utilitaire : style du badge selon le niveau ---
  const getBadgeStyle = (niveau: Niveau): React.CSSProperties => ({
    ...styles.badge,
    ...(niveau === 'college' ? styles.badgeCollege : {}),
    ...(niveau === 'lycee' ? styles.badgeLycee : {}),
    ...(niveau === 'formation_libre' ? styles.badgeFormationLibre : {}),
  });

  return (
    <div style={styles.container}>
      {/* ====== Titre de la page ====== */}
      <h2 style={styles.title}>📚 Gestion des Disciplines</h2>

      {/* ====== Formulaire d'ajout / édition ====== */}
      <form style={styles.form} onSubmit={handleSubmit}>
        <h3 style={styles.formTitle}>
          {editingId ? '✏️ Modifier la discipline' : '➕ Ajouter une discipline'}
        </h3>

        {/* Grille des champs */}
        <div style={styles.formGrid}>
          {/* --- Nom de la discipline --- */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Nom de la discipline</label>
            <input
              type="text"
              style={styles.input}
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              placeholder="Ex : Cuisine sénégalaise, Couture, Français..."
              required
            />
          </div>

          {/* --- Sélection du niveau --- */}
          {/* Ce select contrôle les options du select "Classe" ci-dessous */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Niveau</label>
            <select
              style={styles.select}
              value={formData.niveau}
              onChange={(e) => handleNiveauChange(e.target.value as Niveau)}
            >
              <option value="college">🏫 Collège</option>
              <option value="lycee">🎓 Lycée</option>
              <option value="formation_libre">🌍 Formation libre</option>
            </select>
          </div>

          {/* --- Sélection de la classe (dynamique selon le niveau) --- */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              {formData.niveau === 'formation_libre' ? 'Niveau de formation' : 'Classe'}
            </label>
            <select
              style={styles.select}
              value={formData.classe}
              onChange={(e) => setFormData({ ...formData, classe: e.target.value as Classe })}
            >
              {classesDisponibles.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* --- Ordre d'affichage --- */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Ordre d'affichage</label>
            <input
              type="number"
              style={styles.input}
              value={formData.ordre}
              onChange={(e) => setFormData({ ...formData, ordre: Number(e.target.value) })}
              placeholder="Ex : 1"
              min="0"
            />
          </div>

          {/* --- Coefficient (optionnel pour formation libre) --- */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Coefficient
              {formData.niveau === 'formation_libre' && (
                <span style={styles.labelOptional}>(optionnel)</span>
              )}
            </label>
            <input
              type="number"
              style={styles.input}
              value={formData.coefficient ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  coefficient: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={formData.niveau === 'formation_libre' ? 'Non requis' : 'Ex : 3'}
              min="1"
              max="10"
              required={formData.niveau !== 'formation_libre'}
            />
          </div>

          {/* --- Couleur --- */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Couleur
              <span style={styles.labelOptional}>(optionnel)</span>
            </label>
            <input
              type="color"
              style={{ ...styles.input, maxWidth: '80px', padding: '4px', height: '40px' }}
              value={formData.couleur || '#3182ce'}
              onChange={(e) => setFormData({ ...formData, couleur: e.target.value })}
            />
          </div>
        </div>

        {/* --- Description --- */}
        <div style={{ ...styles.fieldGroup, marginBottom: '20px' }}>
          <label style={styles.label}>
            Description
            <span style={styles.labelOptional}>(optionnel)</span>
          </label>
          <textarea
            style={styles.textarea}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brève description de la discipline..."
          />
        </div>

        {/* --- Icône --- */}
        <div style={{ ...styles.fieldGroup, marginBottom: '20px' }}>
          <label style={styles.label}>
            Icône (emoji)
            <span style={styles.labelOptional}>(optionnel)</span>
          </label>
          <input
            type="text"
            style={{ ...styles.input, maxWidth: '120px' }}
            value={formData.icone}
            onChange={(e) => setFormData({ ...formData, icone: e.target.value })}
            placeholder="🍳"
          />
        </div>

        {/* --- Boutons de soumission --- */}
        <div>
          <button type="submit" style={styles.btnPrimary} disabled={loading}>
            {loading
              ? 'Enregistrement...'
              : editingId
              ? 'Mettre à jour'
              : 'Ajouter la discipline'}
          </button>
          {editingId && (
            <button type="button" style={styles.btnSecondary} onClick={handleCancel}>
              Annuler
            </button>
          )}
        </div>
      </form>

      {/* ====== Liste des disciplines ====== */}
      <div>
        <h3 style={styles.formTitle}>
          📋 Disciplines existantes ({disciplinesFiltrees.length})
        </h3>

        {/* --- Onglets de filtrage par niveau --- */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(filterNiveau === 'all' ? styles.tabActive : {}) }}
            onClick={() => setFilterNiveau('all')}
          >
            Toutes
          </button>
          <button
            style={{ ...styles.tab, ...(filterNiveau === 'college' ? styles.tabActive : {}) }}
            onClick={() => setFilterNiveau('college')}
          >
            🏫 Collège
          </button>
          <button
            style={{ ...styles.tab, ...(filterNiveau === 'lycee' ? styles.tabActive : {}) }}
            onClick={() => setFilterNiveau('lycee')}
          >
            🎓 Lycée
          </button>
          <button
            style={{ ...styles.tab, ...(filterNiveau === 'formation_libre' ? styles.tabActive : {}) }}
            onClick={() => setFilterNiveau('formation_libre')}
          >
            🌍 Formation libre
          </button>
        </div>

        {/* --- Cards des disciplines --- */}
        {disciplinesFiltrees.length === 0 ? (
          <p style={{ color: '#a0aec0', fontStyle: 'italic', textAlign: 'center', padding: '32px' }}>
            Aucune discipline trouvée pour ce filtre.
          </p>
        ) : (
          disciplinesFiltrees.map((discipline) => (
            <div key={discipline.id} style={styles.card}>
              {/* Infos de la discipline */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {discipline.icone && <span style={{ fontSize: '1.2rem' }}>{discipline.icone}</span>}
                  <strong style={{ fontSize: '1rem', color: '#2d3748' }}>{discipline.nom}</strong>
                  {/* Badge niveau */}
                  <span style={getBadgeStyle(discipline.niveau)}>
                    {NIVEAUX_LABELS[discipline.niveau]}
                  </span>
                </div>
                {/* Détails : classe, coefficient */}
                <div style={{ fontSize: '0.85rem', color: '#718096' }}>
                  {discipline.niveau === 'formation_libre' ? 'Niveau' : 'Classe'} :{' '}
                  {getClasseLabel(discipline.classe)}
                  {discipline.coefficient !== undefined && (
                    <span style={{ marginLeft: '12px' }}>| Coeff : {discipline.coefficient}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button style={styles.btnEdit} onClick={() => handleEdit(discipline)}>
                  Modifier
                </button>
                <button
                  style={styles.btnDanger}
                  onClick={() => handleDelete(discipline.id, discipline.nom)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DisciplineManager;

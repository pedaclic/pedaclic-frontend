// ============================================================
// PedaClic — Phase 27 : MediaAjoutPage
// Formulaire d'ajout de contenu à la médiathèque (admin/prof)
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  createMedia,
  updateMedia,
  uploadMediaFichier,
  uploadThumbnail,
} from '../services/mediathequeService';
import type { MediaFormData, TypeMedia, StatutMedia } from '../types/mediatheque_types';
import {
  CONFIG_TYPE_MEDIA,
  DISCIPLINES_MEDIATHEQUE,
  NIVEAUX_MEDIATHEQUE,
} from '../types/mediatheque_types';
import '../styles/Mediatheque.css';

const DISCIPLINE_TO_ID: Record<string, string> = {
  'Mathématiques': 'maths',
  'Français': 'francais',
  'Sciences de la Vie et de la Terre (SVT)': 'svt',
  'Histoire-Géographie': 'histgeo',
  'Physique-Chimie': 'pc',
  'Anglais': 'anglais',
  'Philosophie': 'philo',
  'Sciences Économiques et Sociales': 'ses',
  'Éducation Civique': 'civique',
  'Informatique': 'info',
  'Arabe': 'arabe',
};

const MIME_BY_TYPE: Record<TypeMedia, string> = {
  video: 'video/mp4',
  audio: 'audio/mpeg',
  podcast: 'audio/mpeg',
  webinaire: 'video/mp4',
};

export default function MediaAjoutPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [soumission, setSoumission] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [progressUpload, setProgressUpload] = useState(0);

  const [form, setForm] = useState({
    titre: '',
    description: '',
    type: 'video' as TypeMedia,
    url: '',
    urlBasse: '',
    thumbnailUrl: '',
    duree: 0,
    taille: 0,
    mimeType: 'video/mp4',
    discipline: '',
    classe: '',
    niveau: '',
    tags: '',
    isPremium: false,
    statut: 'publie' as StatutMedia,
  });

  const [fichierMedia, setFichierMedia] = useState<File | null>(null);
  const [fichierThumb, setFichierThumb] = useState<File | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setSoumission(true);
    setErreur(null);

    try {
      const disciplineId = form.discipline ? (DISCIPLINE_TO_ID[form.discipline] ?? form.discipline.toLowerCase().replace(/\s+/g, '_')) : 'general';
      const tags = form.tags ? form.tags.split(/[,;]/).map(t => t.trim()).filter(Boolean) : [];

      const data: MediaFormData = {
        titre: form.titre.trim(),
        description: form.description.trim(),
        type: form.type,
        url: form.url.trim(),
        urlBasse: form.urlBasse?.trim() || '',
        thumbnailUrl: form.thumbnailUrl?.trim() || '',
        duree: Number(form.duree) || 0,
        taille: form.taille || 0,
        mimeType: form.mimeType || MIME_BY_TYPE[form.type],
        discipline: form.discipline || 'Non spécifié',
        disciplineId,
        classe: form.classe || '',
        niveau: form.niveau || '',
        tags,
        isPremium: form.isPremium,
        statut: form.statut,
      };

      if (!data.titre) {
        throw new Error('Le titre est obligatoire.');
      }
      if (!form.url.trim() && !fichierMedia) {
        throw new Error('Indiquez une URL ou sélectionnez un fichier.');
      }

      const urlInitiale = fichierMedia ? 'upload://pending' : form.url.trim();
      const dataAvecUrl: MediaFormData = { ...data, url: urlInitiale };

      let mediaId = await createMedia(dataAvecUrl, currentUser.uid, currentUser.displayName || currentUser.email || 'Auteur');

      if (fichierMedia) {
        setProgressUpload(10);
        const url = await uploadMediaFichier(
          fichierMedia,
          mediaId,
          form.type,
          disciplineId,
          (p) => setProgressUpload(10 + Math.round(p * 0.7))
        );
        await updateMedia(mediaId, { url, mimeType: fichierMedia.type });
        if (data.taille === 0) {
          await updateMedia(mediaId, { taille: fichierMedia.size });
        }
      }

      if (fichierThumb) {
        setProgressUpload(85);
        const thumbnailUrl = await uploadThumbnail(fichierThumb, mediaId);
        await updateMedia(mediaId, { thumbnailUrl });
      }

      setProgressUpload(100);
      navigate(`/mediatheque/${mediaId}`);
    } catch (err: unknown) {
      console.error('[MediaAjout] Erreur:', err);
      setErreur(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      setSoumission(false);
      setProgressUpload(0);
    }
  };

  return (
    <div className="media-detail-page">
      <header className="media-detail-header">
        <button
          className="media-detail-retour"
          onClick={() => navigate('/mediatheque')}
          type="button"
        >
          ← Médiathèque
        </button>
        <span style={{ fontSize: '1rem', fontWeight: 700 }}>➕ Ajouter un contenu</span>
      </header>

      <div className="media-form" style={{ maxWidth: 700, margin: '2rem auto' }}>
        <h1 className="media-form__titre">Nouveau média</h1>

        <form onSubmit={handleSubmit}>
          {erreur && (
            <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem' }}>
              {erreur}
            </div>
          )}

          <div className="media-form__groupe">
            <label className="media-form__label">Type <span>*</span></label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="media-form__select"
              required
            >
              {(Object.entries(CONFIG_TYPE_MEDIA) as [TypeMedia, typeof CONFIG_TYPE_MEDIA[TypeMedia]][]).map(([type, config]) => (
                <option key={type} value={type}>{config.emoji} {config.label}</option>
              ))}
            </select>
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">Titre <span>*</span></label>
            <input
              name="titre"
              value={form.titre}
              onChange={handleChange}
              className="media-form__input"
              placeholder="Ex: Introduction aux fonctions affines"
              required
            />
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="media-form__textarea"
              placeholder="Description courte du contenu"
              rows={3}
            />
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">URL du fichier (vidéo/audio)</label>
            <input
              name="url"
              type="url"
              value={form.url}
              onChange={handleChange}
              className="media-form__input"
              placeholder="https://exemple.com/video.mp4"
              disabled={!!fichierMedia}
            />
            <p className="media-form__upload-texte" style={{ marginTop: '0.5rem' }}>
              Ou utilisez l&apos;upload ci-dessous pour un fichier local.
            </p>
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">Fichier média (optionnel)</label>
            <div
              className={`media-form__upload-zone ${fichierMedia ? 'media-form__upload-zone--active' : ''}`}
              onClick={() => document.getElementById('fichier-media')?.click()}
            >
              <input
                id="fichier-media"
                type="file"
                accept={CONFIG_TYPE_MEDIA[form.type].accept}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFichierMedia(f || null);
                  if (f) setForm(prev => ({ ...prev, url: f.name }));
                }}
                style={{ display: 'none' }}
              />
              <span className="media-form__upload-icone">📁</span>
              <p className="media-form__upload-texte">
                {fichierMedia ? <strong>{fichierMedia.name}</strong> : 'Cliquez pour sélectionner un fichier'}
              </p>
            </div>
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">Vignette (optionnel)</label>
            <div
              className={`media-form__upload-zone ${fichierThumb ? 'media-form__upload-zone--active' : ''}`}
              onClick={() => document.getElementById('fichier-thumb')?.click()}
            >
              <input
                id="fichier-thumb"
                type="file"
                accept="image/*"
                onChange={(e) => setFichierThumb(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
              <span className="media-form__upload-icone">🖼️</span>
              <p className="media-form__upload-texte">
                {fichierThumb ? <strong>{fichierThumb.name}</strong> : 'Cliquez pour une vignette'}
              </p>
            </div>
          </div>

          <div className="media-form__grille-2">
            <div className="media-form__groupe">
              <label className="media-form__label">Durée (secondes)</label>
              <input
                name="duree"
                type="number"
                value={form.duree || ''}
                onChange={handleChange}
                className="media-form__input"
                placeholder="Ex: 600"
                min={0}
              />
            </div>
            <div className="media-form__groupe">
              <label className="media-form__label">Discipline</label>
              <select
                name="discipline"
                value={form.discipline}
                onChange={handleChange}
                className="media-form__select"
              >
                <option value="">Toutes</option>
                {DISCIPLINES_MEDIATHEQUE.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="media-form__grille-2">
            <div className="media-form__groupe">
              <label className="media-form__label">Niveau</label>
              <select
                name="niveau"
                value={form.niveau}
                onChange={handleChange}
                className="media-form__select"
              >
                <option value="">Tous</option>
                {NIVEAUX_MEDIATHEQUE.map(n => (
                  <option key={n.valeur} value={n.valeur}>{n.label}</option>
                ))}
              </select>
            </div>
            <div className="media-form__groupe">
              <label className="media-form__label">Classe</label>
              <input
                name="classe"
                value={form.classe}
                onChange={handleChange}
                className="media-form__input"
                placeholder="Ex: 3ème / 2nde"
              />
            </div>
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">Tags (séparés par virgule)</label>
            <input
              name="tags"
              value={form.tags}
              onChange={handleChange}
              className="media-form__input"
              placeholder="fonctions affines, algèbre, BFEM"
            />
          </div>

          <div className="media-form__grille-2">
            <div className="media-form__groupe">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  name="isPremium"
                  type="checkbox"
                  checked={form.isPremium}
                  onChange={handleChange}
                />
                Contenu Premium (aperçu 30s)
              </label>
            </div>
            <div className="media-form__groupe">
              <label className="media-form__label">Statut</label>
              <select
                name="statut"
                value={form.statut}
                onChange={handleChange}
                className="media-form__select"
              >
                <option value="publie">Publié</option>
                <option value="brouillon">Brouillon</option>
              </select>
            </div>
          </div>

          {progressUpload > 0 && progressUpload < 100 && (
            <div className="media-form__groupe">
              <div className="media-form__progress">
                <div className="media-form__progress-bar" style={{ width: `${progressUpload}%` }} />
              </div>
              <p className="media-form__progress-texte">Upload en cours… {progressUpload}%</p>
            </div>
          )}

          <div className="media-form__actions">
            <button
              type="button"
              className="btn-secondaire"
              onClick={() => navigate('/mediatheque')}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn-principal"
              disabled={soumission || (!form.url.trim() && !fichierMedia)}
            >
              {soumission ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

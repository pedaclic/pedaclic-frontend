// ============================================================
// PedaClic — MediaEditPage
// Formulaire de modification d'un contenu médiathèque (admin/prof)
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDisciplinesOptions } from '../hooks/useDisciplinesOptions';
import {
  getMediaById,
  updateMedia,
  uploadThumbnail,
} from '../services/mediathequeService';
import type { MediaItem, TypeMedia, StatutMedia } from '../types/mediatheque_types';
import {
  CONFIG_TYPE_MEDIA,
  CONFIG_STATUT_MEDIA,
} from '../types/mediatheque_types';
import '../styles/Mediatheque.css';

const MIME_BY_TYPE: Record<TypeMedia, string> = {
  video: 'video/mp4',
  audio: 'audio/mpeg',
  podcast: 'audio/mpeg',
  webinaire: 'video/mp4',
};

export default function MediaEditPage() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { matieres: matieresOptions, niveaux: niveauxOptions } = useDisciplinesOptions();

  const [loading, setLoading] = useState(true);
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
    statut: 'brouillon' as StatutMedia,
  });

  const [fichierThumb, setFichierThumb] = useState<File | null>(null);

  useEffect(() => {
    if (!mediaId) return;
    let cancelled = false;
    async function charger() {
      try {
        const media = await getMediaById(mediaId);
        if (cancelled || !media) {
          setErreur(media ? null : 'Contenu introuvable.');
          return;
        }
        setForm({
          titre: media.titre || '',
          description: media.description || '',
          type: media.type || 'video',
          url: media.url || '',
          urlBasse: media.urlBasse || '',
          thumbnailUrl: media.thumbnailUrl || '',
          duree: media.duree || 0,
          taille: media.taille || 0,
          mimeType: media.mimeType || MIME_BY_TYPE[media.type || 'video'],
          discipline: media.discipline || '',
          classe: media.classe || '',
          niveau: media.niveau || '',
          tags: (media.tags || []).join(', '),
          isPremium: media.isPremium ?? false,
          statut: media.statut || 'brouillon',
        });
      } catch (err) {
        if (!cancelled) setErreur('Erreur lors du chargement.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    charger();
    return () => { cancelled = true; };
  }, [mediaId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !mediaId) return;

    setSoumission(true);
    setErreur(null);

    try {
      const disciplineId = form.discipline ? form.discipline.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '_') : 'general';
      const tags = form.tags ? form.tags.split(/[,;]/).map(t => t.trim()).filter(Boolean) : [];

      await updateMedia(mediaId, {
        titre: form.titre.trim(),
        description: form.description.trim(),
        type: form.type,
        url: form.url.trim(),
        urlBasse: form.urlBasse?.trim() || '',
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
      });

      if (fichierThumb) {
        setProgressUpload(50);
        const thumbnailUrl = await uploadThumbnail(fichierThumb, mediaId);
        await updateMedia(mediaId, { thumbnailUrl });
      }

      setProgressUpload(100);
      navigate(`/mediatheque/${mediaId}`);
    } catch (err: unknown) {
      console.error('[MediaEdit] Erreur:', err);
      setErreur(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement.');
    } finally {
      setSoumission(false);
      setProgressUpload(0);
    }
  };

  if (loading) {
    return (
      <div className="media-detail-page">
        <div className="mediatheque-chargement" style={{ padding: '4rem 2rem' }}>
          <div className="mediatheque-spinner" />
          <p>Chargement…</p>
        </div>
      </div>
    );
  }

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
        <span style={{ fontSize: '1rem', fontWeight: 700 }}>✏️ Modifier le contenu</span>
      </header>

      <div className="media-form" style={{ maxWidth: 700, margin: '2rem auto' }}>
        <h1 className="media-form__titre">Modifier le média</h1>

        <form onSubmit={handleSubmit}>
          {erreur && (
            <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem' }}>
              {erreur}
            </div>
          )}

          <div className="media-form__groupe">
            <label className="media-form__label">Type</label>
            <select name="type" value={form.type} onChange={handleChange} className="media-form__select">
              {(Object.entries(CONFIG_TYPE_MEDIA) as [TypeMedia, (typeof CONFIG_TYPE_MEDIA)[TypeMedia]][]).map(([type, config]) => (
                <option key={type} value={type}>{config.emoji} {config.label}</option>
              ))}
            </select>
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">Titre <span>*</span></label>
            <input name="titre" value={form.titre} onChange={handleChange} className="media-form__input" required />
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} className="media-form__textarea" rows={3} />
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">URL du fichier (vidéo/audio)</label>
            <input name="url" type="url" value={form.url} onChange={handleChange} className="media-form__input" />
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">Vignette</label>
            <div
              className={`media-form__upload-zone ${fichierThumb ? 'media-form__upload-zone--active' : ''}`}
              onClick={() => document.getElementById('fichier-thumb-edit')?.click()}
            >
              <input
                id="fichier-thumb-edit"
                type="file"
                accept="image/*"
                onChange={(e) => setFichierThumb(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
              <span className="media-form__upload-icone">🖼️</span>
              <p className="media-form__upload-texte">
                {fichierThumb ? <strong>{fichierThumb.name}</strong> : (form.thumbnailUrl ? 'Remplacer la vignette' : 'Ajouter une vignette')}
              </p>
            </div>
          </div>

          <div className="media-form__grille-2">
            <div className="media-form__groupe">
              <label className="media-form__label">Durée (secondes)</label>
              <input name="duree" type="number" value={form.duree || ''} onChange={handleChange} className="media-form__input" min={0} />
            </div>
            <div className="media-form__groupe">
              <label className="media-form__label">Discipline</label>
              <select name="discipline" value={form.discipline} onChange={handleChange} className="media-form__select">
                <option value="">Toutes</option>
                {matieresOptions.map(m => (
                  <option key={m.valeur} value={m.valeur}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="media-form__grille-2">
            <div className="media-form__groupe">
              <label className="media-form__label">Niveau</label>
              <select name="niveau" value={form.niveau} onChange={handleChange} className="media-form__select">
                <option value="">Tous</option>
                {niveauxOptions.map(n => (
                  <option key={n.valeur} value={n.valeur}>{n.label}</option>
                ))}
              </select>
            </div>
            <div className="media-form__groupe">
              <label className="media-form__label">Classe</label>
              <input name="classe" value={form.classe} onChange={handleChange} className="media-form__input" placeholder="Ex: 3ème" />
            </div>
          </div>

          <div className="media-form__groupe">
            <label className="media-form__label">Tags (séparés par virgule)</label>
            <input name="tags" value={form.tags} onChange={handleChange} className="media-form__input" />
          </div>

          <div className="media-form__grille-2">
            <div className="media-form__groupe">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input name="isPremium" type="checkbox" checked={form.isPremium} onChange={handleChange} />
                Contenu Premium (aperçu 30s)
              </label>
            </div>
            <div className="media-form__groupe">
              <label className="media-form__label">Statut</label>
              <select name="statut" value={form.statut} onChange={handleChange} className="media-form__select">
                {(Object.entries(CONFIG_STATUT_MEDIA) as [StatutMedia, (typeof CONFIG_STATUT_MEDIA)[StatutMedia]][]).map(([v, config]) => (
                  <option key={v} value={v}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          {progressUpload > 0 && progressUpload < 100 && (
            <div className="media-form__groupe">
              <div className="media-form__progress">
                <div className="media-form__progress-bar" style={{ width: `${progressUpload}%` }} />
              </div>
            </div>
          )}

          <div className="media-form__actions">
            <button type="button" className="btn-secondaire" onClick={() => navigate('/mediatheque')}>
              Annuler
            </button>
            <button type="submit" className="btn-principal" disabled={soumission}>
              {soumission ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

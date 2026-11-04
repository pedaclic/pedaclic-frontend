// ============================================================
// PedaClic — Phase 49 : page « Mes cellules pédagogiques »
// Route : /prof/cellules
// ------------------------------------------------------------
// • Liste des cellules dont je suis membre ou animateur
// • Créer une cellule (professeur Premium)
// • Rejoindre une cellule avec un code (gratuit, validé par l'animateur)
// ============================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { subscribeMesCellules, creerCellule, demanderAdhesion } from '../services/cellulesService';
import type { Cellule, CelluleFormData } from '../types/cellule.types';
import { PORTEES_CELLULE } from '../types/cellule.types';
import { calculerAnneeScolaireEnCours } from '../types/anneesScolaires.types';
import { messageErreurFirestore } from '../utils/messageErreurFirestore';
import CelluleFormModal from '../components/cellules/CelluleFormModal';
import '../styles/CahierTextes.css';
import '../styles/Cellules.css';

const formVide = (): CelluleFormData => ({
  nom: '', discipline: '', portee: 'etablissement', etablissementNom: '', ief: '',
  anneeScolaire: calculerAnneeScolaireEnCours(), description: '',
});

const CellulesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [cellules, setCellules] = useState<Cellule[]>([]);
  const [chargement, setChargement] = useState(true);
  const [showCreer, setShowCreer] = useState(false);
  const [showRejoindre, setShowRejoindre] = useState(false);
  const [code, setCode] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [messageCode, setMessageCode] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null);

  const uid = currentUser?.uid ?? '';
  const nom = currentUser?.displayName || currentUser?.email || 'Professeur';
  const peutCreer = !!currentUser && (currentUser.isPremium || currentUser.role === 'admin');

  // ── Mes cellules (temps réel) ─────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeMesCellules(
      uid,
      liste => { setCellules(liste); setChargement(false); },
      err => { toast.error(messageErreurFirestore(err, 'Lecture des cellules')); setChargement(false); }
    );
    return () => unsub();
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Créer ─────────────────────────────────────────────────
  const handleCreer = async (form: CelluleFormData) => {
    try {
      const id = await creerCellule({ uid, nom }, form);
      setShowCreer(false);
      toast.success('Cellule créée. Partagez son code d\'invitation avec vos collègues.');
      navigate(`/prof/cellules/${id}?onglet=membres`);
    } catch (err) {
      throw new Error(messageErreurFirestore(err, 'Création'));
    }
  };

  // ── Rejoindre avec un code ────────────────────────────────
  const handleRejoindre = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnvoi(true);
    setMessageCode(null);
    try {
      const resultat = await demanderAdhesion(code, { uid, nom });
      setMessageCode(resultat === 'deja-membre'
        ? { type: 'ok', texte: 'Vous êtes déjà membre de cette cellule.' }
        : { type: 'ok', texte: '✅ Demande envoyée. L\'animateur doit la valider ; la cellule apparaîtra ensuite ici.' });
      setCode('');
    } catch (err) {
      const msg = err instanceof Error && !('code' in err) ? err.message : messageErreurFirestore(err, 'Demande');
      setMessageCode({ type: 'erreur', texte: msg });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="cahier-textes-page">
      {/* ── En-tête ── */}
      <div className="cahier-page-header">
        <div>
          <h1 className="cahier-page-title">👥 Mes cellules pédagogiques</h1>
          <p className="cahier-page-subtitle">
            Harmonisez vos progressions et partagez vos séances avec vos collègues
          </p>
        </div>
        <div className="cel-actions-entete">
          <button className="btn-secondary" onClick={() => { setMessageCode(null); setShowRejoindre(true); }}>
            🔑 Rejoindre avec un code
          </button>
          {peutCreer ? (
            <button className="btn-primary" onClick={() => setShowCreer(true)}>+ Créer une cellule</button>
          ) : (
            <button className="btn-primary" onClick={() => navigate('/premium')} title="Réservé aux professeurs Premium">
              ⭐ Créer une cellule (Premium)
            </button>
          )}
        </div>
      </div>

      {/* ── Liste ── */}
      {chargement ? (
        <div className="loading-spinner"><div className="spinner-circle" /></div>
      ) : cellules.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '3rem', opacity: 0.3, marginBottom: '0.75rem' }}>👥</div>
          <h3>Vous n'êtes encore membre d'aucune cellule</h3>
          <p>
            Demandez le code d'invitation à l'animateur de votre cellule, ou créez la vôtre
            pour partager une progression commune et suivre l'avancement de chacun.
          </p>
        </div>
      ) : (
        <div className="cel-grille">
          {cellules.map(c => {
            const animateur = c.animateurId === uid;
            const portee = PORTEES_CELLULE.find(p => p.valeur === c.portee)?.label ?? '';
            return (
              <button key={c.id} type="button" className="cel-carte" onClick={() => navigate(`/prof/cellules/${c.id}`)}>
                <span className={`cel-role ${animateur ? 'cel-role--animateur' : ''}`}>
                  {animateur ? '⭐ Animateur' : 'Membre'}
                </span>
                <h3 className="cel-carte-titre">{c.nom}</h3>
                <p className="cel-carte-meta">📘 {c.discipline} · {c.anneeScolaire}</p>
                <p className="cel-carte-meta">
                  🏫 {portee}{c.etablissementNom ? ` — ${c.etablissementNom}` : ''}
                </p>
                <p className="cel-carte-pied">
                  👥 {c.membreIds.length} membre{c.membreIds.length > 1 ? 's' : ''} · animée par {c.animateurNom}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Modale : créer ── */}
      {showCreer && (
        <CelluleFormModal
          titre="👥 Nouvelle cellule pédagogique"
          initial={formVide()}
          libelleValider="Créer la cellule"
          onValider={handleCreer}
          onClose={() => setShowCreer(false)}
        />
      )}

      {/* ── Modale : rejoindre ── */}
      {showRejoindre && (
        <div className="modal-overlay cel-overlay" onClick={() => setShowRejoindre(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cel-rejoindre-titre">
            <h2 className="modal-title" id="cel-rejoindre-titre">🔑 Rejoindre une cellule</h2>
            <p className="cel-aide">Saisissez le code communiqué par l'animateur (6 caractères).</p>
            <form onSubmit={handleRejoindre}>
              <input
                className="form-input cel-input-code"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Ex : K7M4QX"
                maxLength={10}
                autoFocus
                aria-label="Code d'invitation"
              />
              {messageCode && (
                <p className={messageCode.type === 'ok' ? 'cel-succes' : 'cel-erreur'} role="status">{messageCode.texte}</p>
              )}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowRejoindre(false)}>Fermer</button>
                <button type="submit" className="btn-primary" disabled={envoi || code.trim().length < 4}>
                  {envoi ? 'Envoi…' : 'Envoyer ma demande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CellulesPage;

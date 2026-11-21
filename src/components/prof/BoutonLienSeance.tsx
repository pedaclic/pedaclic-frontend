// ============================================================
// PedaClic — Phase 58 : bouton « Lien de la séance »
// ------------------------------------------------------------
// Deux variantes :
//   • variante="icone"  → bouton 🔗 dans les actions d'une carte
//                         (CahierDetailPage) ; ouvre une petite
//                         fenêtre : copier / WhatsApp / rappel.
//   • variante="bouton" → bouton texte « Copier le lien » dans
//                         l'en-tête de l'éditeur (EntreeEditorPage).
// Aucun accès Firestore : le lien est construit à partir de l'ID.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  construireLienSeance,
  copierLienSeance,
  lienWhatsAppSeance,
} from '../../utils/lienSeance';
import { useToast } from '../../contexts/ToastContext';
import '../../styles/Phase58.css';

interface BoutonLienSeanceProps {
  entreeId: string;
  /** Titre (chapitre) de la séance — ajouté au message WhatsApp */
  titre?: string;
  variante?: 'icone' | 'bouton';
}

/** Icône « maillon de chaîne » (trait, hérite de la couleur du texte) */
const IconeLien: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>
);

const BoutonLienSeance: React.FC<BoutonLienSeanceProps> = ({ entreeId, titre, variante = 'icone' }) => {
  const { toast } = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [copie, setCopie] = useState(false);
  const racineRef = useRef<HTMLDivElement>(null);

  // Ferme la fenêtre au clic extérieur ou sur Échap
  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (racineRef.current && !racineRef.current.contains(e.target as Node)) setOuvert(false);
    };
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false); };
    document.addEventListener('mousedown', surClic);
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('mousedown', surClic);
      document.removeEventListener('keydown', surTouche);
    };
  }, [ouvert]);

  // Copie + retour visuel (« Copié ✓ » pendant 1,8 s)
  const handleCopier = async (e?: React.MouseEvent) => {
    e?.stopPropagation(); // la carte parente est cliquable : on ne la déclenche pas
    const ok = await copierLienSeance(entreeId);
    if (ok) {
      setCopie(true);
      toast.success('Lien de la séance copié.');
      window.setTimeout(() => setCopie(false), 1800);
    }
  };

  // ── Variante éditeur : simple bouton texte ──────────────────
  if (variante === 'bouton') {
    return (
      <button type="button" className="lien-seance-btn-texte" onClick={handleCopier}
              title="Copier le lien direct vers cette séance">
        <IconeLien /> {copie ? 'Copié ✓' : 'Copier le lien'}
      </button>
    );
  }

  // ── Variante carte : icône + fenêtre ────────────────────────
  return (
    <div className="lien-seance" ref={racineRef} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className={`btn-icon lien-seance-declencheur${ouvert ? ' is-actif' : ''}`}
        onClick={() => setOuvert(o => !o)}
        title="Lien de la séance"
        aria-label="Lien de la séance"
        aria-expanded={ouvert}
      >
        <IconeLien />
      </button>

      {ouvert && (
        <div className="lien-seance-pop" role="dialog" aria-label="Lien de la séance">
          <div className="lien-seance-pop__tete">
            <strong>Lien de la séance</strong>
            <button type="button" className="lien-seance-pop__fermer"
                    onClick={() => setOuvert(false)} aria-label="Fermer">×</button>
          </div>

          <label className="lien-seance-pop__label" htmlFor={`lien-${entreeId}`}>
            Lien à envoyer à un élève
          </label>
          <div className="lien-seance-pop__ligne">
            {/* Champ en lecture seule : sélection au focus pour copie manuelle */}
            <input id={`lien-${entreeId}`} readOnly value={construireLienSeance(entreeId)}
                   onFocus={e => e.currentTarget.select()} />
            <button type="button" className="lien-seance-pop__copier" onClick={handleCopier}>
              {copie ? 'Copié ✓' : 'Copier'}
            </button>
          </div>

          <a className="lien-seance-pop__whatsapp" href={lienWhatsAppSeance(entreeId, titre)}
             target="_blank" rel="noopener noreferrer">
            Envoyer par WhatsApp
          </a>

          <p className="lien-seance-pop__note">
            Visible par l'élève si le cahier est <strong>partagé</strong> et la séance
            <strong> réalisée</strong>. Sinon, il verra « Séance pas encore disponible ».
          </p>
        </div>
      )}
    </div>
  );
};

export default BoutonLienSeance;

// ============================================================
// PedaClic — Phase 54 : ComposerMessage
// Formulaire de rédaction de l'espace classe.
//   • 'annonce' (prof) : titre, date/heure d'événement, « important »
//   • 'prive'   (prof) : choix de l'élève destinataire
//   • 'forum'   (prof + élèves) : simple zone de texte
// Ctrl/⌘ + Entrée envoie le message.
// ============================================================

import React, { useState } from 'react';
import type { NatureMessage } from '../../types/communication.types';
import { MAX_CONTENU_MESSAGE, MAX_TITRE_MESSAGE } from '../../types/communication.types';

export interface DonneesComposer {
  titre?: string;
  contenu: string;
  evenementDate?: string;
  evenementHeure?: string;
  important?: boolean;
  destinataireId?: string;
  destinataireNom?: string;
}

interface ComposerMessageProps {
  nature: NatureMessage;
  /** Élèves du groupe (nature 'prive') */
  eleves?: { id: string; nom: string }[];
  /** Élève présélectionné (nature 'prive') */
  destinataireInitial?: string;
  onPublier: (d: DonneesComposer) => Promise<void>;
  /** Texte d'aide affiché sous le formulaire */
  aide?: string;
}

const ComposerMessage: React.FC<ComposerMessageProps> = ({
  nature, eleves = [], destinataireInitial = '', onPublier, aide,
}) => {
  // ── États du formulaire ──
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evHeure, setEvHeure] = useState('');
  const [important, setImportant] = useState(false);
  const [destId, setDestId] = useState(destinataireInitial);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  // Le destinataire suit la présélection (changement d'élève dans la liste)
  React.useEffect(() => { setDestId(destinataireInitial); }, [destinataireInitial]);

  const valide = contenu.trim().length > 0 && (nature !== 'prive' || Boolean(destId));

  const envoyer = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!valide || envoi) return;
    setEnvoi(true);
    setErreur('');
    try {
      await onPublier({
        titre: nature === 'forum' ? undefined : titre,
        contenu,
        evenementDate: nature === 'annonce' ? evDate : undefined,
        evenementHeure: nature === 'annonce' && evDate ? evHeure : undefined,
        important: nature === 'annonce' ? important : undefined,
        destinataireId: nature === 'prive' ? destId : undefined,
        destinataireNom: nature === 'prive' ? eleves.find(x => x.id === destId)?.nom : undefined,
      });
      // Réinitialisation après succès (le destinataire est conservé)
      setTitre(''); setContenu(''); setEvDate(''); setEvHeure(''); setImportant(false);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Envoi impossible. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  const libelleBouton = nature === 'annonce' ? '📢 Publier l\'annonce'
    : nature === 'prive' ? '✉️ Envoyer' : '💬 Envoyer';

  return (
    <form className={`com-composer com-composer--${nature}`} onSubmit={envoyer}>
      {/* ── Destinataire (message privé) ── */}
      {nature === 'prive' && (
        <label className="com-champ">
          <span>Élève destinataire</span>
          <select value={destId} onChange={e => setDestId(e.target.value)} required>
            <option value="">— Choisir un élève —</option>
            {eleves.map(el => <option key={el.id} value={el.id}>{el.nom}</option>)}
          </select>
        </label>
      )}

      {/* ── Titre (annonce / privé) ── */}
      {nature !== 'forum' && (
        <label className="com-champ">
          <span>Objet {nature === 'prive' && <em>(facultatif)</em>}</span>
          <input
            type="text"
            value={titre}
            maxLength={MAX_TITRE_MESSAGE}
            onChange={e => setTitre(e.target.value)}
            placeholder={nature === 'annonce' ? 'Ex. : Sortie au Musée des Civilisations noires' : 'Ex. : Ton exposé'}
          />
        </label>
      )}

      {/* ── Contenu ── */}
      <label className="com-champ">
        {nature !== 'forum' && <span>Message</span>}
        <textarea
          value={contenu}
          maxLength={MAX_CONTENU_MESSAGE}
          rows={nature === 'forum' ? 2 : 4}
          onChange={e => setContenu(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void envoyer(); }}
          placeholder={nature === 'forum' ? 'Écrire au groupe… (Ctrl + Entrée pour envoyer)' : 'Votre message…'}
          aria-label="Contenu du message"
        />
      </label>

      {/* ── Événement & importance (annonce) ── */}
      {nature === 'annonce' && (
        <div className="com-ligne">
          <label className="com-champ com-champ--court">
            <span>Date de l'événement <em>(facultatif)</em></span>
            <input type="date" value={evDate} onChange={e => setEvDate(e.target.value)} />
          </label>
          <label className="com-champ com-champ--court">
            <span>Heure</span>
            <input type="time" value={evHeure} disabled={!evDate} onChange={e => setEvHeure(e.target.value)} />
          </label>
          <label className="com-case">
            <input type="checkbox" checked={important} onChange={e => setImportant(e.target.checked)} />
            Marquer comme important
          </label>
        </div>
      )}

      {erreur && <p className="com-erreur" role="alert">{erreur}</p>}

      <div className="com-composer-pied">
        {aide && <small>{aide}</small>}
        <button type="submit" className="btn-primary" disabled={!valide || envoi}>
          {envoi ? 'Envoi…' : libelleBouton}
        </button>
      </div>
    </form>
  );
};

export default ComposerMessage;

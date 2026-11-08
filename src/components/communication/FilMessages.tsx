// ============================================================
// PedaClic — Phase 54 : FilMessages
// Affiche une liste de messages de l'espace classe.
//   • variante 'annonces' : cartes (épinglées en tête, date d'événement)
//   • variante 'forum'    : bulles de discussion, ordre chronologique
//   • variante 'prives'   : cartes compactes avec le destinataire
// Utilisé côté professeur ET côté élève (droits passés en props).
// ============================================================

import React, { useEffect, useMemo, useRef } from 'react';
import type { MessageClasse } from '../../types/communication.types';

interface FilMessagesProps {
  messages: MessageClasse[];
  variante: 'annonces' | 'forum' | 'prives';
  uidCourant: string;
  /** Professeur du groupe : peut épingler et supprimer tout message */
  estModerateur?: boolean;
  /** Messages publiés après cette date (ms) sont signalés « Nouveau » */
  nouveauxDepuis?: number;
  onEpingler?: (m: MessageClasse) => void;
  onSupprimer?: (m: MessageClasse) => void;
  vide: string;
}

/* Date relative courte en français : « à l'instant », « il y a 5 min », « hier 14:05 »… */
function dateRelative(ms: number): string {
  const diff = Date.now() - ms;
  const d = new Date(ms);
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diff < 60_000) return 'à l\'instant';
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
  if (ms >= aujourdhui.getTime()) return `aujourd'hui ${heure}`;
  if (ms >= aujourdhui.getTime() - 86_400_000) return `hier ${heure}`;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${heure}`;
}

/* Initiales pour l'avatar */
const initiales = (nom: string) =>
  nom.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';

/* Libellé lisible d'un événement (date + heure facultative) */
function libelleEvenement(m: MessageClasse): string | null {
  if (!m.evenementDate) return null;
  const d = new Date(`${m.evenementDate}T00:00:00`);
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `${txt.charAt(0).toUpperCase()}${txt.slice(1)}${m.evenementHeure ? ` à ${m.evenementHeure}` : ''}`;
}

const FilMessages: React.FC<FilMessagesProps> = ({
  messages, variante, uidCourant, estModerateur = false, nouveauxDepuis = 0,
  onEpingler, onSupprimer, vide,
}) => {
  const finRef = useRef<HTMLDivElement>(null);

  // ── Ordre d'affichage selon la variante ──
  const liste = useMemo(() => {
    const ms = (m: MessageClasse) => m.createdAt?.toMillis?.() ?? 0;
    if (variante === 'forum') return [...messages].sort((a, b) => ms(a) - ms(b));          // ancien → récent
    if (variante === 'annonces') return [...messages].sort((a, b) =>
      Number(Boolean(b.epingle)) - Number(Boolean(a.epingle)) || ms(b) - ms(a));            // épinglées puis récent → ancien
    return [...messages].sort((a, b) => ms(b) - ms(a));
  }, [messages, variante]);

  // Forum : défilement automatique vers le dernier message
  useEffect(() => {
    if (variante === 'forum') finRef.current?.scrollIntoView({ block: 'end' });
  }, [liste.length, variante]);

  if (liste.length === 0) {
    return <p className="com-vide">{vide}</p>;
  }

  return (
    <div className={`com-fil com-fil--${variante}`}>
      {liste.map(m => {
        const t = m.createdAt?.toMillis?.() ?? 0;
        const estMoi = m.auteurId === uidCourant;
        const nouveau = !estMoi && nouveauxDepuis > 0 && t > nouveauxDepuis;
        const peutSupprimer = estModerateur || estMoi;
        const evenement = libelleEvenement(m);

        /* ── Bulle de forum ── */
        if (variante === 'forum') {
          return (
            <div
              key={m.id}
              className={`com-bulle${estMoi ? ' com-bulle--moi' : ''}${m.auteurRole === 'prof' ? ' com-bulle--prof' : ''}`}
            >
              <span className="com-avatar" aria-hidden="true">{initiales(m.auteurNom)}</span>
              <div className="com-bulle-corps">
                <div className="com-bulle-tete">
                  <strong>{estMoi ? 'Moi' : m.auteurNom}</strong>
                  {m.auteurRole === 'prof' && <span className="com-badge-prof">Professeur</span>}
                  <time dateTime={new Date(t).toISOString()}>{dateRelative(t)}</time>
                  {nouveau && <span className="com-badge-nouveau">Nouveau</span>}
                </div>
                <p className="com-texte">{m.contenu}</p>
              </div>
              {peutSupprimer && onSupprimer && (
                <button type="button" className="com-btn-icone" title="Supprimer ce message"
                        aria-label="Supprimer ce message" onClick={() => onSupprimer(m)}>🗑</button>
              )}
            </div>
          );
        }

        /* ── Carte d'annonce ou de message privé ── */
        return (
          <article
            key={m.id}
            className={`com-carte${m.epingle ? ' com-carte--epingle' : ''}${m.important ? ' com-carte--important' : ''}${nouveau ? ' com-carte--nouveau' : ''}`}
          >
            <header className="com-carte-tete">
              <div className="com-carte-titres">
                {m.epingle && <span className="com-pastille com-pastille--epingle">📌 Épinglé</span>}
                {m.important && <span className="com-pastille com-pastille--important">⚠️ Important</span>}
                {nouveau && <span className="com-badge-nouveau">Nouveau</span>}
                <h3>{m.titre || (variante === 'prives' ? 'Message personnel' : 'Annonce')}</h3>
              </div>
              <div className="com-carte-actions">
                {estModerateur && variante === 'annonces' && onEpingler && (
                  <button type="button" className="com-btn-icone"
                          title={m.epingle ? 'Désépingler' : 'Épingler en tête'}
                          aria-label={m.epingle ? 'Désépingler' : 'Épingler en tête'}
                          onClick={() => onEpingler(m)}>📌</button>
                )}
                {peutSupprimer && onSupprimer && (
                  <button type="button" className="com-btn-icone" title="Supprimer"
                          aria-label="Supprimer" onClick={() => onSupprimer(m)}>🗑</button>
                )}
              </div>
            </header>

            {/* Date d'événement mise en avant */}
            {evenement && <p className="com-evenement">🗓️ {evenement}</p>}

            <p className="com-texte">{m.contenu}</p>

            <footer className="com-carte-pied">
              {variante === 'prives'
                ? <span>{estMoi ? `À ${m.destinataireNom || 'l\'élève'}` : `De ${m.auteurNom}`} · {m.groupeNom}</span>
                : <span>{m.auteurNom}</span>}
              <time dateTime={new Date(t).toISOString()}>{dateRelative(t)}</time>
            </footer>
          </article>
        );
      })}
      <div ref={finRef} />
    </div>
  );
};

export default FilMessages;

/**
 * ============================================================
 * PEDACLIC — Enregistreur vocal de l'élève
 * ------------------------------------------------------------
 * Permet à l'élève d'enregistrer une réponse orale via le micro
 * (API MediaRecorder), de la réécouter, puis de l'uploader vers
 * Firebase Storage. L'URL obtenue est renvoyée au lecteur de quiz.
 *
 * Chemin Storage : quiz-reponses-audio/{userId}/{questionId}/{ts}.webm
 * ============================================================
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

interface AudioRecorderProps {
  userId: string;
  questionId: string;
  /** Durée maximale autorisée (secondes). 0 = pas de limite. */
  dureeMaxSecondes: number;
  /** URL déjà enregistrée (réouverture de la question). */
  existingUrl?: string;
  /** Appelé après upload réussi : URL publique + durée enregistrée. */
  onRecorded: (url: string, dureeSecondes: number) => void;
}

type EtatEnregistrement = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

/** Formate des secondes en mm:ss. */
function formatDuree(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  userId,
  questionId,
  dureeMaxSecondes,
  existingUrl,
  onRecorded,
}) => {
  const [etat, setEtat] = useState<EtatEnregistrement>(existingUrl ? 'done' : 'idle');
  const [secondes, setSecondes] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingUrl || null);
  const [erreur, setErreur] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const localUrlRef = useRef<string | null>(null);

  // --- Nettoyage à la destruction du composant ---
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    };
  }, []);

  // --- Upload du blob enregistré vers Firebase Storage ---
  const uploader = useCallback(
    async (blob: Blob, duree: number) => {
      setEtat('uploading');
      try {
        const path = `quiz-reponses-audio/${userId}/${questionId}/${Date.now()}.webm`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob, { contentType: blob.type || 'audio/webm' });
        const url = await getDownloadURL(storageRef);
        setAudioUrl(url);
        setEtat('done');
        onRecorded(url, duree);
      } catch (e: any) {
        setErreur(`Échec de l'envoi : ${e.message || e}`);
        setEtat('error');
      }
    },
    [userId, questionId, onRecorded],
  );

  // --- Démarrer l'enregistrement ---
  const demarrer = async () => {
    setErreur(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Stopper le micro
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Aperçu local immédiat
        if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
        const localUrl = URL.createObjectURL(blob);
        localUrlRef.current = localUrl;
        setAudioUrl(localUrl);
        // Capturer la durée AVANT remise à zéro
        setSecondes((dureeFinale) => {
          uploader(blob, dureeFinale);
          return dureeFinale;
        });
      };

      recorder.start();
      setSecondes(0);
      setEtat('recording');

      // Chrono + arrêt automatique à la durée max
      timerRef.current = setInterval(() => {
        setSecondes((s) => {
          const next = s + 1;
          if (dureeMaxSecondes > 0 && next >= dureeMaxSecondes) {
            arreter();
          }
          return next;
        });
      }, 1000);
    } catch (e: any) {
      setErreur(
        "Micro inaccessible. Autorisez l'accès au microphone dans votre navigateur.",
      );
      setEtat('error');
    }
  };

  // --- Arrêter l'enregistrement ---
  const arreter = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // --- Recommencer (efface l'enregistrement courant) ---
  const recommencer = () => {
    setAudioUrl(null);
    setSecondes(0);
    setEtat('idle');
  };

  return (
    <div className="audio-recorder">
      {/* Consigne d'enregistrement / limite */}
      <div className="audio-recorder__info">
        🎙️ Réponse orale
        {dureeMaxSecondes > 0 && (
          <span className="audio-recorder__limit">
            {' '}— durée max {formatDuree(dureeMaxSecondes)}
          </span>
        )}
      </div>

      {/* Zone de contrôle */}
      <div className="audio-recorder__controls">
        {etat === 'idle' && (
          <button
            type="button"
            className="audio-recorder__btn audio-recorder__btn--record"
            onClick={demarrer}
          >
            ● Démarrer l'enregistrement
          </button>
        )}

        {etat === 'recording' && (
          <>
            <span className="audio-recorder__pulse" aria-hidden="true" />
            <span className="audio-recorder__timer">{formatDuree(secondes)}</span>
            <button
              type="button"
              className="audio-recorder__btn audio-recorder__btn--stop"
              onClick={arreter}
            >
              ■ Arrêter
            </button>
          </>
        )}

        {etat === 'uploading' && (
          <span className="audio-recorder__status">⏳ Envoi de l'enregistrement…</span>
        )}

        {etat === 'done' && audioUrl && (
          <>
            <audio src={audioUrl} controls className="audio-recorder__playback" />
            <button
              type="button"
              className="audio-recorder__btn audio-recorder__btn--redo"
              onClick={recommencer}
            >
              ↺ Recommencer
            </button>
          </>
        )}

        {etat === 'error' && (
          <button
            type="button"
            className="audio-recorder__btn audio-recorder__btn--record"
            onClick={recommencer}
          >
            ↺ Réessayer
          </button>
        )}
      </div>

      {/* Confirmation / erreur */}
      {etat === 'done' && (
        <p className="audio-recorder__saved">✅ Enregistrement sauvegardé</p>
      )}
      {erreur && <p className="audio-recorder__error">⚠️ {erreur}</p>}
    </div>
  );
};

export default AudioRecorder;

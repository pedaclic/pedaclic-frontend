/**
 * ============================================================================
 * EBOOKS PAGE - Wrapper pour la bibliothèque et le viewer
 * ============================================================================
 * Connecte EbookLibrary et EbookViewer au contexte d'authentification.
 * Gère la navigation entre la liste et la lecture d'un ebook.
 * 
 * @author PedaClic Team
 * @version 1.0.0 - Phase 20
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Ebook } from '../types/ebook.types';
import { EbookLibrary } from './EbookLibrary';
import { EbookViewer } from './EbookViewer';

const EbooksPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedEbook, setSelectedEbook] = useState<Ebook | null>(null);

  // --- Ouvrir un ebook dans le viewer ---
  const handleReadEbook = (ebook: Ebook) => {
    setSelectedEbook(ebook);
  };

  // --- Retour à la bibliothèque ---
  const handleBack = () => {
    setSelectedEbook(null);
  };

  // --- Redirection vers la page Premium ---
  const handleGoPremium = () => {
    navigate('/premium');
  };

  // --- Mode viewer ---
  if (selectedEbook) {
    return (
      <EbookViewer
        ebook={selectedEbook}
        isPremium={currentUser?.isPremium || false}
        onBack={handleBack}
        onGoPremium={handleGoPremium}
      />
    );
  }

  // --- Mode bibliothèque ---
  return (
    <EbookLibrary
      isPremium={currentUser?.isPremium || false}
      onReadEbook={handleReadEbook}
    />
  );
};

export default EbooksPage;

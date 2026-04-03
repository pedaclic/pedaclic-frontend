import React from 'react';
import { useParams } from 'react-router-dom';

// Page Niveau — affiche les contenus d'un niveau (/niveaux/:niveauSlug)
const NiveauPage: React.FC = () => {
  const { niveauSlug } = useParams<{ niveauSlug: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Niveau : {niveauSlug}</h1>
      <p className="text-gray-500">Page en cours de développement.</p>
    </div>
  );
};

export default NiveauPage;

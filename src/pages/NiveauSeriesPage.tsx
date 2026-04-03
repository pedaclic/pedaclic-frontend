import React from 'react';
import { useParams } from 'react-router-dom';

// Page Séries d'un niveau lycée (/niveaux/lycee/:classeValue)
const NiveauSeriesPage: React.FC = () => {
  const { classeValue } = useParams<{ classeValue: string }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Séries — {classeValue}</h1>
      <p className="text-gray-500">Page en cours de développement.</p>
    </div>
  );
};

export default NiveauSeriesPage;

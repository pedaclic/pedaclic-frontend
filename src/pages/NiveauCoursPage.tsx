import React from 'react';
import { useParams } from 'react-router-dom';

// Page Cours d'un niveau (/niveaux/:niveauSlug/:classeValue/cours)
const NiveauCoursPage: React.FC = () => {
  const { niveauSlug, classeValue, serie } = useParams<{
    niveauSlug?: string;
    classeValue?: string;
    serie?: string;
  }>();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">
        Cours — {niveauSlug || serie} / {classeValue}
      </h1>
      <p className="text-gray-500">Page en cours de développement.</p>
    </div>
  );
};

export default NiveauCoursPage;

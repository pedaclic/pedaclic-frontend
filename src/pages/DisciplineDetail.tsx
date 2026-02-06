import React from 'react';
import { useParams } from 'react-router-dom';

// TODO: Reconnecter avec les bonnes API ResourceService
const DisciplineDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Discipline {id} - En maintenance</h2>
      <p>Cette page sera bientôt disponible.</p>
    </div>
  );
};

export default DisciplineDetail;
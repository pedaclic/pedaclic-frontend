// Code du composant Cahier de Textes (version simplifiée pour démarrer)
const { useState, useEffect } = React;

const CahierTextes = () => {
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '15px', padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ margin: 0, color: '#2c3e50' }}>Cahier de Textes & Carnet de Notes</h1>
        <p style={{ color: '#7f8c8d' }}>Module Premium PedaClic - En cours de configuration</p>
        <p style={{ marginTop: '20px', padding: '20px', background: '#d1ecf1', borderRadius: '8px', color: '#0c5460' }}>
          ✨ Module en cours de mise en place. Firebase doit être configuré.
        </p>
      </div>
    </div>
  );
};

ReactDOM.render(<CahierTextes />, document.getElementById('root'));

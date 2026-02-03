import React from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth, AdminRoute } from './contexts/AuthContext';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import DisciplineManager from './components/admin/DisciplineManager';
import ChapitreManager from './components/admin/ChapitreManager';
import ResourceManager from './components/admin/ResourceManager';

const HomePage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  return (
    <div style={{ padding: '3rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ color: '#2563eb', fontSize: '3rem', marginBottom: '0.5rem' }}>🎓 PedaClic</h1>
      <p style={{ fontSize: '1.2rem', color: '#6b7280', marginBottom: '2rem' }}>L'école en un clic</p>
      {currentUser ? (
        <div style={{ padding: '1.5rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '12px', marginBottom: '2rem' }}>
          <p style={{ margin: 0 }}>✅ Connecté : <strong>{currentUser.displayName || currentUser.email}</strong> ({currentUser.role})</p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {(currentUser.role === 'admin' || currentUser.role === 'prof') && (
              <Link to="/admin" style={{ padding: '0.5rem 1.5rem', background: '#2563eb', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>Accéder à l'Admin →</Link>
            )}
            <button onClick={() => logout()} style={{ padding: '0.5rem 1.5rem', background: '#ef4444', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600' }}>Déconnexion</button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #2563eb, #1e40af)', borderRadius: '12px', color: 'white', textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>🔐 Connectez-vous pour accéder à la plateforme</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/connexion" style={{ padding: '0.75rem 2rem', background: 'white', color: '#2563eb', borderRadius: '8px', textDecoration: 'none', fontWeight: '600' }}>Se connecter</Link>
            <Link to="/inscription" style={{ padding: '0.75rem 2rem', background: 'transparent', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: '600', border: '2px solid white' }}>Créer un compte</Link>
          </div>
        </div>
      )}
      <div style={{ padding: '2rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
        <h2 style={{ color: '#059669', marginBottom: '1rem' }}>✅ Fonctionnalités</h2>
        <ul style={{ lineHeight: '2.2', listStyle: 'none', padding: 0 }}>
          <li>✅ Authentification (Admin / Professeur / Élève)</li>
          <li>✅ Gestion des disciplines, chapitres, ressources</li>
          <li>✅ Upload de fichiers vers Firebase Storage</li>
          <li>✅ Système Premium / Gratuit</li>
        </ul>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />
        <Route path="/admin" element={<AdminRoute><AdminLayout currentPage="dashboard"><AdminDashboard /></AdminLayout></AdminRoute>} />
        <Route path="/admin/disciplines" element={<AdminRoute><AdminLayout currentPage="disciplines"><DisciplineManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/chapitres" element={<AdminRoute><AdminLayout currentPage="chapitres"><ChapitreManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/ressources" element={<AdminRoute><AdminLayout currentPage="ressources"><ResourceManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/quiz" element={<AdminRoute><AdminLayout currentPage="quiz"><div style={{ padding: '3rem', textAlign: 'center' }}><h2>🧩 Quiz - Bientôt disponible</h2></div></AdminLayout></AdminRoute>} />
        <Route path="/admin/utilisateurs" element={<AdminRoute><AdminLayout currentPage="utilisateurs"><div style={{ padding: '3rem', textAlign: 'center' }}><h2>👥 Utilisateurs - Bientôt disponible</h2></div></AdminLayout></AdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;

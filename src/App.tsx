import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AdminRoute } from './contexts/AuthContext';

/* ==================== LAYOUT (Header + Footer) ==================== */
import Layout from './components/Layout';

/* ==================== PAGES PUBLIQUES ==================== */
import Home from './pages/Home';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import DisciplinesPage from './pages/DisciplinesPage';
import DisciplineDetail from './pages/DisciplineDetail';
import PremiumPage from './pages/Premium/PremiumPage';

/* ==================== COMPOSANTS ADMIN ==================== */
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import DisciplineManager from './components/admin/DisciplineManager';
import ChapitreManager from './components/admin/ChapitreManager';
import ResourceManager from './components/admin/ResourceManager';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* ========== PAGES PUBLIQUES (avec Header + Footer) ========== */}
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/disciplines" element={<Layout><DisciplinesPage /></Layout>} />
        <Route path="/disciplines/:id" element={<Layout><DisciplineDetail /></Layout>} />
        <Route path="/premium" element={<Layout><PremiumPage /></Layout>} />

        {/* ========== AUTH (sans Header/Footer) ========== */}
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />

        {/* ========== ADMIN PROTÉGÉ ========== */}
        <Route path="/admin" element={<AdminRoute><AdminLayout currentPage="dashboard"><AdminDashboard /></AdminLayout></AdminRoute>} />
        <Route path="/admin/disciplines" element={<AdminRoute><AdminLayout currentPage="disciplines"><DisciplineManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/chapitres" element={<AdminRoute><AdminLayout currentPage="chapitres"><ChapitreManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/ressources" element={<AdminRoute><AdminLayout currentPage="ressources"><ResourceManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/quiz" element={<AdminRoute><AdminLayout currentPage="quiz"><div style={{padding:'3rem',textAlign:'center'}}><h2>🧩 Quiz - Bientôt disponible</h2></div></AdminLayout></AdminRoute>} />
        <Route path="/admin/utilisateurs" element={<AdminRoute><AdminLayout currentPage="utilisateurs"><div style={{padding:'3rem',textAlign:'center'}}><h2>👥 Utilisateurs - Bientôt disponible</h2></div></AdminLayout></AdminRoute>} />

        {/* ========== 404 ========== */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;

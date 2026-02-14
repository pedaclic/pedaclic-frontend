/**
 * ============================================================================
 * APP.TSX - POINT D'ENTRÉE PRINCIPAL PEDACLIC
 * ============================================================================
 * Configuration du routing et structure de l'application.
 * Toutes les routes sont organisées par section :
 *   - Pages publiques (avec Header + Footer)
 *   - Authentification (sans Header/Footer)
 *   - Admin protégé (avec AdminLayout + sidebar)
 *   - Quiz publics (avec Header + Footer)
 *   - Élève / Parent / Professeur
 *   - Catch-all 404
 * 
 * @author PedaClic Team
 * @version 2.1.0
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AdminRoute, ProfRoute, ProtectedRoute } from './contexts/AuthContext';

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
import QuizManager from './components/admin/QuizManager';
import UserManager from './components/admin/UserManager';
import ResultsAdmin from './components/admin/ResultsAdmin';
import SettingsAdmin from './components/admin/SettingsAdmin';

/* ==================== PAGES QUIZ ==================== */
import QuizEditorPage from './pages/QuizEditorPage';
import QuizAdvancedList from './pages/QuizAdvancedList';
import QuizPlayerPage from './pages/QuizPlayerPage';

/* ==================== COMPOSANTS ÉLÈVE ==================== */
import QuizPlayer from './components/student/QuizPlayer';
import StudentDashboard from './components/student/StudentDashboard';
import StudentSuivi from './components/student/StudentSuivi';

/* ==================== COMPOSANTS PROF ==================== */
import ProfDashboard from './components/prof/ProfDashboard';

/* ==================== COMPOSANTS PARENT ==================== */
import ParentDashboard from './components/parent/ParentDashboard';

/* ==================== GÉNÉRATEUR IA ==================== */
import AIGenerator from './components/generator/AIGenerator';

// ==================== APPLICATION ====================

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

        {/* ========== ADMIN PROTÉGÉ (avec AdminLayout + sidebar) ========== */}
        <Route path="/admin" element={<AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>} />
        <Route path="/admin/disciplines" element={<AdminRoute><AdminLayout><DisciplineManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/chapitres" element={<AdminRoute><AdminLayout><ChapitreManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/ressources" element={<AdminRoute><AdminLayout><ResourceManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/quiz" element={<AdminRoute><AdminLayout><QuizManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/quiz/nouveau" element={<AdminRoute><AdminLayout><QuizEditorPage /></AdminLayout></AdminRoute>} />
        <Route path="/admin/quiz/modifier/:quizId" element={<AdminRoute><AdminLayout><QuizEditorPage /></AdminLayout></AdminRoute>} />
        <Route path="/admin/quiz-avance" element={<AdminRoute><AdminLayout><QuizAdvancedList /></AdminLayout></AdminRoute>} />
        <Route path="/admin/utilisateurs" element={<AdminRoute><AdminLayout><UserManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/resultats" element={<AdminRoute><AdminLayout><ResultsAdmin /></AdminLayout></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><AdminLayout><SettingsAdmin /></AdminLayout></AdminRoute>} />

        {/* ========== ABONNÉS PREMIUM → redirige vers Utilisateurs filtre premium ========== */}
        <Route path="/admin/premium" element={<Navigate to="/admin/utilisateurs?filter=premium" replace />} />

        {/* ========== QUIZ PUBLICS (avec Header + Footer) ========== */}
        <Route path="/quiz/:quizId" element={<Layout><QuizPlayer /></Layout>} />
        <Route path="/quiz-avance/:quizId" element={<Layout><QuizPlayerPage /></Layout>} />

        {/* ========== ESPACE ÉLÈVE ========== */}
        <Route path="/eleve/dashboard" element={<Layout><StudentDashboard /></Layout>} />
        <Route path="/eleve/suivi" element={<Layout><StudentSuivi /></Layout>} />

        {/* ========== ESPACE PROFESSEUR ========== */}
        <Route path="/prof/dashboard" element={<ProfRoute><Layout><ProfDashboard /></Layout></ProfRoute>} />

        {/* ========== ESPACE PARENT ========== */}
        <Route path="/parent/dashboard" element={
          <ProtectedRoute allowedRoles={['parent', 'admin']}>
            <Layout><ParentDashboard /></Layout>
          </ProtectedRoute>
        } />
	
	{/* ========== GÉNÉRATEUR IA (Premium) ========== */}
        <Route path="/generateur" element={<Layout><AIGenerator /></Layout>} />	

        {/* ========== 404 → redirection accueil ========== */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AuthProvider>
  );
};

export default App;

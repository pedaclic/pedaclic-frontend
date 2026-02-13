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
import QuizPlayer from './components/student/QuizPlayer';
import StudentDashboard from './components/student/StudentDashboard';
import StudentSuivi from './components/student/StudentSuivi';
import ProfDashboard from './components/prof/ProfDashboard';
import ParentDashboard from './components/parent/ParentDashboard';
import QuizEditorPage from './pages/QuizEditorPage';
import QuizAdvancedList from './pages/QuizAdvancedList';
import QuizPlayerPage from './pages/QuizPlayerPage';
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
        <Route path="/admin/quiz" element={<AdminRoute><AdminLayout currentPage="quiz"><QuizManager /></AdminLayout></AdminRoute>} />
        <Route path="/admin/quiz/nouveau" element={<AdminRoute><AdminLayout currentPage="quiz"><QuizEditorPage /></AdminLayout></AdminRoute>} />
        <Route path="/admin/quiz/modifier/:quizId" element={<AdminRoute><AdminLayout currentPage="quiz"><QuizEditorPage /></AdminLayout></AdminRoute>} />
        <Route path="/admin/quiz-avance" element={<AdminRoute><AdminLayout currentPage="quiz"><QuizAdvancedList /></AdminLayout></AdminRoute>} />
        <Route path="/quiz-avance/:quizId" element={<Layout><QuizPlayerPage /></Layout>} />
        <Route path="/admin/utilisateurs" element={<AdminRoute><AdminLayout currentPage="utilisateurs"><UserManager /></AdminLayout></AdminRoute>} />
	<Route path="/eleve/dashboard" element={<Layout><StudentDashboard /></Layout>} />
	<Route path="/eleve/suivi" element={<Layout><StudentSuivi /></Layout>} />
	<Route path="/quiz/:quizId" element={<Layout><QuizPlayer /></Layout>} />
	<Route path="/parent/dashboard" element={
	  <ProtectedRoute allowedRoles={['parent', 'admin']}>
	    <Layout><ParentDashboard /></Layout>
	  </ProtectedRoute>
	} />
	
	{/* ========== PROF PROTÉGÉ ========== */}
        <Route path="/prof/dashboard" element={<ProfRoute><Layout><ProfDashboard /></Layout></ProfRoute>} />
        
	{/* ========== RÉSULTATS (placeholder) ========== */}
        <Route path="/admin/resultats" element={
          <AdminRoute>
            <AdminLayout>
              <div style={{padding:'3rem',textAlign:'center'}}>
                <h2>📈 Résultats des Quiz</h2>
                <p style={{color:'#6b7280',marginTop:'1rem'}}>Cette page sera bientôt disponible.</p>
              </div>
            </AdminLayout>
          </AdminRoute>
        } />

        {/* ========== ABONNÉS PREMIUM (placeholder) ========== */}
        <Route path="/admin/premium" element={
          <AdminRoute>
            <AdminLayout>
              <div style={{padding:'3rem',textAlign:'center'}}>
                <h2>⭐ Abonnés Premium</h2>
                <p style={{color:'#6b7280',marginTop:'1rem'}}>Cette page sera bientôt disponible.</p>
              </div>
            </AdminLayout>
          </AdminRoute>
        } />
	
	{/* ========== PARAMÈTRES (placeholder) ========== */}
        <Route path="/admin/settings" element={
          <AdminRoute>
            <AdminLayout>
              <div style={{padding:'3rem',textAlign:'center'}}>
                <h2>⚙️ Configuration</h2>
                <p style={{color:'#6b7280',marginTop:'1rem'}}>Cette page sera bientôt disponible.</p>
              </div>
            </AdminLayout>
          </AdminRoute>
        } />

        {/* ========== 404 ========== */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;

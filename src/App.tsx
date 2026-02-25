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
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage';
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

/* ==================== QUIZ — LISTE UTILISATEURS ==================== */
import QuizListPage from './pages/QuizListPage';
import QuizGratuitsPage from './pages/QuizGratuitsPage';

/* ==================== PHASE 21 — CAHIER DE TEXTES ==================== */
import CahierTextesPage from './pages/CahierTextesPage';
import CahierDetailPage from './pages/CahierDetailPage';
import EntreeEditorPage from './pages/EntreeEditorPage';

/*/* ==================== PHASE 23 — SÉQUENCES PÉDAGOGIQUES ==================== */import SequencesPage      from './pages/SequencesPage';import SequenceEditorPage from './pages/SequenceEditorPage';import SequenceDetailPage from './pages/SequenceDetailPage';/* ==================== PHASE 22 — VUE ÉLÈVE CAHIER ==================== */
import ElveCahierPage from './pages/ElveCahierPage';

/* ==================== COMPOSANTS PARENT ==================== */
import ParentDashboard from './components/parent/ParentDashboard';

/* ==================== GÉNÉRATEUR IA ==================== */
import AIGenerator from './components/generator/AIGenerator';

/* ==================== BIBLIOTHÈQUE EBOOKS ==================== */
import EbooksPage from './pages/EbooksPage';
import AdminEbooks from './pages/AdminEbooks';

/* ==================== PHASE 24 — COURS EN LIGNE ==================== */
import CoursPage       from './pages/CoursPage';
import CoursDetailPage from './pages/CoursDetailPage';
import CoursEditorPage from './pages/CoursEditorPage';
import ProfCoursPage   from './pages/ProfCoursPage';

/* ==================== PHASE 26 — NOTIFICATIONS ==================== */
import NotificationsPage    from './NotificationsPage';
import NotificationComposer from './NotificationComposer';

/* ==================== PWA INSTALL PROMPT ==================== */
import InstallPrompt from './components/InstallPrompt';
import NetworkIndicator from './components/NetworkIndicator';

// ==================== APPLICATION ====================

const App: React.FC = () => {
  return (
    <AuthProvider>
      <InstallPrompt />
      <NetworkIndicator />
      <Routes>

        {/* ========== PAGES PUBLIQUES (avec Header + Footer) ========== */}
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/disciplines" element={<Layout><DisciplinesPage /></Layout>} />
        <Route path="/disciplines/:id" element={<Layout><DisciplineDetail /></Layout>} />
        <Route path="/premium" element={<Layout><PremiumPage /></Layout>} />
        <Route path="/cours"                        element={<CoursPage />} />
        <Route path="/cours/:coursId"               element={<CoursDetailPage />} />
        <Route path="/prof/cours"                   element={<ProfCoursPage />} />
        <Route path="/prof/cours/nouveau"           element={<CoursEditorPage />} />
        <Route path="/prof/cours/:coursId/modifier" element={<CoursEditorPage />} />

        {/* ========== AUTH (sans Header/Footer) ========== */}
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/inscription" element={<RegisterPage />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />

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
	<Route path="/admin/ebooks" element={<AdminRoute><AdminLayout><AdminEbooks /></AdminLayout></AdminRoute>} />
        {/* ========== ABONNÉS PREMIUM → redirige vers Utilisateurs filtre premium ========== */}
        <Route path="/admin/premium" element={<Navigate to="/admin/utilisateurs?filter=premium" replace />} />

        {/* ========== QUIZ — LISTE + JOUEUR ========== */}
        <Route path="/quizzes" element={<ProtectedRoute allowedRoles={['eleve', 'prof', 'admin']}><Layout><QuizListPage /></Layout></ProtectedRoute>} />
        <Route path="/quiz/:quizId" element={<Layout><QuizPlayer /></Layout>} />
        <Route path="/quiz-avance/:quizId" element={<Layout><QuizPlayerPage /></Layout>} />
	<Route path="/quiz-gratuits" element={<Layout><QuizGratuitsPage /></Layout>} />
        {/* ========== ESPACE ÉLÈVE ========== */}
        <Route path="/eleve/dashboard" element={<Layout><StudentDashboard /></Layout>} />
        <Route path="/eleve/suivi" element={<Layout><StudentSuivi /></Layout>} />

        {/* ========== ESPACE PROFESSEUR ========== */}
        <Route path="/prof/dashboard" element={<ProfRoute><Layout><ProfDashboard /></Layout></ProfRoute>} />

	{/* ========== CAHIER DE TEXTES (Prof Premium) ========== */}
	<Route path="/prof/cahiers" element={<ProfRoute><Layout><CahierTextesPage /></Layout></ProfRoute>} />
	<Route path="/prof/cahiers/:cahierId" element={<ProfRoute><Layout><CahierDetailPage /></Layout></ProfRoute>} />
	<Route path="/prof/cahiers/:cahierId/nouvelle" element={<ProfRoute><Layout><EntreeEditorPage /></Layout></ProfRoute>} />
	<Route path="/prof/cahiers/:cahierId/modifier/:entreeId" element={<ProfRoute><Layout><EntreeEditorPage /></Layout></ProfRoute>} />	
	
	{/* ========== PHASE 23 — SÉQUENCES PÉDAGOGIQUES (Prof Premium) ==========  */}        <Route path="/prof/sequences" element={<ProfRoute><Layout><SequencesPage /></Layout></ProfRoute>} />        <Route path="/prof/sequences/nouvelle" element={<ProfRoute><Layout><SequenceEditorPage /></Layout></ProfRoute>} />        <Route path="/prof/sequences/:id" element={<ProfRoute><Layout><SequenceDetailPage /></Layout></ProfRoute>} />        <Route path="/prof/sequences/:id/modifier" element={<ProfRoute><Layout><SequenceEditorPage /></Layout></ProfRoute>} />
	{/* ========== PHASE 22 — CAHIER ÉLÈVE (lecture seule) ==========  */}
        <Route path="/eleve/cahiers/:cahierId" element={
          <ProtectedRoute allowedRoles={['eleve', 'admin']}>
            <Layout><ElveCahierPage /></Layout>
          </ProtectedRoute>
        } />	

        {/* ========== ESPACE PARENT ========== */}
        <Route path="/parent/dashboard" element={
          <ProtectedRoute allowedRoles={['parent', 'admin']}>
            <Layout><ParentDashboard /></Layout>
          </ProtectedRoute>
        } />
	
	{/* ========== GÉNÉRATEUR IA (Premium) ========== */}
        <Route path="/generateur" element={<Layout><AIGenerator /></Layout>} />	
	
	{/* ========== BIBLIOTHÈQUE EBOOKS ========== */}
        <Route path="/ebooks" element={<Layout><EbooksPage /></Layout>} />

        {/* ========== PHASE 24 — COURS EN LIGNE ========== */}
        <Route path="/cours" element={<Layout><CoursPage /></Layout>} />
        <Route path="/cours/:coursId" element={<Layout><CoursDetailPage /></Layout>} />
        <Route path="/prof/cours" element={<ProfRoute><Layout><ProfCoursPage /></Layout></ProfRoute>} />
        <Route path="/prof/cours/nouveau" element={<ProfRoute><Layout><CoursEditorPage /></Layout></ProfRoute>} />
        <Route path="/prof/cours/:coursId/modifier" element={<ProfRoute><Layout><CoursEditorPage /></Layout></ProfRoute>} />
	
	{/* ========== PHASE 26 — NOTIFICATIONS ========== */}
	<Route path="/notifications" element={
  	<ProtectedRoute allowedRoles={['eleve', 'prof', 'admin', 'parent']}>
    	<Layout><NotificationsPage /></Layout>
  	</ProtectedRoute>
	} />
	<Route path="/prof/notifications/nouvelle" element={
  	<ProfRoute><Layout><NotificationComposer /></Layout></ProfRoute>
	} />
	<Route path="/admin/notifications/nouvelle" element={
  	<AdminRoute><AdminLayout><NotificationComposer /></AdminLayout></AdminRoute>
	} />

        {/* ========== 404 → redirection accueil ========== */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AuthProvider>
  );
};

export default App;

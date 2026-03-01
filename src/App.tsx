/**
 * ============================================================================
 * APP.TSX - POINT D'ENTRÉE PRINCIPAL PEDACLIC
 * ============================================================================
 * Configuration du routing et structure de l'application.
 * Toutes les routes sont organisées par section :
 *   - Pages publiques (avec Header + Footer)
 *   - Authentification (sans Header/Footer)
 *   - Admin protégé (avec AdminLayout + sidebar)
 *   - Élève / Parent / Professeur
 *   - Premium (page + confirmation Moneroo)
 *   - Catch-all 404
 *
 * @author PedaClic Team
 * @version 2.2.0
 */

import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AdminRoute, ProfRoute, ProtectedRoute } from './contexts/AuthContext';

/* ==================== LAYOUT (Header + Footer) ==================== */
import Layout from './components/Layout';

/* ==================== PAGES PUBLIQUES ==================== */
import Home               from './pages/Home';
import DisciplinesPage    from './pages/DisciplinesPage';
import DisciplineDetail   from './pages/DisciplineDetail';

/* ==================== AUTH (sans Header/Footer) ==================== */
import LoginPage          from './pages/Auth/LoginPage';
import RegisterPage       from './pages/Auth/RegisterPage';
import ForgotPasswordPage from './pages/Auth/ForgotPasswordPage';

/* ==================== PREMIUM — MONEROO ==================== */
import PremiumPage             from './pages/PremiumPage';
import PremiumCoursChoicePage   from './pages/PremiumCoursChoicePage';
import PremiumConfirmationPage from './pages/PremiumConfirmationPage';

/* ==================== COMPOSANTS ADMIN ==================== */
import AdminLayout    from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import DisciplineManager from './components/admin/DisciplineManager';
import ChapitreManager   from './components/admin/ChapitreManager';
import ResourceManager   from './components/admin/ResourceManager';
import QuizManager       from './components/admin/QuizManager';
import UserManager       from './components/admin/UserManager';
import ResultsAdmin      from './components/admin/ResultsAdmin';
import SettingsAdmin     from './components/admin/SettingsAdmin';

/* ==================== PAGES QUIZ ==================== */
import QuizEditorPage   from './pages/QuizEditorPage';
import QuizAdvancedList from './pages/QuizAdvancedList';
import QuizPlayerPage   from './pages/QuizPlayerPage';
import QuizListPage     from './pages/QuizListPage';
import QuizGratuitsPage from './pages/QuizGratuitsPage';

/* ==================== COMPOSANTS ÉLÈVE ==================== */
import QuizPlayer       from './components/student/QuizPlayer';
import StudentDashboard from './components/student/StudentDashboard';
import StudentSuivi     from './components/student/StudentSuivi';

/* ==================== COMPOSANTS PROF ==================== */
import ProfDashboard from './components/prof/ProfDashboard';

/* ==================== PHASE 21 — CAHIER DE TEXTES ==================== */
import CahierTextesPage from './pages/CahierTextesPage';
import CahierDetailPage from './pages/CahierDetailPage';
import EntreeEditorPage from './pages/EntreeEditorPage';

/* ==================== PHASE 22 — VUE ÉLÈVE CAHIER ==================== */
import ElveCahierPage from './pages/ElveCahierPage';

/* ==================== PHASE 23 — SÉQUENCES PÉDAGOGIQUES ==================== */
import SequencesPage      from './pages/SequencesPage';
import SequenceEditorPage from './pages/SequenceEditorPage';
import SequenceDetailPage from './pages/SequenceDetailPage';

/* ==================== PHASE 24 — COURS EN LIGNE ==================== */
import CoursPage       from './pages/CoursPage';
import CoursDetailPage from './pages/CoursDetailPage';
import CoursEditorPage from './pages/CoursEditorPage';
import ProfCoursPage   from './pages/ProfCoursPage';

/* ==================== BIBLIOTHÈQUE EBOOKS ==================== */
import EbooksPage  from './pages/EbooksPage';
import AdminEbooks from './pages/AdminEbooks';

/* ==================== PHASE 27 — MÉDIATHÈQUE ==================== */
import MediathequePage from './pages/MediathequePage';
import MediaDetailPage from './pages/MediaDetailPage';
import MediaAjoutPage from './pages/MediaAjoutPage';

/* ==================== PHASE 26 — NOTIFICATIONS ==================== */
import NotificationsPage    from './NotificationsPage';
import NotificationComposer from './NotificationComposer';

/* ==================== COMPOSANTS PARENT ==================== */
import ParentDashboard from './components/parent/ParentDashboard';

/* ==================== GÉNÉRATEUR IA ==================== */
import AIGenerator from './components/generator/AIGenerator';

/* ==================== PWA ==================== */
import InstallPrompt    from './components/InstallPrompt';
import NetworkIndicator from './components/NetworkIndicator';

/* ==================== GÉNÉRATEUR IA — KEEP-ALIVE ==================== */
import { pingServeurIA } from './services/aiGeneratorService';

// ==================== APPLICATION ====================

const App: React.FC = () => {

  // Maintient le serveur IA Railway éveillé (évite le cold-start).
  useEffect(() => {
    pingServeurIA();
    const interval = setInterval(pingServeurIA, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AuthProvider>
      <InstallPrompt />
      <NetworkIndicator />
      <Routes>

        {/* ========== PAGES PUBLIQUES (avec Header + Footer) ========== */}
        <Route path="/"              element={<Layout><Home /></Layout>} />
        <Route path="/disciplines"   element={<Layout><DisciplinesPage /></Layout>} />
        <Route path="/disciplines/:id" element={<Layout><DisciplineDetail /></Layout>} />
        <Route path="/quiz-gratuits" element={<Layout><QuizGratuitsPage /></Layout>} />
        <Route path="/ebooks"        element={<Layout><EbooksPage /></Layout>} />
        <Route path="/mediatheque"   element={<Layout><MediathequePage /></Layout>} />
        <Route path="/mediatheque/ajouter" element={
          <ProtectedRoute allowedRoles={['admin', 'prof']}>
            <Layout><MediaAjoutPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/mediatheque/:mediaId" element={<Layout><MediaDetailPage /></Layout>} />

        {/* ========== COURS EN LIGNE (public — lecture) ========== */}
        <Route path="/cours"          element={<Layout><CoursPage /></Layout>} />
        <Route path="/cours/:coursId" element={<Layout><CoursDetailPage /></Layout>} />

        {/* ========== AUTH (sans Header/Footer) ========== */}
        <Route path="/connexion"           element={<LoginPage />} />
        <Route path="/inscription"         element={<RegisterPage />} />
        <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />

        {/* ========== PREMIUM — MONEROO ========== */}
        {/* /premium/confirmation doit être déclaré AVANT /premium (route plus spécifique) */}
        <Route path="/premium/confirmation" element={<PremiumConfirmationPage />} />
        <Route path="/premium/mes-cours"    element={<Layout><PremiumCoursChoicePage /></Layout>} />
        <Route path="/premium"              element={<Layout><PremiumPage /></Layout>} />

        {/* ========== QUIZ — LISTE + JOUEUR ========== */}
        <Route path="/quizzes" element={
          <ProtectedRoute allowedRoles={['eleve', 'prof', 'admin']}>
            <Layout><QuizListPage /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/quiz/:quizId"        element={<Layout><QuizPlayer /></Layout>} />
        <Route path="/quiz-avance/:quizId" element={<Layout><QuizPlayerPage /></Layout>} />

        {/* ========== GÉNÉRATEUR IA (Premium) ========== */}
        <Route path="/generateur" element={<Layout><AIGenerator /></Layout>} />

        {/* ========== ESPACE ÉLÈVE ========== */}
        <Route path="/eleve/dashboard" element={<Layout><StudentDashboard /></Layout>} />
        <Route path="/eleve/suivi"     element={<Layout><StudentSuivi /></Layout>} />

        {/* ========== CAHIER ÉLÈVE (lecture seule) ========== */}
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

        {/* ========== ESPACE PROFESSEUR ========== */}
        <Route path="/prof/dashboard" element={
          <ProfRoute><Layout><ProfDashboard /></Layout></ProfRoute>
        } />

        {/* ========== CAHIER DE TEXTES (Prof Premium) ========== */}
        <Route path="/prof/cahiers" element={
          <ProfRoute><Layout><CahierTextesPage /></Layout></ProfRoute>
        } />
        <Route path="/prof/cahiers/:cahierId" element={
          <ProfRoute><Layout><CahierDetailPage /></Layout></ProfRoute>
        } />
        <Route path="/prof/cahiers/:cahierId/nouvelle" element={
          <ProfRoute><Layout><EntreeEditorPage /></Layout></ProfRoute>
        } />
        <Route path="/prof/cahiers/:cahierId/modifier/:entreeId" element={
          <ProfRoute><Layout><EntreeEditorPage /></Layout></ProfRoute>
        } />

        {/* ========== SÉQUENCES PÉDAGOGIQUES (Prof Premium) ========== */}
        <Route path="/prof/sequences" element={
          <ProfRoute><Layout><SequencesPage /></Layout></ProfRoute>
        } />
        <Route path="/prof/sequences/nouvelle" element={
          <ProfRoute><Layout><SequenceEditorPage /></Layout></ProfRoute>
        } />
        <Route path="/prof/sequences/:id" element={
          <ProfRoute><Layout><SequenceDetailPage /></Layout></ProfRoute>
        } />
        <Route path="/prof/sequences/:id/modifier" element={
          <ProfRoute><Layout><SequenceEditorPage /></Layout></ProfRoute>
        } />

        {/* ========== COURS EN LIGNE — GESTION ========== */}
        <Route path="/prof/cours" element={
          <ProfRoute><Layout><ProfCoursPage /></Layout></ProfRoute>
        } />
        {/* Création et modification réservées aux admins */}
        <Route path="/prof/cours/nouveau" element={
          <AdminRoute><Layout><CoursEditorPage /></Layout></AdminRoute>
        } />
        <Route path="/prof/cours/:coursId/modifier" element={
          <AdminRoute><Layout><CoursEditorPage /></Layout></AdminRoute>
        } />

        {/* ========== ADMIN PROTÉGÉ (avec AdminLayout + sidebar) ========== */}
        <Route path="/admin" element={
          <AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/disciplines" element={
          <AdminRoute><AdminLayout><DisciplineManager /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/chapitres" element={
          <AdminRoute><AdminLayout><ChapitreManager /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/ressources" element={
          <AdminRoute><AdminLayout><ResourceManager /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/quiz" element={
          <AdminRoute><AdminLayout><QuizManager /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/quiz/nouveau" element={
          <AdminRoute><AdminLayout><QuizEditorPage /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/quiz/modifier/:quizId" element={
          <AdminRoute><AdminLayout><QuizEditorPage /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/quiz-avance" element={
          <AdminRoute><AdminLayout><QuizAdvancedList /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/utilisateurs" element={
          <AdminRoute><AdminLayout><UserManager /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/resultats" element={
          <AdminRoute><AdminLayout><ResultsAdmin /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/settings" element={
          <AdminRoute><AdminLayout><SettingsAdmin /></AdminLayout></AdminRoute>
        } />
        <Route path="/admin/ebooks" element={
          <AdminRoute><AdminLayout><AdminEbooks /></AdminLayout></AdminRoute>
        } />
        {/* Abonnés premium → redirige vers Utilisateurs avec filtre */}
        <Route path="/admin/premium" element={
          <Navigate to="/admin/utilisateurs?filter=premium" replace />
        } />

        {/* ========== NOTIFICATIONS (Phase 26) ========== */}
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

        {/* ========== ALIAS DE COMMODITÉ ========== */}
        {/* /cahiers → /prof/cahiers (évite la redirection vers l'accueil) */}
        <Route path="/cahiers"    element={<Navigate to="/prof/cahiers"    replace />} />
        <Route path="/sequences"  element={<Navigate to="/prof/sequences"  replace />} />

        {/* ========== 404 → redirection accueil ========== */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </AuthProvider>
  );
};

export default App;

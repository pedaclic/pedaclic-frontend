/**
 * ============================================
 * APP.TSX - Point d'Entrée Principal PedaClic
 * ============================================
 * 
 * Configuration du routing React Router avec :
 * - Routes publiques (accueil, disciplines, login, register)
 * - Routes protégées (dashboard, quiz, admin)
 * - Layout wrapper avec Header/Footer
 * - Gestion des erreurs 404
 * 
 * @author PedaClic Team
 * @version 2.0.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components';

// ==================== IMPORT DES PAGES ====================
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Disciplines from './pages/Disciplines';
import NotFound from './pages/NotFound';

// Pages à créer plus tard
// import Quiz from './pages/Quiz';
// import Premium from './pages/Premium';
// import Profile from './pages/Profile';
// import AdminDisciplines from './pages/admin/AdminDisciplines';

/* ==================== COMPOSANT ROUTE PROTÉGÉE ==================== */

/**
 * Composant pour protéger les routes qui nécessitent une authentification
 * Redirige vers /login si l'utilisateur n'est pas connecté
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  requirePremium?: boolean;
  requireRole?: ('admin' | 'prof' | 'eleve')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requirePremium = false,
  requireRole = []
}) => {
  const { currentUser, loading } = useAuth();

  // Afficher un loader pendant la vérification
  if (loading) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement...</p>
        </div>
      </Layout>
    );
  }

  // Rediriger vers login si non connecté
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Vérifier le statut Premium si requis
  if (requirePremium && !currentUser.isPremium) {
    return <Navigate to="/premium" replace />;
  }

  // Vérifier le rôle si requis
  if (requireRole.length > 0 && !requireRole.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/* ==================== COMPOSANT ROUTE INVITÉ ==================== */

/**
 * Composant pour les routes accessibles uniquement aux utilisateurs non connectés
 * Redirige vers /dashboard si l'utilisateur est connecté
 */
interface GuestRouteProps {
  children: React.ReactNode;
}

const GuestRoute: React.FC<GuestRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  // Afficher un loader pendant la vérification
  if (loading) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Chargement...</p>
        </div>
      </Layout>
    );
  }

  // Rediriger vers dashboard si connecté
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/* ==================== COMPOSANT ROUTES ==================== */

/**
 * Configuration des routes de l'application
 */
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* ===== ROUTES PUBLIQUES ===== */}
      
      {/* Page d'accueil */}
      <Route
        path="/"
        element={
          <Layout>
            <Home />
          </Layout>
        }
      />

      {/* Page des disciplines (accessible à tous) */}
      <Route
        path="/disciplines"
        element={
          <Layout>
            <Disciplines />
          </Layout>
        }
      />

      {/* Page discipline détaillée (à créer) */}
      {/* <Route
        path="/disciplines/:id"
        element={
          <Layout>
            <DisciplineDetail />
          </Layout>
        }
      /> */}

      {/* ===== ROUTES INVITÉ (non connecté) ===== */}
      
      {/* Page de connexion */}
      <Route
        path="/login"
        element={
          <GuestRoute>
            <Layout>
              <Login />
            </Layout>
          </GuestRoute>
        }
      />

      {/* Page d'inscription */}
      <Route
        path="/register"
        element={
          <GuestRoute>
            <Layout>
              <Register />
            </Layout>
          </GuestRoute>
        }
      />

      {/* ===== ROUTES PROTÉGÉES (connecté) ===== */}
      
      {/* Tableau de bord */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Quiz Premium (à créer) */}
      {/* <Route
        path="/quiz"
        element={
          <ProtectedRoute requirePremium>
            <Layout>
              <Quiz />
            </Layout>
          </ProtectedRoute>
        }
      /> */}

      {/* Page Premium (abonnement) (à créer) */}
      {/* <Route
        path="/premium"
        element={
          <ProtectedRoute>
            <Layout>
              <Premium />
            </Layout>
          </ProtectedRoute>
        }
      /> */}

      {/* Profil utilisateur (à créer) */}
      {/* <Route
        path="/profil"
        element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      /> */}

      {/* ===== ROUTES ADMIN ===== */}
      
      {/* Administration des disciplines (à créer) */}
      {/* <Route
        path="/admin/disciplines"
        element={
          <ProtectedRoute requireRole={['admin']}>
            <Layout>
              <AdminDisciplines />
            </Layout>
          </ProtectedRoute>
        }
      /> */}

      {/* ===== ROUTE 404 ===== */}
      <Route
        path="*"
        element={
          <Layout>
            <NotFound />
          </Layout>
        }
      />
    </Routes>
  );
};

/* ==================== COMPOSANT APP PRINCIPAL ==================== */

/**
 * Composant App principal
 * Enveloppe l'application avec les providers nécessaires
 */
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

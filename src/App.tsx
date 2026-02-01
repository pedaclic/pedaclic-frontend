/**
 * COMPOSANT PRINCIPAL - PedaClic
 * Configuration des routes et layout de l'application
 * 
 * Structure des routes :
 * - / : Page d'accueil
 * - /disciplines : Liste des disciplines
 * - /disciplines/:id : Détail d'une discipline
 * - /ressource/:id : Détail d'une ressource
 * - /premium : Page d'abonnement Premium
 * - /premium/success : Confirmation de paiement
 * - /premium/cancel : Annulation de paiement
 * - /connexion : Page de connexion
 * - /inscription : Page d'inscription
 * - /mot-de-passe-oublie : Réinitialisation mot de passe
 * - /dashboard : Tableau de bord utilisateur (protégé)
 * - /admin : Panneau d'administration (protégé, admin uniquement)
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// ==================== CONTEXTES ====================
import { AuthProvider } from './hooks/useAuth';

// ==================== COMPOSANTS LAYOUT ====================
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import PrivateRoute from './components/auth/PrivateRoute';

// ==================== PAGES PUBLIQUES ====================
import HomePage from './pages/Home';
import DisciplinesPage from './pages/DisciplinesPage';
import DisciplineDetailPage from './pages/DisciplineDetail';
// import ResourceDetailPage from './pages/resources/ResourceDetailPage'; // À créer

// ==================== PAGES PREMIUM ====================
import PremiumPage from './pages/Premium/PremiumPage';
import LoginPage from "./pages/Auth/LoginPage";
import RegisterPage from "./pages/Auth/RegisterPage";
import SeedPage from "./pages/SeedPage";
import PaymentSuccessPage from './pages/PaymentSuccessPage';
import PaymentCancelPage from './pages/PaymentCancelPage';

// ==================== PAGES AUTHENTIFICATION ====================
// import LoginPage from './pages/auth/LoginPage';           // Existant
// import RegisterPage from './pages/auth/RegisterPage';     // Existant
// import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'; // Existant

// ==================== PAGES PROTÉGÉES ====================
// import DashboardPage from './pages/dashboard/DashboardPage'; // À créer
// import AdminPage from './pages/admin/AdminPage';             // À créer

// ==================== STYLES GLOBAUX ====================
import './globals.css';

/**
 * Composant Layout principal
 * Enveloppe les pages avec Navbar et Footer
 */
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app">
      {/* Barre de navigation */}
      <Navbar />
      
      {/* Contenu principal */}
      <main className="main-content">
        {children}
      </main>
      
      {/* Pied de page */}
      <Footer />
    </div>
  );
};

/**
 * Composant App principal
 */
const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <Routes>
            {/* ========== ROUTES PUBLIQUES ========== */}
            
            {/* Page d'accueil */}
            <Route path="/" element={<HomePage />} />
            
            {/* Liste des disciplines */}
            <Route path="/disciplines" element={<DisciplinesPage />} />
            
            {/* Détail d'une discipline */}
            <Route path="/disciplines/:id" element={<DisciplineDetailPage />} />
            
            {/* Détail d'une ressource */}
            {/* <Route path="/ressource/:id" element={<ResourceDetailPage />} /> */}
            
            {/* ========== ROUTES PREMIUM ========== */}
            
            {/* Page d'abonnement Premium */}
            <Route path="/premium" element={<PremiumPage />} />
            
            {/* Confirmation de paiement */}
            <Route path="/premium/success" element={<PaymentSuccessPage />} />
            
            {/* Annulation de paiement */}
            <Route path="/premium/cancel" element={<PaymentCancelPage />} />
            
            {/* ========== ROUTES AUTHENTIFICATION ========== */}
            
            {/* Connexion */}
            <Route path="/connexion" element={<LoginPage />} />
            
            {/* Inscription */}
            <Route path="/inscription" element={<RegisterPage />} />
            
            {/* Mot de passe oublié */}
            {/* <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} /> */}
            
            {/* ========== ROUTES PROTÉGÉES ========== */}
            
            {/* Tableau de bord utilisateur */}
            {/* 
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute>
                  <DashboardPage />
                </PrivateRoute>
              } 
            />
            */}
            
            {/* Panneau d'administration */}
            {/* 
            <Route 
              path="/admin/*" 
              element={
                <PrivateRoute requiredRole="admin">
                  <AdminPage />
                </PrivateRoute>
              } 
            />
            */}
            
            {/* Espace professeur */}
            {/* 
            <Route 
              path="/prof/*" 
              element={
                <PrivateRoute requiredRole="prof">
                  <ProfPage />
                </PrivateRoute>
              } 
            />
            */}
            
            <Route path="/admin/seed" element={<SeedPage />} />
            {/* ========== ROUTE 404 ========== */}
            <Route 
              path="*" 
              element={
                <div className="not-found">
                  <div className="container">
                    <h1>404</h1>
                    <p>Page non trouvée</p>
                    <a href="/" className="btn btn--primary">
                      Retour à l'accueil
                    </a>
                  </div>
                </div>
              } 
            />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
};

export default App;

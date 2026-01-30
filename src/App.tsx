/**
 * Composant App Principal - PedaClic
 * Configuration du routing et des providers
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';

// Import des pages
import { Home } from './pages';
import { Login } from './pages';
import { Register } from './pages';
import { Dashboard } from './pages';
import { NotFound } from './pages';

/**
 * Composant principal de l'application
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Routes publiques */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Routes protégées */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Route 404 */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

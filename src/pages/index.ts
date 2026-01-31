/**
 * ============================================
 * EXPORTS DES PAGES PEDACLIC
 * ============================================
 * 
 * Point d'entrée centralisé pour toutes les pages.
 * 
 * Usage:
 * import { Home, Login, Register, Dashboard } from './pages';
 * 
 * @author PedaClic Team
 * @version 2.0.0
 */

// ==================== PAGES PUBLIQUES ====================
export { default as Home } from './Home';
export { default as Disciplines } from './Disciplines';
export { default as NotFound } from './NotFound';

// ==================== PAGES AUTH ====================
export { default as Login } from './Login';
export { default as Register } from './Register';

// ==================== PAGES PROTÉGÉES ====================
export { default as Dashboard } from './Dashboard';

// ==================== PAGES À VENIR ====================
// export { default as Quiz } from './Quiz';
// export { default as Premium } from './Premium';
// export { default as Profile } from './Profile';
// export { default as DisciplineDetail } from './DisciplineDetail';

// ==================== PAGES ADMIN ====================
// export { default as AdminDisciplines } from './admin/AdminDisciplines';
// export { default as AdminResources } from './admin/AdminResources';
// export { default as AdminUsers } from './admin/AdminUsers';

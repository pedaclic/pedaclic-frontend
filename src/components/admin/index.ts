/**
 * ============================================================================
 * INDEX DES COMPOSANTS ADMIN - PedaClic
 * ============================================================================
 * Point d'entrée pour tous les composants d'administration
 * 
 * @author PedaClic Team
 * @version 1.0.0
 */

// ==================== LAYOUTS ====================
export { default as AdminLayout } from './AdminLayout';

// ==================== PAGES ADMIN ====================
export { default as AdminDashboard } from './AdminDashboard';
export { default as DisciplineManager } from './DisciplineManager';
export { default as ChapitreManager } from './ChapitreManager';
export { default as ResourceManager } from './ResourceManager';
export { default as QuizManager } from './QuizManager';
export { default as UserManager } from './UserManager';

// ==================== TYPES RÉEXPORTÉS ====================
// Pour faciliter l'utilisation dans d'autres parties de l'application
export type { Chapitre, ChapitreFormData } from '../../services/chapitreService';
export type { Resource, ResourceFormData, ResourceType } from '../../services/resourceService';

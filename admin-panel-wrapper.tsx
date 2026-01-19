// Déclarer les globals du navigateur
declare const React: any;
declare const ReactDOM: any;
declare const Recharts: any;
declare const lucideReact: any;
declare const firebase: any;

// Importer le composant (sera remplacé par le contenu réel)
import AdminPanel from './pedaclic-admin-panel';

// Exporter vers le global
(window as any).AdminPanel = AdminPanel;

// Monter automatiquement
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(AdminPanel));

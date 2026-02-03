import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Import des styles
import './globals.css';
import './styles/admin.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("L'élément #root n'existe pas");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
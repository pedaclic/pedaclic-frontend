import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),

    // ============================================
    // PLUGIN PWA — Service Worker avec Workbox
    // ============================================
    VitePWA({
      // --- Génération automatique du SW par Workbox ---
      strategies: 'generateSW',

      // --- Enregistrement automatique du SW ---
      injectRegister: 'auto',

      // --- Mise à jour automatique sans prompt ---
      registerType: 'autoUpdate',

      // --- Inclure les assets statiques dans le précache ---
      includeAssets: [
        'icons/*.png',
        'manifest.json'
      ],

      // --- On utilise notre propre manifest.json dans public/ ---
      manifest: false,

      // --- Configuration Workbox ---
      workbox: {
        // Types de fichiers à précacher
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'
        ],

        // --- Stratégies de cache runtime ---
        runtimeCaching: [
          // 1. Google Fonts — Cache First (ne changent jamais)
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          // 2. Firebase/Firestore — Network First
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },

          // 3. Firebase Auth — Network First
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-auth-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          // 4. API Railway (IA Generator) — Network First
          {
            urlPattern: /^https:\/\/.*\.railway\.app\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'railway-api-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 10,
            },
          },

          // 5. Images externes — Stale While Revalidate
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },

      // --- Désactivé en développement ---
      devOptions: {
        enabled: false,
      },
    }),
  ],

  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

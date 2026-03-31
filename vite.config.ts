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
      strategies: 'generateSW',
      injectRegister: 'auto',
      registerType: 'autoUpdate',

      // --- Assets à inclure dans le précache ---
      includeAssets: [
        'icons/*.png',
        'manifest.json',
        'offline.html'
      ],

      // --- Notre propre manifest.json ---
      manifest: false,

      // --- Configuration Workbox ---
      workbox: {
        mode: 'development',

        // Limite de taille des fichiers précachés (défaut Workbox : 2 MiB)
        // Augmentée à 3 MiB pour couvrir le bundle principal de PedaClic
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

        // Types de fichiers à précacher
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'
        ],
        // index.html doit être précaché : sinon Workbox lève
        // "createHandlerBoundToURL('/index.html') … not precached" (navigateFallback).
        globIgnores: ['**/node_modules/**/*'],

        // --- Page de secours hors-ligne ---
        // Si une page n'est pas en cache ET pas de réseau → offline.html
        navigateFallback: '/index.html',

        // --- Exclure les routes API du fallback navigation ---
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/__(.*)/
        ],

        // --- Stratégies de cache runtime ---
        runtimeCaching: [
          // 1. Google Fonts — Cache First
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

          // 2. Firebase/Firestore — NE PAS intercepter
          // Firestore utilise sa propre persistance IndexedDB (persistentLocalCache).
          // Intercepter les requêtes Firestore via le SW :
          //   - corrompt les headers App Check (token non transmis)
          //   - casse le long-polling (erreurs 400)
          //   - crée un double cache redondant
          // → On laisse le SDK Firebase gérer seul ses requêtes.

          // 3. Firebase Auth — NE PAS intercepter
          // Les requêtes Auth (identitytoolkit, securetoken) transportent
          // des tokens sensibles que le SW ne doit pas mettre en cache.

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

          // 4b. API publique PedaClic — jamais de cache (POST /api/generate, etc.)
          {
            urlPattern: /^https:\/\/api\.pedaclic\.sn\/.*/i,
            handler: 'NetworkOnly',
          },

          // 5. Firebase Storage — NE PAS intercepter
          // Même en NetworkOnly, le SW intercepte la requête et peut
          // altérer les headers App Check sur les requêtes cross-origin.
          // Sans règle → le navigateur fait la requête directement,
          // tous les headers (App Check, Range, Auth) sont préservés.

          // 6. Images — Stale While Revalidate
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
    // --- Code splitting pour réduire la taille du bundle ---
    rollupOptions: {
      output: {
        manualChunks: {
          // Séparer React et ses dépendances
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Séparer Firebase (lourd) — app-check inclus (Phase 28)
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/app-check'],
          // Séparer les icônes Lucide
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
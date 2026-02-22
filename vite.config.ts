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

        // Types de fichiers à précacher
        skipWaiting: true,
	clientsClaim: true,
	globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'
        ],

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

          // 5. Images — Stale While Revalidate
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
          // Séparer Firebase (lourd)
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          // Séparer les icônes Lucide
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});

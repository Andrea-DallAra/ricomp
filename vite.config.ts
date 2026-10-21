import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base relativo: funziona sia su GitHub Pages (/nome-repo/) sia in locale
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      injectManifest: { rollupFormat: 'iife', globPatterns: ['**/*.{js,css,html,svg,png}', '**/*latin*.woff2'] },
      manifest: {
        name: 'Ricomp — allenamento e dieta',
        short_name: 'Ricomp',
        description: 'Diario di allenamento, dieta, spesa e progressi',
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0E1110',
        theme_color: '#0E1110',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Registra pasto', url: './#/dieta', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Allenamento', url: './#/allenamento', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] }
        ]
      }
    })
  ]
});

/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Phase 10 T1 — offline-first PWA (everything is static).
    VitePWA({
      registerType: 'prompt', // update toast asks; no silent reloads mid-setup
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Feeds & Speeds',
        short_name: 'Feeds&Speeds',
        description:
          'CNC speeds & feeds calculator — milling, drilling, turning. Works offline.',
        theme_color: '#14191b',
        background_color: '#14191b',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // hash-fragment share links must always resolve to the app shell
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
    environment: 'node',
  },
});

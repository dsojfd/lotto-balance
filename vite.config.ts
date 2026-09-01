import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';

export const pwaOptions = {
  registerType: 'autoUpdate',
  manifest: false,
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
    cleanupOutdatedCaches: true,
    runtimeCaching: [{
      urlPattern: /\/data\/.*\.json$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'lotto-public-data-v1',
        cacheableResponse: { statuses: [200] },
        expiration: { maxEntries: 10 },
      },
    }],
  },
} satisfies Partial<VitePWAOptions>;

export default defineConfig({
  base: './',
  plugins: [react(), VitePWA(pwaOptions)],
});

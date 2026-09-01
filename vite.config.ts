import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';

export const installManifest = {
  name: '로또 밸런스',
  short_name: '로또',
  description: '기기 안에 저장하는 로또 조합 생성·검증 도구',
  lang: 'ko-KR',
  display: 'standalone',
  start_url: './',
  scope: './',
  theme_color: '#265ce5',
  background_color: '#f5f7fb',
  icons: [
    {
      src: 'icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: 'icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
} as const;

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

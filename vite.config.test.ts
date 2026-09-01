import { describe, expect, it } from 'vitest';
import { installManifest, pwaOptions } from './vite.config';

describe('PWA configuration', () => {
  it('uses auto-update and an installable Korean manifest', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate');
    expect(pwaOptions.manifest).toBe(false);
    expect(installManifest).toMatchObject({
      name: '로또 밸런스',
      short_name: '로또',
      display: 'standalone',
      start_url: './',
      scope: './',
    });
  });

  it('keeps project-base data JSON responses with bounded count and no age expiry', () => {
    const rule = pwaOptions.workbox?.runtimeCaching?.[0];
    expect(rule?.urlPattern).toEqual(/\/data\/.*\.json$/);
    expect(rule?.handler).toBe('NetworkFirst');
    expect(rule?.options?.expiration?.maxEntries).toBeGreaterThanOrEqual(3);
    expect(rule?.options?.expiration).not.toHaveProperty('maxAgeSeconds');
  });
});

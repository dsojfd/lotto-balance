import { describe, expect, it } from 'vitest';
import { pwaOptions } from './vite.config';

describe('PWA configuration', () => {
  it('uses auto-update while the public manifest remains the single install authority', () => {
    expect(pwaOptions.registerType).toBe('autoUpdate');
    expect(pwaOptions.manifest).toBe(false);
  });

  it('keeps project-base data JSON responses with bounded count and no age expiry', () => {
    const rule = pwaOptions.workbox?.runtimeCaching?.[0];
    expect(rule?.urlPattern).toEqual(/\/data\/.*\.json$/);
    expect(rule?.handler).toBe('NetworkFirst');
    expect(rule?.options?.expiration?.maxEntries).toBeGreaterThanOrEqual(3);
    expect(rule?.options?.expiration).not.toHaveProperty('maxAgeSeconds');
  });
});

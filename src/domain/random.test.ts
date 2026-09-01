import { describe, expect, it } from 'vitest';
import { CryptoRandomSource, SeededRandomSource } from './random';

describe('SeededRandomSource', () => {
  it('produces a deterministic Mulberry32 sequence', () => {
    const source = new SeededRandomSource(12345);

    expect([source.nextInt(2 ** 32), source.nextInt(2 ** 32), source.nextInt(2 ** 32)])
      .toEqual([4207900869, 1317490944, 2079646450]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32 + 1])(
    'rejects invalid maxExclusive bound %s',
    (bound) => {
      expect(() => new SeededRandomSource(1).nextInt(bound)).toThrow(RangeError);
    },
  );

  it('accepts the full Uint32 range', () => {
    const value = new SeededRandomSource(1).nextInt(2 ** 32);

    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(2 ** 32);
  });
});

describe('CryptoRandomSource', () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32 + 1])(
    'rejects invalid maxExclusive bound %s',
    (bound) => {
      expect(() => new CryptoRandomSource().nextInt(bound)).toThrow(RangeError);
    },
  );

  it('rejects the incomplete Uint32 tail before taking the remainder', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const values = [0xFFFF_FFFA, 12];

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues(array: Uint32Array) {
          array[0] = values.shift()!;
          return array;
        },
      },
    });

    try {
      expect(new CryptoRandomSource().nextInt(10)).toBe(2);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  });

  it('throws when browser crypto is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });

    try {
      expect(() => new CryptoRandomSource().nextInt(10)).toThrow('안전한 난수를 사용할 수 없습니다.');
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  });
});

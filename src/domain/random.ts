const UINT32_RANGE = 0x1_0000_0000;

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

function validateMaxExclusive(maxExclusive: number): void {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > UINT32_RANGE) {
    throw new RangeError('maxExclusive must be an integer between 1 and 2^32.');
  }
}

function unbiasedInt(nextUint32: () => number, maxExclusive: number): number {
  validateMaxExclusive(maxExclusive);

  // Discard the incomplete tail so each result has the same number of source values.
  const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  let value: number;
  do {
    value = nextUint32();
  } while (value >= limit);
  return value % maxExclusive;
}

export class CryptoRandomSource implements RandomSource {
  nextInt(maxExclusive: number): number {
    validateMaxExclusive(maxExclusive);

    const cryptoSource = globalThis.crypto;
    if (!cryptoSource || typeof cryptoSource.getRandomValues !== 'function') {
      throw new Error('안전한 난수를 사용할 수 없습니다.');
    }

    const value = new Uint32Array(1);
    return unbiasedInt(() => cryptoSource.getRandomValues(value)[0], maxExclusive);
  }
}

/**
 * Mulberry32 is deterministic and intended only for tests and backtests.
 * Live recommendation APIs must explicitly use CryptoRandomSource instead.
 */
export class SeededRandomSource implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  private nextUint32(): number {
    let value = (this.state + 0x6D2B79F5) >>> 0;
    this.state = value;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  nextInt(maxExclusive: number): number {
    return unbiasedInt(() => this.nextUint32(), maxExclusive);
  }
}

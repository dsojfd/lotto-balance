# Task 5: Secure Uniform Generator

## Implementation

- Added `src/domain/random.ts` with the `RandomSource` interface, browser `CryptoRandomSource`, and documented Mulberry32 `SeededRandomSource` for tests/backtests.
- Both sources validate `nextInt(maxExclusive)` as an integer in `1..2^32`, including support for the full `2^32` bound.
- `CryptoRandomSource` uses Uint32 rejection sampling, never `Math.random`, and throws `안전한 난수를 사용할 수 없습니다.` when browser crypto is unavailable.
- Added `src/domain/generator.ts` with six-number Fisher-Yates sampling without replacement and sorted ascending output.
- Portfolio generation deduplicates by the domain `combinationKey`; partial number overlap remains allowed.

## TDD evidence

RED was captured before production implementation with:

```text
npm test -- src/domain/random.test.ts src/domain/generator.random.test.ts
```

The two suites failed to resolve the missing `./random` and `./generator` modules (0 tests), which was the expected pre-implementation failure.

GREEN after implementation:

```text
npm test -- src/domain/random.test.ts src/domain/generator.random.test.ts
Test Files  2 passed (2)
Tests       19 passed (19)
```

The tests cover deterministic Mulberry32 output, invalid bounds including non-integers/non-positive values/NaN/infinity/greater-than-`2^32`, full-range support, crypto rejection sampling, unavailable crypto, sorted unique in-range combinations, portfolio uniqueness, and fresh source consumption.

## Verification

Commands run from `C:\Users\Y\Documents\로또\.worktrees\lotto-webapp`:

```text
npm test -- src/domain/random.test.ts src/domain/generator.random.test.ts
exit 0; Test Files 2 passed (2); Tests 19 passed (19)

npm test
exit 0; Test Files 7 passed (7); Tests 62 passed (62)

npm run typecheck
exit 0; tsc --noEmit

npm run build
exit 0; vite v8.2.2; 15 modules transformed; build completed in 98ms

git diff --check
exit 0
```

Each npm invocation printed the existing PowerShell `npm.ps1` warning about denied access to `C:\Users\Y\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js`; npm then ran normally and the commands exited successfully.

## Files changed

- `src/domain/random.ts`
- `src/domain/random.test.ts`
- `src/domain/generator.ts`
- `src/domain/generator.random.test.ts`
- `.superpowers/sdd/2026-09-01-lotto-webapp/task-5-report.md`

## Self-review

- No UI behavior or live recommendation wiring was changed.
- No automatic fallback to seeded randomness or `Math.random` exists.
- The rejection-sampling limit is calculated from the exact Uint32 domain, so `2^32` remains valid.
- Portfolio uniqueness is enforced by canonical combination keys while allowing shared numbers between different combinations.
- The implementation uses only the required domain draw interfaces and has no external dependencies.

## Concerns

- `generateRandomPortfolio` assumes a supplied source eventually yields a new combination; a deliberately constant source would not terminate. This is appropriate for the contract's real random sources, but callers should not pass a degenerate source.
- The PowerShell npm wrapper warning is environmental and did not affect exit status or verification results.

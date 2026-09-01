import type { Combination, Draw } from './draw';

export type WindowName = 'all' | '10' | '30' | '50' | '100';
export type FixedSection = '1-10' | '11-20' | '21-30' | '31-40' | '41-45';

export interface Shape {
  oddCount: number;
  lowCount: number;
  sum: number;
  range: number;
  sectionCount: number;
  adjacentPairs: number;
  duplicateEndings: number;
}

export interface NumberAnalysis {
  number: number;
  appearances: number;
  expected: number;
  delta: number;
  absence: number;
}

export type Histogram = Record<string, number>;

export interface AnalysisWindow {
  drawCount: number;
  numbers: NumberAnalysis[];
  shapeHistograms: Record<keyof Shape, Histogram>;
  fixedSectionCounts: Record<FixedSection, Histogram>;
  pairCounts: Record<string, number>;
  pairSampleSize: number;
  previousDrawReuse: Record<string, number>;
  previousDrawReuseSampleSize: number;
}

export interface AnalysisReport {
  windows: Record<WindowName, AnalysisWindow>;
}

const WINDOW_SIZES: Record<Exclude<WindowName, 'all'>, number> = {
  '10': 10,
  '30': 30,
  '50': 50,
  '100': 100,
};

const FIXED_SECTIONS: readonly FixedSection[] = ['1-10', '11-20', '21-30', '31-40', '41-45'];

function increment(counts: Histogram, value: string | number): void {
  const key = String(value);
  counts[key] = (counts[key] ?? 0) + 1;
}

function sectionFor(number: number): FixedSection {
  if (number <= 10) return '1-10';
  if (number <= 20) return '11-20';
  if (number <= 30) return '21-30';
  if (number <= 40) return '31-40';
  return '41-45';
}

export function extractShape(numbers: Combination): Shape {
  const endings = new Set<number>();
  const sections = new Set<FixedSection>();
  let oddCount = 0;
  let lowCount = 0;
  let sum = 0;
  let adjacentPairs = 0;

  for (let index = 0; index < numbers.length; index += 1) {
    const number = numbers[index];
    if (number % 2 !== 0) oddCount += 1;
    if (number <= 22) lowCount += 1;
    sum += number;
    endings.add(number % 10);
    sections.add(sectionFor(number));
    if (index > 0 && number === numbers[index - 1] + 1) adjacentPairs += 1;
  }

  return {
    oddCount,
    lowCount,
    sum,
    range: numbers[5] - numbers[0],
    sectionCount: sections.size,
    adjacentPairs,
    duplicateEndings: numbers.length - endings.size,
  };
}

function createShapeHistograms(): Record<keyof Shape, Histogram> {
  return {
    oddCount: {},
    lowCount: {},
    sum: {},
    range: {},
    sectionCount: {},
    adjacentPairs: {},
    duplicateEndings: {},
  };
}

function createFixedSectionCounts(): Record<FixedSection, Histogram> {
  return {
    '1-10': {},
    '11-20': {},
    '21-30': {},
    '31-40': {},
    '41-45': {},
  };
}

function analyzeWindow(draws: readonly Draw[]): AnalysisWindow {
  const appearances = Array.from({ length: 45 }, () => 0);
  const lastAppearance = Array.from({ length: 45 }, () => -1);
  const shapeHistograms = createShapeHistograms();
  const fixedSectionCounts = createFixedSectionCounts();
  const pairCounts: Histogram = {};
  const previousDrawReuse: Histogram = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => [String(index), 0]),
  );

  draws.forEach((draw, drawIndex) => {
    const shape = extractShape(draw.numbers);
    (Object.keys(shape) as Array<keyof Shape>).forEach((field) => {
      increment(shapeHistograms[field], shape[field]);
    });

    const perDrawSectionCounts: Record<FixedSection, number> = {
      '1-10': 0,
      '11-20': 0,
      '21-30': 0,
      '31-40': 0,
      '41-45': 0,
    };

    draw.numbers.forEach((number, numberIndex) => {
      appearances[number - 1] += 1;
      lastAppearance[number - 1] = drawIndex;
      perDrawSectionCounts[sectionFor(number)] += 1;

      for (let laterIndex = numberIndex + 1; laterIndex < draw.numbers.length; laterIndex += 1) {
        increment(pairCounts, `${number}-${draw.numbers[laterIndex]}`);
      }
    });

    FIXED_SECTIONS.forEach((section) => increment(fixedSectionCounts[section], perDrawSectionCounts[section]));

    if (drawIndex > 0) {
      const previousNumbers = new Set(draws[drawIndex - 1].numbers);
      const overlapCount = draw.numbers.filter((number) => previousNumbers.has(number)).length;
      increment(previousDrawReuse, overlapCount);
    }
  });

  const drawCount = draws.length;
  const expected = drawCount * 6 / 45;
  const numbers = appearances.map((appearance, index) => ({
    number: index + 1,
    appearances: appearance,
    expected,
    delta: appearance - expected,
    absence: lastAppearance[index] === -1 ? drawCount : drawCount - 1 - lastAppearance[index],
  }));

  return {
    drawCount,
    numbers,
    shapeHistograms,
    fixedSectionCounts,
    pairCounts,
    pairSampleSize: drawCount,
    previousDrawReuse,
    previousDrawReuseSampleSize: Math.max(0, drawCount - 1),
  };
}

export function analyzeDraws(draws: readonly Draw[]): AnalysisReport {
  return {
    windows: {
      all: analyzeWindow(draws),
      '10': analyzeWindow(draws.slice(-WINDOW_SIZES['10'])),
      '30': analyzeWindow(draws.slice(-WINDOW_SIZES['30'])),
      '50': analyzeWindow(draws.slice(-WINDOW_SIZES['50'])),
      '100': analyzeWindow(draws.slice(-WINDOW_SIZES['100'])),
    },
  };
}

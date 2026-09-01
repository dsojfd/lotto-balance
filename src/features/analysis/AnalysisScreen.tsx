import { useState } from 'react';
import type { AnalysisReport, AnalysisWindow, Histogram, WindowName } from '../../domain/analysis';

interface AnalysisScreenProps {
  report: AnalysisReport;
}

const windows: ReadonlyArray<{ key: WindowName; label: string }> = [
  { key: 'all', label: '전체' },
  { key: '10', label: '최근 10회' },
  { key: '30', label: '최근 30회' },
  { key: '50', label: '최근 50회' },
  { key: '100', label: '최근 100회' },
];

const shapeLabels: ReadonlyArray<{ key: keyof AnalysisWindow['shapeHistograms']; label: string }> = [
  { key: 'oddCount', label: '홀수 개수' },
  { key: 'lowCount', label: '낮은 번호(1~22) 개수' },
  { key: 'sum', label: '합계' },
  { key: 'range', label: '범위' },
  { key: 'sectionCount', label: '사용 구간 수' },
  { key: 'adjacentPairs', label: '연속 번호쌍' },
  { key: 'duplicateEndings', label: '끝수 중복 개수' },
];

const sections = ['1-10', '11-20', '21-30', '31-40', '41-45'] as const;

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function pairOrder(left: string, right: string): number {
  const [leftFirst, leftSecond] = left.split('-').map(Number);
  const [rightFirst, rightSecond] = right.split('-').map(Number);
  return leftFirst - rightFirst || leftSecond - rightSecond;
}

function HistogramView({ label, sampleSize, values }: { label: string; sampleSize: number; values: Histogram }) {
  const entries = Object.entries(values).sort(([left], [right]) => Number(left) - Number(right));
  const maximum = Math.max(1, ...entries.map(([, count]) => count));

  return (
    <section className="metric-histogram" aria-label={`${label} 분포, 표본 ${sampleSize}회`}>
      <h3>{label} (표본 {sampleSize}회)</h3>
      <ul>
        {entries.map(([value, count]) => (
          <li key={value}>
            <span>{value}: {count}회</span>
            <span className="metric-bar" aria-hidden="true"><span style={{ width: `${(count / maximum) * 100}%` }} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PairList({ values, sampleSize }: { values: Histogram; sampleSize: number }) {
  const pairs = Object.entries(values).sort(([leftPair, leftCount], [rightPair, rightCount]) => (
    rightCount - leftCount || pairOrder(leftPair, rightPair)
  ));

  return (
    <details className="analysis-details">
      <summary>번호쌍 (표본 {sampleSize}회)</summary>
      <ol className="pair-list">
        {pairs.map(([pair, count]) => <li key={pair}>{pair} · {count}회</li>)}
      </ol>
    </details>
  );
}

function WindowReport({ window }: { window: AnalysisWindow }) {
  return (
    <>
      <p className="screen-summary">집계 회차 {window.drawCount}회</p>
      <p className="analysis-disclaimer">다음 회차 당첨확률 예측이 아닙니다</p>

      <section className="analysis-section" aria-labelledby="number-analysis-heading">
        <h3 id="number-analysis-heading">번호별 출현 기록</h3>
        <p className="section-note">출현·미출현·기대값·차이를 완료된 추첨 기록으로만 표시합니다.</p>
        <ul className="number-analysis-grid">
          {window.numbers.map((number) => (
            <li key={number.number}>
              <strong>{number.number}번</strong>
              <span>출현 {number.appearances}회</span>
              <span>미출현 {number.absence}회</span>
              <span>기대 {number.expected.toFixed(2)}</span>
              <span>차이 {formatSigned(number.delta)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="analysis-section" aria-labelledby="shape-analysis-heading">
        <h3 id="shape-analysis-heading">추첨 조합 분포</h3>
        <div className="metric-grid">
          {shapeLabels.map(({ key, label }) => (
            <HistogramView key={key} label={label} sampleSize={window.drawCount} values={window.shapeHistograms[key]} />
          ))}
          {sections.map((section) => (
            <HistogramView key={section} label={`${section} 구간 개수`} sampleSize={window.drawCount} values={window.fixedSectionCounts[section]} />
          ))}
          <HistogramView label="이전 회차 재출현" sampleSize={window.previousDrawReuseSampleSize} values={window.previousDrawReuse} />
        </div>
      </section>

      <PairList values={window.pairCounts} sampleSize={window.pairSampleSize} />
    </>
  );
}

export function AnalysisScreen({ report }: AnalysisScreenProps) {
  const [selected, setSelected] = useState<WindowName>('all');
  const window = report.windows[selected];

  return (
    <section className="analysis-screen" aria-labelledby="analysis-heading">
      <h2 id="analysis-heading">분석</h2>
      <div className="analysis-window-controls" aria-label="분석 기간">
        {windows.map(({ key, label }) => (
          <button key={key} type="button" aria-pressed={selected === key} onClick={() => setSelected(key)}>{label}</button>
        ))}
      </div>
      <WindowReport window={window} />
    </section>
  );
}

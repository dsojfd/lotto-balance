import type { BacktestReport, ModeBacktestMetrics } from '../../domain/backtest';

interface VerificationScreenProps {
  report: BacktestReport;
}

function formatValue(value: number): string {
  return value.toFixed(3);
}

function ModeResults({ id, label, metrics }: { id: 'balanced' | 'random'; label: string; metrics: ModeBacktestMetrics }) {
  const headingId = `verification-mode-${id}-heading`;
  return (
    <section className="verification-mode" aria-labelledby={headingId}>
      <h3 id={headingId}>{label}</h3>
      <p>평균 일치 수 {formatValue(metrics.meanMainMatches)}</p>
      <ul className="match-distribution" aria-label={`${label} 본번호 일치 수 분포`}>
        {metrics.mainMatchDistribution.map((count, matches) => <li key={matches}>{matches}개 일치 {count}</li>)}
      </ul>
      <p>3개 {metrics.matchCounts['3']} · 4개 {metrics.matchCounts['4']} · 5개 {metrics.matchCounts['5']} · 6개 {metrics.matchCounts['6']}</p>
      <p>보너스 번호 일치 {metrics.bonusMatches}</p>
    </section>
  );
}

export function VerificationScreen({ report }: VerificationScreenProps) {
  const firstTarget = report.config.minimumTrainingDraws + 1;

  return (
    <section className="verification-screen" aria-labelledby="verification-heading">
      <h2 id="verification-heading">검증</h2>
      <p className="screen-summary">평가 대상 {report.evaluation.targetCount}회</p>
      <p className="section-note">평가 기간 제{firstTarget}회~제{report.latestDraw}회 · 각 대상 회차 이전 기록만 사용</p>

      <section className="verification-inputs" aria-label="검증 입력값">
        <p>게임 수 {report.evaluation.gamesPerPortfolio}</p>
        <p>반복 수 {report.evaluation.portfoliosPerTarget}</p>
        <p>시드 {report.config.seed}</p>
        <p>방식별 총 게임 {report.evaluation.totalGamesPerMode}</p>
      </section>

      <div className="verification-grid">
        <ModeResults id="balanced" label="균형·분산 방식" metrics={report.metrics.balanced} />
        <ModeResults id="random" label="무작위 방식" metrics={report.metrics.random} />
      </div>

      <section className="verification-interval" aria-label="평균 일치 수 차이 불확실성">
        <h3>균형·분산 − 무작위 평균 일치 수</h3>
        <p>보고된 차이 {formatValue(report.meanMainMatchDifference)}</p>
        <p>95% 구간 {formatValue(report.interval.lower)} ~ {formatValue(report.interval.upper)} (재표본 {report.interval.resamples}회)</p>
        <p className="verification-conclusion">{report.conclusion}</p>
      </section>

      <p className="section-note">시드 난수는 보고서 재현용입니다. 실시간 추천은 브라우저 암호학적 난수를 사용합니다.</p>
    </section>
  );
}

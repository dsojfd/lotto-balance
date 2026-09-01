import { extractShape } from '../../domain/analysis';
import { buildShapeModel, scoreCombination } from '../../domain/generator';
import type { Combination, Draw } from '../../domain/draw';
import { LottoBall } from '../../ui/LottoBall';

interface PortfolioViewProps {
  combinations: readonly Combination[];
  draws: readonly Draw[];
  mode: 'balanced' | 'random';
  avoidPopular: boolean;
}

export function PortfolioView({ combinations, draws, mode, avoidPopular }: PortfolioViewProps) {
  const model = mode === 'balanced' ? buildShapeModel(draws) : undefined;

  return (
    <ol className="portfolio-list" aria-label="추천 결과">
      {combinations.map((combination, index) => {
        const shape = extractShape(combination);
        const score = model === undefined ? undefined : scoreCombination(combination, model, avoidPopular);
        return (
          <li className="portfolio-card" key={combination.join('-')} aria-label={`추천 조합 ${index + 1}`}>
            <h3>{index + 1}번째 조합</h3>
            <div className="ball-row" aria-label={`추천 번호 ${index + 1}`}>
              {combination.map((number) => <LottoBall key={number} number={number} />)}
            </div>
            <dl className="shape-summary">
              <div><dt>홀짝</dt><dd>{shape.oddCount}홀 {6 - shape.oddCount}짝</dd></div>
              <div><dt>합계</dt><dd>{shape.sum}</dd></div>
              <div><dt>연속 번호</dt><dd>{shape.adjacentPairs}쌍</dd></div>
              <div><dt>구간 분산</dt><dd>{shape.sectionCount}개 구간</dd></div>
              {score !== undefined && <div><dt>조합 형태 점수</dt><dd>{score.toFixed(2)}</dd></div>}
            </dl>
          </li>
        );
      })}
    </ol>
  );
}

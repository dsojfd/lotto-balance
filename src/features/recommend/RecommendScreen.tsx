import { useState } from 'react';
import type { SavedPortfolioStore } from '../../data/savedPortfolios';
import type { Combination, DrawDataset } from '../../domain/draw';
import { generateBalancedPortfolio, generateRandomPortfolio } from '../../domain/generator';
import { CryptoRandomSource, type RandomSource } from '../../domain/random';
import { StatusBanner } from '../../ui/StatusBanner';
import { PortfolioView } from './PortfolioView';

type RecommendMode = 'balanced' | 'random';
type GameCount = 1 | 5 | 10;

interface RecommendScreenProps {
  dataset: DrawDataset;
  randomSourceFactory?: () => RandomSource;
  savedPortfolioStore?: Pick<SavedPortfolioStore, 'save'>;
}

const GAME_COUNTS: readonly GameCount[] = [1, 5, 10];

function userFacingError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== '' ? error.message : fallback;
}

export function RecommendScreen({
  dataset,
  randomSourceFactory = () => new CryptoRandomSource(),
  savedPortfolioStore,
}: RecommendScreenProps) {
  const [mode, setMode] = useState<RecommendMode>('balanced');
  const [gameCount, setGameCount] = useState<GameCount>(5);
  const [avoidPopular, setAvoidPopular] = useState(false);
  const [portfolio, setPortfolio] = useState<Combination[]>([]);
  const [generationError, setGenerationError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();
  const [saveMessage, setSaveMessage] = useState<string>();
  const targetDrawNo = dataset.latestDraw + 1;

  function generate(): void {
    setGenerationError(undefined);
    setSaveError(undefined);
    setSaveMessage(undefined);
    try {
      const source = randomSourceFactory();
      const nextPortfolio = mode === 'balanced'
        ? generateBalancedPortfolio(gameCount, dataset.draws, source, { avoidPopular })
        : generateRandomPortfolio(gameCount, source);
      setPortfolio(nextPortfolio);
    } catch (error) {
      setGenerationError(userFacingError(error, '추천번호를 생성하지 못했습니다. 다시 시도해 주세요.'));
    }
  }

  function saveAll(): void {
    if (portfolio.length === 0 || !savedPortfolioStore) return;
    setSaveError(undefined);
    setSaveMessage(undefined);
    try {
      const createdAt = new Date().toISOString();
      savedPortfolioStore.save({
        id: `${targetDrawNo}:${portfolio.map((combination) => combination.join('-')).join('|')}`,
        schemaVersion: 1,
        targetDrawNo,
        mode,
        createdAt,
        combinations: portfolio,
      });
      setSaveMessage('추천 조합을 저장했습니다.');
    } catch {
      setSaveError('추천 조합을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.');
    }
  }

  return (
    <section className="recommend-screen" aria-labelledby="recommend-heading">
      <div className="section-heading">
        <p className="eyebrow">A. 바로 추천</p>
        <h2 id="recommend-heading">오늘의 추천 조합</h2>
        <p>번호의 출현을 예측하지 않고, 선택한 기준으로 조합을 구성합니다.</p>
      </div>

      <div className="recommend-controls" aria-label="추천 설정">
        <fieldset>
          <legend>추천 방식</legend>
          <div className="button-group">
            <button type="button" aria-pressed={mode === 'balanced'} onClick={() => setMode('balanced')}>균형·분산 추천</button>
            <button type="button" aria-pressed={mode === 'random'} onClick={() => setMode('random')}>무작위 추천</button>
          </div>
        </fieldset>
        <fieldset>
          <legend>게임 수</legend>
          <div className="button-group">
            {GAME_COUNTS.map((count) => (
              <button key={count} type="button" aria-pressed={gameCount === count} onClick={() => setGameCount(count)}>{count}게임</button>
            ))}
          </div>
        </fieldset>
        <label className="toggle-control">
          <input type="checkbox" checked={avoidPopular} onChange={(event) => setAvoidPopular(event.target.checked)} />
          <span>많이 고르는 형태 피하기</span>
        </label>
        <button type="button" className="primary-action" onClick={generate}>추천번호 생성</button>
      </div>

      <details className="recommend-details">
        <summary>추천 기준 자세히 보기</summary>
        <p>균형·분산 추천은 과거 조합 형태와 조합 간 겹침을 기준으로 구성합니다. 많이 고르는 형태를 피하거나 조합끼리 덜 겹치게 하는 기준은 조합의 구성을 바꾸지만, 각 한 줄의 1등 당첨 확률을 바꾸지 않습니다.</p>
      </details>

      {generationError && <StatusBanner tone="error">{generationError}</StatusBanner>}
      {saveError && <StatusBanner tone="error">{saveError}</StatusBanner>}
      {saveMessage && <StatusBanner>{saveMessage}</StatusBanner>}

      {portfolio.length > 0 && (
        <section className="recommend-results" aria-live="polite">
          <div className="results-heading">
            <div>
              <p className="eyebrow">제{targetDrawNo}회 추천</p>
              <h2>{mode === 'balanced' ? '균형·분산 추천 결과' : '무작위 추천 결과'}</h2>
            </div>
            <button type="button" onClick={saveAll}>전체 저장</button>
          </div>
          <PortfolioView combinations={portfolio} draws={dataset.draws} mode={mode} avoidPopular={avoidPopular} />
          <p className="probability-disclosure">모든 고정 조합의 1등 확률은 동일합니다 (1/8,145,060)</p>
        </section>
      )}
    </section>
  );
}

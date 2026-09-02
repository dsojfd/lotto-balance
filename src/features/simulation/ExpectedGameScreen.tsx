import { useEffect, useMemo, useRef, useState } from 'react';
import type { Combination, Draw } from '../../domain/draw';
import { CryptoRandomSource, type RandomSource } from '../../domain/random';
import { checkCombination } from '../../domain/rank';
import {
  drawVirtualResult,
  generateSimulationPortfolioAsync,
  summarizeSimulation,
  type SimulationGameCount,
  type SimulationMode,
  type VirtualResult,
} from '../../domain/simulation';
import { LottoBall } from '../../ui/LottoBall';
import { StatusBanner } from '../../ui/StatusBanner';
import { startSimulationWorker } from './simulationWorkerClient';

interface ExpectedGameScreenProps {
  draws: readonly Draw[];
  randomSourceFactory?: () => RandomSource;
  drawRandomSourceFactory?: () => RandomSource;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function ExpectedGameScreen(_props: ExpectedGameScreenProps) {
  const {
    draws,
    randomSourceFactory,
    drawRandomSourceFactory = () => new CryptoRandomSource(),
  } = _props;
  const [mode, setMode] = useState<SimulationMode>('balanced');
  const [gameCount, setGameCount] = useState<SimulationGameCount>(10);
  const [games, setGames] = useState<Combination[]>();
  const [virtualResult, setVirtualResult] = useState<VirtualResult>();
  const [error, setError] = useState<string>();
  const [isGenerating, setIsGenerating] = useState(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const activeWorkerRef = useRef<Worker | null>(null);
  const summary = useMemo(
    () => games && virtualResult ? summarizeSimulation(games, virtualResult) : undefined,
    [games, virtualResult],
  );

  useEffect(() => {
    if (virtualResult) resultHeadingRef.current?.focus();
  }, [virtualResult]);

  useEffect(() => () => activeWorkerRef.current?.terminate(), []);

  function changeMode(nextMode: SimulationMode): void {
    setMode(nextMode);
    setGames(undefined);
    setVirtualResult(undefined);
    setError(undefined);
  }

  function changeCount(nextCount: SimulationGameCount): void {
    setGameCount(nextCount);
    setGames(undefined);
    setVirtualResult(undefined);
    setError(undefined);
  }

  async function generateGames(): Promise<void> {
    setError(undefined);
    setVirtualResult(undefined);
    setIsGenerating(true);
    try {
      if (randomSourceFactory) {
        setGames(await generateSimulationPortfolioAsync(
          gameCount,
          mode,
          draws,
          randomSourceFactory(),
          yieldToBrowser,
        ));
      } else {
        const run = startSimulationWorker(gameCount, mode, draws);
        activeWorkerRef.current = run.worker;
        setGames(await run.result);
        if (activeWorkerRef.current === run.worker) activeWorkerRef.current = null;
      }
    } catch (caught) {
      activeWorkerRef.current = null;
      setGames(undefined);
      setError(caught instanceof Error ? caught.message : '게임번호를 생성하지 못했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }

  function revealDraw(): void {
    setError(undefined);
    try {
      setVirtualResult(drawVirtualResult(drawRandomSourceFactory()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '가상 추첨을 진행하지 못했습니다.');
    }
  }

  function reset(): void {
    setGames(undefined);
    setVirtualResult(undefined);
    setError(undefined);
  }

  return (
    <section className="simulation-screen" aria-labelledby="simulation-heading">
      <div className="section-heading">
        <p className="eyebrow">C. 예상게임</p>
        <h2 id="simulation-heading">가상 로또 추첨</h2>
        <p>게임번호를 먼저 만든 뒤, 무작위 당첨번호를 공개합니다.</p>
      </div>

      {!games && (
        <div className="simulation-controls" aria-label="예상게임 설정">
          <fieldset>
            <legend>게임번호 생성 방식</legend>
            <div className="button-group">
              <button type="button" disabled={isGenerating} aria-pressed={mode === 'balanced'} onClick={() => changeMode('balanced')}>분석 추천</button>
              <button type="button" disabled={isGenerating} aria-pressed={mode === 'random'} onClick={() => changeMode('random')}>완전 랜덤</button>
            </div>
          </fieldset>
          <fieldset className="simulation-counts">
            <legend>게임 수</legend>
            <div className="button-group">
              {([10, 20, 50, 100, 200, 300, 400, 500] as const).map((count) => (
                <button key={count} type="button" disabled={isGenerating} aria-pressed={gameCount === count} onClick={() => changeCount(count)}>{count}게임</button>
              ))}
            </div>
          </fieldset>
          <button type="button" className="primary-action" disabled={isGenerating} onClick={() => void generateGames()}>
            {isGenerating ? '게임번호 생성 중' : '게임번호 생성'}
          </button>
        </div>
      )}

      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      {games && (
        <section className="simulation-games" aria-labelledby="simulation-games-heading">
          <div className="results-heading">
            <div>
              <p className="eyebrow">{mode === 'balanced' ? '분석 추천' : '완전 랜덤'}</p>
              <h3 id="simulation-games-heading">구매번호 {games.length}게임</h3>
            </div>
            {!virtualResult && <button type="button" className="primary-action" onClick={revealDraw}>추첨 시작</button>}
          </div>
          <ol className="simulation-game-list" aria-label="가상 구매번호">
            {games.map((game, index) => {
              const checked = virtualResult
                ? checkCombination(game, { drawNo: 0, drawDate: '', ...virtualResult })
                : undefined;
              return (
                <li key={game.join('-')} aria-label={`가상 구매 조합 ${index + 1}`}>
                  <strong>{index + 1}</strong>
                  <div className="ball-row">
                    {game.map((number) => <LottoBall key={number} number={number} />)}
                  </div>
                  {checked && <span className={checked.rank ? 'winning-rank' : 'losing-rank'}>{checked.rank ? `${checked.rank}등` : `${checked.mainMatches}개 일치`}</span>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {virtualResult && summary && (
        <section className="simulation-result" aria-live="polite" aria-labelledby="virtual-result-heading">
          <h3 id="virtual-result-heading" ref={resultHeadingRef} tabIndex={-1}>가상 당첨번호</h3>
          <div className="virtual-draw-balls">
            <div className="ball-row">
              {virtualResult.numbers.map((number) => <LottoBall key={number} number={number} />)}
            </div>
            <span className="bonus-label">보너스번호</span>
            <LottoBall number={virtualResult.bonus} />
          </div>
          <p className="simulation-highest">{summary.highestRank ? `최고 ${summary.highestRank}등` : '당첨 게임 없음'}</p>
          <ul className="rank-counts" aria-label="등수별 결과">
            {([1, 2, 3, 4, 5] as const).map((rank) => <li key={rank}>{rank}등 {summary.rankCounts[rank]}게임</li>)}
            <li>낙첨 {summary.losingCount}게임</li>
          </ul>
          <button type="button" className="primary-action" onClick={reset}>다시 도전</button>
        </section>
      )}

      <p className="probability-disclosure">실제 구매나 당첨 예측과 무관한 가상 체험입니다.</p>
    </section>
  );
}

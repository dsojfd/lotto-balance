import { useState } from 'react';
import type { SavedPortfolio, SavedPortfolioStore } from '../../data/savedPortfolios';
import type { Draw, DrawDataset } from '../../domain/draw';
import { checkCombination } from '../../domain/rank';
import { LottoBall } from '../../ui/LottoBall';
import { StatusBanner } from '../../ui/StatusBanner';
import {
  copyPortfolio,
  sharePortfolio,
  type ShareDependencies,
} from './sharePortfolio';

interface SavedScreenProps {
  dataset: DrawDataset;
  store: Pick<SavedPortfolioStore, 'list' | 'delete'>;
  shareDependencies?: ShareDependencies;
}

interface SavedState {
  portfolios: SavedPortfolio[];
  readError?: string;
}

function readSaved(store: SavedScreenProps['store']): SavedState {
  try {
    return { portfolios: store.list() };
  } catch (error) {
    return {
      portfolios: [],
      readError: error instanceof Error ? error.message : '저장된 조합 데이터를 읽을 수 없습니다.',
    };
  }
}

function defaultShareDependencies(): ShareDependencies {
  return {
    share: navigator.share?.bind(navigator),
    clipboard: navigator.clipboard,
  };
}

function modeLabel(mode: SavedPortfolio['mode']): string {
  return mode === 'balanced' ? '균형·분산 추천' : '무작위 추천';
}

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function checkedLabel(portfolio: SavedPortfolio, draw: Draw | undefined, index: number): string {
  if (!draw) return '추첨 전';
  const result = checkCombination(portfolio.combinations[index], draw);
  return `본번호 ${result.mainMatches}개 · 보너스 ${result.bonusMatched ? '일치' : '불일치'} · ${result.rank ? `${result.rank}등` : '낙첨'}`;
}

export function SavedScreen({ dataset, store, shareDependencies }: SavedScreenProps) {
  const [saved, setSaved] = useState<SavedState>(() => readSaved(store));
  const [actionMessage, setActionMessage] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const dependencies = shareDependencies ?? defaultShareDependencies();
  const groups = Array.from(
    saved.portfolios.reduce((byDraw, portfolio) => {
      const group = byDraw.get(portfolio.targetDrawNo) ?? [];
      group.push(portfolio);
      byDraw.set(portfolio.targetDrawNo, group);
      return byDraw;
    }, new Map<number, SavedPortfolio[]>()),
  ).sort(([left], [right]) => right - left);

  function clearActionStatus(): void {
    setActionMessage(undefined);
    setActionError(undefined);
  }

  function deletePortfolio(id: string): void {
    clearActionStatus();
    try {
      store.delete(id);
      setSaved(readSaved(store));
    } catch {
      setActionError('저장 기록을 삭제하지 못했습니다.');
    }
  }

  async function share(portfolio: SavedPortfolio): Promise<void> {
    clearActionStatus();
    try {
      const result = await sharePortfolio(portfolio, dependencies);
      setActionMessage(result === 'copied' ? '복사했습니다' : '공유했습니다.');
    } catch {
      setActionError('공유하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  async function copy(portfolio: SavedPortfolio): Promise<void> {
    clearActionStatus();
    try {
      await copyPortfolio(portfolio, dependencies.clipboard);
      setActionMessage('복사했습니다');
    } catch {
      setActionError('복사하지 못했습니다. 브라우저 권한을 확인해 주세요.');
    }
  }

  return (
    <section className="saved-screen" aria-labelledby="saved-heading">
      <div className="section-heading">
        <p className="eyebrow">D. 저장 기록</p>
        <h2 id="saved-heading">저장한 추천 조합</h2>
        <p>이 기기의 브라우저에만 저장됩니다.</p>
      </div>

      {saved.readError && <StatusBanner tone="error">{saved.readError}</StatusBanner>}
      {actionMessage && <StatusBanner>{actionMessage}</StatusBanner>}
      {actionError && <StatusBanner tone="error">{actionError}</StatusBanner>}

      {!saved.readError && groups.length === 0 && <p className="saved-empty">저장된 조합이 없습니다.</p>}
      <div className="saved-groups">
        {groups.map(([targetDrawNo, portfolios]) => {
          const draw = dataset.draws.find((candidate) => candidate.drawNo === targetDrawNo);
          return (
            <section className="saved-group" key={targetDrawNo} aria-labelledby={`saved-draw-${targetDrawNo}`}>
              <h3 id={`saved-draw-${targetDrawNo}`}>제{targetDrawNo}회</h3>
              <div className="saved-records">
                {[...portfolios]
                  .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
                  .map((portfolio) => (
                    <article className="saved-record" aria-label={`${portfolio.id} 저장 기록`} key={portfolio.id}>
                      <div className="saved-record-heading">
                        <div>
                          <h4>{modeLabel(portfolio.mode)}</h4>
                          <p>{formatCreatedAt(portfolio.createdAt)}</p>
                        </div>
                        <div className="saved-actions">
                          <button type="button" onClick={() => void share(portfolio)}>공유</button>
                          <button type="button" onClick={() => void copy(portfolio)}>복사</button>
                          <button type="button" aria-label={`${portfolio.id} 삭제`} onClick={() => deletePortfolio(portfolio.id)}>삭제</button>
                        </div>
                      </div>
                      <ol className="saved-combinations">
                        {portfolio.combinations.map((combination, index) => (
                          <li key={`${portfolio.id}:${combination.join('-')}`}>
                            <div className="ball-row">
                              {combination.map((number) => <LottoBall key={number} number={number} />)}
                            </div>
                            <p>{checkedLabel(portfolio, draw, index)}</p>
                          </li>
                        ))}
                      </ol>
                    </article>
                  ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

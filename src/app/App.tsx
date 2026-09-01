import { useEffect, useMemo, useState } from 'react';
import { loadAppData, type AppDataState } from '../data/appData';
import { SavedPortfolioStore } from '../data/savedPortfolios';
import type { RandomSource } from '../domain/random';
import { AnalysisScreen } from '../features/analysis/AnalysisScreen';
import { RecommendScreen } from '../features/recommend/RecommendScreen';
import { SavedScreen } from '../features/saved/SavedScreen';
import { VerificationScreen } from '../features/verification/VerificationScreen';
import { StatusBanner } from '../ui/StatusBanner';
import './styles.css';

const tabs = ['추천', '분석', '검증', '저장'] as const;
type Tab = typeof tabs[number];

interface AppProps {
  loadData?: () => Promise<AppDataState>;
  randomSourceFactory?: () => RandomSource;
  savedPortfolioStore?: Pick<SavedPortfolioStore, 'save'> & Partial<Pick<SavedPortfolioStore, 'list' | 'delete'>>;
}

type AppLoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: AppDataState }
  | { status: 'error'; message: string };

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date).map(({ type, value: partValue }) => [type, partValue]));
  return `${parts.year}. ${Number(parts.month)}. ${Number(parts.day)}. ${parts.hour}:${parts.minute} KST`;
}

export function App({ loadData = loadAppData, randomSourceFactory, savedPortfolioStore }: AppProps) {
  const [loadState, setLoadState] = useState<AppLoadState>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('추천');
  const data = loadState.status === 'ready' ? loadState.data : undefined;
  const deviceStore = useMemo(() => new SavedPortfolioStore(localStorage), []);
  const store = savedPortfolioStore ?? deviceStore;
  const readableStore = store.list && store.delete
    ? store as Pick<SavedPortfolioStore, 'list' | 'delete'>
    : deviceStore;

  function selectTab(nextTab: Tab): void {
    setTab(nextTab);
  }

  function moveTab(current: Tab, key: string): void {
    const currentIndex = tabs.indexOf(current);
    const nextIndex = key === 'Home' ? 0
      : key === 'End' ? tabs.length - 1
        : (currentIndex + (key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    selectTab(nextTab);
    document.getElementById(`tab-${nextTab}`)?.focus();
  }

  useEffect(() => {
    let mounted = true;
    setLoadState({ status: 'loading' });
    loadData()
      .then((nextData) => { if (mounted) setLoadState({ status: 'ready', data: nextData }); })
      .catch(() => {
        if (mounted) {
          setLoadState({
            status: 'error',
            message: '로또 데이터를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
          });
        }
      });
    return () => { mounted = false; };
  }, [loadData]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">로또 6/45</p>
          <h1>로또 밸런스</h1>
        </div>
        {loadState.status === 'loading' && <p className="data-status">최신 데이터를 불러오는 중입니다.</p>}
        {data && <p className="data-status">제{data.dataset.latestDraw}회 기준 · 갱신 {formatUpdatedAt(data.dataset.generatedAt)}</p>}
      </header>

      {data?.isOfflineFallback && (
        <StatusBanner>
          오프라인 · 제{data.dataset.latestDraw}회 저장 데이터 사용 중 · 마지막 갱신 {formatUpdatedAt(data.dataset.generatedAt)}
        </StatusBanner>
      )}
      {loadState.status === 'error' && <StatusBanner tone="error">{loadState.message}</StatusBanner>}

      <div className="app-content">
        {data && tab === '추천' && (
          <section role="tabpanel" id="panel-추천" aria-labelledby="tab-추천">
            <RecommendScreen dataset={data.dataset} randomSourceFactory={randomSourceFactory} savedPortfolioStore={store} />
          </section>
        )}
        {data && tab === '분석' && (
          <section role="tabpanel" id="panel-분석" aria-labelledby="tab-분석">
            <AnalysisScreen report={data.analysis.metrics} />
          </section>
        )}
        {data && tab === '검증' && (
          <section role="tabpanel" id="panel-검증" aria-labelledby="tab-검증">
            <VerificationScreen report={data.backtest} />
          </section>
        )}
        {data && tab === '저장' && (
          <section role="tabpanel" id="panel-저장" aria-labelledby="tab-저장">
            <SavedScreen dataset={data.dataset} store={readableStore} />
          </section>
        )}
      </div>

      <nav className="bottom-nav" aria-label="주요 메뉴" role="tablist">
        {tabs.map((name) => (
          <button key={name} id={`tab-${name}`} type="button" role="tab" aria-selected={tab === name} aria-controls={`panel-${name}`} tabIndex={tab === name ? 0 : -1} onClick={() => selectTab(name)} onKeyDown={(event) => {
            if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              moveTab(name, event.key);
            }
          }}>
            <span aria-hidden="true">{name === '추천' ? '✦' : name === '분석' ? '◫' : name === '검증' ? '✓' : '▣'}</span>
            {name}
          </button>
        ))}
      </nav>
    </main>
  );
}

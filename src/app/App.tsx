import { useEffect, useState } from 'react';
import { loadAppData, type AppDataState } from '../data/appData';
import { SavedPortfolioStore } from '../data/savedPortfolios';
import type { RandomSource } from '../domain/random';
import { RecommendScreen } from '../features/recommend/RecommendScreen';
import { StatusBanner } from '../ui/StatusBanner';
import './styles.css';

const tabs = ['추천', '분석', '검증', '저장'] as const;
type Tab = typeof tabs[number];

interface AppProps {
  loadData?: () => Promise<AppDataState>;
  randomSourceFactory?: () => RandomSource;
  savedPortfolioStore?: Pick<SavedPortfolioStore, 'save'>;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return `${date.getUTCFullYear()}. ${date.getUTCMonth() + 1}. ${date.getUTCDate()}.`;
}

export function App({ loadData = loadAppData, randomSourceFactory, savedPortfolioStore }: AppProps) {
  const [data, setData] = useState<AppDataState>();
  const [error, setError] = useState<string>();
  const [tab, setTab] = useState<Tab>('추천');
  const store = savedPortfolioStore ?? new SavedPortfolioStore(localStorage);

  useEffect(() => {
    let mounted = true;
    loadData()
      .then((nextData) => { if (mounted) setData(nextData); })
      .catch(() => { if (mounted) setError('로또 데이터를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.'); });
    return () => { mounted = false; };
  }, [loadData]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">로또 6/45</p>
          <h1>로또 밸런스</h1>
        </div>
        <p className="data-status">
          {data ? `제${data.dataset.latestDraw}회 기준 · 갱신 ${formatUpdatedAt(data.dataset.generatedAt)}` : '데이터를 불러오는 중입니다.'}
        </p>
      </header>

      {data?.isOfflineFallback && <StatusBanner>오프라인 저장 데이터로 표시 중입니다.</StatusBanner>}
      {error && <StatusBanner tone="error">{error}</StatusBanner>}

      <div className="app-content">
        {data && tab === '추천' && <RecommendScreen dataset={data.dataset} randomSourceFactory={randomSourceFactory} savedPortfolioStore={store} />}
        {data && tab !== '추천' && <section className="future-tab" aria-live="polite"><h2>{tab}</h2><p>이 화면은 준비 중입니다.</p></section>}
      </div>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        {tabs.map((name) => (
          <button key={name} type="button" aria-pressed={tab === name} onClick={() => setTab(name)}>
            <span aria-hidden="true">{name === '추천' ? '✦' : name === '분석' ? '◫' : name === '검증' ? '✓' : '▣'}</span>
            {name}
          </button>
        ))}
      </nav>
    </main>
  );
}

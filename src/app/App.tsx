const tabs = ['추천', '분석', '검증', '저장'] as const;

export function App() {
  return (
    <main>
      <h1>로또 밸런스</h1>
      <nav aria-label="주요 메뉴">
        {tabs.map((tab) => <button key={tab} type="button">{tab}</button>)}
      </nav>
    </main>
  );
}

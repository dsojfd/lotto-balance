# 로또 밸런스

직전 완료 추첨 회차까지의 검증된 로또 6/45 기록을 분석하고, 브라우저의 암호학적 난수로 추천 조합을 만드는 정적 PWA입니다. 회원가입·서버 저장·구매 기능은 없습니다.

## 로컬 실행

[Node.js 24](https://nodejs.org/)를 설치한 뒤 저장소 루트에서 다음 명령을 실행합니다.

```powershell
npm ci
npm run data:bootstrap
npm run reports:build
npm run dev
```

`data:bootstrap`은 공식 동행복권 페이지에서 전체 회차 데이터를 새로 구성하는 초기 작업입니다. 네트워크를 사용하므로, 이미 검증된 `public/data/draws.json`으로 개발할 때는 생략하고 `reports:build`부터 실행할 수 있습니다.

전체 로컬 검증은 다음 순서로 실행합니다. E2E 전에 Playwright Chromium이 없다면 한 번 `npx playwright install chromium`을 실행합니다.

```powershell
npm ci
npm test
npm run reports:build
npm run typecheck
npm run build
npm run e2e
git diff --check
git status --short
```

`npm run e2e`는 방금 생성한 `dist`를 로컬 미리보기 서버로 열어 모바일, 저장 유지, 잘못된 네트워크 데이터 대체, Service Worker 오프라인 재실행을 검증합니다.

## GitHub Pages 배포

1. GitHub에서 빈 저장소를 만듭니다.
2. 이 로컬 저장소에 GitHub 원격을 추가하고 `main` 브랜치를 push합니다.
3. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
4. **Actions** 탭에서 **Update data and deploy Pages**를 선택하고 **Run workflow**로 첫 배포를 수동 실행합니다.
5. `CI`와 `Update data and deploy Pages`가 모두 성공한 뒤 배포 URL에서 최신 정상 회차, 360px 화면, 저장 유지와 오프라인 재실행을 확인합니다.

Pages 워크플로는 `main` push, 수동 실행, 토요일 22:17 KST와 일요일 07:17 KST에 동작합니다. 예약·수동 실행에서는 공식 데이터 갱신 후 테스트, 보고서 생성, 정적 빌드가 모두 성공해야만 새 `draws.json`을 commit/push하고 같은 `dist` 산출물을 배포합니다. 어느 검증이든 실패하면 기존 데이터 commit과 기존 Pages 배포본은 그대로 유지됩니다.

## PWA 설치와 오프라인 사용

배포된 HTTPS 페이지를 연 뒤 브라우저 메뉴의 **앱 설치**, **홈 화면에 추가** 또는 주소창의 설치 아이콘을 사용합니다. 한 번 온라인으로 정상 데이터를 불러오면 앱 셸과 마지막 검증 데이터가 기기에 남아, 네트워크가 끊겨도 추천 생성·분석·저장 기록 열람을 계속할 수 있습니다. 오프라인이나 잘못된 새 응답에서는 마지막 정상 데이터로 전환했음을 화면에 표시합니다.

저장한 추천 조합은 현재 기기의 해당 브라우저 저장소에만 보관됩니다. 다른 기기나 브라우저와 동기화되지 않으며, 브라우저 데이터를 지우면 함께 삭제될 수 있습니다.

## 확률과 분석에 관한 중요한 안내

로또 6/45의 모든 고정 조합은 동일한 1등 확률 `1/8,145,060`을 가집니다. 이 앱의 분석, 균형·분산 기준, 인기 선택 회피와 백테스트는 번호별 미래 당첨확률을 높인다는 증거가 아닙니다. 여러 게임의 완전 중복을 막고 조합 형태와 겹침을 관리하는 도구일 뿐이며, 과거 통계나 화면의 형태 점수를 당첨 가능성 예측으로 해석하면 안 됩니다.

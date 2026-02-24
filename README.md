# MAXI⚡DOGE Unified

> Single source of truth: this `README.md` is the canonical collaboration and project guide for all humans and agents.
> Mandatory gate: every task must log start/end in `docs/AGENT_WATCH_LOG.md` and pass `npm run check` + `npm run build` before push/merge.

AI 에이전트 기반 트레이딩 시뮬레이션 웹앱입니다.  
SvelteKit + TypeScript 기반으로 `Arena`, `Terminal (War Room/Intel)`, `Signals`, `Passport` 경험을 제공합니다.

## 0) Agent Collaboration Protocol (SSOT)

아래 규칙은 모든 에이전트/기여자 공통 강제 규칙입니다.

1. 매 작업(매 요청) 시작 시, 이 `README.md`를 다시 읽는다.
2. 코드/문서 수정 전에 `docs/AGENT_WATCH_LOG.md`에 시작 기록을 남긴다.
3. 작업 브랜치에서 `npm run check`와 `npm run build`를 모두 통과시킨다.
4. 둘 중 하나라도 실패하면 push/merge를 중단하고 먼저 에러를 수정한다.
5. push/merge 후에도 `docs/AGENT_WATCH_LOG.md`에 완료 기록(검증 결과, commit hash, merge hash, push 상태)을 남긴다.
6. `main` 머지 후 `main`에서 다시 `npm run check` + `npm run build`를 실행한다.
7. 한 요청(한 작업 단위)은 **하나의 atomic commit**으로 마감한다.  
   해당 요청에서 바뀐 코드/문서와 `docs/AGENT_WATCH_LOG.md` 기록을 같은 커밋에 포함한다.
8. 작업 종료 직전에 `git status --short --branch`를 실행해 워킹트리가 clean인지 확인하고, 결과를 로그에 남긴다.
9. push 전 워킹트리에 요청과 무관한 변경이 남아 있으면 먼저 정리한다.
   필요 시 `git stash push -u -m "wip/<task>"`로 백업 후 push하고, 이후 `git stash pop`으로 복원한다.
10. 모든 구현 작업은 반드시 설계안을 먼저 작성하고, 설계 검토/승인을 받은 뒤에만 실제 구현을 시작한다.
11. 매 작업 시작 메시지에서 현재 브랜치 위치를 먼저 보고한 뒤 작업을 시작한다.

참고:
- 에이전트 자동 실행 규칙 파일은 `AGENTS.md`다.
- `docs/README.md`는 호환성 유지를 위한 리다이렉트 문서다.

## 1) Overview

- 목적: 멀티 에이전트 시그널을 시각화하고, 배틀/카피트레이드 흐름으로 연결
- 핵심 경험
  - `Terminal`: 시장 인텔/에이전트 시그널 확인
  - `Arena`: phase 기반 배틀 루프
  - `Signals`: 시그널 탐색 및 추적
  - `Passport`: 유저/지갑/성과 프로필

## 2) Tech Stack

- Svelte 5
- SvelteKit 2
- TypeScript
- Vite
- lightweight-charts

## 3) Quick Start

### Prerequisites

- Node.js 20+ (권장: 22 LTS)
- npm 10+

### Install

```bash
npm install
```

### Environment Variables

프로젝트 루트에 `.env` 생성:

```bash
COINALYZE_API_KEY=YOUR_KEY_HERE
```

참고:
- `COINALYZE_API_KEY`가 없으면 `/api/coinalyze`는 `500`을 반환합니다.
- `.env`는 커밋하지 않습니다.

### Run (Dev)

```bash
npm run dev
```

### Check / Build / Preview

```bash
npm run check
npm run build
npm run preview
```

## 4) NPM Scripts

- `npm run dev`: 개발 서버 실행
- `npm run check`: Svelte/TypeScript 정적 검사
- `npm run build`: 프로덕션 빌드
- `npm run preview`: 빌드 결과 로컬 프리뷰
- `npm run gate`: `check + build` 통합 게이트
- `npm run safe:status`: 현재 브랜치/워크트리/변경 파일 점검
- `npm run safe:worktree -- <task-name> [base-branch]`: `codex/<task-name>` 브랜치 + 분리 워킹트리 생성
- `npm run safe:hooks`: 로컬 pre-push/post-merge 훅 설치 (`.githooks/*`)
- `npm run safe:sync`: 브랜치 동기화 (`main`은 `pull --ff-only`, 작업 브랜치는 `origin/main` rebase + check)
- `npm run safe:sync:gate`: 동기화 후 `check + build`까지 실행

### Solo Safety Routine (Recommended)

1. 한 번만 실행:
   ```bash
   npm run safe:hooks
   ```
2. 작업 시작 전:
   ```bash
   npm run safe:status
   npm run safe:worktree -- ui-refresh main
   ```
3. 작업 중 pull/merge 전후:
   ```bash
   npm run safe:sync
   ```
4. 작업 끝나기 전:
   ```bash
   npm run safe:sync:gate
   ```

참고:
- pre-push는 기본적으로 `npm run check` + `npm run build`를 자동 실행합니다.
- post-merge는 pull/merge 직후 `npm run check`를 자동 실행합니다.
- 긴급 상황에서만 `SKIP_PREPUSH=1 git push`로 일시 우회하세요.

## 5) Project Structure

```txt
src/
  routes/
    +page.svelte                          # 홈
    arena/+page.svelte                    # Arena 메인
    terminal/+page.svelte                 # Terminal 메인
    signals/+page.svelte                  # Signal 룸
    passport/+page.svelte                 # 프로필/지갑
    settings/+page.svelte                 # 설정
    api/
      auth/                               # register/session/wallet
      coinalyze/                          # Coinalyze 프록시
      polymarket/                         # markets/orderbook 프록시
      matches/                            # 매치 기록 API

  components/
    arena/                                # Chart, Lobby, Squad, Match UI
    terminal/                             # WarRoom, Intel, BottomPanel
    modals/                               # Wallet/Settings/CopyTrade 등
    shared/                               # 공통 컴포넌트

  lib/
    api/                                  # binance/coinalyze/polymarket client
    stores/                               # app state (localStorage persisted)
    engine/                               # game loop/scoring/replay
    data/                                 # agents/tokens/warroom fixtures
```

## 6) Runtime Architecture

### Client

- 주요 상태는 Svelte store에서 관리됩니다.
- 다수 store가 localStorage에 debounce 저장합니다.
- 차트는 `lightweight-charts` + Binance WS 업데이트로 구동됩니다.

### Server (SvelteKit API Routes)

- 외부 API CORS 우회를 위해 프록시 라우트 사용
  - `/api/coinalyze`
  - `/api/polymarket/*`
- 주요 도메인 액션(트레이드/시그널/프로필/알림/커뮤니티)은 PostgreSQL API 라우트로 기록됩니다.

## 7) Data Flow (요약)

1. `WarRoom`/`ChartPanel`이 가격 데이터(Binance + proxy API)를 조회/구독
2. 유저 액션(트레이드/시그널/복제/알림/프로필)이 API 라우트로 저장
3. store는 UI 반응성과 오프라인 복원을 위해 localStorage를 캐시로 유지
4. 세션 기반 유저 컨텍스트로 DB 상태를 재조회해 화면을 복원

## 8) API Endpoints

### Auth

- `POST /api/auth/register`
  - body: `{ email, nickname, walletAddress?, walletSignature? }`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `POST /api/auth/nonce`
  - body: `{ address, provider? }`
- `POST /api/auth/verify-wallet`
  - body: `{ address, message, signature, provider? }`
- `POST /api/auth/wallet`
  - body: `{ address, signature?, provider }`

### Matches

- `GET /api/matches?limit=50&offset=0&userId=...`
- `POST /api/matches`

### Quick Trades

- `GET /api/quick-trades?limit=50&offset=0&status=open`
- `POST /api/quick-trades/open`
- `POST /api/quick-trades/{id}/close`
- `PATCH /api/quick-trades/prices`

### Signals / Actions

- `GET /api/signals?limit=50&offset=0&status=tracking`
- `POST /api/signals/track`
- `POST /api/signals/{id}/convert`
- `DELETE /api/signals/{id}`
- `GET /api/signal-actions?limit=50&offset=0`
- `POST /api/signal-actions`

### Copy Trades

- `GET /api/copy-trades/runs?limit=50&offset=0`
- `GET /api/copy-trades/runs/{id}`
- `POST /api/copy-trades/publish`

### PnL / Predictions / Agents

- `GET /api/pnl?limit=50&offset=0`
- `POST /api/pnl`
- `GET /api/pnl/summary`
- `GET /api/predictions?limit=50&offset=0`
- `POST /api/predictions/vote`
- `POST /api/predictions/positions/open`
- `POST /api/predictions/positions/{id}/close`
- `GET /api/agents/stats`
- `PATCH /api/agents/stats/{agentId}`

### Profile / Preferences / UI State

- `GET /api/profile`
- `PATCH /api/profile`
- `GET /api/profile/passport`
- `GET /api/preferences`
- `PUT /api/preferences`
- `GET /api/ui-state`
- `PUT /api/ui-state`

### Community / Notifications / Activity / Chat

- `GET /api/community/posts?limit=50&offset=0`
- `POST /api/community/posts`
- `POST /api/community/posts/{id}/react`
- `DELETE /api/community/posts/{id}/react`
- `GET /api/notifications?limit=50&offset=0&unreadOnly=true`
- `POST /api/notifications/read`
- `DELETE /api/notifications/{id}`
- `GET /api/activity?limit=50&offset=0`
- `POST /api/activity/reaction`
- `GET /api/chat/messages?channel=terminal&limit=50&offset=0`
- `POST /api/chat/messages`

### External Proxy

- `GET /api/coinalyze?endpoint=<allowed>&...params`
- `GET /api/polymarket/markets?limit=20&category=crypto`
- `GET /api/polymarket/orderbook?token_id=...`

## 9) Configuration Notes

- timeframe 표기가 코드 전반에 `1h/4h`와 `1H/4H` 혼재되어 있습니다.
- 새 기능 추가 시 timeframe enum/mapper를 먼저 정규화하는 것을 권장합니다.

## 10) Known Issues (현재 기준)

- `auth_nonces` 마이그레이션(`003`) 미적용 환경에서는 wallet verify API가 실패합니다.
- store는 DB와 localStorage를 병행(dual-write/dual-read)하므로 완전 서버 단일화 전까지 동기화 이슈 여지가 있습니다.
- localStorage reset 시 일부 키 불일치 가능성
- 대형 컴포넌트(`ChartPanel`, `arena/+page`)에 책임이 집중되어 디버깅 난이도 상승

## 11) Refactoring Roadmap

1. Domain Type 정규화
   - timeframe/direction/tier 단일 타입 체계화
   - 변환 함수 중앙화
2. API Contract 강화
   - request/response 스키마 검증 도입
   - session 검증 강화
3. Persistence Layer 통합
   - localStorage adapter + key 상수화
   - 버전 마이그레이션 도입
4. Component Decomposition
   - ChartPanel 로직 분리 (`data/ws/indicator/drawing`)
   - arena page phase orchestration 분리
5. Test Baseline
   - timeframe mapping
   - session parsing
   - store reset/restore
   - indicator 계산 최소 케이스

## 12) Execution Tickets (Actionable)

아래 티켓은 바로 작업 가능한 최소 단위로 쪼갠 실행 계획입니다.

### Sprint 1 (Stabilize / P0)

- `T1-1` Timeframe 표준화
  - 대상 파일: `src/lib/stores/gameState.ts`, `src/lib/api/binance.ts`, `src/lib/api/coinalyze.ts`, `src/components/arena/SquadConfig.svelte`, `src/components/terminal/WarRoom.svelte`
  - 작업: `1h/4h` vs `1H/4H` 혼재 제거, 단일 타입 + 매핑 유틸 도입
  - 완료 기준: pair/timeframe 변경 시 Binance/Coinalyze 요청이 일관된 interval로 전송

- `T1-2` Session 검증 강화
  - 대상 파일: `src/routes/api/auth/session/+server.ts`, `src/routes/api/auth/register/+server.ts`
  - 작업: 쿠키 파싱 실패/비정상 포맷 방어, 최소 사용자 조회 검증 추가
  - 완료 기준: 임의 문자열 쿠키로 `authenticated: true`가 되지 않음

- `T1-3` Reset key 불일치 수정
  - 대상 파일: `src/routes/settings/+page.svelte`, `src/lib/stores/*.ts`
  - 작업: 실제 저장 키와 reset 로직 키 동기화
  - 완료 기준: Reset 실행 시 주요 store 데이터가 의도대로 초기화

### Sprint 2 (Persistence / P1)

- `T2-1` Storage Adapter 도입
  - 대상 파일: `src/lib/stores/` 하위 공통 유틸 신설
  - 작업: `load/save/remove` 공통 함수 + 에러 핸들링 통합
  - 완료 기준: store에서 localStorage 직접 접근 코드 감소

- `T2-2` Key 상수화 + 스키마 버전
  - 대상 파일: `src/lib/stores/` 전반
  - 작업: key 상수 모듈과 `schemaVersion` 마이그레이션 루틴 추가
  - 완료 기준: 구버전 데이터 로딩 시 안전하게 기본값/변환 적용

### Sprint 3-4 (Decompose / P2)

- `T3-1` ChartPanel 분리
  - 대상 파일: `src/components/arena/ChartPanel.svelte`, `src/lib/` 신규 모듈
  - 작업: `data(ws/fetch)`, `indicator`, `drawing`, `tv-mode` 책임 분리
  - 완료 기준: `ChartPanel.svelte` 라인 수/책임 축소, 기능 회귀 없음

- `T3-2` Arena Page 오케스트레이션 분리
  - 대상 파일: `src/routes/arena/+page.svelte`, `src/lib/engine/` 신규 모듈
  - 작업: phase 처리, replay, feed 업데이트 로직을 서비스 레이어로 이동
  - 완료 기준: UI 컴포넌트는 상태 바인딩/이벤트 위주로 단순화

### Sprint 5 (API Contract / P3)

- `T5-1` Request/Response 스키마 검증
  - 대상 파일: `src/routes/api/auth/*`, `src/routes/api/matches/+server.ts`, `src/routes/api/coinalyze/+server.ts`
  - 작업: 입력 파라미터 검증, 에러 응답 포맷 표준화
  - 완료 기준: 잘못된 요청에 대해 일관된 4xx 응답

- `T5-2` In-memory 의존도 축소 준비
  - 대상 파일: `src/routes/api/auth/register/+server.ts`, `src/routes/api/matches/+server.ts`
  - 작업: 저장소 인터페이스 추출(향후 DB 교체 가능 구조)
  - 완료 기준: 핸들러가 저장 구현체와 느슨하게 결합

### Sprint 6 (Tests / P4)

- `T6-1` 핵심 단위 테스트
  - 대상 파일: `src/lib/api/*`, `src/lib/stores/*`, `src/routes/api/*` 관련 테스트
  - 작업: timeframe mapping/session parsing/storage migration 테스트 추가
  - 완료 기준: 회귀가 잦은 구간에 자동 검증 확보

- `T6-2` 계산 로직 테스트
  - 대상 파일: indicator/scoring 관련 모듈
  - 작업: 지표 계산값 최소 fixture 기반 테스트
  - 완료 기준: 계산 변경 시 테스트로 영향 감지 가능

## 13) Definition of Done (Refactor)

- `npm run check` 통과
- 주요 화면(`home/terminal/arena/signals/passport`) 진입 회귀 없음
- timeframe/pair 전환 시 데이터 fetch 오류 없음
- reset 동작과 persistence 동작이 문서화된 키와 일치
- API 에러 응답 형태가 문서와 일치

## 14) Troubleshooting

### `Missing API key` (Coinalyze)

- `.env`에 `COINALYZE_API_KEY`를 설정했는지 확인
- dev 서버 재시작 후 재확인

### 차트가 OFFLINE으로 표시됨

- 네트워크 연결 확인
- Binance API/WS 접근 가능 여부 확인
- 브라우저 콘솔에서 `/api/coinalyze` 또는 Binance fetch 에러 확인

### 데이터가 초기화됨

- 현재 일부 API 데이터는 in-memory 저장
- 서버 재시작 시 유실될 수 있음

## 15) Security

- API 키는 반드시 `.env`로만 관리
- 키가 노출되었으면 즉시 폐기(rotate) 후 교체
- 프로덕션에서는 인증/세션/매치 저장소를 영속 DB로 이전 필요

## 16) Contribution Guide (Internal)

- 변경 전 `npm run check` 통과 기준으로 작업
- store key 추가/변경 시 reset/migration 경로 함께 업데이트
- 외부 API 추가 시 프록시 라우트 + 에러 매핑 + 캐시 정책 명시

## 17) License

Private project.

## 18) Performance Change Log

### 2026-02-23 (Deployment latency fix)

- 변경 파일: `src/hooks.server.ts`
- 변경 내용: 앱 레벨 수동 gzip(`gzipSync` + `response.arrayBuffer()`) 제거
- 이유: 모든 응답을 서버에서 동기 압축하면 CPU 사용량/TTFB가 증가하고 스트리밍 이점이 사라짐
- 운영 정책: 압축은 앱 코드가 아닌 CDN/리버스 프록시에서 처리 (`br`/`gzip`)

검증 방법:

```bash
curl -I -H 'Accept-Encoding: br,gzip' https://<your-domain>/
```

- `Content-Encoding: br` 또는 `Content-Encoding: gzip` 헤더가 보이면 정상

### 2026-02-23 — Server Performance Hardening (`9ddc4b3`)

- 서버 모듈 캐싱 5건 추가 (yahoo/feargreed/defillama/coingecko/marketFeed)
- persistSnapshots N+1 → 배치 INSERT (24쿼리 → 2쿼리)
- battleInterval 메모리 누수 수정 (onDestroy cleanup)
- walletStore localStorage 디바운스 300ms
- quickTradeStore 즉시 hydration 제거 → terminal onMount
- 터미널 3초 폴링 최적화 (가격 해시 비교)

상세 변경 파일: `docs/AGENT_WATCH_LOG.md` → W-20260223-002 참조

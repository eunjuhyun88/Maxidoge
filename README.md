# MAXI⚡DOGE Unified

AI 에이전트 기반 트레이딩 시뮬레이션 웹앱입니다.  
SvelteKit + TypeScript 기반으로 `Arena`, `Terminal (War Room/Intel)`, `Signals`, `Passport` 경험을 제공합니다.

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
- 인증/매치 API는 현재 **in-memory 저장소**를 일부 사용합니다.

## 7) Data Flow (요약)

1. `WarRoom`에서 pair/timeframe 기준 파생 데이터(Coinalyze) 조회
2. `ChartPanel`이 Binance kline + websocket으로 가격/지표 반영
3. 유저 액션(시그널 추적/퀵트레이드/아레나 결과)이 각 store에 반영
4. store 상태가 localStorage로 persisted

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

### External Proxy

- `GET /api/coinalyze?endpoint=<allowed>&...params`
- `GET /api/polymarket/markets?limit=20&category=crypto`
- `GET /api/polymarket/orderbook?token_id=...`

## 9) Configuration Notes

- timeframe 표기가 코드 전반에 `1h/4h`와 `1H/4H` 혼재되어 있습니다.
- 새 기능 추가 시 timeframe enum/mapper를 먼저 정규화하는 것을 권장합니다.

## 10) Known Issues (현재 기준)

- 세션 체크 API가 쿠키 형식 위주로 판단하는 구간이 있음
- `register/matches` API 일부 데이터가 서버 메모리 기반이라 재시작 시 유실됨
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

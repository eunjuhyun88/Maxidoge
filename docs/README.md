# MAXI DOGE v3 Documentation Hub

Last updated: 2026-02-22
Purpose: 다중 에이전트 협업의 단일 진입점. **모든 에이전트는 작업 전 이 문서를 먼저 읽는다.**

---

## 0. 이 문서를 읽는 에이전트에게

당신은 MAXI DOGE 프로젝트에서 작업하는 AI 에이전트입니다. 이 프로젝트는 **여러 에이전트(Claude A, Claude B 등)와 유저(EJ)가 동시에 같은 코드베이스를 수정**합니다. 혼선을 방지하기 위해 반드시 아래 규칙을 따르세요:

1. 작업 전: 이 README 전체를 읽고, §2 구현 현황을 확인한다
2. 코드 수정 전: `git pull`로 최신 상태를 가져온다
3. 설계 수정 시: §6 교차 참조 표를 확인하고, 연관 문서도 함께 수정한다
4. 작업 후: §9 Changelog에 기록하고, 커밋 메시지에 변경 이유를 명시한다
5. **설계 승인 전 코드 구현 금지** — 현재 상태: DESIGN REVIEW 단계

---

## 1. 프로젝트 개요

MAXI DOGE는 암호화폐 트레이딩 인텔리전스 플랫폼. v3는 기존 7-에이전트 시스템을 8-에이전트 + 5-Phase 매치 + Spec/Tier 시스템으로 전면 재설계한다.

**기술 스택**: SvelteKit 2 / Svelte 5 / TypeScript / Vite 7.3.1 / Supabase + pgvector
**빌드**: `node node_modules/.bin/vite build` (npm run build는 sh ENOENT 이슈)
**체크**: `npx svelte-check`
**GitHub**: `eunjuhyun88/Maxidoge` / 브랜치: `codex/hero-scroll-interaction`

---

## 2. 구현 현황 스냅샷 (2026-02-22 기준)

### 2.1 EXISTS (코드에 존재, 동작함)

| 항목 | 파일 | 비고 |
|------|------|------|
| v3 타입 30+ | `engine/types.ts` (380줄) | AgentId, MatchPhase, Tier, DraftSelection 등 |
| 8 Agent Pool | `engine/agents.ts` (224줄) | AGENT_POOL Record, 48 FactorDefinition |
| 32 Spec | `engine/specs.ts` (571줄) | SPEC_REGISTRY, 가중치 검증 함수 |
| LP/Tier 상수 | `engine/constants.ts` (174줄) | TIER_TABLE, getTierForLP() |
| 5-Phase 엔진 | `phases.ts` + `gameLoop.ts` | DRAFT~RESULT 루프 |
| DB Migration 004 | `004_agent_engine_v3.sql` (463줄) | 11테이블 + pgvector + enums |
| WarRoom 스캔 | `warroomScan.ts` (407줄) | Binance+Coinalyze → 5에이전트 스코어링 |
| API 42개 | `src/routes/api/**` | auth, signals, trades, chat, community 등 |
| Store 17개 | `src/lib/stores/**` | gameState, walletStore, agentData 등 |
| Oracle v3 | `oracle/+page.svelte` | AGENT_POOL 사용, Wilson score |

### 2.2 DESIGNED ONLY (설계 문서에만 존재, 코드 없음)

| 항목 | 설계 문서 | 백로그 |
|------|----------|--------|
| `progressionStore` | ARCHITECTURE_DESIGN §1.3 | S-02 |
| `priceService` | ARCHITECTURE_DESIGN §1.4 | S-03 |
| Arena Match API (`/api/arena/match/*`) | API_CONTRACT §2 | B-01 |
| Agent Pipeline (scoring 실행) | ARCHITECTURE_DESIGN §2.2 | B-03 |
| Exit Optimizer | ARCHITECTURE_DESIGN §2.3 | B-04 |
| RAG Memory 연동 | ARCHITECTURE_DESIGN §2.4 | B-07 |
| Terminal Scan API (서버사이드) | API_CONTRACT §9.2 | B-09 |
| Terminal Chat (컨텍스트 기반 응답) | API_CONTRACT §9.1 | B-10 |
| Migration 005 (3 신규 테이블) | PERSISTENCE_DESIGN §3 | S-05 |

### 2.3 LEGACY (교체 필요)

| 항목 | 파일 | 문제 | 교체 계획 |
|------|------|------|----------|
| AGDEFS 7-에이전트 | `data/agents.ts` | guardian/commander/scanner 포함 | S-01: AGENT_POOL 브릿지 |
| AGDEFS import 15개 파일 | Lobby, SquadConfig, BattleStage, terminal, passport 등 | v2 에이전트 참조 | F-01 |
| scoring.ts guardian | `engine/scoring.ts` | hasGuardianOverride 파라미터 | S-01 |
| Lobby guardian 기본선택 | `Lobby.svelte:9` | `['structure','flow','deriv','senti','guardian']` | F-04 |
| agentData 7에이전트 초기화 | `stores/agentData.ts` | AGDEFS 기반 초기화 | S-01 |
| 가격 3곳 분산 WS | Header/Chart/Terminal 각각 | 불일치 위험 | S-03 |

---

## 3. 핵심 상수 (에이전트가 코딩할 때 필요한 숫자)

| 상수 | 값 | 출처 |
|------|-----|------|
| 에이전트 총 수 | 8 | engine/agents.ts |
| 스펙 총 수 | 32 (8x4) | engine/specs.ts |
| 드래프트 에이전트 수 | 3 | engine/constants.ts |
| 드래프트 가중치 합 | 100 | engine/constants.ts |
| 드래프트 가중치 최소/최대 | 10 / 80 | engine/constants.ts |
| ANALYSIS 시간 | 5s / speed | engine/phases.ts |
| HYPOTHESIS 시간 | 30s / speed | engine/phases.ts |
| BATTLE 시간 | 12s / speed | engine/phases.ts |
| Battle TP/SL 타임아웃 | 8s | ARCHITECTURE_DESIGN §4.3 |
| 가격 배치 인터벌 | 350ms | ARCHITECTURE_DESIGN §1.4 |
| Klines 조회 수 | 240 | ARCHITECTURE_DESIGN §2.2 |
| 스캔 탭 최대 | 6 | TERMINAL_SCAN_E2E §3.1 |
| 탭당 시그널 최대 | 60 | TERMINAL_SCAN_E2E §3.1 |
| 추적 시그널 만료 | 24시간 | PERSISTENCE_DESIGN §4.4 |
| WarRoom 현재 줄수 | 1,142 | 코드 실측 |
| WarRoom 목표 줄수 | 800 이하 | MASTER_DESIGN Phase B |

### Tier 테이블

| Tier | LP 범위 | 스펙 해금 |
|------|--------|----------|
| BRONZE | 0-199 | base (0판) |
| SILVER | 200-599 | a/b (10판) |
| GOLD | 600-1199 | a/b (10판) |
| DIAMOND | 1200-2199 | c (30판) |
| MASTER | 2200+ | c (30판) |

### 8 에이전트 배치

| AgentId | 역할 | 그룹 | Terminal 스캔 | Arena 드래프트 |
|---------|------|------|:---:|:---:|
| `structure` | OFFENSE | 방향 판단 | O | O |
| `vpa` | OFFENSE | 방향 판단 | X | O |
| `ict` | OFFENSE | 방향 판단 | X | O |
| `deriv` | DEFENSE | 리스크 | O | O |
| `valuation` | DEFENSE | 리스크 | X | O |
| `flow` | DEFENSE | 리스크 | O | O |
| `senti` | CONTEXT | 환경 | O | O |
| `macro` | CONTEXT | 환경 | O | O |

---

## 4. 용어 사전 (Naming Glossary)

문서/코드에서 반드시 이 이름만 사용. 다른 표현 금지.

| 정본 용어 | 금지 표현 | 설명 |
|-----------|----------|------|
| `AGENT_POOL` | AGDEFS, agents 배열 | 8 에이전트 정의 유일한 소스 |
| `AgentId` | agentName, agentKey | `'structure'\|'vpa'\|'ict'\|'deriv'\|'valuation'\|'flow'\|'senti'\|'macro'` |
| `DraftSelection` | squad, team, lineup | `{ agentId, specId, weight }` |
| `MatchPhase` | phase, stage, step | `'DRAFT'\|'ANALYSIS'\|'HYPOTHESIS'\|'BATTLE'\|'RESULT'` |
| `Tier` | level, rank, grade | `'BRONZE'\|'SILVER'\|'GOLD'\|'DIAMOND'\|'MASTER'` |
| `LP` | points, score, XP | League Points |
| `progressionStore` | walletStore.lp, userProfileStore.tier | LP/Tier/Matches 단일 소스 (미구현) |
| `priceService.livePrice` | gameState.prices, miniTicker | 가격 단일 소스 (미구현) |
| `terminal_scan_runs` | terminal_scans, scan_sessions | 스캔 세션 테이블명 |
| `terminal_scan_signals` | — | 스캔 시그널 테이블명 |
| `agent_chat_messages` | terminal_chat_messages, chat_log | 에이전트 채팅 테이블명 |
| `/api/chat/messages` | /api/terminal/chat | 채팅 API 경로 (기존 API 확장) |
| `/api/terminal/scan/history` | /api/terminal/scans | 스캔 히스토리 API 경로 |
| `overrideMode` | — | `'AGENT_FOLLOW'\|'USER_OVERRIDE'` |
| `response_source` | — | `'scan_context'\|'llm'\|'fallback'` |
| `consensus` / `vote` | direction (scan context) | `'long'\|'short'\|'neutral'` |

---

## 5. API 엔드포인트 전체 목록

### 5.1 Arena Match API (Target — 미구현)

| Method | Path | 설명 | 백로그 |
|--------|------|------|--------|
| POST | `/api/arena/match/create` | 매치 생성 | B-01 |
| POST | `/api/arena/match/:id/draft` | 드래프트 제출 | B-01 |
| POST | `/api/arena/match/:id/analyze` | 분석 실행 | B-01 |
| POST | `/api/arena/match/:id/hypothesis` | 가설 제출 | B-01 |
| GET | `/api/arena/match/:id/result` | 결과 조회 | B-01 |

### 5.2 Terminal API (Target — 미구현)

| Method | Path | 설명 | 백로그 |
|--------|------|------|--------|
| POST | `/api/terminal/scan` | 스캔 실행 (BE) | B-09 |
| GET | `/api/terminal/scan/history?pair=...&tf=...&limit=20` | 스캔 히스토리 | B-09 |
| GET | `/api/terminal/scan/:id` | 단일 스캔 상세 | B-09 |
| GET | `/api/terminal/scan/:id/signals` | 시그널 목록 | B-09 |

### 5.3 Chat API (기존 확장)

| Method | Path | 설명 | 백로그 |
|--------|------|------|--------|
| GET | `/api/chat/messages?channel=terminal&limit=50` | 채팅 히스토리 | 기존 |
| POST | `/api/chat/messages` | 메시지 전송 (meta.mentionedAgent 시 에이전트 응답 생성) | B-10 확장 |
| POST | `/api/chat/uploads` | 멀티모달 업로드 | 향후 |

### 5.4 기존 API (이미 구현됨 — 42개)

주요: `/api/auth/*`, `/api/signals/*`, `/api/quick-trades/*`, `/api/copy-trades/*`, `/api/predictions/*`, `/api/pnl/*`, `/api/agents/stats/*`, `/api/profile/*`, `/api/chat/messages`, `/api/community/*`, `/api/matches`, `/api/coinalyze`, `/api/ui-state`

### 5.5 응답 형식 주의

| API 그룹 | 성공 키 | 봉투 형식 |
|----------|---------|----------|
| Arena/Terminal/Market (v3 신규) | `ok: true` | `{ ok, data }` |
| Chat (기존) | `success: true` | `{ success, records/message }` |
| 기타 기존 API | 혼재 | 개별 확인 필요 |

---

## 6. DB 테이블 전체 목록

### 6.1 v3 신규 (Migration 004 — 존재)

`indicator_series`, `market_snapshots`, `arena_matches`, `agent_analysis_results`, `match_memories` (pgvector 256d), `user_passports`, `user_agent_progress`, `agent_accuracy_stats`, `lp_transactions`, `live_sessions`, `agent_challenges`

### 6.2 v3 신규 (Migration 005 — 미생성)

`terminal_scan_runs`, `terminal_scan_signals`, `agent_chat_messages`

DDL은 `PERSISTENCE_DESIGN.md §3`에 정의. 백로그 S-05.

### 6.3 기존 (pre-v3)

`app_users`, `chat_messages`, `user_ui_state`, `user_preferences`, `quick_trades`, `tracked_signals`, `community_posts`

---

## 7. 설계 문서 맵

### 7.1 정본 8개 (구현 시 이것만 참조)

| # | 파일 | 역할 | 정본 질문 |
|---|------|------|----------|
| 1 | `MASTER_DESIGN.md` | 프로그램 범위, Phase A-H 순서, 머지 게이트 | 뭘 만들고 어떤 순서? |
| 2 | `ARCHITECTURE_DESIGN.md` | Shared/BE/FE 타겟 아키텍처, 상세 설계 | 타겟 구조와 계약은? |
| 3 | `INTERACTION_CALL_MAP.md` | 클릭 → 호출체인 → 상태변경 → UI전이 | 유저가 X 누르면? |
| 4 | `TERMINAL_SCAN_E2E_SPEC.md` | 스캔 1회의 좌/중/우 + 히스토리 + 영속 | 스캔 후 정확히 뭐가 바뀌나? |
| 5 | `FE_STATE_MAP.md` | FE 상태 소유권, 스토어 규칙 | 어느 store가 소유? |
| 6 | `API_CONTRACT.md` | API 요청/응답/에러 계약 | API 페이로드? |
| 7 | `PERSISTENCE_DESIGN.md` | Supabase 전환, 캐시 전략 | 데이터가 어디에 저장? |
| 8 | `REFACTORING_BACKLOG.md` | S/B/F 실행 큐, 의존성, 상태 | 다음에 뭘 구현? |

### 7.2 충돌 시 우선순위

```
1. MASTER_DESIGN          (프로그램 방향)
2. ARCHITECTURE_DESIGN    (타겟 구조)
3. API_CONTRACT           (API 계약)
4. FE_STATE_MAP           (FE 상태 계약)
5. INTERACTION_CALL_MAP   (인터랙션 동작)
6. TERMINAL_SCAN_E2E_SPEC (스캔 동작)
7. PERSISTENCE_DESIGN     (영속성)
8. REFACTORING_BACKLOG    (실행 큐)
```

### 7.3 레퍼런스 (구현에 직접 사용 안 함)

`STRUCTURE_ALIGNMENT_ACTION_PLAN.md`, `p0-alignment-checklist-latest.md`, `structure-mismatch-audit-latest.md`, `schema-redesign-analysis.md`, `full-file-audit.md`, `click-backend-navigation-audit.md`, `database-design.md`, `v3-direct-rewrite-status-2026-02-22.md`

### 7.4 Legacy (구버전, 히스토리 목적)

`MAXIDOGE_Final_Integrated_Spec_v1.md`, `MAXIDOGE_DesignDoc_v1.md`, `MAXIDOGE_UserJourney_v1.md`, `MAXIDOGE_FlowSpec_v2_0.md`, `MAXIDOGE_Implementation_Priority_v1.md`

---

## 8. 실행 규칙

### 8.1 브랜치 규칙

```
codex/contract-*   — Shared 트랙 (계약/코어)
codex/be-*         — BE 트랙 (API/서비스/DB)
codex/fe-*         — FE 트랙 (컴포넌트/스토어/UI)
```

금지: `codex/shared-*` (구 명칭)

### 8.2 백로그 실행 순서 (고정)

```
Phase 1: 계약 확정
  S-01 → S-02 → S-03 → S-04 → S-05

Phase 2: 병렬 시작
  BE: B-01 + B-02 + B-09
  FE: F-01 + F-03

Phase 3: 크리티컬 패스
  BE: B-03 + B-10 + B-11
  FE: F-04 → F-05 → F-06

Phase 4: 마무리
  BE: B-05 + B-06 + B-07 + B-08
  FE: F-07 + F-08 + F-09 + F-10 + F-11
```

### 8.3 백로그 ID 현황

| Track | 사용 중 | 다음 가용 ID |
|-------|--------|-------------|
| Shared | S-01 ~ S-05 | **S-06** |
| BE | B-01 ~ B-11 | **B-12** |
| FE | F-01 ~ F-11 | **F-12** |

새 항목 추가 시 이 표를 업데이트할 것.

### 8.4 검증 게이트

매 티켓 완료 시:
1. `node node_modules/.bin/vite build` — 0 errors
2. `npx svelte-check` — 0 errors
3. 브라우저 수동 확인

### 8.5 금지 사항

- FE/BE 혼합 PR
- 설계 승인 전 코드 구현
- AGDEFS 직접 수정 (브릿지 통해서만)
- guardian/commander/scanner 신규 참조
- localStorage primary 신규 도입 (Supabase primary 필수)

---

## 9. 다중 에이전트 협업 규칙

### 9.1 문서 소유자

| 문서 | Primary Owner | 수정 시 확인 |
|------|---------------|-------------|
| `MASTER_DESIGN` | User (EJ) | 방향 변경은 유저만 |
| `ARCHITECTURE_DESIGN` | 공동 | MASTER와 정합성 |
| `INTERACTION_CALL_MAP` | 공동 | 실제 코드와 일치 여부 |
| `TERMINAL_SCAN_E2E_SPEC` | User (EJ) | 제품 동작은 유저 소유 |
| `FE_STATE_MAP` | FE 담당 에이전트 | API_CONTRACT 정합성 |
| `API_CONTRACT` | 공동 | PERSISTENCE_DESIGN 정합성 |
| `PERSISTENCE_DESIGN` | BE 담당 에이전트 | API_CONTRACT, SQL 정합성 |
| `REFACTORING_BACKLOG` | 전체 | ID 충돌 체크 (§8.3) |

### 9.2 교차 수정 시 필수 확인

| 수정한 문서 | 반드시 확인 |
|------------|-----------|
| `API_CONTRACT` | `PERSISTENCE_DESIGN`, `INTERACTION_CALL_MAP` |
| `PERSISTENCE_DESIGN` | `API_CONTRACT`, `REFACTORING_BACKLOG` |
| `FE_STATE_MAP` | `INTERACTION_CALL_MAP`, `TERMINAL_SCAN_E2E_SPEC` |
| `REFACTORING_BACKLOG` | `PERSISTENCE_DESIGN §9` |
| `INTERACTION_CALL_MAP` | `TERMINAL_SCAN_E2E_SPEC` (Terminal 관련 시) |

### 9.3 파일 네이밍 규칙

| 구분 | 네이밍 | 예시 |
|------|--------|------|
| v3 설계 문서 | `UPPER_SNAKE_CASE.md` | `API_CONTRACT.md` |
| Legacy 스펙 | `MAXIDOGE_*.md` | `MAXIDOGE_DesignDoc_v1.md` |
| 레퍼런스/감사 | `kebab-case.md` | `full-file-audit.md` |

금지: `v3-` 접두사, 공백, 이모지, 한글 파일명

---

## 10. Changelog

형식: `날짜 | 작성자 | 커밋 | 변경 내용`

### 2026-02-22

| 시간 | 작성자 | 커밋 | 변경 |
|------|--------|------|------|
| 오전 | Agent (Codex) | `2d921c7` | engine/types, agents, specs, constants, 004_agent_engine_v3.sql 신규 생성 |
| 오전 | Agent (Codex) | `5d63111` | svelte-check 14개 에러 수정, v3 engine base 정리 |
| 오전 | Agent (Codex) | `2acbd4a` | arena/+page.svelte guardian->macro 교체 |
| 오전 | Agent (Claude Code) | `9e767c9` | REFACTORING_BACKLOG 신규 생성 (3-track S/B/F) |
| 오후 | Agent (Claude Code) | `89c15fe` | BACKLOG 유저 확인 포맷으로 업데이트 |
| 오후 | Agent (Claude Code) | `45c8b02` | 5개 설계문서 신규: MASTER, ARCHITECTURE, API_CONTRACT, FE_STATE, INTERACTION |
| 오후 | User (EJ) | — | INTERACTION §7-14 추가, FE_STATE §9 추가, API_CONTRACT §9 추가, TERMINAL_SCAN_E2E 신규 생성 |
| 오후 | Agent (Claude Code) | `8993bca` | PERSISTENCE_DESIGN 신규 + 유저 수정사항 커밋 |
| 저녁 | Agent (Claude Code) | `f423b45` | 7개 문서 교차검증 → 9개 이슈 수정 (Critical 5 + Important 4) |
| 저녁 | Agent (다른 세션) | — | ARCHITECTURE, FE_STATE, INTERACTION에 Doc index 라인 추가 |
| 저녁 | Agent (Claude Code) | `1a39ea3` | README 재작성 + Doc index 8개 문서 통일 |
| 저녁 | Agent (Claude Code) | 현재 | README 전면 재작성 (에이전트 온보딩 허브) |

---

## 11. Quick Start by Role

### 새로 합류하는 에이전트
1. 이 README 전체 읽기 (현재 문서)
2. §2 구현 현황에서 EXISTS/DESIGNED/LEGACY 파악
3. `REFACTORING_BACKLOG.md`에서 다음 작업 확인
4. 담당 작업의 상세 설계문서 읽기
5. `git pull` 후 작업 시작
6. 작업 후 §10 Changelog 기록

### FE 에이전트
`FE_STATE_MAP.md` → `INTERACTION_CALL_MAP.md` → `API_CONTRACT.md` → `REFACTORING_BACKLOG.md`

### BE 에이전트
`API_CONTRACT.md` → `PERSISTENCE_DESIGN.md` → `ARCHITECTURE_DESIGN.md` → `REFACTORING_BACKLOG.md`

### Product / UX
`MASTER_DESIGN.md` → `INTERACTION_CALL_MAP.md` → `TERMINAL_SCAN_E2E_SPEC.md`

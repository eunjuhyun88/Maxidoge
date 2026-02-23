# MAXI DOGE Collaboration README (Single Source for Agents)

Last updated: 2026-02-22  
Audience: EJ + all coding agents working in parallel  
Purpose: **작업 전에 반드시 읽고, 이 문서를 기준으로만 설계/문서/코드 변경을 진행한다.**

---

## 0. Mandatory Rule

이 프로젝트에서 작업하는 모든 에이전트는 아래 순서를 지킨다.

1. `docs/README.md`를 먼저 읽는다.
2. 아래 `Core Docs`를 읽고 현재 변경 범위를 확정한다.
3. 변경 후 `Cross-Doc Update Matrix`에 따라 연관 문서를 함께 수정한다.
4. 마지막에 `Consistency Check Commands`를 실행해 불일치 패턴이 0인지 확인한다.

이 절차를 건너뛰고 코드/문서를 수정하지 않는다.

---

## 1. Core Docs (정본)

아래 7개가 정본이다. (`REFACTORING_BACKLOG.md`는 실행 큐 보조 문서)

1. `MASTER_DESIGN.md`  
프로그램 방향, 단계 순서, 머지 게이트
2. `ARCHITECTURE_DESIGN.md`  
Shared/BE/FE 목표 아키텍처
3. `API_CONTRACT.md`  
API 요청/응답/에러 계약
4. `FE_STATE_MAP.md`  
프론트 상태 소유권/스토어 규칙
5. `INTERACTION_CALL_MAP.md`  
클릭 -> 호출 -> 상태 -> UI 전환
6. `TERMINAL_SCAN_E2E_SPEC.md`  
Terminal 스캔 1회 E2E 흐름
7. `PERSISTENCE_DESIGN.md`  
DB/영속성/캐시/마이그레이션

보조 실행 문서:
1. `REFACTORING_BACKLOG.md`

---

## 2. Conflict Priority (충돌 시 우선순위)

문서가 서로 다르면 아래 우선순위를 따른다.

1. `MASTER_DESIGN.md`
2. `ARCHITECTURE_DESIGN.md`
3. `API_CONTRACT.md`
4. `FE_STATE_MAP.md`
5. `INTERACTION_CALL_MAP.md`
6. `TERMINAL_SCAN_E2E_SPEC.md`
7. `PERSISTENCE_DESIGN.md`
8. `REFACTORING_BACKLOG.md`

---

## 3. Canonical Decisions (이미 확정된 통일 규칙)

아래 항목은 다시 흔들지 않는다.

1. Chat API 경로: `GET/POST /api/chat/messages` (`channel=terminal` 사용)
2. Scan history 경로: `GET /api/terminal/scan/history?pair=...&timeframe=...&limit=...`
3. Branch prefix:
- Shared: `codex/contract-*`
- BE: `codex/be-*`
- FE: `codex/fe-*`
4. Hypothesis `overrideMode` enum:
- `AGENT_FOLLOW`
- `USER_OVERRIDE`
5. Terminal scan agent 범위 (현재): 5개
- `STRUCTURE`, `FLOW`, `DERIV`, `SENTI`, `MACRO`
 - 역할: 시장 데이터 수집/요약/초기 시나리오 제안
6. Arena는 8 Agent Pool 전체 기준
7. 최종 의사결정 규칙:
- Terminal scan `consensus`는 추천 신호이며 자동 집행 결정이 아니다.
- 최종 진입 방향/리스크 결정은 트레이더가 수행한다. (Arena에서는 `HYPOTHESIS` 입력이 최종 결정)
8. Chat 저장소 호환:
- 마이그레이션 기간에 `/api/chat/messages`는 내부적으로 `chat_messages` 또는 `agent_chat_messages` adapter 허용
- 외부 JSON 계약은 유지
9. Backlog 번호 기준:
- `B-08` = legacy `/api/matches` adapter
- Terminal 관련 신규는 `B-09~B-11`, `F-09~F-11`

---

## 4. Cross-Doc Update Matrix (한 문서 바꾸면 같이 바꿔야 하는 문서)

### 4.1 API 경로/파라미터 변경

반드시 동시 수정:
1. `API_CONTRACT.md`
2. `PERSISTENCE_DESIGN.md`
3. `INTERACTION_CALL_MAP.md`
4. `TERMINAL_SCAN_E2E_SPEC.md` (Terminal 관련일 때)

### 4.2 상태/스토어 구조 변경

반드시 동시 수정:
1. `FE_STATE_MAP.md`
2. `INTERACTION_CALL_MAP.md`
3. `TERMINAL_SCAN_E2E_SPEC.md` (Terminal 관련일 때)

### 4.3 엔티티/DB 스키마 변경

반드시 동시 수정:
1. `PERSISTENCE_DESIGN.md`
2. `API_CONTRACT.md`
3. `REFACTORING_BACKLOG.md`

### 4.4 UX 클릭 플로우 변경

반드시 동시 수정:
1. `INTERACTION_CALL_MAP.md`
2. `TERMINAL_SCAN_E2E_SPEC.md` (Terminal/Scan/Intel)
3. `FE_STATE_MAP.md` (상태 영향 있으면)

### 4.5 실행 순서/티켓 변경

반드시 동시 수정:
1. `REFACTORING_BACKLOG.md`
2. `MASTER_DESIGN.md` (단계 변경 시)

---

## 5. Pre-Work Checklist (작업 시작 전)

1. 현재 브랜치/워크트리 상태 확인
2. 원격 최신 이력과 최근 상태 문서 확인 (작업 중복 방지)
3. 내 작업 범위가 FE/BE/Contract 중 어디인지 확정
4. 영향 문서를 `Cross-Doc Update Matrix`로 체크
5. `docs/AGENT_WATCH_LOG.md`에 시작 시각/계획 범위/중복 점검 결과 기록
6. 아래 불일치 패턴 검색 결과가 현재 기준 0인지 확인

### Consistency Check Commands

```bash
# 금지/잔존 경로 패턴 확인 (--glob '!README.md' → 자기 자신 매칭 제외)
rg -n "/api/terminal/chat|/api/terminal/scans|\?pair=...&tf=...|codex/shared-" docs/*.md --glob '!docs/README.md'

# 핵심 통일 항목 확인 (이 파일 자체 제외)
rg -n "overrideMode|AGENT_FOLLOW|USER_OVERRIDE|response_source|/api/terminal/scan/history|/api/chat/messages" docs/*.md --glob '!docs/README.md'

# 과거 SQL 오타 확인
rg -n "ON DELETE CASCADE ON DELETE CASCADE" docs/*.md --glob '!docs/README.md'
```

---

## 6. Post-Work Checklist (작업 완료 후)

1. 수정한 모든 문서를 다시 읽고 상호충돌 없는지 확인
2. 위 `Consistency Check Commands` 재실행
3. `REFACTORING_BACKLOG.md` 상태값 반영 (해당 시)
4. `docs/AGENT_WATCH_LOG.md`의 같은 작업 항목에 완료 시각/실제 변경/차이점 반영
5. 커밋 메시지에 아래 3줄 포함
- 무엇을 바꿨는지
- 왜 바꿨는지
- 어떤 문서와 동기화했는지
6. 원격 브랜치에 push 완료 여부를 로그에 기록

권장 커밋 템플릿:

```text
docs: align terminal scan/chat contracts across core docs

- unify scan history endpoint to /api/terminal/scan/history?pair&timeframe
- keep chat endpoint on /api/chat/messages and remove legacy variants
- sync FE state + backlog + persistence notes to same contract
```

---

## 7. Agent Role Assignment (4-에이전트 역할 분리)

4개 에이전트가 동시에 작업할 때, 아래 파일 소유권을 준수한다.
**다른 에이전트 소유 파일을 수정해야 할 경우 AGENT_WATCH_LOG.md에 사유를 기록하고, 최소 범위로 한다.**

### Agent 1 — Backend API & Server (BE)
**브랜치**: `codex/be-*`

| 소유 디렉토리 | 설명 |
|---|---|
| `src/routes/api/**` | 모든 API 엔드포인트 (+server.ts) |
| `src/lib/server/**` | 서버 전용 모듈 (DB, LLM, 외부 API 클라이언트) |
| `src/lib/engine/**` | factorEngine, agentPipeline, gameLoop |
| `supabase/migrations/**` | DB 마이그레이션 |

**금지**: Svelte 컴포넌트(`.svelte`) 직접 수정, 클라이언트 스토어 수정
**허용 예외**: API 응답 타입 변경 시 `src/lib/api/*.ts` wrapper에 반영 필요 → Agent 3에 요청 또는 WATCH_LOG에 기록 후 최소 수정

### Agent 2 — Frontend UI & Components (FE)
**브랜치**: `codex/fe-*`

| 소유 디렉토리 | 설명 |
|---|---|
| `src/components/**` | 모든 UI 컴포넌트 |
| `src/routes/**/+page.svelte` | 페이지 컴포넌트 |
| `src/routes/**/+layout.svelte` | 레이아웃 |
| `src/lib/assets/**` | 이미지, 아이콘 |
| `src/lib/audio/**` | 사운드 |
| `static/**` | 정적 자원 |

**금지**: API 엔드포인트(+server.ts) 수정, 서버 모듈 수정, API 계약 임의 변경
**허용 예외**: 컴포넌트 내 `fetch('/api/...')` 호출 추가/수정은 가능하되, 새 엔드포인트 생성은 Agent 1 담당

### Agent 3 — State & Integration (Glue)
**브랜치**: `codex/fe-*` (FE와 같은 트랙, 단 서로 다른 파일)

| 소유 디렉토리 | 설명 |
|---|---|
| `src/lib/stores/**` | 모든 Svelte 스토어 |
| `src/lib/api/**` | 클라이언트 API wrapper |
| `src/lib/wallet/**` | 지갑 연결/서명/체인 스위칭 |
| `src/lib/services/**` | 클라이언트 서비스 (scanService 등) |
| `src/lib/utils/**` | 공유 유틸리티 |
| `src/lib/data/**` | 정적 데이터/설정 |
| `src/lib/signals/**` | 트레이딩 시그널 정의 |

**금지**: 서버 모듈 수정, API 엔드포인트 수정, UI 레이아웃/스타일 변경
**허용 예외**: 스토어 변경이 컴포넌트 prop 인터페이스에 영향을 줄 때 Agent 2에 알리거나 WATCH_LOG에 기록

### Agent 4 — Architecture & QA (Watcher / 감시자)
**브랜치**: `codex/fe-api-connect` (메인 통합 브랜치)

| 소유 디렉토리 | 설명 |
|---|---|
| `docs/**` | 모든 문서 |
| `README.md` | 루트 README |
| `CLAUDE.md` | 에이전트 설정 |
| 크로스커팅 파일 | `hooks.server.ts`, `app.d.ts`, `svelte.config.js`, `vite.config.ts` |

**역할**:
- 다른 에이전트의 작업 중복/충돌 감지
- 성능 감사 및 크로스커팅 수정
- 문서 정합성 유지
- AGENT_WATCH_LOG 관리
- Consistency Check Commands 실행

**금지**: 기능 구현 (새 API, 새 컴포넌트, 새 스토어 생성)
**허용 예외**: 성능/버그 수정을 위해 모든 파일을 수정할 수 있으나, 반드시 WATCH_LOG에 사유와 범위를 사전 기록

---

### 7.1 충돌 해결 프로토콜

같은 파일을 두 에이전트가 수정해야 할 때:

1. **먼저 발견한 에이전트가 WATCH_LOG에 잠금 기록** (파일명 + 예상 완료 시간)
2. 다른 에이전트는 해당 파일 수정을 보류하고 다른 작업 진행
3. 잠금 에이전트가 커밋/푸시 완료 → WATCH_LOG에 잠금 해제 기록
4. 보류 에이전트가 `git pull` 후 이어서 작업

**긴급 수정** (빌드 깨짐 등): Agent 4(Watcher)가 우선 수정 권한을 가진다.

---

## 8. Current Known Decisions to Keep

1. Terminal scan은 현재 5-agent 엔진을 유지한다.
2. 8-agent 확장은 Arena 중심이며, Terminal 8-agent 확장은 별도 결정 후 진행한다.
3. Terminal scan 결과는 추천/보조 신호이며, 자동 매매 결정으로 간주하지 않는다.
4. Oracle 프로필 모달의 구형 표기(`TIER: CONNECTED`, `PHASE P1`)는 backlog `F-12`에서 정리한다.
5. `battleRuntime` 타입은 `FE_STATE_MAP.md`에 정의된 구조를 사용한다.

---

## 9. Non-Canonical / Legacy Docs

아래 문서는 참조용이다. 정본 충돌 시 정본이 우선이다.

1. `MAXIDOGE_Final_Integrated_Spec_v1.md`
2. `MAXIDOGE_DesignDoc_v1.md`
3. `MAXIDOGE_UserJourney_v1.md`
4. `MAXIDOGE_FlowSpec_v2_0.md`
5. `overall-architecture-design.md`
6. `feature-specification.md`
7. `terminal-ia-reset-v1.md`
8. `✅StockHoo_ The Complete Crypto Intelligence OS (3).md`
9. `ARENA_SYSTEM_SPEC_V3_0.md` (Arena v3.0 확장 설계: PvE/PvP/토너먼트/상태머신)

---

## 10. Fast Start for Any Agent

작업 시작할 때 **아래 2가지를 반드시 수행**하고 시작한다.

### 10.1 선언문 남기기

```text
에이전트: [1-BE / 2-FE / 3-Glue / 4-Watcher]
작업 범위: [소유 디렉토리 내 파일 목록]
참조 문서: [정본 7개 중 해당 문서]
동기화 대상: [Cross-Doc Update Matrix 기준]
완료 후 체크: consistency grep 3종 + backlog 반영
```

### 10.2 WATCH_LOG 사전 기록

`docs/AGENT_WATCH_LOG.md`에 새 ID로 시작 항목을 기록한다.
선언문과 WATCH_LOG 없이 작업 시작하지 않는다.

---

## 11. AGENT_WATCH_LOG 운영 규칙

모든 에이전트(1~4)는 작업 단위마다 `docs/AGENT_WATCH_LOG.md`에 같은 ID로 **사전 기록 + 사후 갱신**을 수행한다.

### 11.1 사전 기록 (작업 시작 전 — 커밋/푸시 후 작업 시작)

| 항목 | 필수 | 내용 |
|------|------|------|
| ID | O | `W-YYYYMMDD-###` |
| Start (KST) | O | `YYYY-MM-DD HH:mm` |
| Agent | O | `1-BE` / `2-FE` / `3-Glue` / `4-Watcher` |
| Branch | O | 현재 브랜치명 |
| Scope (planned) | O | 이번 작업에서 수정할 파일/범위 |
| Overlap check | O | `git log -n 8` + WATCH_LOG 최근 항목 확인 결과 |
| Status | O | `IN_PROGRESS` |

### 11.2 사후 갱신 (작업 완료 후)

| 항목 | 필수 | 내용 |
|------|------|------|
| End (KST) | O | 종료 시각 |
| Changes (actual) | O | 실제 변경 파일 + 핵심 변경점 |
| Diff vs plan | O | 계획 대비 달라진 점 (없으면 "없음") |
| Commit / Push | O | 커밋 해시 + push 완료 여부 |
| Status | O | `DONE` |

### 11.3 핵심 규칙

1. **진행 상태는 WATCH_LOG에만 유지** — README.md에 "진행중" 블록 금지
2. **README.md는 완료된 변경 이력만 기록** — 상세는 WATCH_LOG ID 참조
3. **작업 전 반드시 `git pull` → WATCH_LOG 최신 확인** — 다른 에이전트의 IN_PROGRESS 항목과 겹치면 보류
4. **하나의 에이전트가 동시에 2개 이상 IN_PROGRESS 금지** — 순차 처리
5. **파일 잠금**: 같은 파일에 두 에이전트가 접근하면 Section 7.1 충돌 해결 프로토콜 적용

---

## 12. 에이전트 간 커뮤니케이션 규칙

에이전트끼리 직접 통신할 수 없으므로, 아래 채널을 사용한다.

| 채널 | 용도 | 위치 |
|------|------|------|
| AGENT_WATCH_LOG.md | 작업 계획/결과 공유, 파일 잠금 | `docs/AGENT_WATCH_LOG.md` |
| REFACTORING_BACKLOG.md | 백로그 상태 업데이트 | `docs/REFACTORING_BACKLOG.md` |
| git log | 실제 변경 이력 확인 | `git log --oneline -12` |
| 커밋 메시지 | 무엇을/왜/어떤 문서와 동기화했는지 | `git log` |

**금지**: README.md에 다른 에이전트에게 보내는 메시지/요청을 쓰지 않는다.

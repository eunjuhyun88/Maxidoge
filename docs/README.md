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
6. Arena는 8 Agent Pool 전체 기준
7. Chat 저장소 호환:
- 마이그레이션 기간에 `/api/chat/messages`는 내부적으로 `chat_messages` 또는 `agent_chat_messages` adapter 허용
- 외부 JSON 계약은 유지
8. Backlog 번호 기준:
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
2. 내 작업 범위가 FE/BE/Contract 중 어디인지 확정
3. 영향 문서를 `Cross-Doc Update Matrix`로 체크
4. 아래 불일치 패턴 검색 결과가 현재 기준 0인지 확인

### Consistency Check Commands

```bash
# 금지/잔존 경로 패턴 확인
rg -n "/api/terminal/chat|/api/terminal/scans|\?pair=...&tf=...|codex/shared-" docs/*.md

# 핵심 통일 항목 확인
rg -n "overrideMode|AGENT_FOLLOW|USER_OVERRIDE|response_source|/api/terminal/scan/history|/api/chat/messages" docs/*.md

# 과거 SQL 오타 확인
rg -n "ON DELETE CASCADE ON DELETE CASCADE" docs/*.md
```

---

## 6. Post-Work Checklist (작업 완료 후)

1. 수정한 모든 문서를 다시 읽고 상호충돌 없는지 확인
2. 위 `Consistency Check Commands` 재실행
3. `REFACTORING_BACKLOG.md` 상태값 반영 (해당 시)
4. 커밋 메시지에 아래 3줄 포함
- 무엇을 바꿨는지
- 왜 바꿨는지
- 어떤 문서와 동기화했는지

권장 커밋 템플릿:

```text
docs: align terminal scan/chat contracts across core docs

- unify scan history endpoint to /api/terminal/scan/history?pair&timeframe
- keep chat endpoint on /api/chat/messages and remove legacy variants
- sync FE state + backlog + persistence notes to same contract
```

---

## 7. Working Scope Split (병렬 작업 시 충돌 방지)

1. Contract 트랙 (`codex/contract-*`)
- 문서/타입/계약만 수정
- UI/서버 구현 금지

2. BE 트랙 (`codex/be-*`)
- `src/routes/api/**`, `src/lib/server/**`, `src/lib/engine/**` 중심
- Svelte UI 직접 수정 금지

3. FE 트랙 (`codex/fe-*`)
- `src/components/**`, `src/routes/**/+page.svelte`, `src/lib/stores/**`
- API 계약 임의 변경 금지

---

## 8. Current Known Decisions to Keep

1. Terminal scan은 현재 5-agent 엔진을 유지한다.
2. 8-agent 확장은 Arena 중심이며, Terminal 8-agent 확장은 별도 결정 후 진행한다.
3. Oracle 프로필 모달의 구형 표기(`TIER: CONNECTED`, `PHASE P1`)는 backlog `F-12`에서 정리한다.
4. `battleRuntime` 타입은 `FE_STATE_MAP.md`에 정의된 구조를 사용한다.

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

---

## 10. Fast Start for Any Agent

작업 시작할 때 아래 1문단을 먼저 남기고 시작한다.

```text
작업 범위: [Contract/BE/FE]
참조 문서: [정본 7개 중 해당 문서]
동기화 대상: [Cross-Doc Update Matrix 기준 문서 목록]
완료 후 체크: consistency grep 3종 + backlog 반영
```

이 문구 없이 작업 시작하지 않는다.

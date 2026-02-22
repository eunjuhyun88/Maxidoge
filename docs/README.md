# MAXI DOGE v3 Documentation Hub

Last updated: 2026-02-22
Purpose: 모든 설계 문서의 단일 진입점. 다중 에이전트 협업 시 혼선 방지를 위한 규칙 포함.

---

## 1. File Naming Convention

모든 문서 파일명은 아래 규칙을 따른다:

| 구분 | 네이밍 | 예시 |
|------|--------|------|
| v3 설계 문서 (정본) | `UPPER_SNAKE_CASE.md` | `API_CONTRACT.md` |
| Legacy 스펙 | `MAXIDOGE_*.md` | `MAXIDOGE_DesignDoc_v1.md` |
| 레퍼런스/감사 | `kebab-case.md` | `full-file-audit.md` |

**금지**: `v3-` 접두사, 공백, 이모지, 한글 파일명

---

## 2. v3 Design Documents (정본 — 8개)

구현 시 이 문서만 참조. 읽기 순서대로 나열.

| # | 파일 | 역할 | 정본 답변 |
|---|------|------|-----------|
| 1 | `MASTER_DESIGN.md` | 프로그램 범위, 목표, Phase 순서, 머지 게이트 | 뭘 만들고 어떤 순서로? |
| 2 | `ARCHITECTURE_DESIGN.md` | 목표 아키텍처, Shared/BE/FE 설계 | 타겟 구조는? |
| 3 | `INTERACTION_CALL_MAP.md` | 클릭 → 호출 체인 → 상태 변경 → UI 전이 | 유저가 X 누르면? |
| 4 | `TERMINAL_SCAN_E2E_SPEC.md` | Terminal 스캔 1회의 전체 흐름 (좌/중/우 + 영속) | 스캔 후 정확히 뭐가 바뀌나? |
| 5 | `FE_STATE_MAP.md` | FE 상태 소유권, 컴포넌트 책임, 스토어 규칙 | 어느 store가 이 상태를 소유? |
| 6 | `API_CONTRACT.md` | BE API 요청/응답/에러 계약 | API 페이로드가 뭐야? |
| 7 | `PERSISTENCE_DESIGN.md` | 데이터 영속성 모델, Supabase 전환 설계 | 데이터가 어디에 저장? |
| 8 | `REFACTORING_BACKLOG.md` | 실행 큐 (S/B/F 트랙), 의존성, 상태 | 다음에 뭘 구현? |

---

## 3. Conflict Resolution Priority

문서 간 내용이 충돌할 경우 이 우선순위를 따른다:

```
1. MASTER_DESIGN.md          (프로그램 방향)
2. ARCHITECTURE_DESIGN.md    (타겟 구조)
3. API_CONTRACT.md           (API 계약)
4. FE_STATE_MAP.md           (FE 상태 계약)
5. INTERACTION_CALL_MAP.md   (인터랙션 동작)
6. TERMINAL_SCAN_E2E_SPEC.md (스캔 동작)
7. PERSISTENCE_DESIGN.md     (영속성 설계)
8. REFACTORING_BACKLOG.md    (실행 큐)
```

---

## 4. Multi-Agent Collaboration Rules

### 4.1 문서 수정 프로토콜

여러 에이전트(Claude A, Claude B, User 등)가 동시에 문서를 수정할 때 혼선을 방지하기 위한 규칙:

1. **수정 전**: `git pull` 후 최신 상태에서 작업
2. **수정 후**: 반드시 §5 Changelog에 기록 (누가, 무엇을, 왜)
3. **커밋 메시지**: 어떤 문서를 어떤 이유로 수정했는지 명시
4. **충돌 시**: README §3 우선순위에 따라 상위 문서가 정본

### 4.2 문서별 소유자 (편집 책임)

| 문서 | Primary Owner | 수정 시 확인 대상 |
|------|---------------|-----------------|
| `MASTER_DESIGN.md` | User (EJ) | 프로그램 방향은 유저만 변경 |
| `ARCHITECTURE_DESIGN.md` | User + Agent 공동 | 구조 변경 시 MASTER와 정합성 확인 |
| `INTERACTION_CALL_MAP.md` | User + Agent 공동 | 실제 코드와 일치 여부 확인 |
| `TERMINAL_SCAN_E2E_SPEC.md` | User (EJ) | 제품 동작 정의는 유저 소유 |
| `FE_STATE_MAP.md` | Agent (FE 담당) | API_CONTRACT와 정합성 확인 |
| `API_CONTRACT.md` | User + Agent 공동 | PERSISTENCE_DESIGN과 정합성 확인 |
| `PERSISTENCE_DESIGN.md` | Agent (BE 담당) | API_CONTRACT, SQL migration과 정합성 확인 |
| `REFACTORING_BACKLOG.md` | Agent (전체) | 새 항목 추가 시 ID 충돌 체크 |

### 4.3 교차 수정 시 필수 체크리스트

한 문서를 수정하면 연관 문서도 확인해야 한다:

| 수정한 문서 | 반드시 확인할 문서 |
|------------|------------------|
| `API_CONTRACT.md` | `PERSISTENCE_DESIGN.md`, `INTERACTION_CALL_MAP.md` |
| `PERSISTENCE_DESIGN.md` | `API_CONTRACT.md`, `REFACTORING_BACKLOG.md` |
| `FE_STATE_MAP.md` | `INTERACTION_CALL_MAP.md`, `TERMINAL_SCAN_E2E_SPEC.md` |
| `REFACTORING_BACKLOG.md` | `PERSISTENCE_DESIGN.md §9` (backlog 추가 항목 섹션) |
| `INTERACTION_CALL_MAP.md` | `TERMINAL_SCAN_E2E_SPEC.md` (Terminal 관련 시) |

---

## 5. Changelog

모든 문서 수정은 여기에 기록한다. 형식: `날짜 | 작성자 | 커밋 | 변경 내용`

### 2026-02-22

| 시간 | 작성자 | 커밋 | 변경 내용 |
|------|--------|------|-----------|
| 오전 | Agent (Codex) | `2d921c7` | `engine/types.ts`, `agents.ts`, `specs.ts`, `constants.ts`, `004_agent_engine_v3.sql` 신규 생성 |
| 오전 | Agent (Codex) | `5d63111` | svelte-check 14개 에러 수정, v3 engine base 정리 |
| 오전 | Agent (Codex) | `2acbd4a` | arena/+page.svelte guardian→macro 교체 |
| 오전 | Agent (Claude Code) | `9e767c9` | `REFACTORING_BACKLOG.md` 신규 생성 (3-track S/B/F) |
| 오후 | Agent (Claude Code) | `89c15fe` | BACKLOG를 유저 확인 포맷으로 업데이트 |
| 오후 | Agent (Claude Code) | `45c8b02` | 5개 설계문서 신규 생성: `MASTER_DESIGN`, `ARCHITECTURE_DESIGN`, `API_CONTRACT`, `FE_STATE_MAP`, `INTERACTION_CALL_MAP` |
| 오후 | User (EJ) | — | `INTERACTION_CALL_MAP.md` §7-14 추가 (Passport/Oracle/Signals/WalletModal/Terminal 우측/Header) |
| 오후 | User (EJ) | — | `FE_STATE_MAP.md` §9 추가 (Scan History/Intel/Chat State 세부) |
| 오후 | User (EJ) | — | `API_CONTRACT.md` §9 추가 (Terminal Scan/Chat/Upload API 계약) |
| 오후 | User (EJ) | — | `TERMINAL_SCAN_E2E_SPEC.md` 신규 생성 (스캔 E2E 9개 섹션) |
| 오후 | Agent (Claude Code) | `8993bca` | `PERSISTENCE_DESIGN.md` 신규 생성 + 유저 수정사항 커밋 |
| 저녁 | Agent (Claude Code) | `f423b45` | 7개 문서 교차 검증 → 9개 이슈 수정 (Critical 5 + Important 4) |
| 저녁 | Agent (다른 세션) | uncommitted | `ARCHITECTURE_DESIGN`, `FE_STATE_MAP`, `INTERACTION_CALL_MAP`에 `Doc index` 라인 추가 |
| 저녁 | Agent (Claude Code) | 현재 작업 | `README.md` 전면 재작성 (changelog + naming + multi-agent rules) |

---

## 6. Naming Glossary (용어 통일)

문서 간 같은 개념을 다른 이름으로 부르지 않기 위한 정본 용어:

| 정본 용어 | 금지 표현 | 사용처 |
|-----------|----------|--------|
| `AGENT_POOL` | AGDEFS(레거시), agents 배열 | 8 에이전트 정의의 유일한 소스 |
| `AgentId` | agentName, agentKey | `'structure' \| 'vpa' \| 'ict' \| 'deriv' \| 'valuation' \| 'flow' \| 'senti' \| 'macro'` |
| `DraftSelection` | squad, team, lineup | `{ agentId, specId, weight }` |
| `MatchPhase` | phase, stage, step | `'DRAFT' \| 'ANALYSIS' \| 'HYPOTHESIS' \| 'BATTLE' \| 'RESULT'` |
| `Tier` | level, rank, grade | `'BRONZE' \| 'SILVER' \| 'GOLD' \| 'DIAMOND' \| 'MASTER'` |
| `LP` | points, score, XP | League Points |
| `progressionStore` | walletStore.lp, userProfileStore.tier | LP/Tier/Matches 단일 소스 |
| `priceService.livePrice` | gameState.prices, miniTicker | 가격 단일 소스 |
| `terminal_scan_runs` | terminal_scans, scan_sessions | 스캔 세션 테이블명 |
| `agent_chat_messages` | terminal_chat_messages, chat_log | 에이전트 채팅 테이블명 |
| `/api/chat/messages` | /api/terminal/chat | 채팅 API 경로 (기존 API 확장) |
| `/api/terminal/scan/history` | /api/terminal/scans | 스캔 히스토리 API 경로 |
| `overrideMode` | — | `'AGENT_FOLLOW' \| 'USER_OVERRIDE'` |
| `response_source` | — | `'scan_context' \| 'llm' \| 'fallback'` |

---

## 7. Branch Naming (통일)

```
codex/contract-*   — Shared 트랙 (계약/코어)
codex/be-*         — BE 트랙 (API/서비스/DB)
codex/fe-*         — FE 트랙 (컴포넌트/스토어/UI)
```

**금지**: `codex/shared-*` (구 명칭, `codex/contract-*`로 통일됨)

---

## 8. Backlog ID Rules

충돌 방지를 위한 ID 할당 규칙:

| Track | 현재 범위 | 다음 가용 ID |
|-------|----------|-------------|
| Shared | S-01 ~ S-05 | **S-06** |
| BE | B-01 ~ B-11 | **B-12** |
| FE | F-01 ~ F-11 | **F-12** |

새 항목 추가 시 반드시 이 표를 업데이트할 것.

---

## 9. Reference / Audit Files

구현에 직접 사용하지 않지만, 분석/감사 목적으로 보관:

| 파일 | 용도 |
|------|------|
| `STRUCTURE_ALIGNMENT_ACTION_PLAN.md` | Phase A 구조 정렬 액션 플랜 |
| `p0-alignment-checklist-latest.md` | P0 검증 체크리스트 |
| `structure-mismatch-audit-latest.md` | 구조 불일치 감사 |
| `schema-redesign-analysis.md` | DB 스키마 재설계 분석 |
| `full-file-audit.md` | 전체 파일 감사 |
| `click-backend-navigation-audit.md` | 클릭/네비게이션 감사 |
| `database-design.md` | 초기 DB 설계 |
| `github-issues-refactor.md` | GitHub 이슈 리팩토링 정리 |
| `v3-direct-rewrite-status-2026-02-22.md` | v3 직접 재작성 상태 |

---

## 10. Legacy Specs (구버전 — 참조만)

현재 구현의 정본이 아님. 비전/히스토리 목적:

| 파일 | 설명 |
|------|------|
| `MAXIDOGE_Final_Integrated_Spec_v1.md` | v1 통합 스펙 |
| `MAXIDOGE_DesignDoc_v1.md` | v1 디자인 문서 |
| `MAXIDOGE_UserJourney_v1.md` | v1 유저 여정 |
| `MAXIDOGE_FlowSpec_v2_0.md` | v2 플로우 스펙 |
| `MAXIDOGE_Implementation_Priority_v1.md` | v1 구현 우선순위 |
| `overall-architecture-design.md` | 구형 아키텍처 |
| `feature-specification.md` | 구형 기능 스펙 |
| `terminal-ia-reset-v1.md` | Terminal IA 리셋 v1 |

---

## 11. Quick Start by Role

### Product / UX
`MASTER_DESIGN.md` → `INTERACTION_CALL_MAP.md` → `TERMINAL_SCAN_E2E_SPEC.md`

### Frontend
`FE_STATE_MAP.md` → `INTERACTION_CALL_MAP.md` → `API_CONTRACT.md` → `REFACTORING_BACKLOG.md`

### Backend
`API_CONTRACT.md` → `PERSISTENCE_DESIGN.md` → `ARCHITECTURE_DESIGN.md` → `REFACTORING_BACKLOG.md`

### New Agent (처음 합류하는 에이전트)
1. 이 `README.md` 전체 읽기
2. `MASTER_DESIGN.md` 읽기
3. 담당 역할(FE/BE)에 맞는 Quick Start 순서 따르기
4. 작업 전 `REFACTORING_BACKLOG.md`에서 현재 상태 확인
5. 작업 후 §5 Changelog에 기록

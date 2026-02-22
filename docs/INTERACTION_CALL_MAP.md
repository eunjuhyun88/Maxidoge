# MAXI DOGE v3 Interaction Call Map

작성일: 2026-02-22  
목적: "무엇을 누르면 어디가 호출되고, 어떤 상태가 바뀌며, 어떤 탭/패널이 같이 바뀌는지"를 코드 기준으로 고정한다.

## 1. 범위

대상 화면:
1. `/arena`
2. `/terminal`
3. 공통 헤더 내비게이션

참조 파일:
1. `src/routes/arena/+page.svelte`
2. `src/components/arena/Lobby.svelte`
3. `src/components/arena/SquadConfig.svelte`
4. `src/routes/terminal/+page.svelte`
5. `src/components/terminal/WarRoom.svelte`
6. `src/components/layout/Header.svelte`

## 2. Arena Interaction Map

## 2.1 Lobby -> Draft 진입

트리거:
1. `Lobby`의 `START MATCH` 버튼 클릭

호출 체인:
1. `Lobby.startMatch()`
2. `gameState.update({ inLobby:false, selectedAgents, speed, pair })`
3. `resetPhaseInit()`
4. `engineStartMatch()`

상태 변경:
1. `gameState.inLobby: true -> false`
2. `gameState.selectedAgents` 저장
3. 매치 phase 루프 시작

UI 변경:
1. Lobby 화면 숨김
2. `state.phase === 'DRAFT'` 조건의 `SquadConfig` 표시

## 2.2 SquadConfig Deploy

트리거:
1. `SquadConfig`의 `DEPLOY SQUAD` 버튼 클릭

호출 체인:
1. `SquadConfig.handleDeploy()`
2. `dispatch('deploy', { config })`
3. `arena/+page.svelte`의 `onSquadDeploy()`
4. `gameState.update({ squadConfig })`
5. `pushFeedItem(...)`
6. `startAnalysisFromDraft()`

상태 변경:
1. `gameState.squadConfig` 저장
2. phase `DRAFT -> ANALYSIS`

UI 변경:
1. 피드에 시스템 메시지 추가
2. 분석 단계 UI(스카우트/가더/카운슬 흐름) 진행

## 2.3 Hypothesis Submit

트리거:
1. `HypothesisPanel` 제출 이벤트

호출 체인:
1. `onHypothesisSubmit(e)`
2. `gameState.update({ hypothesis, pos })`
3. chart position state 업데이트
4. `advancePhase()`

상태 변경:
1. `gameState.hypothesis` 저장
2. `gameState.pos` 저장
3. phase `HYPOTHESIS -> BATTLE`

UI 변경:
1. 차트에 ENTRY/TP/SL 라인 표시
2. 배틀 시뮬레이션 시작

## 2.4 Chart Drag (TP/SL/ENTRY)

트리거:
1. 차트 드래그 이벤트 (`dragTP`, `dragSL`, `dragEntry`)

호출 체인:
1. `onDragTP/onDragSL/onDragEntry`
2. local chart position 값 갱신
3. `gameState.hypothesis` 동기 갱신

상태 변경:
1. hypothesis의 `tp/sl/entry/rr` 갱신

UI 변경:
1. 차트 라인 위치 즉시 갱신
2. 가설 패널 수치와 동기

## 2.5 Result 이후 버튼

트리거:
1. `LOBBY` 클릭
2. `PLAY AGAIN` 클릭

호출 체인:
1. `goLobby()` 또는 `playAgain()`
2. `gameState` 초기화/재시작
3. `engineStartMatch()` (play again)

상태 변경:
1. LOBBY: `inLobby:true`, `phase:'DRAFT'`
2. AGAIN: 같은 페어/선택 유지한 재시작

UI 변경:
1. Lobby 복귀 또는 즉시 다음 매치 진입

## 3. Terminal Interaction Map

## 3.1 Chart Scan 버튼 -> WarRoom Scan -> Intel 반영

트리거:
1. `ChartPanel`에서 `scanrequest` 이벤트 발생

호출 체인:
1. `terminal/+page.svelte`의 `handleChartScanRequest()`
2. `tryTriggerWarRoomScan()`
3. `WarRoom.triggerScanFromChart()`
4. `WarRoom.runAgentScan()`
5. `runWarRoomScan(pair, timeframe)` 호출
6. `scanTabs` 업데이트 + `dispatch('scancomplete', detail)`
7. `terminal/+page.svelte`의 `handleScanComplete()`
8. `latestScan`/`chatMessages` 갱신 -> `IntelPanel` 표시

상태 변경:
1. `WarRoom.scanTabs` 누적
2. `WarRoom.activeScanId` 신규 탭으로 전환
3. `terminal.latestScan` 갱신

UI 변경:
1. WarRoom 탭 목록에 새 스캔 탭 추가
2. Intel에 스캔 요약 메시지 자동 추가
3. 모바일이면 차트 탭에서 warroom 탭으로 전환될 수 있음

## 3.2 WarRoom Scan Tab 클릭

트리거:
1. `scan-tab` 버튼 클릭

호출 체인:
1. `activateScanTab(id)`

상태 변경:
1. `activeScanId` 변경
2. `selectedIds` 초기화
3. `activeToken` 초기화

UI 변경:
1. 해당 스캔 결과로 signal 리스트 교체

## 3.3 Token 필터 탭 클릭

트리거:
1. `ALL/BTC/ETH/...` 토큰 탭 클릭

호출 체인:
1. `activeToken = tok`
2. `selectedIds = new Set()`

상태 변경:
1. 필터 기준 변경
2. 선택 시그널 초기화

UI 변경:
1. 하단 signal 목록이 토큰 기준으로 좁혀짐

## 3.4 LONG/SHORT/TRACK 버튼

트리거:
1. 시그널 카드의 `LONG`, `SHORT`, `TRACK`

호출 체인:
1. LONG/SHORT:
- `quickTrade(dir, sig)`
- `openQuickTrade(...)`
- `dispatch('quicktrade', ...)`
2. TRACK:
- `handleTrack(sig)`
- `trackSignalStore(...)`
- `incrementTrackedSignals()`
- `notifySignalTracked(...)`
- `dispatch('tracked', ...)`

상태 변경:
1. quickTradeStore/ trackedSignalStore / userProfileStore 갱신

UI 변경:
1. 퀵트레이드 모달 오픈
2. tracked 카운트/알림 반영

## 3.5 Collapse/Expand 패널

트리거:
1. WarRoom collapse 버튼
2. Terminal 좌/우 strip 버튼

호출 체인:
1. WarRoom `dispatch('collapse')`
2. terminal `toggleLeft()`
3. 우측도 `toggleRight()`

상태 변경:
1. `leftCollapsed/rightCollapsed`
2. `leftW/rightW` 폭 저장/복원

UI 변경:
1. 패널 접힘/펼침
2. strip 버튼 표시 전환

## 3.6 모바일 탭 변경

트리거:
1. `WAR ROOM / CHART / INTEL` 하단 nav 버튼

호출 체인:
1. `setMobileTab(tab)`
2. GTM 이벤트 `terminal_mobile_tab_change`

상태 변경:
1. `mobileTab` 값 변경

UI 변경:
1. 단일 active 탭 내용만 표시

## 4. Pair/Timeframe 변경 연쇄

트리거:
1. Terminal `TokenDropdown` 변경

호출 체인:
1. `onTokenSelect()`
2. `gameState.update({ pair })`
3. WarRoom의 reactive 블록이 `currentPair/currentTF` 감지
4. 파생 데이터 재조회 `fetchDerivativesData()`

상태 변경:
1. `gameState.pair`
2. WarRoom 내부 파생 지표 상태

UI 변경:
1. ticker/pair 표시 변경
2. 파생 지표 strip 값 변경

## 5. 현재 구조 기준 "바꿔야 할 포인트"

1. 스캔 실행 위치
- 현재: FE 컴포넌트(`WarRoom`)가 `runWarRoomScan` 직접 호출
- 목표: 서비스/BE API 호출로 이전, 컴포넌트는 렌더링 전담

2. 에이전트 참조
- 현재: Terminal chat이 `AGDEFS` 기반 멘션 매칭
- 목표: `AGENT_POOL` 기반 또는 브릿지 단일화

3. 가격 동기
- 현재: Terminal interval sync + Header/Chart 개별 WS
- 목표: `priceService` 단일 구독

4. phase 행동 계약
- 현재: Arena phase는 5-phase 표면 + 내부 구형 로직 혼재
- 목표: API lifecycle 중심으로 분리 (`create/draft/analyze/hypothesis/result`)

## 6. 구현 전 체크리스트

1. 이 문서 기준으로 FE 이벤트 단위 테스트 케이스 작성
2. API 계약 문서(`v3-api-contract.md`)와 핸들러 이름 1:1 매핑
3. FE state map(`v3-fe-state-map.md`)과 store 책임 충돌 여부 확인

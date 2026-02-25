# Intel Trading Decision Policy (v1)

작성일: 2026-02-25  
대상: `/terminal` 우측 Intel 패널(Headlines / Events / Flow / Trending / Positions)

## 1) 목적 정의

Intel은 "정보 나열"이 아니라 아래 한 가지 목적만 가진다.

- 목적: **다음 30~120분 트레이드에서 Long / Short / Wait 결정을 돕는 것**

따라서 Intel에 표시되는 모든 데이터는 "왜 이 데이터가 지금 의사결정에 필요하지?"를 통과해야 한다.

## 2) 데이터 표시 자격 (Quality Gate)

모든 데이터 카드/행은 4개 축으로 평가한다.

1. Actionability (행동 가능성)
- 이 데이터가 엔트리/청산/보류 판단에 직접 쓰이는가?

2. Timeliness (시의성)
- 현재 의사결정 윈도우(30~120분)에 아직 유효한가?

3. Reliability (신뢰성)
- 소스 품질, 계산 안정성, 실패율, 조작 가능성 리스크는 허용 범위인가?

4. Relevance (연관성)
- 현재 선택 페어/타임프레임과 직접 연관 있는가?

### Gate 통과 기준

- 최소 점수 컷:
  - Actionability >= 65
  - Timeliness >= 60
  - Reliability >= 70
  - Relevance >= 70
- 가중 합산 점수 >= 70

가중치:

- Actionability 0.30
- Timeliness 0.20
- Reliability 0.30
- Relevance 0.20

Gate 미통과 데이터는 숨기거나 "참고"로만 격하한다.

## 3) 패널별 역할과 표시 기준

## 3.1 Headlines

표시 목적:

- 단기 방향/변동성에 영향을 주는 **촉매(catalyst)** 제공

표시 규칙:

- 고중요도/고상호작용/고신선도 뉴스만 표시
- 현재 페어 alias(BTC/ETH 등) 매칭 우선
- 중복/재인용 헤드라인은 축약

WHY 템플릿:

- "거래소/ETF/규제 뉴스 -> 단기 변동성 확대 가능"
- "프로토콜 이슈 -> 해당 자산 리스크 프리미엄 확대"

## 3.2 Events

표시 목적:

- 발표/온체인 이벤트 전후의 리스크 타이밍 관리

표시 규칙:

- 이벤트 시간과 현재 시점의 거리(전/후)를 함께 표기
- "이미 가격에 반영" 가능성이 높은 오래된 이벤트는 축소

WHY 템플릿:

- "이벤트 직전 유동성 축소 가능 -> 포지션 크기 조절 필요"

## 3.3 Flow

표시 목적:

- 포지션 쏠림/청산 구조/자금 유입을 통해 단기 압력 식별

표시 규칙:

- Funding, Liquidation, Volume의 이상치만 표시
- 평시 노이즈는 제거

WHY 템플릿:

- "롱 청산 급증 + 펀딩 하락 -> 하방 압력 우세"
- "숏 청산 급증 + 거래량 확장 -> 숏스퀴즈 위험"

## 3.4 Trending / Picks

표시 목적:

- 단순 인기 코인이 아니라 **후보군 우선순위**를 제공

표시 규칙:

- 스코어 분해(모멘텀/볼륨/소셜/매크로/온체인)와 함께 제공
- "왜 상위인지" 사유 태그를 필수로 노출

WHY 템플릿:

- "모멘텀 + 거래량 동시 강화, 매크로 중립 이상"

## 3.5 Positions

표시 목적:

- 현재 포지션 유지/축소/청산 의사결정

표시 규칙:

- 상태 동기화(SYNCING/SYNCED/ERROR) 명시
- pending 주문 상태 추적(Polymarket/GMX)
- 미연결/인증오류/단순 빈 상태를 명확히 구분

WHY 템플릿:

- "pending 해소 전 신규 리스크 확대 금지"
- "PnL/상태 변화 기반으로 포지션 조정"

## 4) 최종 의사결정 엔진 기준

Intel은 각 도메인의 증거를 결합해 `Long / Short / Wait`를 만든다.

## 4.1 도메인 가중치

- Derivatives: 0.28
- Flow: 0.22
- Events: 0.18
- Headlines: 0.14
- Positions: 0.10
- Trending: 0.08

## 4.2 충돌 페널티

- Long 증거와 Short 증거가 동시에 강하면 신뢰도를 감점
- 충돌 시 기본 전략은 `Wait` 쪽으로 보수화

## 4.3 No-Trade 규칙

아래 중 하나면 `Wait`:

- Quality Gate 미통과
- Long/Short edge 차이 임계값 미만
- 데이터 신선도 기준 초과(지연 데이터)
- 핵심 도메인(Derivatives/Flow) 누락

## 5) Intel 카드 출력 표준

각 카드/신호는 아래 구조를 만족해야 한다.

- What: 데이터 사실(숫자/상태)
- So What: 시장에 미치는 의미
- Now What: 트레이더 행동(진입/축소/보류/청산)
- Why: 근거 1~2줄

예시:

- What: Funding +0.035%, Long liq 24h 급증
- So What: 롱 포지션 과밀 + 하방 변동성 증가
- Now What: 신규 Long 보류, 반등 숏 우선 관찰
- Why: 포지션 쏠림 해소 전 하방 압력 지속 가능성

## 6) 운영 원칙 (신뢰성)

1. 상태 분리
- `loading` / `error` / `empty` / `stale` 분리 표기

2. 실패 보수성
- 핵심 소스 실패 시 과감히 `Wait`

3. 관측 가능성
- 마지막 동기화 시각, 데이터 freshness, pending 개수 표시

4. 정책 버전 관리
- `IntelPolicy v1`처럼 버전 고정
- 임계값 변경 시 변경 이력 남김

## 7) 구현 기준 (이 저장소)

실행 가능한 정책은 아래 코드 모듈을 SSOT로 사용한다.

- `src/lib/intel/decisionPolicy.ts`

이 모듈이 Gate/가중치/No-Trade 임계값의 단일 기준이다.

---

요약:
Intel은 "정보판"이 아니라 "행동판"이어야 한다.  
표시 기준은 Quality Gate로 통제하고, 최종 의사결정은 충돌 페널티와 No-Trade 규칙을 포함한 보수적 정책으로 운영한다.

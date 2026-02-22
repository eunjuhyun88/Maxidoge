# MAXI DOGE v3 API Contract

작성일: 2026-02-22  
목적: FE/BE 분리 개발을 위해 Arena/Live/Market API 계약을 고정한다.

## 1. Conventions

1. Base path: `/api`
2. Content type: `application/json`
3. 시간: ISO8601 UTC (`createdAt`, `updatedAt`)
4. 에러 형식 통일:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "weight sum must be 100"
  }
}
```

5. 성공 형식 통일:

```json
{
  "ok": true,
  "data": {}
}
```

## 2. Arena Match API

## 2.1 POST `/api/arena/match/create`

요청:

```json
{
  "pair": "BTC/USDT",
  "timeframe": "4h",
  "mode": "AI"
}
```

응답:

```json
{
  "ok": true,
  "data": {
    "matchId": "uuid",
    "phase": "DRAFT",
    "pair": "BTC/USDT",
    "timeframe": "4h",
    "createdAt": "2026-02-22T10:00:00.000Z"
  }
}
```

에러:
1. `400 INVALID_PAIR`
2. `401 UNAUTHORIZED`
3. `500 INTERNAL_ERROR`

## 2.2 POST `/api/arena/match/:id/draft`

요청:

```json
{
  "draft": [
    { "agentId": "STRUCTURE", "specId": "structure_base", "weight": 40 },
    { "agentId": "DERIV", "specId": "deriv_squeeze_hunter", "weight": 35 },
    { "agentId": "FLOW", "specId": "flow_base", "weight": 25 }
  ]
}
```

검증:
1. agent 3개 고정
2. 중복 agent 금지
3. weight 합계 100
4. spec unlock 여부 확인

응답:

```json
{
  "ok": true,
  "data": {
    "matchId": "uuid",
    "phase": "ANALYSIS",
    "acceptedDraft": [
      { "agentId": "STRUCTURE", "specId": "structure_base", "weight": 40 },
      { "agentId": "DERIV", "specId": "deriv_squeeze_hunter", "weight": 35 },
      { "agentId": "FLOW", "specId": "flow_base", "weight": 25 }
    ]
  }
}
```

에러:
1. `400 INVALID_DRAFT`
2. `400 SPEC_LOCKED`
3. `404 MATCH_NOT_FOUND`
4. `409 INVALID_PHASE`

## 2.3 POST `/api/arena/match/:id/analyze`

요청:

```json
{
  "forceRefresh": false
}
```

응답:

```json
{
  "ok": true,
  "data": {
    "matchId": "uuid",
    "phase": "HYPOTHESIS",
    "outputs": [
      {
        "agentId": "STRUCTURE",
        "specId": "structure_base",
        "direction": "LONG",
        "confidence": 71,
        "thesis": "EMA trend and MTF alignment are bullish.",
        "factors": [
          {
            "name": "EMA_TREND",
            "weight": 0.35,
            "signal": "BULL",
            "score": 74,
            "detail": "EMA20 > EMA60 > EMA120",
            "contribution": 25.9
          }
        ],
        "bullScore": 68.1,
        "bearScore": 31.9
      }
    ],
    "aggregate": {
      "direction": "LONG",
      "confidence": 66,
      "reasonTags": ["MTF_ALIGNED", "FLOW_SUPPORT"]
    }
  }
}
```

에러:
1. `409 INVALID_PHASE`
2. `422 INSUFFICIENT_MARKET_DATA`
3. `500 ANALYSIS_FAILED`

## 2.4 POST `/api/arena/match/:id/hypothesis`

요청:

```json
{
  "direction": "LONG",
  "overrideMode": "USER_OVERRIDE",
  "entry": 68100.2,
  "tp": 69150.0,
  "sl": 67520.5,
  "rr": 1.8
}
```

응답:

```json
{
  "ok": true,
  "data": {
    "matchId": "uuid",
    "phase": "BATTLE",
    "userPrediction": {
      "direction": "LONG",
      "entry": 68100.2,
      "tp": 69150.0,
      "sl": 67520.5,
      "rr": 1.8
    }
  }
}
```

에러:
1. `400 INVALID_PREDICTION`
2. `409 INVALID_PHASE`
3. `404 MATCH_NOT_FOUND`

## 2.5 GET `/api/arena/match/:id/result`

응답:

```json
{
  "ok": true,
  "data": {
    "matchId": "uuid",
    "phase": "RESULT",
    "outcome": {
      "won": true,
      "lpDelta": 18,
      "entryPrice": 68100.2,
      "exitPrice": 69210.0,
      "priceChangePct": 1.63
    },
    "progression": {
      "lpTotal": 1246,
      "tier": "DIAMOND",
      "tierLevel": 1,
      "unlockedSpecs": [
        { "agentId": "DERIV", "specId": "deriv_position_reader" }
      ]
    },
    "agentBreakdown": [
      { "agentId": "STRUCTURE", "correct": true, "direction": "LONG", "confidence": 71 },
      { "agentId": "DERIV", "correct": true, "direction": "LONG", "confidence": 64 },
      { "agentId": "FLOW", "correct": false, "direction": "SHORT", "confidence": 58 }
    ]
  }
}
```

## 3. Live API

## 3.1 GET `/api/live/sessions/active`

응답:

```json
{
  "ok": true,
  "data": {
    "sessions": [
      {
        "sessionId": "uuid",
        "matchId": "uuid",
        "pair": "BTC/USDT",
        "timeframe": "4h",
        "stage": "POSITION_OPEN",
        "startedAt": "2026-02-22T10:00:00.000Z"
      }
    ]
  }
}
```

## 3.2 POST `/api/live/sessions/:matchId/start`

요청:

```json
{
  "streamMode": "SSE"
}
```

응답:

```json
{
  "ok": true,
  "data": {
    "sessionId": "uuid",
    "streamUrl": "/api/live/sessions/uuid/stream"
  }
}
```

## 3.3 GET `/api/live/sessions/:id/stream`

SSE 이벤트:
1. `price_tick`
2. `position_update`
3. `stage_change`
4. `session_end`

## 4. Market Data API

## 4.1 GET `/api/market/snapshot`

설명:
1. 외부 데이터 수집기 진입점
2. `indicator_series`, `market_snapshots` 업데이트

응답:

```json
{
  "ok": true,
  "data": {
    "updated": ["RSI_14", "EMA_20", "OI", "FUNDING_RATE"],
    "pair": "BTC/USDT",
    "timeframe": "4h",
    "at": "2026-02-22T10:00:00.000Z"
  }
}
```

## 4.2 Proxy routes

1. GET `/api/feargreed`
2. GET `/api/coingecko/global`
3. GET `/api/yahoo/:symbol`

## 5. Progression API (Optional Read Endpoint)

## 5.1 GET `/api/profile/progression`

응답:

```json
{
  "ok": true,
  "data": {
    "lpTotal": 1246,
    "matches": 52,
    "wins": 30,
    "losses": 22,
    "tier": "DIAMOND",
    "tierLevel": 1,
    "agentMatchCounts": {
      "STRUCTURE": 21,
      "VPA": 3,
      "ICT": 5,
      "DERIV": 22,
      "VALUATION": 1,
      "FLOW": 16,
      "SENTI": 7,
      "MACRO": 2
    }
  }
}
```

## 6. Legacy Compatibility

1. 기존 `GET/POST /api/matches`는 당분간 유지한다.
2. 내부에서는 `arena/match` API를 호출하는 adapter로 구현한다.
3. deprecated 기간 종료 시점은 별도 공지한다.

## 7. Status Codes

1. `200` 성공
2. `400` 검증 오류
3. `401` 인증 필요
4. `403` 권한 부족
5. `404` 리소스 없음
6. `409` phase 충돌/상태 충돌
7. `422` 데이터 부족/도메인 검증 실패
8. `429` 외부 API 레이트리밋
9. `500` 서버 내부 오류

## 8. Contract Test Checklist

1. create -> draft -> analyze -> hypothesis -> result 순서 강제
2. draft weight 합 100 검증
3. spec unlock 검증
4. phase mismatch 시 409 반환
5. legacy `/api/matches` 경로 정상 응답

# Front/Back Separation Audit

- Generated at (UTC): 2026-02-24T20:26:00.236Z
- Scope: `src/components`, `src/routes`, `src/lib/api`

## Summary
- UI direct fetch calls: 0
- Client API external vendor calls: 14
- Client files importing $lib/server: 0

## UI Direct Fetch Findings
- none

## External Vendor Calls in Client API Layer
- `src/lib/api/binance.ts:5` // Base: https://api.binance.com or https://data-api.binance.vision
- `src/lib/api/binance.ts:10` const BASE = 'https://api.binance.com';
- `src/lib/api/binance.ts:11` const DATA_BASE = 'https://data-api.binance.vision';
- `src/lib/api/binance.ts:118` const url = `wss://stream.binance.com:9443/ws/${wsSymbol}@kline_${wsInterval}`;
- `src/lib/api/binance.ts:185` const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
- `src/lib/api/coincap.ts:5` // https://docs.coincap.io/
- `src/lib/api/coincap.ts:9` const CC_BASE = 'https://api.coincap.io/v2';
- `src/lib/api/coingecko.ts:5` // https://www.coingecko.com/en/api/documentation
- `src/lib/api/coingecko.ts:10` const CG_BASE = 'https://api.coingecko.com/api/v3';
- `src/lib/api/defillama.ts:5` // https://defillama.com/docs/api
- `src/lib/api/defillama.ts:10` const LLAMA_BASE = 'https://api.llama.fi';
- `src/lib/api/defillama.ts:11` const STABLES_BASE = 'https://stablecoins.llama.fi';
- `src/lib/api/feargreed.ts:5` // https://api.alternative.me/fng/
- `src/lib/api/feargreed.ts:9` const FNG_API = 'https://api.alternative.me/fng/';

## Client Importing Server Modules
- none

## Notes
- `UI direct fetch`는 컴포넌트/페이지가 API 세부사항을 직접 가지므로 API 래퍼 계층으로 이동하는 것이 권장됩니다.
- `Client API external vendor calls`는 브라우저가 외부 벤더 API를 직접 호출한다는 의미이며, 운영 환경에서는 서버 프록시(`/api/*`) 경유가 안정적입니다.
- `$lib/server` import는 브라우저 번들 경계 위반 가능성이 높으므로 즉시 제거 대상입니다.

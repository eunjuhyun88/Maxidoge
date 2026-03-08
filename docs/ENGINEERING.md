# Engineering Authority

## Layer Dependency (절대 위반 금지)

```
types → repository → service → ui(Svelte)
```

- UI에서 repository 직접 import 금지
- 외부 데이터는 반드시 경계에서 파싱 (zod / pydantic)

## State Pattern

| Layer | Pattern | Example |
| --- | --- | --- |
| Stores | Svelte 4 `writable()` / `derived()` | `priceStore`, `gameState` |
| Components | Svelte 5 runes | `$state()`, `$derived()`, `$effect()`, `$props()` |
| Chart primitives | Class-based (lightweight-charts v5) | `DrawingManager`, `PluginBase` |

**절대 섞지 말 것**: Store 파일에 runes 금지. Component에서 `writable()` 새로 만들지 말 것.

## Persistence Strategy

| 방식 | 용도 | 예시 |
| --- | --- | --- |
| localStorage + debounce | 클라이언트 캐시 (server가 truth) | `userProfileStore`, `matchHistoryStore` |
| localStorage (primary) | 클라이언트 소유 상태 | `pnlStore`, `agentData`, `communityStore` |
| Runtime only | 세션 한정 상태 | `arenaWarStore`, `warRoomStore`, `battleFeedStore` |
| Server reconcile | 낙관적 업데이트 → 서버 확인 | `quickTradeStore`, `positionStore` |

## Error Handling

```typescript
// 금지
throw new Error("invalid input");

// 필수
throw new Error(
  "[CODE] 무엇이 잘못됐나\n수정: 어떻게 고치나\n예시: 올바른 형태"
);
```

에러 메시지에 복구 방법 포함 — 다음 세션이 혼자 고칠 수 있어야 한다.

## API 경계 규칙

| 위치 | 규칙 |
| --- | --- |
| `src/routes/api/**/+server.ts` | Server-side only. zod로 input 파싱 |
| `src/lib/server/**` | Server-only 모듈. 브라우저에서 import 불가 |
| `src/lib/api/**` | Client-side fetch wrapper. 응답을 boundary에서 파싱 |
| `src/lib/services/**` | 브라우저 전용 비즈니스 로직 |

## File Naming

- 문서: `{PROJECT}_{주제}_{YYYYMMDD}.md`
- 버전 파일 생성 금지 (v1, v2 파일명 금지) → 같은 파일에 Changelog
- Component: PascalCase.svelte (`ChartToolbar.svelte`)
- Store: camelCase.ts (`priceStore.ts`)
- API route: kebab-case directory (`/api/arena-war/`)

## Chart Primitives Pattern

lightweight-charts v5의 Series Primitive 3-tier 패턴:

```
Renderer (Canvas 2D draw) → PaneView (좌표 변환) → Primitive (extends PluginBase)
```

- `DrawingManager`: 이벤트 핸들링, preview/finalize, drag-to-move, selection, magnet snap
- `AnchorPoint`: `{time: Time, price: number}` — zoom/scroll에도 유지되는 논리 좌표
- chart element에 직접 mousedown listener 부착 (capture phase)

## Git Workflow

- `merge --ff-only` 또는 명시적 `cherry-pick`만 사용
- 강제 머지/강제 푸시 금지, `--no-verify` 금지
- push 전: `npm run gate` (guard:workspace + check:budget + build) 통과 필수
- worktree 분리: `.wt-<branch>` 형태

## Build & Check Commands

| Command | Purpose |
| --- | --- |
| `npm run check` | svelte-kit sync + svelte-check (TS errors) |
| `npm run build` | Production build |
| `npm run gate` | Pre-push gate (workspace + budget + build) |
| `npm run docs:check` | Context system integrity |
| `npm run docs:refresh` | Regenerate route/store/api maps |

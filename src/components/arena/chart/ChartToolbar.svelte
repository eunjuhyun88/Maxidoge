<script lang="ts">
  import type { DrawingMode } from '$lib/chart/chartTypes';

  interface Props {
    drawingMode: DrawingMode;
    drawingsVisible?: boolean;
    drawingCount?: number;
    magnetEnabled?: boolean;
    enableTradeLineEntry?: boolean;
    onSetDrawingMode?: (mode: DrawingMode) => void;
    onToggleDrawingsVisible?: () => void;
    onClearAllDrawings?: () => void;
    onToggleMagnet?: () => void;
  }

  let {
    drawingMode,
    drawingsVisible = true,
    drawingCount = 0,
    magnetEnabled = true,
    enableTradeLineEntry = false,
    onSetDrawingMode = () => {},
    onToggleDrawingsVisible = () => {},
    onClearAllDrawings = () => {},
    onToggleMagnet = () => {},
  }: Props = $props();

  type ToolItem = { mode: DrawingMode; label: string; svgIcon: string };
  type ToolCategory = {
    id: string;
    label: string;
    tools: ToolItem[];
  };

  // TradingView-style categories with Korean labels and SVG icons
  const TOOL_CATEGORIES: ToolCategory[] = [
    {
      id: 'lines',
      label: '라인',
      tools: [
        { mode: 'trendline', label: '추세선', svgIcon: 'trendline' },
        { mode: 'ray', label: '레이', svgIcon: 'ray' },
        { mode: 'extended_line', label: '확장선', svgIcon: 'extended_line' },
        { mode: 'hline', label: '수평선', svgIcon: 'hline' },
        { mode: 'vline', label: '수직선', svgIcon: 'vline' },
        { mode: 'channel', label: '평행 채널', svgIcon: 'channel' },
      ],
    },
    {
      id: 'fib',
      label: '피보나치',
      tools: [
        { mode: 'fib_retracement', label: '피보나치 되돌림', svgIcon: 'fib' },
      ],
    },
    {
      id: 'shapes',
      label: '도형',
      tools: [
        { mode: 'rect', label: '사각형', svgIcon: 'rect' },
      ],
    },
    {
      id: 'measure',
      label: '계측기',
      tools: [
        { mode: 'price_range', label: '가격 범위', svgIcon: 'price_range' },
      ],
    },
    {
      id: 'position',
      label: '포지션',
      tools: [
        { mode: 'longentry', label: '매수 포지션', svgIcon: 'long' },
        { mode: 'shortentry', label: '매도 포지션', svgIcon: 'short' },
      ],
    },
  ];

  // Which category popover is open
  let openCategory = $state<string | null>(null);

  // Active tool per category (last selected)
  let activeModes = $state<Record<string, DrawingMode>>({
    lines: 'trendline',
    fib: 'fib_retracement',
    shapes: 'rect',
    measure: 'price_range',
    position: 'longentry',
  });

  function selectTool(categoryId: string, mode: DrawingMode) {
    activeModes[categoryId] = mode;
    onSetDrawingMode(drawingMode === mode ? 'none' : mode);
    openCategory = null;
  }

  function toggleCategory(categoryId: string, e?: MouseEvent) {
    if (e) e.preventDefault();
    openCategory = openCategory === categoryId ? null : categoryId;
  }

  function getActiveTool(cat: ToolCategory): ToolItem {
    const activeMode = activeModes[cat.id];
    return cat.tools.find((t) => t.mode === activeMode) ?? cat.tools[0];
  }

  function isCategoryActive(cat: ToolCategory): boolean {
    return cat.tools.some((t) => t.mode === drawingMode);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="chart-toolbar" role="toolbar" aria-label="Drawing tools">
  <!-- ── Cursor / Select ── -->
  <button
    class="tb-btn"
    class:active={drawingMode === 'none'}
    title="선택 / 커서 (Esc)"
    onclick={() => onSetDrawingMode('none')}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M5 3L5 17L9.5 12.5L14.5 20L17 19L12 11L17.5 10L5 3Z" fill="currentColor"/>
    </svg>
  </button>

  <div class="tb-sep"></div>

  <!-- ── Tool categories ── -->
  {#each TOOL_CATEGORIES as cat}
    {@const activeTool = getActiveTool(cat)}
    {@const isActive = isCategoryActive(cat)}

    <div class="tb-group" class:active={isActive}>
      <!-- Main button: click = activate/toggle tool -->
      <button
        class="tb-btn"
        class:active={isActive}
        title={activeTool.label}
        onclick={() => selectTool(cat.id, activeModes[cat.id] ?? cat.tools[0].mode)}
        oncontextmenu={(e) => toggleCategory(cat.id, e)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          {#if activeTool.svgIcon === 'trendline'}
            <path d="M4 18L20 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="4" cy="18" r="2" fill="currentColor"/>
            <circle cx="20" cy="6" r="2" fill="currentColor"/>
          {:else if activeTool.svgIcon === 'ray'}
            <path d="M4 18L20 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="4" cy="18" r="2" fill="currentColor"/>
            <path d="M18 5L22 4L19 8" fill="currentColor"/>
          {:else if activeTool.svgIcon === 'extended_line'}
            <path d="M2 18L22 6" stroke="currentColor" stroke-width="1.8"/>
            <path d="M2 17L4 19" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M20 5L22 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          {:else if activeTool.svgIcon === 'hline'}
            <path d="M3 12H21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="3" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="21" cy="12" r="1.5" fill="currentColor"/>
          {:else if activeTool.svgIcon === 'vline'}
            <path d="M12 3V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="12" cy="3" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="21" r="1.5" fill="currentColor"/>
          {:else if activeTool.svgIcon === 'channel'}
            <path d="M3 16L21 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M3 20L21 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="3 2"/>
            <circle cx="3" cy="16" r="1.5" fill="currentColor"/>
            <circle cx="21" cy="8" r="1.5" fill="currentColor"/>
          {:else if activeTool.svgIcon === 'fib'}
            <path d="M3 5H21" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/>
            <path d="M3 9H21" stroke="currentColor" stroke-width="1.2"/>
            <path d="M3 13H21" stroke="currentColor" stroke-width="1.2"/>
            <path d="M3 17H21" stroke="currentColor" stroke-width="1.2"/>
            <path d="M3 21H21" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity="0.5"/>
            <text x="4" y="8" fill="currentColor" font-size="5" font-weight="bold">0.382</text>
            <text x="4" y="12" fill="currentColor" font-size="5" font-weight="bold">0.5</text>
            <text x="4" y="16" fill="currentColor" font-size="5" font-weight="bold">0.618</text>
          {:else if activeTool.svgIcon === 'rect'}
            <rect x="4" y="6" width="16" height="12" rx="1" stroke="currentColor" stroke-width="1.6" fill="none"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor"/>
            <circle cx="20" cy="6" r="1.5" fill="currentColor"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor"/>
            <circle cx="20" cy="18" r="1.5" fill="currentColor"/>
          {:else if activeTool.svgIcon === 'price_range'}
            <path d="M12 4V20" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M8 4H16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M8 20H16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <text x="14" y="13" fill="currentColor" font-size="6" font-weight="bold">$</text>
          {:else if activeTool.svgIcon === 'long'}
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.2" fill="none"/>
            <path d="M8 14L12 8L16 14" stroke="#26a69a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          {:else if activeTool.svgIcon === 'short'}
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.2" fill="none"/>
            <path d="M8 10L12 16L16 10" stroke="#ef5350" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          {:else}
            <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/>
          {/if}
        </svg>
      </button>

      <!-- Expand arrow (only for multi-tool categories) -->
      {#if cat.tools.length > 1}
        <button
          class="tb-expand"
          onclick={() => toggleCategory(cat.id)}
          title="{cat.label} 도구 더보기"
          aria-label="{cat.label} 도구 더보기"
        >
          <svg width="6" height="6" viewBox="0 0 6 6"><path d="M1 2L3 4.5L5 2" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>
        </button>
      {/if}

      <!-- Popover dropdown -->
      {#if openCategory === cat.id}
        <div class="tb-popover" onmouseleave={() => { openCategory = null; }}>
          <div class="tb-pop-header">{cat.label}</div>
          {#each cat.tools as tool}
            <button
              class="tb-pop-item"
              class:active={drawingMode === tool.mode}
              onclick={() => selectTool(cat.id, tool.mode)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="tb-pop-svg">
                {#if tool.svgIcon === 'trendline'}
                  <path d="M4 18L20 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  <circle cx="4" cy="18" r="1.5" fill="currentColor"/><circle cx="20" cy="6" r="1.5" fill="currentColor"/>
                {:else if tool.svgIcon === 'ray'}
                  <path d="M4 18L20 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  <circle cx="4" cy="18" r="1.5" fill="currentColor"/><path d="M18 5L22 4L19 8" fill="currentColor"/>
                {:else if tool.svgIcon === 'extended_line'}
                  <path d="M2 18L22 6" stroke="currentColor" stroke-width="1.6"/>
                  <path d="M2 17L4 19M20 5L22 7" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                {:else if tool.svgIcon === 'hline'}
                  <path d="M3 12H21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  <circle cx="3" cy="12" r="1.5" fill="currentColor"/><circle cx="21" cy="12" r="1.5" fill="currentColor"/>
                {:else if tool.svgIcon === 'vline'}
                  <path d="M12 3V21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  <circle cx="12" cy="3" r="1.5" fill="currentColor"/><circle cx="12" cy="21" r="1.5" fill="currentColor"/>
                {:else if tool.svgIcon === 'channel'}
                  <path d="M3 16L21 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  <path d="M3 20L21 12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="3 2"/>
                  <circle cx="3" cy="16" r="1.5" fill="currentColor"/><circle cx="21" cy="8" r="1.5" fill="currentColor"/>
                {:else if tool.svgIcon === 'fib'}
                  <path d="M3 6H21M3 10H21M3 14H21M3 18H21" stroke="currentColor" stroke-width="1"/>
                  <text x="14" y="9" fill="currentColor" font-size="5">.382</text>
                  <text x="14" y="17" fill="currentColor" font-size="5">.618</text>
                {:else if tool.svgIcon === 'rect'}
                  <rect x="4" y="6" width="16" height="12" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/>
                {:else if tool.svgIcon === 'price_range'}
                  <path d="M12 4V20" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  <path d="M8 4H16M8 20H16" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                {:else if tool.svgIcon === 'long'}
                  <path d="M8 14L12 8L16 14" stroke="#26a69a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                {:else if tool.svgIcon === 'short'}
                  <path d="M8 10L12 16L16 10" stroke="#ef5350" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                {/if}
              </svg>
              <span class="tb-pop-label">{tool.label}</span>
              {#if tool.mode === drawingMode}
                <span class="tb-pop-check">✓</span>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}

  <div class="tb-sep"></div>

  <!-- ── Magnet ── -->
  <button
    class="tb-btn"
    class:active={magnetEnabled}
    title={magnetEnabled ? '자석 모드 켜짐' : '자석 모드 꺼짐'}
    onclick={onToggleMagnet}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 8C4 4 8 2 12 2C16 2 20 4 20 8V14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      <rect x="2" y="14" width="6" height="8" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="16" y="14" width="6" height="8" rx="1" fill="currentColor" opacity="0.8"/>
      <path d="M2 16H8M16 16H22" stroke="#ef5350" stroke-width="1.5"/>
    </svg>
  </button>

  <!-- ── Eraser ── -->
  <button
    class="tb-btn"
    class:active={drawingMode === 'eraser'}
    title="지우개 — 그림 클릭시 삭제"
    onclick={() => onSetDrawingMode(drawingMode === 'eraser' ? 'none' : 'eraser')}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9 20H21M14.5 4.5L19.5 9.5L9.5 19.5L3 20L4.5 13.5L14.5 4.5Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4.5 13.5L10.5 19.5" stroke="currentColor" stroke-width="1"/>
    </svg>
  </button>

  <div class="tb-sep"></div>

  <!-- ── Visibility toggle ── -->
  {#if drawingCount > 0}
    <button
      class="tb-btn"
      class:off={!drawingsVisible}
      title={drawingsVisible ? '그림 숨기기' : '그림 보이기'}
      onclick={onToggleDrawingsVisible}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        {#if drawingsVisible}
          <path d="M1 12C4 7 8 4 12 4C16 4 20 7 23 12C20 17 16 20 12 20C8 20 4 17 1 12Z" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="3" fill="currentColor"/>
        {:else}
          <path d="M1 12C4 7 8 4 12 4C16 4 20 7 23 12C20 17 16 20 12 20C8 20 4 17 1 12Z" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        {/if}
      </svg>
      <span class="tb-badge">{drawingCount}</span>
    </button>
  {/if}

  <!-- ── Trash ── -->
  <button
    class="tb-btn trash"
    title="전체 삭제"
    onclick={onClearAllDrawings}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 6H21M8 6V4C8 3 9 2 10 2H14C15 2 16 3 16 4V6M19 6V20C19 21 18 22 17 22H7C6 22 5 21 5 20V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 11V17M14 11V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </button>
</div>

<style>
  .chart-toolbar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 38px;
    z-index: 8;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 6px 0;
    background: #131722;
    border-right: 1px solid #2a2e39;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }
  .chart-toolbar::-webkit-scrollbar { display: none; }

  .tb-group {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .tb-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: #787b86;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.12s ease;
    position: relative;
    padding: 0;
  }
  .tb-btn:hover {
    background: rgba(41, 98, 255, 0.1);
    color: #d1d4dc;
  }
  .tb-btn.active {
    background: rgba(41, 98, 255, 0.18);
    color: #2962ff;
  }
  .tb-btn.off {
    color: #363a45;
  }

  .tb-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    font-size: 7px;
    font-weight: 700;
    color: #787b86;
    line-height: 1;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  }

  .tb-expand {
    width: 32px;
    height: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: #363a45;
    cursor: pointer;
    padding: 0;
    margin-top: -2px;
  }
  .tb-expand:hover {
    color: #787b86;
  }

  .tb-popover {
    position: absolute;
    left: 40px;
    top: -4px;
    min-width: 180px;
    background: #1e222d;
    border: 1px solid #363a45;
    border-radius: 6px;
    padding: 4px;
    z-index: 100;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }

  .tb-pop-header {
    font-size: 10px;
    font-weight: 600;
    color: #787b86;
    padding: 4px 10px 6px;
    letter-spacing: 0.5px;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
    border-bottom: 1px solid #2a2e39;
    margin-bottom: 2px;
  }

  .tb-pop-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 7px 10px;
    border: none;
    background: transparent;
    color: #d1d4dc;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
    white-space: nowrap;
    transition: background 0.1s;
  }
  .tb-pop-item:hover {
    background: rgba(41, 98, 255, 0.12);
  }
  .tb-pop-item.active {
    color: #2962ff;
    background: rgba(41, 98, 255, 0.08);
  }

  .tb-pop-svg {
    flex-shrink: 0;
  }

  .tb-pop-label {
    flex: 1;
  }

  .tb-pop-check {
    font-size: 11px;
    color: #2962ff;
    margin-left: auto;
  }

  .tb-sep {
    width: 24px;
    height: 1px;
    background: #2a2e39;
    margin: 4px 0;
  }

  .tb-btn.trash {
    color: #363a45;
  }
  .tb-btn.trash:hover {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.08);
  }

  @media (max-width: 768px) {
    .chart-toolbar {
      width: 32px;
      padding: 3px 0;
    }
    .tb-btn {
      width: 28px;
      height: 28px;
    }
    .tb-btn svg {
      width: 15px;
      height: 15px;
    }
    .tb-popover {
      left: 34px;
      min-width: 160px;
    }
  }
</style>

<script lang="ts">
  import type { DrawingMode } from '$lib/chart/chartTypes';
  import ChartToolbarIcon from './ChartToolbarIcon.svelte';
  import ChartToolbarPopover from './ChartToolbarPopover.svelte';
  import { TOOL_CATEGORIES, type ToolCategory, type ToolItem } from './chartToolbarCatalog';

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
    <ChartToolbarIcon name="cursor" />
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
        <ChartToolbarIcon name={activeTool.svgIcon} />
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
        <ChartToolbarPopover
          category={cat}
          {drawingMode}
          onSelect={(mode) => selectTool(cat.id, mode)}
          onClose={() => {
            openCategory = null;
          }}
        />
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
    <ChartToolbarIcon name="magnet" />
  </button>

  <!-- ── Eraser ── -->
  <button
    class="tb-btn"
    class:active={drawingMode === 'eraser'}
    title="지우개 — 그림 클릭시 삭제"
    onclick={() => onSetDrawingMode(drawingMode === 'eraser' ? 'none' : 'eraser')}
  >
    <ChartToolbarIcon name="eraser" />
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
      <ChartToolbarIcon name={drawingsVisible ? 'eye' : 'eye_off'} />
      <span class="tb-badge">{drawingCount}</span>
    </button>
  {/if}

  <!-- ── Trash ── -->
  <button
    class="tb-btn trash"
    title="전체 삭제"
    onclick={onClearAllDrawings}
  >
    <ChartToolbarIcon name="trash" />
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
    .tb-btn :global(svg) {
      width: 15px;
      height: 15px;
    }
  }
</style>

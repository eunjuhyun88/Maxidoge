<script lang="ts">
  import type { DrawingMode } from '$lib/chart/chartTypes';
  import type { ToolCategory } from './chartToolbarCatalog';
  import ChartToolbarIcon from './ChartToolbarIcon.svelte';

  interface Props {
    category: ToolCategory;
    drawingMode: DrawingMode;
    onSelect?: (mode: DrawingMode) => void;
    onClose?: () => void;
  }

  let {
    category,
    drawingMode,
    onSelect = () => {},
    onClose = () => {},
  }: Props = $props();
</script>

<div
  class="tb-popover"
  role="menu"
  aria-label="{category.label} 도구 메뉴"
  tabindex="-1"
  onmouseleave={onClose}
>
  <div class="tb-pop-header">{category.label}</div>
  {#each category.tools as tool}
    <button
      class="tb-pop-item"
      class:active={drawingMode === tool.mode}
      onclick={() => onSelect(tool.mode)}
    >
      <ChartToolbarIcon name={tool.svgIcon} width={20} height={20} />
      <span class="tb-pop-label">{tool.label}</span>
      {#if tool.mode === drawingMode}
        <span class="tb-pop-check">✓</span>
      {/if}
    </button>
  {/each}
</div>

<style>
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

  .tb-pop-label {
    flex: 1;
  }

  .tb-pop-check {
    font-size: 11px;
    color: #2962ff;
    margin-left: auto;
  }

  @media (max-width: 768px) {
    .tb-popover {
      left: 34px;
      min-width: 160px;
    }
  }
</style>

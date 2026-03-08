<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  // ── Preset color palette (TradingView-like) ──
  const COLORS = [
    '#2962ff', '#e91e63', '#ff9800',
    '#4caf50', '#00bcd4', '#9c27b0',
  ] as const;

  const WIDTHS = [1, 2, 3] as const;
  const STYLES = ['solid', 'dashed', 'dotted'] as const;

  interface Props {
    visible: boolean;
    x: number;
    y: number;
    currentColor?: string;
    currentWidth?: number;
    currentStyle?: 'solid' | 'dashed' | 'dotted';
    isLocked?: boolean;
    onChangeColor?: (color: string) => void;
    onChangeWidth?: (width: number) => void;
    onChangeStyle?: (style: 'solid' | 'dashed' | 'dotted') => void;
    onDuplicate?: () => void;
    onToggleLock?: () => void;
    onDelete?: () => void;
    onClose?: () => void;
  }

  let {
    visible,
    x,
    y,
    currentColor = '#2962ff',
    currentWidth = 1,
    currentStyle = 'solid',
    isLocked = false,
    onChangeColor = () => {},
    onChangeWidth = () => {},
    onChangeStyle = () => {},
    onDuplicate = () => {},
    onToggleLock = () => {},
    onDelete = () => {},
    onClose = () => {},
  }: Props = $props();

  let menuEl: HTMLDivElement | null = $state(null);

  // Close on click outside
  function handleClickOutside(e: MouseEvent) {
    if (menuEl && !menuEl.contains(e.target as Node)) {
      onClose();
    }
  }

  // Close on Escape
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  $effect(() => {
    if (visible) {
      // Delay so the contextmenu mousedown doesn't immediately close it
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 50);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    }
  });

  // Clamp menu position to viewport
  let clampedX = $derived(Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 800) - 200));
  let clampedY = $derived(Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 600) - 260));
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="ctx-menu"
    bind:this={menuEl}
    style="left: {clampedX}px; top: {clampedY}px;"
  >
    <!-- Color row -->
    <div class="ctx-row">
      <span class="ctx-label">Color</span>
      <div class="ctx-swatches">
        {#each COLORS as color}
          <button
            class="swatch"
            class:active={currentColor === color}
            style="background: {color};"
            onclick={() => onChangeColor(color)}
            aria-label="Color {color}"
          ></button>
        {/each}
      </div>
    </div>

    <!-- Width row -->
    <div class="ctx-row">
      <span class="ctx-label">Width</span>
      <div class="ctx-widths">
        {#each WIDTHS as w}
          <button
            class="width-btn"
            class:active={currentWidth === w}
            onclick={() => onChangeWidth(w)}
            aria-label="Width {w}"
          >
            <span class="width-line" style="height: {w}px;"></span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Style row -->
    <div class="ctx-row">
      <span class="ctx-label">Style</span>
      <div class="ctx-styles">
        {#each STYLES as s}
          <button
            class="style-btn"
            class:active={currentStyle === s}
            onclick={() => onChangeStyle(s)}
            aria-label="Style {s}"
          >
            <svg width="28" height="8" viewBox="0 0 28 8">
              {#if s === 'solid'}
                <line x1="0" y1="4" x2="28" y2="4" stroke="currentColor" stroke-width="2" />
              {:else if s === 'dashed'}
                <line x1="0" y1="4" x2="28" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="6,4" />
              {:else}
                <line x1="0" y1="4" x2="28" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="2,3" />
              {/if}
            </svg>
          </button>
        {/each}
      </div>
    </div>

    <div class="ctx-divider"></div>

    <!-- Action buttons -->
    <button class="ctx-action" onclick={onDuplicate}>
      <span class="ctx-icon">⧉</span> Duplicate
    </button>
    <button class="ctx-action" onclick={onToggleLock}>
      <span class="ctx-icon">{isLocked ? '🔓' : '🔒'}</span>
      {isLocked ? 'Unlock' : 'Lock'}
    </button>
    <button class="ctx-action ctx-danger" onclick={onDelete}>
      <span class="ctx-icon">🗑</span> Delete
    </button>
  </div>
{/if}

<style>
  .ctx-menu {
    position: fixed;
    z-index: 9999;
    background: #1e222d;
    border: 1px solid #363a45;
    border-radius: 6px;
    padding: 8px 0;
    min-width: 180px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    color: #d1d4dc;
    user-select: none;
  }

  .ctx-row {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    gap: 8px;
  }

  .ctx-label {
    width: 40px;
    flex-shrink: 0;
    color: #787b86;
    font-size: 11px;
  }

  .ctx-swatches {
    display: flex;
    gap: 4px;
  }

  .swatch {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: border-color 0.15s;
  }

  .swatch:hover {
    border-color: rgba(255, 255, 255, 0.3);
  }

  .swatch.active {
    border-color: #fff;
  }

  .ctx-widths,
  .ctx-styles {
    display: flex;
    gap: 4px;
  }

  .width-btn,
  .style-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 24px;
    background: transparent;
    border: 1px solid #363a45;
    border-radius: 4px;
    cursor: pointer;
    color: #d1d4dc;
    padding: 0;
  }

  .width-btn:hover,
  .style-btn:hover {
    background: #2a2e39;
  }

  .width-btn.active,
  .style-btn.active {
    border-color: #2962ff;
    background: rgba(41, 98, 255, 0.15);
  }

  .width-line {
    display: block;
    width: 20px;
    background: currentColor;
    border-radius: 1px;
  }

  .ctx-divider {
    height: 1px;
    background: #363a45;
    margin: 6px 0;
  }

  .ctx-action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 12px;
    background: transparent;
    border: none;
    color: #d1d4dc;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .ctx-action:hover {
    background: #2a2e39;
  }

  .ctx-danger:hover {
    background: rgba(244, 67, 54, 0.15);
    color: #f44336;
  }

  .ctx-icon {
    width: 16px;
    text-align: center;
    font-size: 13px;
  }
</style>

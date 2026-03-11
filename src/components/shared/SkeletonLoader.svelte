<script lang="ts">
  type Variant = 'text' | 'card' | 'chart' | 'stat' | 'inline';

  interface Props {
    variant?: Variant;
    lines?: number;
    compact?: boolean;
    animate?: boolean;
  }

  let {
    variant = 'text' as Variant,
    lines = 3,
    compact = false,
    animate = true,
  }: Props = $props();

  const rowIndexes = $derived(Array.from({ length: Math.max(lines, 1) }, (_, index) => index));
</script>

<div class="skeleton" class:compact class:animate data-variant={variant} aria-hidden="true">
  {#if variant === 'text'}
    <div class="stack">
      {#each rowIndexes as row}
        <div class="line" style={`--line-width:${row === rowIndexes.length - 1 ? 72 : 100}%`}></div>
      {/each}
    </div>
  {:else if variant === 'card'}
    <div class="card-frame">
      <div class="card-head"></div>
      <div class="stack">
        {#each rowIndexes as row}
          <div class="line" style={`--line-width:${row === rowIndexes.length - 1 ? 62 : 100}%`}></div>
        {/each}
      </div>
      <div class="card-foot">
        <div class="pill"></div>
        <div class="pill short"></div>
      </div>
    </div>
  {:else if variant === 'chart'}
    <div class="chart-frame">
      <div class="chart-header">
        <div class="pill short"></div>
        <div class="pill tiny"></div>
      </div>
      <div class="chart-body"></div>
      <div class="chart-axis"></div>
    </div>
  {:else if variant === 'stat'}
    <div class="stat-frame">
      <div class="pill tiny"></div>
      <div class="stat-value"></div>
      <div class="line stat-caption"></div>
    </div>
  {:else}
    <div class="inline-frame">
      <div class="dot"></div>
      <div class="line"></div>
    </div>
  {/if}
</div>

<style>
  .skeleton {
    --sk-bg: rgba(255, 255, 255, 0.06);
    --sk-bg-2: rgba(255, 255, 255, 0.12);
    --sk-border: rgba(255, 255, 255, 0.08);
    display: block;
  }

  .skeleton.animate :global(*) {
    animation: skeletonPulse 1.4s ease-in-out infinite;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .line,
  .pill,
  .dot,
  .card-head,
  .chart-body,
  .chart-axis,
  .stat-value {
    background: linear-gradient(90deg, var(--sk-bg) 0%, var(--sk-bg-2) 50%, var(--sk-bg) 100%);
    border: 1px solid var(--sk-border);
  }

  .line {
    width: var(--line-width, 100%);
    height: 12px;
    border-radius: 999px;
  }

  .card-frame,
  .chart-frame,
  .stat-frame {
    border: 1px solid var(--sk-border);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.025);
    padding: 16px;
  }

  .card-frame {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .card-head {
    width: 42%;
    height: 18px;
    border-radius: 999px;
  }

  .card-foot,
  .chart-header,
  .inline-frame {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pill {
    width: 84px;
    height: 24px;
    border-radius: 999px;
  }

  .pill.short {
    width: 56px;
  }

  .pill.tiny {
    width: 40px;
    height: 18px;
  }

  .chart-frame {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .chart-body {
    width: 100%;
    height: 180px;
    border-radius: 16px;
  }

  .chart-axis {
    width: 100%;
    height: 18px;
    border-radius: 8px;
  }

  .stat-frame {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 120px;
  }

  .stat-value {
    width: 76%;
    height: 28px;
    border-radius: 10px;
  }

  .stat-caption {
    width: 48%;
  }

  .inline-frame .line {
    flex: 1;
  }

  .dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .compact .stack {
    gap: 8px;
  }

  .compact .line {
    height: 10px;
  }

  .compact .card-frame,
  .compact .chart-frame,
  .compact .stat-frame {
    padding: 12px;
    border-radius: 14px;
  }

  .compact .chart-body {
    height: 132px;
  }

  .compact .stat-value {
    height: 22px;
  }

  @keyframes skeletonPulse {
    0%, 100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }
</style>

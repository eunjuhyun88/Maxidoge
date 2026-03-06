<script lang="ts">
  interface Props {
    segments?: string[];
    idPrefix?: string;
    segmentClass?: (segment: string) => string;
  }

  let {
    segments = [],
    idPrefix = 'ticker',
    segmentClass = () => 'ticker-chip',
  }: Props = $props();
</script>

<div class="ticker-bar">
  <div class="ticker-inner">
    <div class="ticker-track">
      {#each segments as segment, idx (`${idPrefix}-a-${idx}-${segment}`)}
        <span class={segmentClass(segment)}>{segment}</span>
      {/each}
    </div>
    <div class="ticker-track" aria-hidden="true">
      {#each segments as segment, idx (`${idPrefix}-b-${idx}-${segment}`)}
        <span class={segmentClass(segment)}>{segment}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .ticker-bar {
    height: 22px;
    background: linear-gradient(180deg, rgba(15, 40, 24, 0.95) 0%, rgba(10, 27, 17, 0.98) 100%);
    border-top: 1px solid rgba(var(--t-accent-rgb), 0.2);
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
  }

  .ticker-inner {
    display: flex;
    animation: tickerScroll 40s linear infinite;
    will-change: transform;
    contain: layout style;
  }

  .ticker-track {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }

  .ticker-chip {
    font-size: 9px;
    font-family: var(--fm);
    color: var(--grn, #87dcbe);
    font-weight: 600;
    letter-spacing: 0.35px;
    line-height: 1;
    padding: 3px 8px;
    margin: 0 10px;
    border-radius: 999px;
    border: 1px solid transparent;
  }

  .ticker-chip-pos {
    color: #98f5cc;
    border-color: rgba(152, 245, 204, 0.22);
    background: rgba(152, 245, 204, 0.1);
  }

  .ticker-chip-neg {
    color: #ff9eb0;
    border-color: rgba(255, 158, 176, 0.24);
    background: rgba(255, 158, 176, 0.12);
  }

  .ticker-chip-fg {
    font-weight: 800;
    border-color: rgba(var(--t-accent-rgb), 0.3);
    background: rgba(var(--t-accent-rgb), 0.12);
  }

  .ticker-chip-fg.fear {
    color: #ff8ca1;
    box-shadow: 0 0 8px rgba(255, 140, 161, 0.24);
  }

  .ticker-chip-fg.greed {
    color: #86f7b4;
    box-shadow: 0 0 8px rgba(134, 247, 180, 0.24);
  }

  .ticker-chip-fg.neutral {
    color: #ffd89d;
  }

  @keyframes tickerScroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
</style>

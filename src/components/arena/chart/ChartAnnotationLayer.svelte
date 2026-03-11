<script lang="ts">
  type Annotation = {
    id: string;
    icon: string;
    name: string;
    color: string;
    label: string;
    detail: string;
    yPercent: number;
    xPercent: number;
    type: 'ob' | 'funding' | 'whale' | 'signal';
  };

  interface Props {
    annotations?: Annotation[];
  }

  let { annotations = [] }: Props = $props();

  let selectedAnnotationId = $state<string | null>(null);
</script>

{#each annotations as ann (ann.id)}
  <button
    class="chart-annotation"
    style="top:{ann.yPercent}%;left:{ann.xPercent}%;--ann-color:{ann.color}"
    class:active={selectedAnnotationId === ann.id}
    onclick={(event: MouseEvent) => {
      event.stopPropagation();
      selectedAnnotationId = selectedAnnotationId === ann.id ? null : ann.id;
    }}
  >
    <span class="ann-icon">{ann.icon}</span>
    {#if selectedAnnotationId === ann.id}
      <div class="ann-popup">
        <div class="ann-popup-header" style="border-color:{ann.color}">
          <span class="ann-popup-icon">{ann.icon}</span>
          <span class="ann-popup-name" style="color:{ann.color}">{ann.name}</span>
          <span class="ann-popup-type">{ann.type.toUpperCase()}</span>
        </div>
        <div class="ann-popup-label">{ann.label}</div>
        <div class="ann-popup-detail">{ann.detail}</div>
      </div>
    {/if}
  </button>
{/each}

<style>
  .chart-annotation {
    position: absolute;
    z-index: 8;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid var(--ann-color);
    background: rgba(0, 0, 0, 0.8);
    box-shadow: 0 0 10px var(--ann-color), 0 0 20px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    transform: translate(-50%, -50%);
    padding: 0;
    contain: layout style;
  }

  .chart-annotation::before {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 1px solid var(--ann-color);
    opacity: 0;
    will-change: auto;
  }

  .chart-annotation::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    background: var(--ann-color);
    opacity: 0.08;
    z-index: -1;
  }

  .chart-annotation:hover {
    transform: translate(-50%, -50%) scale(1.35);
    box-shadow: 0 0 20px var(--ann-color), 0 0 30px var(--ann-color);
  }

  .chart-annotation.active {
    transform: translate(-50%, -50%) scale(1.25);
    box-shadow: 0 0 20px var(--ann-color), 0 0 30px var(--ann-color);
    z-index: 20;
  }

  .chart-annotation:hover::before {
    animation: annRing 2s ease-out;
  }

  @keyframes annRing {
    0% { transform: scale(1); opacity: 0.4; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  .ann-icon {
    font-size: 13px;
    line-height: 1;
    filter: drop-shadow(0 0 2px var(--ann-color));
  }

  .ann-popup {
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    width: 200px;
    background: rgba(10, 10, 30, 0.95);
    border: 2px solid var(--ann-color);
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    animation: annPopIn 0.2s ease;
    pointer-events: none;
  }

  @keyframes annPopIn {
    from { opacity: 0; transform: translateX(-50%) translateY(5px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .ann-popup-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid;
    margin-bottom: 4px;
  }

  .ann-popup-icon { font-size: 12px; }

  .ann-popup-name {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 1px;
  }

  .ann-popup-type {
    margin-left: auto;
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    letter-spacing: 0.5px;
  }

  .ann-popup-label {
    font-family: var(--fm);
    font-size: 9px;
    font-weight: 900;
    color: #fff;
    margin-bottom: 2px;
  }

  .ann-popup-detail {
    font-family: var(--fm);
    font-size: 9px;
    color: rgba(255, 255, 255, 0.74);
    line-height: 1.4;
  }
</style>

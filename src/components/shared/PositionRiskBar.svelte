<script lang="ts">
  type Direction = 'LONG' | 'SHORT';

  interface Props {
    direction?: Direction;
    entry: number;
    target: number;
    stop: number;
    current?: number | null;
    compact?: boolean;
  }

  let {
    direction = 'LONG' as Direction,
    entry,
    target,
    stop,
    current = null,
    compact = false,
  }: Props = $props();

  const riskPercent = $derived(toPercent(Math.abs(stop - entry), entry));
  const rewardPercent = $derived(toPercent(Math.abs(target - entry), entry));
  const rewardRatio = $derived(riskPercent > 0 ? rewardPercent / riskPercent : null);
  const totalMove = $derived(Math.max(riskPercent + rewardPercent, 0.0001));
  const stopWidth = $derived(`${(riskPercent / totalMove) * 100}%`);
  const targetWidth = $derived(`${(rewardPercent / totalMove) * 100}%`);
  const currentPosition = $derived(formatPosition(direction, stop, target, entry, current));

  function toPercent(delta: number, base: number): number {
    if (!Number.isFinite(delta) || !Number.isFinite(base) || base === 0) return 0;
    return Number(((delta / Math.abs(base)) * 100).toFixed(2));
  }

  function formatPosition(
    side: Direction,
    stopPrice: number,
    targetPrice: number,
    entryPrice: number,
    currentPrice: number | null
  ): string {
    const fallback = side === 'LONG'
      ? ((entryPrice - stopPrice) / Math.max(targetPrice - stopPrice, 0.0001)) * 100
      : ((stopPrice - entryPrice) / Math.max(stopPrice - targetPrice, 0.0001)) * 100;

    if (currentPrice == null || !Number.isFinite(currentPrice)) {
      return `${clamp(fallback)}%`;
    }

    const raw = side === 'LONG'
      ? ((currentPrice - stopPrice) / Math.max(targetPrice - stopPrice, 0.0001)) * 100
      : ((stopPrice - currentPrice) / Math.max(stopPrice - targetPrice, 0.0001)) * 100;

    return `${clamp(raw)}%`;
  }

  function clamp(value: number): number {
    return Number(Math.min(100, Math.max(0, value)).toFixed(2));
  }

  function formatPrice(value: number): string {
    if (!Number.isFinite(value)) return '-';
    if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (Math.abs(value) >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
</script>

<div class="risk-bar" class:compact data-direction={direction}>
  <div class="meta">
    <div>
      <span class="label">Risk</span>
      <strong>{riskPercent.toFixed(2)}%</strong>
    </div>
    <div>
      <span class="label">Reward</span>
      <strong>{rewardPercent.toFixed(2)}%</strong>
    </div>
    <div>
      <span class="label">R:R</span>
      <strong>{rewardRatio == null ? '-' : `${rewardRatio.toFixed(2)}x`}</strong>
    </div>
  </div>

  <div class="track">
    <div class="segment stop" style={`width:${stopWidth}`}></div>
    <div class="segment target" style={`width:${targetWidth}`}></div>
    <div class="marker" style={`left:${currentPosition}`}></div>
  </div>

  <div class="prices">
    <span class="stop-price">SL {formatPrice(stop)}</span>
    <span class="entry-price">ENTRY {formatPrice(entry)}</span>
    <span class="target-price">TP {formatPrice(target)}</span>
  </div>
</div>

<style>
  .risk-bar {
    display: grid;
    gap: 12px;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .meta,
  .prices {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .meta div,
  .prices span {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .label,
  .prices span {
    font-family: var(--fm);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.52);
  }

  strong {
    font-family: var(--fd);
    font-size: 18px;
    color: rgba(255, 255, 255, 0.92);
  }

  .track {
    position: relative;
    display: flex;
    width: 100%;
    height: 14px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
  }

  .segment {
    height: 100%;
  }

  .stop {
    background: linear-gradient(90deg, rgba(255, 107, 122, 0.18), rgba(255, 107, 122, 0.55));
  }

  .target {
    background: linear-gradient(90deg, rgba(41, 211, 145, 0.55), rgba(41, 211, 145, 0.18));
  }

  .marker {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    border-radius: 999px;
    border: 2px solid #041118;
    background: #f5efe7;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 3px rgba(245, 239, 231, 0.12);
  }

  .entry-price {
    align-items: center;
  }

  .target-price {
    align-items: flex-end;
  }

  .compact {
    gap: 10px;
    padding: 12px;
  }

  .compact strong {
    font-size: 15px;
  }

  .compact .track {
    height: 12px;
  }

  @media (max-width: 640px) {
    .meta,
    .prices {
      grid-template-columns: 1fr;
    }

    .entry-price,
    .target-price {
      align-items: flex-start;
    }
  }
</style>

<script lang="ts">
  import type { ChartToolbarIconKey } from './chartToolbarCatalog';

  interface Props {
    name: ChartToolbarIconKey;
    width?: number;
    height?: number;
  }

  let { name, width = 18, height = 18 }: Props = $props();
</script>

<svg {width} {height} viewBox="0 0 24 24" fill="none" aria-hidden="true">
  {#if name === 'cursor'}
    <path d="M5 3L5 17L9.5 12.5L14.5 20L17 19L12 11L17.5 10L5 3Z" fill="currentColor" />
  {:else if name === 'trendline'}
    <path d="M4 18L20 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    <circle cx="4" cy="18" r="2" fill="currentColor" />
    <circle cx="20" cy="6" r="2" fill="currentColor" />
  {:else if name === 'ray'}
    <path d="M4 18L20 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    <circle cx="4" cy="18" r="2" fill="currentColor" />
    <path d="M18 5L22 4L19 8" fill="currentColor" />
  {:else if name === 'extended_line'}
    <path d="M2 18L22 6" stroke="currentColor" stroke-width="1.8" />
    <path d="M2 17L4 19" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    <path d="M20 5L22 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
  {:else if name === 'hline'}
    <path d="M3 12H21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    <circle cx="3" cy="12" r="1.5" fill="currentColor" />
    <circle cx="21" cy="12" r="1.5" fill="currentColor" />
  {:else if name === 'vline'}
    <path d="M12 3V21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    <circle cx="12" cy="3" r="1.5" fill="currentColor" />
    <circle cx="12" cy="21" r="1.5" fill="currentColor" />
  {:else if name === 'channel'}
    <path d="M3 16L21 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    <path
      d="M3 20L21 12"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-dasharray="3 2"
    />
    <circle cx="3" cy="16" r="1.5" fill="currentColor" />
    <circle cx="21" cy="8" r="1.5" fill="currentColor" />
  {:else if name === 'fib'}
    <path d="M3 5H21" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity="0.5" />
    <path d="M3 9H21" stroke="currentColor" stroke-width="1.2" />
    <path d="M3 13H21" stroke="currentColor" stroke-width="1.2" />
    <path d="M3 17H21" stroke="currentColor" stroke-width="1.2" />
    <path d="M3 21H21" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2" opacity="0.5" />
    <text x="4" y="8" fill="currentColor" font-size="5" font-weight="bold">0.382</text>
    <text x="4" y="12" fill="currentColor" font-size="5" font-weight="bold">0.5</text>
    <text x="4" y="16" fill="currentColor" font-size="5" font-weight="bold">0.618</text>
  {:else if name === 'rect'}
    <rect x="4" y="6" width="16" height="12" rx="1" stroke="currentColor" stroke-width="1.6" fill="none" />
    <circle cx="4" cy="6" r="1.5" fill="currentColor" />
    <circle cx="20" cy="6" r="1.5" fill="currentColor" />
    <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    <circle cx="20" cy="18" r="1.5" fill="currentColor" />
  {:else if name === 'price_range'}
    <path d="M12 4V20" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    <path d="M8 4H16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    <path d="M8 20H16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    <text x="14" y="13" fill="currentColor" font-size="6" font-weight="bold">$</text>
  {:else if name === 'long'}
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.2" fill="none" />
    <path
      d="M8 14L12 8L16 14"
      stroke="#26a69a"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {:else if name === 'short'}
    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.2" fill="none" />
    <path
      d="M8 10L12 16L16 10"
      stroke="#ef5350"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {:else if name === 'magnet'}
    <path
      d="M4 8C4 4 8 2 12 2C16 2 20 4 20 8V14"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <rect x="2" y="14" width="6" height="8" rx="1" fill="currentColor" opacity="0.8" />
    <rect x="16" y="14" width="6" height="8" rx="1" fill="currentColor" opacity="0.8" />
    <path d="M2 16H8M16 16H22" stroke="#ef5350" stroke-width="1.5" />
  {:else if name === 'eraser'}
    <path
      d="M9 20H21M14.5 4.5L19.5 9.5L9.5 19.5L3 20L4.5 13.5L14.5 4.5Z"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path d="M4.5 13.5L10.5 19.5" stroke="currentColor" stroke-width="1" />
  {:else if name === 'eye'}
    <path
      d="M1 12C4 7 8 4 12 4C16 4 20 7 23 12C20 17 16 20 12 20C8 20 4 17 1 12Z"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  {:else if name === 'eye_off'}
    <path
      d="M1 12C4 7 8 4 12 4C16 4 20 7 23 12C20 17 16 20 12 20C8 20 4 17 1 12Z"
      stroke="currentColor"
      stroke-width="1.5"
      opacity="0.3"
    />
    <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  {:else if name === 'trash'}
    <path
      d="M3 6H21M8 6V4C8 3 9 2 10 2H14C15 2 16 3 16 4V6M19 6V20C19 21 18 22 17 22H7C6 22 5 21 5 20V6"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path d="M10 11V17M14 11V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  {/if}
</svg>

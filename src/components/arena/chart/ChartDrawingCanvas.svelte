<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { DrawingMode } from '$lib/chart/chartTypes';

  interface Props {
    drawingMode: DrawingMode;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
    onMouseDown?: (event: MouseEvent) => void;
    onMouseMove?: (event: MouseEvent) => void;
    onMouseUp?: (event: MouseEvent) => void;
  }

  let {
    drawingMode,
    onCanvasReady = () => {},
    onMouseDown = () => {},
    onMouseMove = () => {},
    onMouseUp = () => {},
  }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);

  $effect(() => {
    onCanvasReady(canvasEl);
  });

  onDestroy(() => {
    onCanvasReady(null);
  });
</script>

<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
<canvas
  class="drawing-canvas"
  bind:this={canvasEl}
  role="application"
  aria-label="Chart drawing overlay"
  class:drawing-active={drawingMode !== 'none'}
  onmousedown={onMouseDown}
  onmousemove={onMouseMove}
  onmouseup={onMouseUp}
></canvas>

<style>
  .drawing-canvas {
    position: absolute;
    inset: 0;
    z-index: 6;
    pointer-events: none;
  }

  .drawing-canvas.drawing-active {
    pointer-events: auto;
    cursor: crosshair;
  }
</style>

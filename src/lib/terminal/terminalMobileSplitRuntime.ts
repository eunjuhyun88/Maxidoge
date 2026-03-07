import { get, readonly, writable } from 'svelte/store';

const CHAT_PERCENT_BOUNDS: Readonly<{
  min: number;
  max: number;
  initial: number;
}> = {
  min: 15,
  max: 80,
  initial: 30,
};

export function createTerminalMobileSplitRuntime() {
  const chatPercentStore = writable<number>(CHAT_PERCENT_BOUNDS.initial);
  const resizingStore = writable(false);
  let splitContainer: HTMLDivElement | null = null;
  let resizeStartY = 0;
  let resizeStartPercent: number = CHAT_PERCENT_BOUNDS.initial;

  function setContainer(element: HTMLDivElement | null) {
    splitContainer = element;
  }

  function startResize(event: PointerEvent) {
    resizingStore.set(true);
    resizeStartY = event.clientY;
    resizeStartPercent = get(chatPercentStore);
    (event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  }

  function moveResize(event: PointerEvent) {
    if (!get(resizingStore) || !splitContainer) return;

    const containerHeight = splitContainer.offsetHeight;
    if (containerHeight <= 0) return;

    const deltaY = resizeStartY - event.clientY;
    const deltaPercent = (deltaY / containerHeight) * 100;
    chatPercentStore.set(
      Math.max(
        CHAT_PERCENT_BOUNDS.min,
        Math.min(CHAT_PERCENT_BOUNDS.max, resizeStartPercent + deltaPercent),
      ),
    );
  }

  function endResize() {
    resizingStore.set(false);
  }

  return {
    chatPercent: readonly(chatPercentStore),
    endResize,
    moveResize,
    resizing: readonly(resizingStore),
    setContainer,
    startResize,
  };
}

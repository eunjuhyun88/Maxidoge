import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type {
  DrawingManager,
} from '$lib/chart/primitives/drawingManager';
import type { DrawingManagerCallbacks } from '$lib/chart/primitives/drawingManagerTypes';

type DrawingManagerModule = typeof import('$lib/chart/primitives/drawingManager');
type DrawingPersistenceModule = typeof import('$lib/chart/primitives/drawingPersistence');
type DrawingPrimitiveRegistryModule = typeof import('$lib/chart/primitives/drawingPrimitiveRegistry');
type DrawingAutoSaver = {
  trigger: () => void;
  flush: () => void;
  dispose: () => void;
};

export interface ChartDrawingPersistenceRuntimeController {
  preload(): Promise<void>;
  getDrawingManager(): DrawingManager | null;
  ensureDrawingManagerReady(): Promise<DrawingManager | null>;
  syncPairTimeframe(): Promise<void>;
  dispose(): void;
}

export interface CreateChartDrawingPersistenceRuntimeOptions {
  getPair: () => string;
  getTimeframe: () => string;
  getChart: () => IChartApi | null;
  getSeries: () => ISeriesApi<'Candlestick'> | null;
  createDrawingManagerCallbacks: () => DrawingManagerCallbacks;
  autoSaveDebounceMs?: number;
}

export function createChartDrawingPersistenceRuntime(
  options: CreateChartDrawingPersistenceRuntimeOptions,
): ChartDrawingPersistenceRuntimeController {
  const autoSaveDebounceMs = options.autoSaveDebounceMs ?? 500;

  let drawingManagerModulePromise: Promise<DrawingManagerModule> | null = null;
  let drawingPersistenceModulePromise: Promise<DrawingPersistenceModule> | null = null;
  let drawingPrimitiveRegistryModulePromise: Promise<DrawingPrimitiveRegistryModule> | null = null;
  let preloadPromise: Promise<void> | null = null;
  let lastPair = '';
  let lastTimeframe = '';
  let autoSaver: DrawingAutoSaver | null = null;
  let drawingManager: DrawingManager | null = null;

  async function loadDrawingManagerModule() {
    if (!drawingManagerModulePromise) {
      drawingManagerModulePromise = import('$lib/chart/primitives/drawingManager');
    }

    return await drawingManagerModulePromise;
  }

  async function loadDrawingPersistenceModule() {
    if (!drawingPersistenceModulePromise) {
      drawingPersistenceModulePromise = import('$lib/chart/primitives/drawingPersistence');
    }

    return await drawingPersistenceModulePromise;
  }

  async function loadDrawingPrimitiveRegistryModule() {
    if (!drawingPrimitiveRegistryModulePromise) {
      drawingPrimitiveRegistryModulePromise = import('$lib/chart/primitives/drawingPrimitiveRegistry');
    }

    return await drawingPrimitiveRegistryModulePromise;
  }

  function getDrawingManager() {
    return drawingManager;
  }

  async function ensureDrawingManagerReady(): Promise<DrawingManager | null> {
    if (drawingManager) return drawingManager;

    const [managerModule, registryModule] = await Promise.all([
      loadDrawingManagerModule(),
      loadDrawingPrimitiveRegistryModule(),
    ]);
    const chart = options.getChart();
    const series = options.getSeries();
    if (!chart || !series) return null;
    const callbacks = options.createDrawingManagerCallbacks();

    drawingManager = new managerModule.DrawingManager(
      chart,
      series,
      {
        ...callbacks,
        onDrawingsChanged: (count) => {
          callbacks.onDrawingsChanged(count);
          autoSaver?.trigger();
        },
      },
      registryModule.createDrawingPrimitiveRegistry(),
    );

    if (!autoSaver) {
      const persistenceModule = await loadDrawingPersistenceModule();
      autoSaver = persistenceModule.createDrawingAutoSaver(
        () => options.getPair(),
        () => options.getTimeframe(),
        () => drawingManager?.exportDrawings() ?? [],
        autoSaveDebounceMs,
      );
    }

    return drawingManager;
  }

  async function syncPairTimeframe(): Promise<void> {
    const pair = options.getPair();
    const timeframe = options.getTimeframe();
    if (pair === lastPair && timeframe === lastTimeframe) return;

    if (lastPair && lastTimeframe && drawingManager) {
      autoSaver?.flush();
    }

    lastPair = pair;
    lastTimeframe = timeframe;

    const persistenceModule = await loadDrawingPersistenceModule();
    const hasPersistedDrawings = persistenceModule.hasDrawings(pair, timeframe);
    const manager = drawingManager ?? (hasPersistedDrawings ? await ensureDrawingManagerReady() : null);
    if (!manager) return;

    manager.clearAllDrawings();

    if (!hasPersistedDrawings) return;

    const saved = persistenceModule.loadDrawings(pair, timeframe);
    if (saved.length > 0) {
      manager.importDrawings(saved);
    }
  }

  async function preload() {
    if (!preloadPromise) {
      preloadPromise = (async () => {
        await ensureDrawingManagerReady();
        await syncPairTimeframe();
      })();
    }

    await preloadPromise;
  }

  function dispose() {
    autoSaver?.flush();
    autoSaver?.dispose();
    autoSaver = null;
    preloadPromise = null;
    lastPair = '';
    lastTimeframe = '';
    if (drawingManager) {
      drawingManager.dispose();
      drawingManager = null;
    }
  }

  return {
    preload,
    getDrawingManager,
    ensureDrawingManagerReady,
    syncPairTimeframe,
    dispose,
  };
}

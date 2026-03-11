import type { ChartDerivativesRuntimeController } from './chartDerivativesRuntime';
import type { ChartPanelController } from './chartPanelController';
import type { ChartPanelSupportRuntimeController } from './chartPanelSupportRuntime';

export type ChartMountRuntimeModule = typeof import('./chartMountRuntime');
type ChartPanelControllerModule = typeof import('./chartPanelController');
type ChartPanelSupportRuntimeModule = typeof import('./chartPanelSupportRuntime');
type ChartDerivativesRuntimeModule = typeof import('./chartDerivativesRuntime');

export interface ChartClientRuntimeAssembly {
  mountModule: ChartMountRuntimeModule;
  supportRuntime: ChartPanelSupportRuntimeController;
  derivativesRuntime: ChartDerivativesRuntimeController;
  panelController: ChartPanelController;
}

export interface EnsureChartClientRuntimeOptions {
  getCachedPromise: () => Promise<ChartClientRuntimeAssembly> | null;
  setCachedPromise: (promise: Promise<ChartClientRuntimeAssembly> | null) => void;
  getSupportRuntime: () => ChartPanelSupportRuntimeController | null;
  setSupportRuntime: (runtime: ChartPanelSupportRuntimeController | null) => void;
  getDerivativesRuntime: () => ChartDerivativesRuntimeController | null;
  setDerivativesRuntime: (runtime: ChartDerivativesRuntimeController | null) => void;
  getPanelController: () => ChartPanelController | null;
  setPanelController: (controller: ChartPanelController | null) => void;
  createSupportRuntime: (
    createRuntime: ChartPanelSupportRuntimeModule['createChartPanelSupportRuntime'],
  ) => ChartPanelSupportRuntimeController;
  createDerivativesRuntime: (
    createRuntime: ChartDerivativesRuntimeModule['createChartDerivativesRuntime'],
  ) => ChartDerivativesRuntimeController;
  createPanelController: (
    createController: ChartPanelControllerModule['createChartPanelController'],
  ) => ChartPanelController;
}

export async function ensureChartClientRuntime(
  options: EnsureChartClientRuntimeOptions,
): Promise<ChartClientRuntimeAssembly> {
  const cachedPromise = options.getCachedPromise();
  if (cachedPromise) return await cachedPromise;

  const nextPromise = (async () => {
    const [mountModule, controllerModule, supportRuntimeModule, derivativesRuntimeModule] =
      await Promise.all([
        import('./chartMountRuntime'),
        import('./chartPanelController'),
        import('./chartPanelSupportRuntime'),
        import('./chartDerivativesRuntime'),
      ]);

    let supportRuntime = options.getSupportRuntime();
    if (!supportRuntime) {
      supportRuntime = options.createSupportRuntime(
        supportRuntimeModule.createChartPanelSupportRuntime,
      );
      options.setSupportRuntime(supportRuntime);
      supportRuntime.syncDrawingPersistence();
    }

    let derivativesRuntime = options.getDerivativesRuntime();
    if (!derivativesRuntime) {
      derivativesRuntime = options.createDerivativesRuntime(
        derivativesRuntimeModule.createChartDerivativesRuntime,
      );
      options.setDerivativesRuntime(derivativesRuntime);
    }

    let panelController = options.getPanelController();
    if (!panelController) {
      panelController = options.createPanelController(
        controllerModule.createChartPanelController,
      );
      options.setPanelController(panelController);
    }

    return {
      mountModule,
      supportRuntime,
      derivativesRuntime,
      panelController,
    };
  })();

  options.setCachedPromise(nextPromise);

  try {
    return await nextPromise;
  } catch (error) {
    options.setCachedPromise(null);
    throw error;
  }
}

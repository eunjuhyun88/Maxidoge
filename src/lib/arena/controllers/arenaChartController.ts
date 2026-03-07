import {
  applyArenaChartDrag,
  type ArenaChartBridgeState,
  type ArenaChartDragTarget,
} from '$lib/arena/adapters/arenaChartBridge';
import type { Hypothesis } from '$lib/stores/gameState';

interface CreateArenaChartControllerOptions {
  getHypothesis: () => Hypothesis | null;
  getChartBridge: () => ArenaChartBridgeState;
  setChartBridge: (next: ArenaChartBridgeState) => void;
  setHypothesis: (next: Hypothesis) => void;
  getShowMarkers: () => boolean;
  setShowMarkers: (value: boolean) => void;
}

export function createArenaChartController(options: CreateArenaChartControllerOptions) {
  function applyDrag(target: ArenaChartDragTarget, price: number) {
    const dragPatch = applyArenaChartDrag(options.getHypothesis(), target, price);
    options.setChartBridge({
      ...options.getChartBridge(),
      position: dragPatch.position,
    });
    if (dragPatch.nextHypothesis) {
      options.setHypothesis(dragPatch.nextHypothesis);
    }
  }

  return {
    applyDrag,
    onDragEntry: ({ price }: { price: number }) => {
      applyDrag('entry', price);
    },
    onDragSL: ({ price }: { price: number }) => {
      applyDrag('sl', price);
    },
    onDragTP: ({ price }: { price: number }) => {
      applyDrag('tp', price);
    },
    toggleMarkers: () => {
      options.setShowMarkers(!options.getShowMarkers());
    },
    togglePositionVisibility: () => {
      const chartBridge = options.getChartBridge();
      options.setChartBridge({
        ...chartBridge,
        position: {
          ...chartBridge.position,
          visible: !chartBridge.position.visible,
        },
      });
    },
  };
}

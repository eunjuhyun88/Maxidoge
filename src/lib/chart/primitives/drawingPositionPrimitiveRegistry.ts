import type { AnchorPoint } from './drawingPrimitiveTypes';
import type { DrawingData } from './drawingManagerTypes';
import { PositionPrimitive } from './positionPrimitive';

export function createPositionDragPreview(
  mode: 'longentry' | 'shortentry',
  previewId: string,
  anchor: AnchorPoint,
) {
  const side = mode === 'longentry' ? 'long' : 'short';
  const entryPrice = anchor.price;

  return new PositionPrimitive(previewId, {
    side,
    entryPrice,
    entryTime: anchor.time,
    exitTime: anchor.time,
    takeProfitPrice: entryPrice,
    stopLossPrice: entryPrice,
    quantity: 0,
  });
}

export function createPositionPrimitiveFromData(data: DrawingData) {
  if (data.type !== 'position' || !data.positionData) return null;
  return new PositionPrimitive(data.id, data.positionData, data.positionStyle);
}

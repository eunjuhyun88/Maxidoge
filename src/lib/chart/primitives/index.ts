// ═══════════════════════════════════════════════════════════════
// Stockclaw — Drawing Primitives (barrel export)
// ═══════════════════════════════════════════════════════════════

export { PluginBase } from './pluginBase';
export { HorizontalLinePrimitive } from './horizontalLinePrimitive';
export { VerticalLinePrimitive } from './verticalLinePrimitive';
export { TrendLinePrimitive } from './trendLinePrimitive';
export { RayPrimitive } from './rayPrimitive';
export { FibRetracementPrimitive } from './fibRetracementPrimitive';
export { RectanglePrimitive } from './rectanglePrimitive';
export { PriceRangePrimitive } from './priceRangePrimitive';
export { PositionPrimitive } from './positionPrimitive';
export { ExtendedLinePrimitive } from './extendedLinePrimitive';
export { ChannelPrimitive } from './channelPrimitive';
export type { PositionData, PositionStyleOptions } from './positionPrimitive';
export { DrawingManager, isPrimitiveDrawingMode } from './drawingManager';
export type { DrawingData, CandleOHLC, DrawingManagerCallbacks } from './drawingManagerTypes';

export type {
  AnchorPoint,
  DrawingStyleOptions,
  SelectionState,
  ViewPoint,
} from './drawingPrimitiveTypes';

export {
  DEFAULT_DRAWING_STYLE,
  DEFAULT_SELECTION,
  HIT_THRESHOLD,
  pointToSegmentDistance,
  pointToRayDistance,
  isPointInBBox,
  colorWithAlpha,
} from './drawingPrimitiveTypes';

import type { Time } from 'lightweight-charts';
import type { DrawingMode } from '$lib/chart/chartTypes';
import type { PositionData, PositionStyleOptions } from './positionPrimitive';
import { HorizontalLinePrimitive } from './horizontalLinePrimitive';
import { VerticalLinePrimitive } from './verticalLinePrimitive';
import { TrendLinePrimitive } from './trendLinePrimitive';
import { RayPrimitive } from './rayPrimitive';
import { FibRetracementPrimitive } from './fibRetracementPrimitive';
import { RectanglePrimitive } from './rectanglePrimitive';
import { PriceRangePrimitive } from './priceRangePrimitive';
import { PositionPrimitive } from './positionPrimitive';
import { ExtendedLinePrimitive } from './extendedLinePrimitive';
import { ChannelPrimitive } from './channelPrimitive';
import type { DrawingData } from './drawingManagerTypes';
import type { AnchorPoint, DrawingStyleOptions } from './drawingPrimitiveTypes';
import { DEFAULT_DRAWING_STYLE } from './drawingPrimitiveTypes';
import { PluginBase } from './pluginBase';

export interface ManagedPrimitive extends PluginBase {
  id: string;
  setSelected: (selected: boolean) => void;
  setHovered: (hovered: boolean) => void;
  toJSON?: () => unknown;
}

export interface PositionManagedPrimitive extends ManagedPrimitive {
  positionData: PositionData;
  updatePrices: (entry: number, tp: number, sl: number) => void;
  updateTimes: (entryTime: Time, exitTime: Time) => void;
}

export interface DrawingPrimitiveRegistry {
  createSinglePointPrimitive(
    mode: 'hline' | 'vline',
    id: string,
    value: number | Time,
    options: Partial<DrawingStyleOptions>,
  ): ManagedPrimitive | null;
  createDragPreview(
    mode: DrawingMode,
    previewId: string,
    anchor: AnchorPoint,
    options: Partial<DrawingStyleOptions>,
  ): ManagedPrimitive | null;
  createTwoPointPrimitive(
    mode: DrawingMode,
    id: string,
    p1: AnchorPoint,
    p2: AnchorPoint,
    options: Partial<DrawingStyleOptions>,
  ): ManagedPrimitive | null;
  createPrimitiveFromData(data: DrawingData): ManagedPrimitive | null;
  snapshotPrimitive(primitive: ManagedPrimitive): DrawingData | null;
}

function primitiveJsonToDrawingData(json: any): DrawingData | null {
  if (!json || !json.id || !json.type) return null;

  const type = json.type as DrawingData['type'];
  const options = json.options ?? { ...DEFAULT_DRAWING_STYLE };
  let anchors: AnchorPoint[] = [];

  switch (type) {
    case 'hline':
      anchors = [{ time: 0 as unknown as Time, price: json.price ?? 0 }];
      break;
    case 'vline':
      anchors = [{ time: json.time ?? (0 as unknown as Time), price: 0 }];
      break;
    case 'position':
      anchors = [
        { time: json.entryTime, price: json.entryPrice ?? 0 },
        { time: json.exitTime, price: json.entryPrice ?? 0 },
      ];
      return {
        id: json.id,
        type,
        anchors,
        options,
        positionData: {
          side: json.side ?? 'long',
          entryPrice: json.entryPrice ?? 0,
          entryTime: json.entryTime,
          exitTime: json.exitTime,
          takeProfitPrice: json.takeProfitPrice ?? 0,
          stopLossPrice: json.stopLossPrice ?? 0,
          quantity: json.quantity ?? 0,
        },
        positionStyle: json.style,
      };
    default:
      if (json.p1 && json.p2) {
        anchors = [json.p1, json.p2];
      }
      break;
  }

  return { id: json.id, type, anchors, options };
}

export function createDrawingPrimitiveRegistry(): DrawingPrimitiveRegistry {
  return {
    createSinglePointPrimitive(mode, id, value, options) {
      switch (mode) {
        case 'hline':
          return new HorizontalLinePrimitive(id, value as number, options);
        case 'vline':
          return new VerticalLinePrimitive(id, value as Time, options);
        default:
          return null;
      }
    },

    createDragPreview(mode, previewId, anchor, options) {
      switch (mode) {
        case 'trendline':
          return new TrendLinePrimitive(previewId, anchor, anchor, options);
        case 'ray':
          return new RayPrimitive(previewId, anchor, anchor, options);
        case 'fib_retracement':
          return new FibRetracementPrimitive(previewId, anchor, anchor, options);
        case 'rect':
          return new RectanglePrimitive(previewId, anchor, anchor, options);
        case 'price_range':
          return new PriceRangePrimitive(previewId, anchor, anchor, options);
        case 'channel':
          return new ChannelPrimitive(previewId, anchor, anchor, 0, options);
        case 'extended_line':
          return new ExtendedLinePrimitive(previewId, anchor, anchor, options);
        case 'longentry':
        case 'shortentry': {
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
        default:
          return null;
      }
    },

    createTwoPointPrimitive(mode, id, p1, p2, options) {
      switch (mode) {
        case 'trendline':
          return new TrendLinePrimitive(id, p1, p2, options);
        case 'ray':
          return new RayPrimitive(id, p1, p2, options);
        case 'fib_retracement':
          return new FibRetracementPrimitive(id, p1, p2, options);
        case 'rect':
          return new RectanglePrimitive(id, p1, p2, options);
        case 'price_range':
          return new PriceRangePrimitive(id, p1, p2, options);
        case 'channel':
          return new ChannelPrimitive(id, p1, p2, undefined, options);
        case 'extended_line':
          return new ExtendedLinePrimitive(id, p1, p2, options);
        default:
          return null;
      }
    },

    createPrimitiveFromData(data) {
      const { id, type, anchors, options } = data;

      switch (type) {
        case 'hline':
          return anchors[0] ? new HorizontalLinePrimitive(id, anchors[0].price, options) : null;
        case 'vline':
          return anchors[0] ? new VerticalLinePrimitive(id, anchors[0].time, options) : null;
        case 'trendline':
          return anchors[0] && anchors[1] ? new TrendLinePrimitive(id, anchors[0], anchors[1], options) : null;
        case 'ray':
          return anchors[0] && anchors[1] ? new RayPrimitive(id, anchors[0], anchors[1], options) : null;
        case 'fib_retracement':
          return anchors[0] && anchors[1] ? new FibRetracementPrimitive(id, anchors[0], anchors[1], options) : null;
        case 'rect':
          return anchors[0] && anchors[1] ? new RectanglePrimitive(id, anchors[0], anchors[1], options) : null;
        case 'price_range':
          return anchors[0] && anchors[1] ? new PriceRangePrimitive(id, anchors[0], anchors[1], options) : null;
        case 'position':
          return data.positionData ? new PositionPrimitive(id, data.positionData, data.positionStyle) : null;
        case 'extended_line':
          return anchors[0] && anchors[1] ? new ExtendedLinePrimitive(id, anchors[0], anchors[1], options) : null;
        case 'channel':
          return anchors[0] && anchors[1] ? new ChannelPrimitive(id, anchors[0], anchors[1], undefined, options) : null;
        default:
          return null;
      }
    },

    snapshotPrimitive(primitive) {
      if (!('toJSON' in primitive) || typeof primitive.toJSON !== 'function') {
        return null;
      }

      return primitiveJsonToDrawingData(primitive.toJSON());
    },
  };
}

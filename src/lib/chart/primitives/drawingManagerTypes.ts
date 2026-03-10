import type { AnchorPoint, DrawingStyleOptions } from './drawingPrimitiveTypes';
import type { PositionData, PositionStyleOptions } from './positionPrimitive';

export interface DrawingData {
  id: string;
  type:
    | 'hline'
    | 'vline'
    | 'trendline'
    | 'ray'
    | 'fib_retracement'
    | 'rect'
    | 'price_range'
    | 'position'
    | 'extended_line'
    | 'channel';
  anchors: AnchorPoint[];
  options: DrawingStyleOptions;
  positionData?: PositionData;
  positionStyle?: Partial<PositionStyleOptions>;
}

export interface CandleOHLC {
  time: unknown;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DrawingManagerCallbacks {
  onDrawingModeChanged: (mode: import('$lib/chart/chartTypes').DrawingMode) => void;
  onDrawingsChanged: (count: number) => void;
  onSelectedChanged: (id: string | null) => void;
  getDrawingColor: () => string;
  getKlines?: () => CandleOHLC[];
  onContextMenu?: (x: number, y: number, drawingId: string) => void;
}

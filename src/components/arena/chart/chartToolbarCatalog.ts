import type { DrawingMode } from '$lib/chart/chartTypes';

export type ChartToolbarIconKey =
  | 'cursor'
  | 'trendline'
  | 'ray'
  | 'extended_line'
  | 'hline'
  | 'vline'
  | 'channel'
  | 'fib'
  | 'rect'
  | 'price_range'
  | 'long'
  | 'short'
  | 'magnet'
  | 'eraser'
  | 'eye'
  | 'eye_off'
  | 'trash';

export type ToolItem = { mode: DrawingMode; label: string; svgIcon: ChartToolbarIconKey };

export type ToolCategory = {
  id: string;
  label: string;
  tools: ToolItem[];
};

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'lines',
    label: '라인',
    tools: [
      { mode: 'trendline', label: '추세선', svgIcon: 'trendline' },
      { mode: 'ray', label: '레이', svgIcon: 'ray' },
      { mode: 'extended_line', label: '확장선', svgIcon: 'extended_line' },
      { mode: 'hline', label: '수평선', svgIcon: 'hline' },
      { mode: 'vline', label: '수직선', svgIcon: 'vline' },
      { mode: 'channel', label: '평행 채널', svgIcon: 'channel' },
    ],
  },
  {
    id: 'fib',
    label: '피보나치',
    tools: [{ mode: 'fib_retracement', label: '피보나치 되돌림', svgIcon: 'fib' }],
  },
  {
    id: 'shapes',
    label: '도형',
    tools: [{ mode: 'rect', label: '사각형', svgIcon: 'rect' }],
  },
  {
    id: 'measure',
    label: '계측기',
    tools: [{ mode: 'price_range', label: '가격 범위', svgIcon: 'price_range' }],
  },
  {
    id: 'position',
    label: '포지션',
    tools: [
      { mode: 'longentry', label: '매수 포지션', svgIcon: 'long' },
      { mode: 'shortentry', label: '매도 포지션', svgIcon: 'short' },
    ],
  },
];

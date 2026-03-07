import type { Direction, Hypothesis } from '$lib/stores/gameState';

export interface ArenaChartAnnotation {
  id: string;
  icon: string;
  name: string;
  color: string;
  label: string;
  detail: string;
  yPercent: number;
  xPercent: number;
  type: 'ob' | 'funding' | 'whale' | 'signal';
}

export interface ArenaChartMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text: string;
}

export interface ArenaChartPositionState {
  visible: boolean;
  entry: number | null;
  tp: number | null;
  sl: number | null;
  dir: Direction;
}

export interface ArenaChartBridgeState {
  position: ArenaChartPositionState;
  annotations: ArenaChartAnnotation[];
  markers: ArenaChartMarker[];
}

export type ArenaChartDragTarget = 'entry' | 'tp' | 'sl';

interface ArenaChartAgentLike {
  id: string;
  icon: string;
  name: string;
  color: string;
  dir: string;
  finding: { title: string; detail: string };
}

type HypothesisLevels = Pick<Hypothesis, 'entry' | 'tp' | 'sl' | 'dir'>;

const ANNOTATION_CONFIG: Array<{
  agentId: string;
  annId: string;
  icon: string;
  name: string;
  type: ArenaChartAnnotation['type'];
  yRange: [number, number];
  xRange: [number, number];
}> = [
  { agentId: 'structure', annId: 'ob-zone', icon: '⚡', name: 'STRUCTURE', type: 'ob', yRange: [25, 40], xRange: [60, 80] },
  { agentId: 'deriv', annId: 'funding-zone', icon: '📊', name: 'DERIV', type: 'funding', yRange: [15, 25], xRange: [75, 90] },
  { agentId: 'flow', annId: 'whale-zone', icon: '💰', name: 'FLOW', type: 'whale', yRange: [40, 55], xRange: [45, 65] },
  { agentId: 'senti', annId: 'senti-zone', icon: '💜', name: 'SENTI', type: 'signal', yRange: [55, 70], xRange: [55, 80] },
  { agentId: 'macro', annId: 'macro-zone', icon: '🌍', name: 'MACRO', type: 'signal', yRange: [70, 80], xRange: [30, 45] },
];

export function createArenaChartPositionState(): ArenaChartPositionState {
  return {
    visible: false,
    entry: null,
    tp: null,
    sl: null,
    dir: 'LONG',
  };
}

export function createArenaChartBridgeState(): ArenaChartBridgeState {
  return {
    position: createArenaChartPositionState(),
    annotations: [],
    markers: [],
  };
}

export function buildArenaChartPositionFromHypothesis(
  hypothesis: HypothesisLevels,
): ArenaChartPositionState {
  return {
    visible: true,
    entry: hypothesis.entry,
    tp: hypothesis.tp,
    sl: hypothesis.sl,
    dir: hypothesis.dir,
  };
}

export function buildArenaChartDecorations<T extends ArenaChartAgentLike>(
  agents: ReadonlyArray<T>,
): Pick<ArenaChartBridgeState, 'annotations' | 'markers'> {
  return {
    annotations: buildArenaChartAnnotations(agents),
    markers: buildArenaChartMarkers(agents),
  };
}

// Keep chart drag math in one place so the page shell only wires store updates.
export function applyArenaChartDrag(
  hypothesis: Hypothesis | null,
  target: ArenaChartDragTarget,
  price: number,
): {
  nextHypothesis: Hypothesis | null;
  position: ArenaChartPositionState;
} {
  if (!hypothesis) {
    const position = createArenaChartPositionState();
    position.visible = true;
    if (target === 'entry') position.entry = price;
    if (target === 'tp') position.tp = price;
    if (target === 'sl') position.sl = price;
    return {
      nextHypothesis: null,
      position,
    };
  }

  const nextHypothesis = { ...hypothesis, [target]: price };

  if (target === 'tp') {
    nextHypothesis.rr = computeRewardToRisk(nextHypothesis.entry, price, nextHypothesis.sl);
  } else if (target === 'sl') {
    nextHypothesis.rr = computeRewardToRisk(nextHypothesis.entry, nextHypothesis.tp, price);
  }

  return {
    nextHypothesis,
    position: buildArenaChartPositionFromHypothesis(nextHypothesis),
  };
}

function buildArenaChartAnnotations<T extends ArenaChartAgentLike>(
  agents: ReadonlyArray<T>,
): ArenaChartAnnotation[] {
  return ANNOTATION_CONFIG.flatMap((config) => {
    const agent = agents.find((item) => item.id === config.agentId);
    if (!agent) return [];
    return [
      {
        id: config.annId,
        icon: config.icon,
        name: config.name,
        color: agent.color,
        label: agent.finding.title,
        detail: agent.finding.detail,
        yPercent: config.yRange[0] + Math.random() * (config.yRange[1] - config.yRange[0]),
        xPercent: config.xRange[0] + Math.random() * (config.xRange[1] - config.xRange[0]),
        type: config.type,
      },
    ];
  });
}

function buildArenaChartMarkers<T extends ArenaChartAgentLike>(
  agents: ReadonlyArray<T>,
): ArenaChartMarker[] {
  const now = Math.floor(Date.now() / 1000);
  return agents
    .map((agent, index) => {
      const isLong = agent.dir === 'LONG';
      return {
        time: now - (agents.length - index) * 3600,
        position: (isLong ? 'belowBar' : 'aboveBar') as ArenaChartMarker['position'],
        color: agent.color,
        shape: (isLong ? 'arrowUp' : 'arrowDown') as ArenaChartMarker['shape'],
        text: `${agent.icon} ${agent.name}`,
      };
    })
    .sort((left, right) => left.time - right.time);
}

function computeRewardToRisk(entry: number, tp: number, sl: number): number {
  return Math.abs(tp - entry) / Math.max(1, Math.abs(entry - sl));
}

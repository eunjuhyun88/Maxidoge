import type { PassportLearningStatus } from '$lib/api/passportLearningApi';

export type PassportFocusTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface PassportFocusInsight {
  key: string;
  value: string;
  sub: string;
  tone: PassportFocusTone;
}

export interface PassportHeaderStat {
  label: string;
  value: string | number;
  color?: string;
}

export interface PassportFocusCard extends PassportFocusInsight {
  primary?: boolean;
}

interface PassportHeaderStatsInput {
  openPos: number;
  effectiveHoldingCount: number;
  walletConnected: boolean;
  winRate: number;
  trackedCount: number;
}

interface PassportFocusCardsInput {
  closedCount: number;
  recordCount: number;
  trackedCount: number;
  expiredCount: number;
  openPos: number;
  winRate: number;
  closedWinRate: number;
  closedLosses: number;
  avgWinPnl: number;
  avgLossPnl: number;
  longBiasPct: number;
  learningStatusRemote: PassportLearningStatus | null;
}

export function buildPassportHeaderStats(input: PassportHeaderStatsInput): PassportHeaderStat[] {
  return [
    { label: 'OPEN', value: input.openPos },
    { label: 'ASSETS', value: input.walletConnected ? input.effectiveHoldingCount : 0, color: '#8bd8ff' },
    { label: 'WIN RATE', value: `${input.winRate}%`, color: input.winRate >= 50 ? '#9dffcf' : '#ff8f7e' },
    { label: 'TRACKED', value: input.trackedCount, color: '#ff8c3b' },
  ];
}

function buildPassportPerformanceInsight(input: PassportFocusCardsInput): PassportFocusInsight {
  const sampleCount = input.closedCount + input.recordCount;
  if (sampleCount < 8) {
    return {
      key: 'PERFORMANCE STATUS',
      value: 'BOOTSTRAP',
      sub: 'Need 8+ resolved samples for reliable fit',
      tone: 'neutral',
    };
  }

  const riskBalance = input.avgLossPnl <= 0 ? 1.2 : input.avgWinPnl / input.avgLossPnl;
  if (input.closedWinRate >= 55 && riskBalance >= 1 && input.winRate >= 50) {
    return {
      key: 'PERFORMANCE STATUS',
      value: 'ON TRACK',
      sub: 'Win quality and risk control are aligned',
      tone: 'good',
    };
  }

  if (riskBalance < 0.9 || input.closedWinRate < 45) {
    return {
      key: 'PERFORMANCE STATUS',
      value: 'TUNE RISK',
      sub: 'Loss size is dominating your wins',
      tone: 'bad',
    };
  }

  return {
    key: 'PERFORMANCE STATUS',
    value: 'MIXED',
    sub: 'Edge exists but consistency is not stable',
    tone: 'warn',
  };
}

function buildPassportWinRateInsight(input: PassportFocusCardsInput): PassportFocusInsight {
  if (input.recordCount < 5) {
    return {
      key: 'WHY WIN RATE',
      value: `${input.winRate}%`,
      sub: 'Arena sample is still small',
      tone: 'neutral',
    };
  }

  if (input.avgLossPnl > input.avgWinPnl && input.closedLosses >= 3) {
    return {
      key: 'WHY WIN RATE',
      value: `${input.winRate}%`,
      sub: 'Average loss is larger than average win',
      tone: 'bad',
    };
  }

  if (input.longBiasPct >= 70 || input.longBiasPct <= 30) {
    return {
      key: 'WHY WIN RATE',
      value: `${input.winRate}%`,
      sub: `Directional bias is high (${input.longBiasPct}% LONG)`,
      tone: 'warn',
    };
  }

  return {
    key: 'WHY WIN RATE',
    value: `${input.winRate}%`,
    sub: 'Direction and execution are mostly balanced',
    tone: 'good',
  };
}

function buildPassportActionInsight(input: PassportFocusCardsInput): PassportFocusInsight {
  if (input.closedCount < 6) {
    return {
      key: 'NEXT IMPROVEMENT',
      value: 'BUILD SAMPLE',
      sub: 'Close at least 6 trades before tuning rules',
      tone: 'neutral',
    };
  }

  if (input.avgLossPnl > input.avgWinPnl && input.closedLosses > 0) {
    return {
      key: 'NEXT IMPROVEMENT',
      value: 'CUT LOSS FASTER',
      sub: `Target avg loss below ${input.avgWinPnl.toFixed(2)}%`,
      tone: 'bad',
    };
  }

  if (input.longBiasPct >= 70 || input.longBiasPct <= 30) {
    return {
      key: 'NEXT IMPROVEMENT',
      value: 'REBALANCE BIAS',
      sub: 'Keep LONG/SHORT split near 50:50',
      tone: 'warn',
    };
  }

  if (input.openPos > 4) {
    return {
      key: 'NEXT IMPROVEMENT',
      value: 'REDUCE OPEN RISK',
      sub: 'Keep concurrent positions at 3 or less',
      tone: 'warn',
    };
  }

  return {
    key: 'NEXT IMPROVEMENT',
    value: 'SCALE GRADUALLY',
    sub: 'Increase size only if current rules stay consistent',
    tone: 'good',
  };
}

function buildPassportLearningInsight(input: PassportFocusCardsInput): PassportFocusInsight {
  const learningSamples = input.closedCount + input.recordCount + input.trackedCount + input.expiredCount;
  const readinessPct = Math.min(100, Math.round((learningSamples / 40) * 100));

  if (input.learningStatusRemote) {
    if (input.learningStatusRemote.outbox.failed > 0 || input.learningStatusRemote.trainJobs.failed > 0) {
      return {
        key: 'AI LEARNING READINESS',
        value: 'ATTENTION',
        sub: `Outbox failed ${input.learningStatusRemote.outbox.failed} · Jobs failed ${input.learningStatusRemote.trainJobs.failed}`,
        tone: 'bad',
      };
    }

    if (input.learningStatusRemote.outbox.processing > 0 || input.learningStatusRemote.trainJobs.running > 0) {
      return {
        key: 'AI LEARNING READINESS',
        value: 'PIPELINE RUNNING',
        sub: `Processing ${input.learningStatusRemote.outbox.processing} events · Running ${input.learningStatusRemote.trainJobs.running} jobs`,
        tone: 'warn',
      };
    }

    if (input.learningStatusRemote.latestDataset) {
      return {
        key: 'AI LEARNING READINESS',
        value: 'PIPELINE SYNCED',
        sub: `Latest dataset ${input.learningStatusRemote.latestDataset.versionLabel} (${input.learningStatusRemote.latestDataset.sampleCount} samples)`,
        tone: 'good',
      };
    }
  }

  if (learningSamples >= 40) {
    return {
      key: 'AI LEARNING READINESS',
      value: `READY ${readinessPct}%`,
      sub: `Trades ${input.closedCount} · Arena ${input.recordCount} · Signals ${input.trackedCount + input.expiredCount}`,
      tone: 'good',
    };
  }

  if (learningSamples >= 20) {
    return {
      key: 'AI LEARNING READINESS',
      value: `WARMING ${readinessPct}%`,
      sub: `Need ${Math.max(0, 40 - learningSamples)} more samples for stable training`,
      tone: 'warn',
    };
  }

  return {
    key: 'AI LEARNING READINESS',
    value: `COLLECTING ${readinessPct}%`,
    sub: `Need ${Math.max(0, 40 - learningSamples)} more samples to start model tuning`,
    tone: 'neutral',
  };
}

export function shouldShowPassportFocusInsights(resolvedSamples: number, learningSamples: number): boolean {
  return resolvedSamples >= 8 || learningSamples >= 20;
}

export function buildPassportFocusCards(input: PassportFocusCardsInput): PassportFocusCard[] {
  return [
    { ...buildPassportPerformanceInsight(input), primary: true },
    buildPassportWinRateInsight(input),
    buildPassportActionInsight(input),
    buildPassportLearningInsight(input),
  ];
}

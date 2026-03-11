import type {
  PolicyCard,
  PolicyDecision,
  PolicyPanel,
  PolicySummary,
} from './intelTypes';

export interface NormalizedIntelPolicyPayload {
  policyPanels: Record<PolicyPanel, PolicyCard[]>;
  policyDecision: PolicyDecision | null;
  policySummary: PolicySummary | null;
  policyUpdatedAt: number;
  policyLoaded: boolean;
}

export function normalizeIntelPolicyPayload(raw: any): NormalizedIntelPolicyPayload {
  const panels = raw?.panels ?? {};

  return {
    policyPanels: {
      headlines: Array.isArray(panels.headlines) ? panels.headlines : [],
      events: Array.isArray(panels.events) ? panels.events : [],
      flow: Array.isArray(panels.flow) ? panels.flow : [],
      trending: Array.isArray(panels.trending) ? panels.trending : [],
      picks: Array.isArray(panels.picks) ? panels.picks : [],
    },
    policyDecision: raw?.decision ?? null,
    policySummary: raw?.summary ?? null,
    policyUpdatedAt: Number(raw?.generatedAt ?? Date.now()),
    policyLoaded: true,
  };
}

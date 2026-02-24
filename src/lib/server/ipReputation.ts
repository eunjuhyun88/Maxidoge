import { isIP } from 'node:net';
import { env } from '$env/dynamic/private';

function envBool(name: string, fallback: boolean): boolean {
  const raw = env[name as keyof typeof env];
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = env[name as keyof typeof env];
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim() || '';
  if (!first) return null;

  const ipv4WithPort = first.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4WithPort?.[1] && isIP(ipv4WithPort[1]) === 4) {
    return ipv4WithPort[1];
  }

  const bracketedIpv6 = first.match(/^\[([0-9a-fA-F:]+)\](?::\d+)?$/);
  if (bracketedIpv6?.[1] && isIP(bracketedIpv6[1]) === 6) {
    return bracketedIpv6[1];
  }

  return isIP(first) > 0 ? first : null;
}

function parseBlockedIps(): Set<string> {
  const blocked = env.SECURITY_BLOCKED_IPS?.trim() || '';
  if (!blocked) return new Set<string>();

  const values = blocked
    .split(',')
    .map((item) => sanitizeIp(item))
    .filter((item): item is string => Boolean(item));

  return new Set(values);
}

export interface IpReputationDecision {
  allowed: boolean;
  reason?: 'blocked_ip' | 'cf_threat_score';
  clientIp: string | null;
  threatScore: number | null;
}

export function evaluateIpReputation(request: Request, fallbackIp?: string | null): IpReputationDecision {
  const cfIp = sanitizeIp(request.headers.get('cf-connecting-ip'));
  const xffIp = sanitizeIp(request.headers.get('x-forwarded-for'));
  const fallback = sanitizeIp(fallbackIp || null);
  const clientIp = cfIp || xffIp || fallback;

  const blockedIps = parseBlockedIps();
  if (clientIp && blockedIps.has(clientIp)) {
    return {
      allowed: false,
      reason: 'blocked_ip',
      clientIp,
      threatScore: null,
    };
  }

  const threatScoreRaw = request.headers.get('cf-threat-score');
  const parsedThreatScore = typeof threatScoreRaw === 'string'
    ? Number.parseInt(threatScoreRaw, 10)
    : Number.NaN;
  const threatScore = Number.isFinite(parsedThreatScore) ? parsedThreatScore : null;

  const enforceThreatScore = envBool('CF_THREAT_SCORE_ENFORCE', false);
  const threshold = envInt('CF_THREAT_SCORE_BLOCK_THRESHOLD', 30, 1, 100);

  if (enforceThreatScore && threatScore !== null && threatScore >= threshold) {
    return {
      allowed: false,
      reason: 'cf_threat_score',
      clientIp,
      threatScore,
    };
  }

  return {
    allowed: true,
    clientIp,
    threatScore,
  };
}

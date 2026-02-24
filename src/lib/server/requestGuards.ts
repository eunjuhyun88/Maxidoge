export function isBodyTooLarge(request: Request, maxBytes: number): boolean {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const length = Number.parseInt(raw, 10);
  if (!Number.isFinite(length)) return false;
  return length > maxBytes;
}

export function readTurnstileToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const source = body as Record<string, unknown>;

  const direct = typeof source.turnstileToken === 'string' ? source.turnstileToken.trim() : '';
  if (direct) return direct;

  const alt = typeof source.cfTurnstileToken === 'string' ? source.cfTurnstileToken.trim() : '';
  return alt || null;
}

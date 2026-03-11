import { json } from '@sveltejs/kit';

export function isBodyTooLarge(request: Request, maxBytes: number): boolean {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const length = Number.parseInt(raw, 10);
  if (!Number.isFinite(length)) return false;
  return length > maxBytes;
}

export class RequestBodyTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Request body too large (max ${maxBytes} bytes)`);
    this.name = 'RequestBodyTooLargeError';
  }
}

export function isRequestBodyTooLargeError(error: unknown): error is RequestBodyTooLargeError {
  return error instanceof RequestBodyTooLargeError;
}

export async function readJsonBody<T = Record<string, unknown>>(request: Request, maxBytes: number): Promise<T> {
  if (isBodyTooLarge(request, maxBytes)) {
    throw new RequestBodyTooLargeError(maxBytes);
  }

  if (!request.body) return {} as T;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let raw = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // best-effort cancellation
      }
      throw new RequestBodyTooLargeError(maxBytes);
    }

    raw += decoder.decode(value, { stream: true });
  }

  raw += decoder.decode();
  if (!raw.trim()) return {} as T;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new SyntaxError('Invalid request body');
  }
}

type ReadJsonBodyOk<T> = {
  ok: true;
  body: T;
};

type ReadJsonBodyBlocked = {
  ok: false;
  response: Response;
};

export async function readJsonBodySafely<T = Record<string, unknown>>(
  request: Request,
  maxBytes: number,
): Promise<ReadJsonBodyOk<T> | ReadJsonBodyBlocked> {
  try {
    const body = await readJsonBody<T>(request, maxBytes);
    return { ok: true, body };
  } catch (error: unknown) {
    if (isRequestBodyTooLargeError(error)) {
      return {
        ok: false,
        response: json({ error: 'Request body too large' }, { status: 413 }),
      };
    }
    if (error instanceof SyntaxError) {
      return {
        ok: false,
        response: json({ error: 'Invalid request body' }, { status: 400 }),
      };
    }
    throw error;
  }
}

export function readTurnstileToken(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const source = body as Record<string, unknown>;

  const direct = typeof source.turnstileToken === 'string' ? source.turnstileToken.trim() : '';
  if (direct) return direct;

  const alt = typeof source.cfTurnstileToken === 'string' ? source.cfTurnstileToken.trim() : '';
  return alt || null;
}

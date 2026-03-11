/**
 * Type-safe error message extraction.
 * Replaces `catch (error: any)` pattern with `catch (error: unknown)`.
 *
 * Usage:
 *   catch (error: unknown) {
 *     return json({ error: getErrorMessage(error) }, { status: 500 });
 *   }
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

export function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return getErrorCode(error) === code;
}

export function createErrorWithCode(message: string, code: string): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

/**
 * Type guard: check if error has a specific message substring.
 */
export function errorContains(error: unknown, substring: string): boolean {
  return getErrorMessage(error).includes(substring);
}

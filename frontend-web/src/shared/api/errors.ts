export class ApiError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }

  override toString() {
    return this.statusCode != null
      ? `ApiError: Status ${this.statusCode} - ${this.message}`
      : `ApiError: ${this.message}`;
  }
}

export const messageFromResponseBody = (body: string, fallback = 'Cererea a eșuat. Verifică conexiunea și încearcă din nou.'): string => {
  try {
    const json = JSON.parse(body);
    if (json && typeof json === 'object') {
      const record = json as Record<string, unknown>;
      for (const key of ['detail', 'error', 'message']) {
        const value = record[key];
        if (typeof value === 'string' && value.length > 0) return value;
      }
    }
  } catch {}
  // Non-JSON bodies (e.g. raw nginx error pages) must not be dumped in the UI.
  const trimmed = (body || '').trim();
  if (!trimmed || trimmed.startsWith('<')) {
    if (/413|Entity Too Large/i.test(trimmed)) {
      return 'Fișierele încărcate sunt prea mari. Alege imagini mai mici (max ~25 MB în total).';
    }
    return fallback;
  }
  return trimmed;
};

export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message.replace(/^Exception:\s*/, '');
  return String(error);
};

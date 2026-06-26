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

export const messageFromResponseBody = (body: string, fallback = 'Request failed'): string => {
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
  return body || fallback;
};

export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message.replace(/^Exception:\s*/, '');
  return String(error);
};

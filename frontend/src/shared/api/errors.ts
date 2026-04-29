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

export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message.replace(/^Exception:\s*/, '');
  return String(error);
};

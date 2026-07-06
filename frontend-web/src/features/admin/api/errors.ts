export class ApiError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export const messageFromResponseBody = (body: string, fallback = "Request failed"): string => {
  try {
    const json = JSON.parse(body);
    if (json && typeof json === "object" && typeof (json as { detail?: unknown }).detail === "string") {
      return (json as { detail: string }).detail;
    }
  } catch {}
  return body || fallback;
};

export const extractErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message.replace(/^Exception:\s*/, "");
  return String(error);
};

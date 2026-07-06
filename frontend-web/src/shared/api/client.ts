import { ApiConfig } from './config';
import { ApiError, messageFromResponseBody } from './errors';
import { Logger } from '../utils/logger';

const TIMEOUT_MS = 30_000;

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

type RequestOptions = {
  token?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const buildHeaders = (opts?: RequestOptions) =>
  ApiConfig.getHeaders({ token: opts?.token ?? null });

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiError('Cererea a expirat. Încearcă din nou.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
};

const extractMessage = (body: string): string => messageFromResponseBody(body);

const handle = async (response: Response): Promise<Json> => {
  const body = await response.text();
  Logger.debug(`Response Status: ${response.status}`);

  if (response.status >= 200 && response.status < 300) {
    if (!body) return { success: true } as Json;
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        return (parsed as any).data as Json;
      }
      return parsed as Json;
    } catch {
      return { success: true, message: body } as Json;
    }
  }

  throw new ApiError(extractMessage(body), response.status);
};

export const ApiClient = {
  async getList(endpoint: string, opts?: RequestOptions): Promise<unknown[]> {
    const url = ApiConfig.getUrl(endpoint);
    Logger.debug(`GET List Request: ${url}`);
    try {
      const response = await withTimeout(
        fetch(url, { method: 'GET', headers: buildHeaders(opts), signal: opts?.signal }),
        opts?.timeoutMs ?? TIMEOUT_MS,
      );
      const result = await handle(response);
      return Array.isArray(result) ? result : [];
    } catch (err) {
      Logger.error(`GET List Request failed: ${endpoint}`, err);
      throw err;
    }
  },

  async post(
    endpoint: string,
    body: Record<string, unknown>,
    opts?: RequestOptions,
  ): Promise<Record<string, unknown>> {
    const url = ApiConfig.getUrl(endpoint);
    Logger.debug(`POST Request: ${url}`);
    try {
      const response = await withTimeout(
        fetch(url, {
          method: 'POST',
          headers: buildHeaders(opts),
          body: JSON.stringify(body),
          signal: opts?.signal,
        }),
        opts?.timeoutMs ?? TIMEOUT_MS,
      );
      const result = await handle(response);
      return (result && typeof result === 'object' ? (result as Record<string, unknown>) : { result });
    } catch (err) {
      Logger.error(`POST Request failed: ${endpoint}`, err);
      throw err;
    }
  },

  async get<T = Json>(endpoint: string, opts?: RequestOptions): Promise<T> {
    const url = ApiConfig.getUrl(endpoint);
    Logger.debug(`GET Request: ${url}`);
    try {
      const response = await withTimeout(
        fetch(url, { method: 'GET', headers: buildHeaders(opts), signal: opts?.signal }),
        opts?.timeoutMs ?? TIMEOUT_MS,
      );
      return (await handle(response)) as T;
    } catch (err) {
      Logger.error(`GET Request failed: ${endpoint}`, err);
      throw err;
    }
  },

  async put(
    endpoint: string,
    body: Record<string, unknown>,
    opts?: RequestOptions,
  ): Promise<Record<string, unknown>> {
    const url = ApiConfig.getUrl(endpoint);
    Logger.debug(`PUT Request: ${url}`);
    try {
      const response = await withTimeout(
        fetch(url, {
          method: 'PUT',
          headers: buildHeaders(opts),
          body: JSON.stringify(body),
          signal: opts?.signal,
        }),
        opts?.timeoutMs ?? TIMEOUT_MS,
      );
      const result = await handle(response);
      return (result && typeof result === 'object' ? (result as Record<string, unknown>) : { result });
    } catch (err) {
      Logger.error(`PUT Request failed: ${endpoint}`, err);
      throw err;
    }
  },
};

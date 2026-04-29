import { ApiConfig } from '../../../shared/api/config';
import { ApiError } from '../../../shared/api/errors';
import { StorageService } from '../../../shared/storage/storageService';
import { Logger } from '../../../shared/utils/logger';
import {
  VerificationStatusResponse,
  VerificationSubmitResponse,
  verificationStatusResponseFromJson,
  verificationSubmitFromJson,
} from '../types';

const SUBMIT_TIMEOUT_MS = 120_000;
const STATUS_TIMEOUT_MS = 30_000;

const extractMessage = (body: string): string => {
  try {
    const json = JSON.parse(body);
    if (json && typeof json === 'object') {
      if (typeof (json as any).detail === 'string') return (json as any).detail;
      if (typeof (json as any).message === 'string') return (json as any).message;
    }
  } catch {
    // ignore
  }
  return body || 'Verification request failed';
};

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit, ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export type VerificationImage = {
  uri: string;
  fileName?: string;
  mime?: string;
};

const buildAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = StorageService.getUserToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const userId = StorageService.getUserId();
  if (userId != null) headers['X-User-Id'] = String(userId);
  return headers;
};

const fileNameFromUri = (uri: string, fallback: string) => {
  const parts = uri.split('/');
  const last = parts[parts.length - 1];
  return last && last.length > 0 ? last : fallback;
};

export const VerificationApi = {
  async submit(args: {
    userId: number;
    idCardImage: VerificationImage;
    selfieImage: VerificationImage;
  }): Promise<VerificationSubmitResponse> {
    const url = `${ApiConfig.baseUrl}${ApiConfig.verificationEndpoint}/submit`;

    const formData = new FormData();
    formData.append('userId', String(args.userId));
    formData.append('idCardImage', {
      uri: args.idCardImage.uri,
      name: args.idCardImage.fileName ?? fileNameFromUri(args.idCardImage.uri, 'id-card.jpg'),
      type: args.idCardImage.mime ?? 'image/jpeg',
    } as unknown as Blob);
    formData.append('selfieImage', {
      uri: args.selfieImage.uri,
      name: args.selfieImage.fileName ?? fileNameFromUri(args.selfieImage.uri, 'selfie.jpg'),
      type: args.selfieImage.mime ?? 'image/jpeg',
    } as unknown as Blob);

    try {
      const response = await fetchWithTimeout(
        url,
        { method: 'POST', headers: buildAuthHeaders(), body: formData },
        SUBMIT_TIMEOUT_MS,
      );
      const text = await response.text();
      if (!response.ok) throw new ApiError(extractMessage(text), response.status);
      return verificationSubmitFromJson(text ? JSON.parse(text) : {});
    } catch (e) {
      Logger.error('Verification submit failed', e);
      throw e;
    }
  },

  async getStatus(userId: number): Promise<VerificationStatusResponse> {
    const url = `${ApiConfig.baseUrl}${ApiConfig.verificationEndpoint}/status/${userId}`;
    try {
      const response = await fetchWithTimeout(
        url,
        { method: 'GET', headers: ApiConfig.getHeaders() },
        STATUS_TIMEOUT_MS,
      );
      const text = await response.text();
      if (!response.ok) throw new ApiError(extractMessage(text), response.status);
      return verificationStatusResponseFromJson(text ? JSON.parse(text) : {});
    } catch (e) {
      Logger.error('Verification status failed', e);
      throw e;
    }
  },
};

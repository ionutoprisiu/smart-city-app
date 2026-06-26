import { ApiConfig } from '@shared/api/config';
import { ApiError, messageFromResponseBody } from '@shared/api/errors';
import { StorageService } from '@shared/storage/storageService';
import { Logger } from '@shared/utils/logger';
import {
  VerificationStatusResponse,
  VerificationSubmitResponse,
  verificationStatusResponseFromJson,
  verificationSubmitFromJson,
} from '../types';

const SUBMIT_TIMEOUT_MS = 120_000;
const STATUS_TIMEOUT_MS = 30_000;

const extractMessage = (body: string): string =>
  messageFromResponseBody(body, 'Verification request failed');

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit, ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export type VerificationImage = File;

const buildAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  const token = StorageService.getUserToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export const VerificationApi = {
  async submit(args: {
    idCardImage: VerificationImage;
    selfieImage: VerificationImage;
  }): Promise<VerificationSubmitResponse> {
    const url = `${ApiConfig.baseUrl}${ApiConfig.verificationEndpoint}/submit`;

    const formData = new FormData();
    formData.append('idCardImage', args.idCardImage, args.idCardImage.name || 'id-card.jpg');
    formData.append('selfieImage', args.selfieImage, args.selfieImage.name || 'selfie.jpg');

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

  async getStatus(): Promise<VerificationStatusResponse> {
    const url = `${ApiConfig.baseUrl}${ApiConfig.verificationEndpoint}/status`;
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

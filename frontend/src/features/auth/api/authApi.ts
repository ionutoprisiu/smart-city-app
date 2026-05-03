import { ApiClient } from '@shared/api/client';
import { ApiConfig } from '@shared/api/config';
import { Logger } from '@shared/utils/logger';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  authResponseFromJson,
} from '../types';

export const AuthApi = {
  async register(request: RegisterRequest): Promise<AuthResponse> {
    try {
      const body: Record<string, unknown> = {
        email: request.email,
        password: request.password,
        firstName: request.firstName,
        lastName: request.lastName,
      };
      if (request.phoneNumber && request.phoneNumber.length > 0) {
        body.phoneNumber = request.phoneNumber;
      }
      const response = await ApiClient.post(`${ApiConfig.authEndpoint}/register`, body);
      return authResponseFromJson(response);
    } catch (e) {
      Logger.error('Register failed', e);
      throw e;
    }
  },

  async login(request: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await ApiClient.post(`${ApiConfig.authEndpoint}/login`, {
        email: request.email,
        password: request.password,
      });
      return authResponseFromJson(response);
    } catch (e) {
      Logger.error('Login failed', e);
      throw e;
    }
  },
};

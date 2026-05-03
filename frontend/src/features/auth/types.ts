import { Role, roleFromString } from '@shared/types/role';
import { User } from '@shared/types/user';
import {
  VerificationStatus,
  verificationStatusFromString,
} from '@shared/types/verification';

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
};

export type AuthResponse = {
  userId: number;
  email: string;
  role: Role | null;
  firstName: string;
  lastName: string;
  isVerified: boolean | null;
  verificationStatus: VerificationStatus;
  accessToken?: string | null;
  message: string;
};

export const authResponseFromJson = (json: any): AuthResponse => ({
  userId: Number(json?.userId ?? 0),
  email: String(json?.email ?? ''),
  role: roleFromString(json?.role),
  firstName: String(json?.firstName ?? ''),
  lastName: String(json?.lastName ?? ''),
  isVerified: typeof json?.isVerified === 'boolean' ? json.isVerified : null,
  verificationStatus: verificationStatusFromString(json?.verificationStatus),
  accessToken: typeof json?.accessToken === 'string' ? json.accessToken : null,
  message: String(json?.message ?? ''),
});

export const userFromAuthResponse = (response: AuthResponse): User => ({
  id: response.userId,
  email: response.email,
  firstName: response.firstName,
  lastName: response.lastName,
  role: response.role,
  isVerified: response.isVerified,
  verificationStatus: response.verificationStatus,
});

import { Role, roleFromString } from './role';
import {
  VerificationStatus,
  verificationStatusFromString,
} from './verification';

export type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  profilePhotoUri?: string | null;
  role?: Role | null;
  isVerified?: boolean | null;
  verificationStatus: VerificationStatus;
};

export const fullName = (user: User): string => `${user.firstName} ${user.lastName}`;

export const userFromJson = (json: any): User => ({
  id: Number(json?.userId ?? json?.id ?? 0),
  email: String(json?.email ?? ''),
  firstName: String(json?.firstName ?? ''),
  lastName: String(json?.lastName ?? ''),
  profilePhotoUri: typeof json?.profilePhotoUri === 'string' ? json.profilePhotoUri : null,
  role: roleFromString(json?.role),
  isVerified: typeof json?.isVerified === 'boolean' ? json.isVerified : null,
  verificationStatus: verificationStatusFromString(json?.verificationStatus),
});

import {
  VerificationStatus,
  verificationStatusFromString,
} from '@shared/types/verification';
import { roleFromString } from '@shared/types/role';

export type VerificationSubmitResponse = {
  userId: number;
  status: VerificationStatus;
  role: 'user' | 'guide' | 'admin';
  isVerified: boolean;
  score: number | null;
  reason: string;
};

export type VerificationStatusResponse = {
  userId: number;
  status: VerificationStatus;
  role: 'user' | 'guide' | 'admin';
  isVerified: boolean;
  score: number | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  canSubmit: boolean;
  submitBlockedReason: string | null;
  canAccessGuideFlow: boolean;
  guideFlowBlockedReason: string | null;
};

export const verificationSubmitFromJson = (json: any): VerificationSubmitResponse => ({
  userId: Number(json?.userId ?? 0),
  status: verificationStatusFromString(json?.status),
  role: roleFromString(json?.role) ?? 'user',
  isVerified: Boolean(json?.isVerified),
  score: typeof json?.score === 'number' ? json.score : null,
  reason: String(json?.reason ?? ''),
});

export const verificationStatusResponseFromJson = (
  json: any,
): VerificationStatusResponse => ({
  userId: Number(json?.userId ?? 0),
  status: verificationStatusFromString(json?.status),
  role: roleFromString(json?.role) ?? 'user',
  isVerified: Boolean(json?.isVerified),
  score: typeof json?.score === 'number' ? json.score : null,
  reason: typeof json?.reason === 'string' ? json.reason : null,
  metadata:
    json?.metadata && typeof json.metadata === 'object'
      ? (json.metadata as Record<string, unknown>)
      : json?.ocrData && typeof json.ocrData === 'object'
        ? (json.ocrData as Record<string, unknown>)
        : null,
  canSubmit: Boolean(json?.canSubmit),
  submitBlockedReason:
    typeof json?.submitBlockedReason === 'string' ? json.submitBlockedReason : null,
  canAccessGuideFlow: Boolean(json?.canAccessGuideFlow),
  guideFlowBlockedReason:
    typeof json?.guideFlowBlockedReason === 'string'
      ? json.guideFlowBlockedReason
      : null,
});

import {
  VerificationStatus,
  verificationStatusFromString,
} from '../../shared/types/verification';

export type VerificationSubmitResponse = {
  userId: number;
  status: VerificationStatus;
  score: number | null;
  reason: string;
};

export type VerificationStatusResponse = {
  userId: number;
  status: VerificationStatus;
  score: number | null;
  reason: string | null;
  ocrData: Record<string, unknown> | null;
};

export const verificationSubmitFromJson = (json: any): VerificationSubmitResponse => ({
  userId: Number(json?.userId ?? 0),
  status: verificationStatusFromString(json?.status),
  score: typeof json?.score === 'number' ? json.score : null,
  reason: String(json?.reason ?? ''),
});

export const verificationStatusResponseFromJson = (
  json: any,
): VerificationStatusResponse => ({
  userId: Number(json?.userId ?? 0),
  status: verificationStatusFromString(json?.status),
  score: typeof json?.score === 'number' ? json.score : null,
  reason: typeof json?.reason === 'string' ? json.reason : null,
  ocrData:
    json?.ocrData && typeof json.ocrData === 'object'
      ? (json.ocrData as Record<string, unknown>)
      : null,
});

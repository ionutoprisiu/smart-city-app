export type VerificationStatus =
  | 'notSubmitted'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'manualReview';

export const verificationStatusFromString = (value?: string | null): VerificationStatus => {
  switch (value) {
    case 'PENDING':
      return 'pending';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'MANUAL_REVIEW':
      return 'manualReview';
    case 'NOT_SUBMITTED':
    default:
      return 'notSubmitted';
  }
};

export const verificationStatusToApi = (status: VerificationStatus): string => {
  switch (status) {
    case 'pending':
      return 'PENDING';
    case 'approved':
      return 'APPROVED';
    case 'rejected':
      return 'REJECTED';
    case 'manualReview':
      return 'MANUAL_REVIEW';
    case 'notSubmitted':
    default:
      return 'NOT_SUBMITTED';
  }
};

export const verificationStatusLabel = (status: VerificationStatus): string => {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'manualReview':
      return 'Manual review';
    case 'pending':
      return 'Pending';
    case 'notSubmitted':
    default:
      return 'Not submitted';
  }
};

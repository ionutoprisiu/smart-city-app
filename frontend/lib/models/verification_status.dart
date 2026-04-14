enum VerificationStatus {
  notSubmitted,
  pending,
  approved,
  rejected,
  manualReview,
}

VerificationStatus verificationStatusFromString(String? value) {
  switch (value) {
    case 'PENDING':
      return VerificationStatus.pending;
    case 'APPROVED':
      return VerificationStatus.approved;
    case 'REJECTED':
      return VerificationStatus.rejected;
    case 'MANUAL_REVIEW':
      return VerificationStatus.manualReview;
    case 'NOT_SUBMITTED':
    default:
      return VerificationStatus.notSubmitted;
  }
}

String verificationStatusToApi(VerificationStatus status) {
  switch (status) {
    case VerificationStatus.pending:
      return 'PENDING';
    case VerificationStatus.approved:
      return 'APPROVED';
    case VerificationStatus.rejected:
      return 'REJECTED';
    case VerificationStatus.manualReview:
      return 'MANUAL_REVIEW';
    case VerificationStatus.notSubmitted:
      return 'NOT_SUBMITTED';
  }
}

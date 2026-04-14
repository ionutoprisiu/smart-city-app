import 'verification_status.dart';

class VerificationSubmitResponse {
  final int userId;
  final VerificationStatus status;
  final double? score;
  final String reason;

  VerificationSubmitResponse({
    required this.userId,
    required this.status,
    required this.score,
    required this.reason,
  });

  factory VerificationSubmitResponse.fromJson(Map<String, dynamic> json) {
    return VerificationSubmitResponse(
      userId: json['userId'] ?? 0,
      status: verificationStatusFromString(json['status']?.toString()),
      score: (json['score'] as num?)?.toDouble(),
      reason: json['reason']?.toString() ?? '',
    );
  }
}

class VerificationStatusResponse {
  final int userId;
  final VerificationStatus status;
  final double? score;
  final String? reason;
  final Map<String, dynamic>? ocrData;

  VerificationStatusResponse({
    required this.userId,
    required this.status,
    required this.score,
    required this.reason,
    required this.ocrData,
  });

  factory VerificationStatusResponse.fromJson(Map<String, dynamic> json) {
    return VerificationStatusResponse(
      userId: json['userId'] ?? 0,
      status: verificationStatusFromString(json['status']?.toString()),
      score: (json['score'] as num?)?.toDouble(),
      reason: json['reason']?.toString(),
      ocrData: json['ocrData'] is Map<String, dynamic> ? json['ocrData'] as Map<String, dynamic> : null,
    );
  }
}

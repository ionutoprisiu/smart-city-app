import 'role.dart';
import 'verification_status.dart';

class User {
  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final Role? role;
  final bool? isVerified;
  final VerificationStatus verificationStatus;

  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.role,
    this.isVerified,
    this.verificationStatus = VerificationStatus.notSubmitted,
  });

  String get fullName => '$firstName $lastName';

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['userId'] ?? json['id'] ?? 0,
      email: json['email'] ?? '',
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      role: Role.fromString(json['role']?.toString()),
      isVerified: json['isVerified'],
      verificationStatus: verificationStatusFromString(json['verificationStatus']?.toString()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'role': role?.name,
      'isVerified': isVerified,
      'verificationStatus': verificationStatusToApi(verificationStatus),
    };
  }

  User copyWith({
    int? id,
    String? email,
    String? firstName,
    String? lastName,
    Role? role,
    bool? isVerified,
    VerificationStatus? verificationStatus,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      role: role ?? this.role,
      isVerified: isVerified ?? this.isVerified,
      verificationStatus: verificationStatus ?? this.verificationStatus,
    );
  }
}

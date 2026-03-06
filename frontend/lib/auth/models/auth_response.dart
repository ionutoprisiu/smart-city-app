import 'user.dart';
import 'role.dart';

class AuthResponse {
  final int userId;
  final String email;
  final Role? role;
  final String firstName;
  final String lastName;
  final bool? isVerified;
  final bool? isApproved;
  final String message;

  AuthResponse({
    required this.userId,
    required this.email,
    this.role,
    required this.firstName,
    required this.lastName,
    this.isVerified,
    this.isApproved,
    required this.message,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      userId: json['userId'] ?? 0,
      email: json['email'] ?? '',
      role: Role.fromString(json['role']?.toString()),
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      isVerified: json['isVerified'],
      isApproved: json['isApproved'],
      message: json['message'] ?? '',
    );
  }

  User toUser() {
    return User(
      id: userId,
      email: email,
      firstName: firstName,
      lastName: lastName,
      role: role,
      isVerified: isVerified,
      isApproved: isApproved,
    );
  }
}

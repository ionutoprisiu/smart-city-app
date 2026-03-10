import 'role.dart';

class User {
  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final Role? role;
  final bool? isVerified;

  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.role,
    this.isVerified,
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
    };
  }

  User copyWith({
    int? id,
    String? email,
    String? firstName,
    String? lastName,
    Role? role,
    bool? isVerified,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      role: role ?? this.role,
      isVerified: isVerified ?? this.isVerified,
    );
  }
}

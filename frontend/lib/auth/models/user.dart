import 'role.dart';

class User {
  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final String? licensePlate;
  final Role? role;
  final bool? isVerified;
  final bool? isApproved;

  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.licensePlate,
    this.role,
    this.isVerified,
    this.isApproved,
  });

  String get fullName => '$firstName $lastName';

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['userId'] ?? json['id'] ?? 0,
      email: json['email'] ?? '',
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      licensePlate: json['licensePlate'],
      role: Role.fromString(json['role']?.toString()),
      isVerified: json['isVerified'],
      isApproved: json['isApproved'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'licensePlate': licensePlate,
      'role': role?.name,
      'isVerified': isVerified,
      'isApproved': isApproved,
    };
  }

  User copyWith({
    int? id,
    String? email,
    String? firstName,
    String? lastName,
    String? licensePlate,
    Role? role,
    bool? isVerified,
    bool? isApproved,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      licensePlate: licensePlate ?? this.licensePlate,
      role: role ?? this.role,
      isVerified: isVerified ?? this.isVerified,
      isApproved: isApproved ?? this.isApproved,
    );
  }
}

import 'role.dart';

class RegisterRequest {
  final String email;
  final String password;
  final String firstName;
  final String lastName;
  final String? phoneNumber;
  final String? address;
  final String? idCardImageUrl;
  final Role role;

  RegisterRequest({
    required this.email,
    required this.password,
    required this.firstName,
    required this.lastName,
    this.phoneNumber,
    this.address,
    this.idCardImageUrl,
    required this.role,
  });

  Map<String, dynamic> toJson() {
    return {
      'email': email,
      'password': password,
      'firstName': firstName,
      'lastName': lastName,
      if (phoneNumber != null && phoneNumber!.isNotEmpty) 'phoneNumber': phoneNumber,
      if (address != null && address!.isNotEmpty) 'address': address,
      if (idCardImageUrl != null && idCardImageUrl!.isNotEmpty) 'idCardImageUrl': idCardImageUrl,
      'role': role.name.toUpperCase(),
    };
  }
}

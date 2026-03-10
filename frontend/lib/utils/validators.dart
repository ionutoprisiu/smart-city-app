class Validators {
  static String? email(String? value) {
    if (value == null || value.isEmpty) return 'Email is required';
    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    if (!emailRegex.hasMatch(value)) return 'Email is not valid';
    return null;
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return null;
  }

  static String? required(String? value, {String fieldName = 'Field'}) {
    if (value == null || value.isEmpty) return '$fieldName is required';
    return null;
  }

  static String? phone(String? value) {
    if (value == null || value.isEmpty) return null;
    final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
    if (digitsOnly.length < 10) return 'Phone number must have at least 10 digits';
    return null;
  }
}

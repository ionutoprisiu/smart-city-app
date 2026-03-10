class AppConfig {
  // App Info
  static const String appName = 'Smart City App';
  static const String appVersion = '1.0.0';

  // Storage Keys
  static const String userIdKey = 'user_id';
  static const String userEmailKey = 'user_email';
  static const String userNameKey = 'user_name';
  static const String userTokenKey = 'user_token';

  // Timeouts
  static const Duration apiTimeout = Duration(seconds: 30);
  static const Duration connectionTimeout = Duration(seconds: 10);
}

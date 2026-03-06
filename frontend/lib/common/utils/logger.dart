import 'package:flutter/foundation.dart' show kDebugMode;

class Logger {
  static void debug(String message, [dynamic error]) {
    if (kDebugMode) {
      print('🔵 [DEBUG] $message${error != null ? ' - $error' : ''}');
    }
  }

  static void info(String message, [dynamic error]) {
    if (kDebugMode) {
      print('🟢 [INFO] $message${error != null ? ' - $error' : ''}');
    }
  }

  static void warning(String message, [dynamic error]) {
    if (kDebugMode) {
      print('🟡 [WARNING] $message${error != null ? ' - $error' : ''}');
    }
  }

  static void error(String message, [dynamic error]) {
    if (kDebugMode) {
      print('🔴 [ERROR] $message${error != null ? ' - $error' : ''}');
      if (error != null && error is Error) {
        print(error.stackTrace);
      }
    }
  }
}

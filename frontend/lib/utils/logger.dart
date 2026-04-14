import 'package:flutter/foundation.dart' show debugPrint, kDebugMode;

class Logger {
  static void debug(String message, [dynamic error]) {
    if (kDebugMode) {
      debugPrint('[DEBUG] $message${error != null ? ' - $error' : ''}');
    }
  }

  static void info(String message, [dynamic error]) {
    if (kDebugMode) {
      debugPrint('[INFO] $message${error != null ? ' - $error' : ''}');
    }
  }

  static void warning(String message, [dynamic error]) {
    if (kDebugMode) {
      debugPrint('[WARNING] $message${error != null ? ' - $error' : ''}');
    }
  }

  static void error(String message, [dynamic error]) {
    if (kDebugMode) {
      debugPrint('[ERROR] $message${error != null ? ' - $error' : ''}');
      if (error != null && error is Error) {
        debugPrint(error.stackTrace.toString());
      }
    }
  }
}

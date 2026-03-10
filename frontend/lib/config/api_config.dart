import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform;
import 'package:flutter/material.dart';
import '../services/storage_service.dart';

class ApiConfig {
  /// Your Mac's IP on the Wi-Fi network (System Settings -> Network). iPhone and Mac must be on the same Wi-Fi.
  /// Do NOT commit this IP if the repo is public!
  static const String localIp = String.fromEnvironment('LOCAL_IP', defaultValue: '172.20.10.5'); // <-- Change to your local IP

  static String getBaseUrl() {
    if (kIsWeb) {
      return 'http://localhost:8080/api';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8080/api'; // Android Emulator
    } else if (defaultTargetPlatform == TargetPlatform.iOS) {
      return 'http://$localIp:8080/api'; // Physical iOS device or Simulator
    } else if (defaultTargetPlatform == TargetPlatform.macOS) {
      return 'http://127.0.0.1:8080/api';

    }
    return 'http://localhost:8080/api';
  }

  static String get baseUrl => getBaseUrl();

  static const String authEndpoint = '/auth';
  static const String visitCityEndpoint = '/visit-city';

  static Map<String, String> getHeaders({String? token, int? userId}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (token != null) {
      headers['Authorization'] = 'Bearer $token';
    }
    if (userId != null) {
      headers['X-User-Id'] = userId.toString();
    } else {
      final storedUserId = StorageService.getUserId();
      if (storedUserId != null) {
        headers['X-User-Id'] = storedUserId.toString();
      }
    }
    return headers;
  }

  static String getUrl(String endpoint) => '$baseUrl$endpoint';
}

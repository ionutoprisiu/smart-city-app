import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../config/app_config.dart';
import '../utils/logger.dart';
import 'storage_service.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException({required this.message, this.statusCode});

  @override
  String toString() {
    if (statusCode != null) {
      return 'ApiException: Status $statusCode - $message';
    }
    return 'ApiException: $message';
  }
}

class ApiService {
  static final ApiService _instance = ApiService._internal();

  factory ApiService() {
    return _instance;
  }

  ApiService._internal();

  String _getUserId() {
    return StorageService.getUserId()?.toString() ?? '0';
  }

  String? _getToken() {
    return StorageService.getUserToken();
  }

  Future<List<dynamic>> getList(String endpoint,
      {String? token, int? userId}) async {
    final url = Uri.parse('${ApiConfig.baseUrl}$endpoint');
    try {
      final headers = ApiConfig.getHeaders(
        token: token ?? _getToken(),
        userId: userId ?? int.tryParse(_getUserId()),
      );
      Logger.debug('GET List Request: $url');
      final response = await http
          .get(url, headers: headers)
          .timeout(AppConfig.apiTimeout);
      return _handleListResponse(response);
    } catch (e) {
      Logger.error('GET List Request failed: $endpoint', e);
      rethrow;
    }
  }

  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> data,
      {String? token, int? userId}) async {
    final url = Uri.parse('${ApiConfig.baseUrl}$endpoint');
    try {
      final headers = ApiConfig.getHeaders(
        token: token ?? _getToken(),
        userId: userId ?? int.tryParse(_getUserId()),
      );
      Logger.debug('POST Request: $url, Body: $data');
      final response = await http
          .post(url, headers: headers, body: jsonEncode(data))
          .timeout(AppConfig.apiTimeout);
      return _handleResponse(response);
    } catch (e) {
      Logger.error('POST Request failed: $endpoint', e);
      rethrow;
    }
  }

  Map<String, dynamic> _handleResponse(http.Response response) {
    Logger.debug('Response Status: ${response.statusCode}');
    Logger.debug('Response Body: ${response.body}');
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        return {'success': true};
      }
      try {
        final json = jsonDecode(response.body);
        if (json is Map<String, dynamic> && json.containsKey('data')) {
          return json['data'] as Map<String, dynamic>;
        }
        return json as Map<String, dynamic>;
      } catch (e) {
        Logger.error('Failed to parse JSON response', e);
        return {'success': true, 'message': response.body};
      }
    } else {
      final errorMessage = _extractErrorMessage(response);
      throw ApiException(
        message: errorMessage,
        statusCode: response.statusCode,
      );
    }
  }

  List<dynamic> _handleListResponse(http.Response response) {
    Logger.debug('Response Status: ${response.statusCode}');
    Logger.debug('Response Body: ${response.body}');
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) {
        return [];
      }
      try {
        final json = jsonDecode(response.body);
        if (json is Map<String, dynamic> && json.containsKey('data')) {
          return json['data'] as List<dynamic>;
        }
        return json as List<dynamic>;
      } catch (e) {
        Logger.error('Failed to parse JSON list response', e);
        return [];
      }
    } else {
      final errorMessage = _extractErrorMessage(response);
      throw ApiException(
        message: errorMessage,
        statusCode: response.statusCode,
      );
    }
  }

  String _extractErrorMessage(http.Response response) {
    try {
      final json = jsonDecode(response.body);
      if (json is Map<String, dynamic> && json.containsKey('error')) {
        return json['error'] as String;
      }
      if (json is Map<String, dynamic> && json.containsKey('message')) {
        return json['message'] as String;
      }
      return response.body;
    } catch (_) {
      return response.body;
    }
  }
}

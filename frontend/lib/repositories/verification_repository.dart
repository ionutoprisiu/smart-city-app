import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../config/app_config.dart';
import '../models/verification_models.dart';
import '../services/storage_service.dart';

class VerificationRepository {
  static const Duration _verificationSubmitTimeout = Duration(seconds: 120);

  Future<VerificationSubmitResponse> submit({
    required int userId,
    required File idCardImage,
    required File selfieImage,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}${ApiConfig.verificationEndpoint}/submit');
    final request = http.MultipartRequest('POST', uri)
      ..fields['userId'] = userId.toString()
      ..files.add(await http.MultipartFile.fromPath('idCardImage', idCardImage.path))
      ..files.add(await http.MultipartFile.fromPath('selfieImage', selfieImage.path));

    final token = StorageService.getUserToken();
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    final streamed = await request.send().timeout(_verificationSubmitTimeout);
    final body = await streamed.stream.bytesToString();
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      throw Exception(_extractMessage(body));
    }

    final json = jsonDecode(body) as Map<String, dynamic>;
    return VerificationSubmitResponse.fromJson(json);
  }

  Future<VerificationStatusResponse> getStatus(int userId) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}${ApiConfig.verificationEndpoint}/status/$userId');
    final response = await http.get(uri, headers: ApiConfig.getHeaders()).timeout(AppConfig.apiTimeout);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_extractMessage(response.body));
    }
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return VerificationStatusResponse.fromJson(json);
  }

  String _extractMessage(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        if (decoded['detail'] != null) {
          return decoded['detail'].toString();
        }
        if (decoded['message'] != null) {
          return decoded['message'].toString();
        }
      }
      return body;
    } catch (_) {
      return body;
    }
  }
}

import '../services/api_service.dart';
import '../config/api_config.dart';
import '../models/auth_response.dart';
import '../models/login_request.dart';
import '../models/register_request.dart';
import '../utils/logger.dart';

class AuthRepository {
  final ApiService _apiService;

  AuthRepository({ApiService? apiService})
      : _apiService = apiService ?? ApiService();

  Future<AuthResponse> register(RegisterRequest request) async {
    try {
      final response = await _apiService.post(
        '${ApiConfig.authEndpoint}/register',
        request.toJson(),
      );
      return AuthResponse.fromJson(response);
    } catch (e) {
      Logger.error('Register failed', e);
      rethrow;
    }
  }

  Future<AuthResponse> login(LoginRequest request) async {
    try {
      final response = await _apiService.post(
        '${ApiConfig.authEndpoint}/login',
        request.toJson(),
      );
      return AuthResponse.fromJson(response);
    } catch (e) {
      Logger.error('Login failed', e);
      rethrow;
    }
  }
}

import 'package:flutter/foundation.dart';
import 'auth_repository.dart';
import 'models/login_request.dart';
import 'models/register_request.dart';
import 'models/user.dart';
import '../services/storage_service.dart';
import '../common/utils/logger.dart';

class AuthProvider extends ChangeNotifier {
  final AuthRepository _authRepository;
  User? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;

  AuthProvider({AuthRepository? authRepository})
      : _authRepository = authRepository ?? AuthRepository();

  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _currentUser != null;

  Future<void> initialize() async {
    try {
      _setLoading(true);
      final userId = StorageService.getUserId();
      final email = StorageService.getUserEmail();
      final name = StorageService.getUserName();
      if (userId != null && email != null && name != null) {
        final nameParts = name.split('|');
        if (nameParts.length == 2) {
          _currentUser = User(
            id: userId,
            email: email,
            firstName: nameParts[0],
            lastName: nameParts[1],
            licensePlate: StorageService.getLicensePlate(),
          );
          Logger.info('User loaded from storage: ${_currentUser!.email}');
        }
      }
    } catch (e) {
      Logger.error('Failed to initialize auth', e);
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> register(RegisterRequest request) async {
    try {
      _setLoading(true);
      _clearError();
      final response = await _authRepository.register(request);
      await StorageService.saveUserId(response.userId);
      await StorageService.saveUserEmail(response.email);
      await StorageService.saveUserName(response.firstName, response.lastName);
      _currentUser = response.toUser();
      Logger.info('Registration successful: ${response.email}');
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(_extractErrorMessage(e));
      _setLoading(false);
      return false;
    }
  }

  Future<bool> login(LoginRequest request) async {
    try {
      _setLoading(true);
      _clearError();
      final response = await _authRepository.login(request);
      await StorageService.saveUserId(response.userId);
      await StorageService.saveUserEmail(response.email);
      await StorageService.saveUserName(response.firstName, response.lastName);
      _currentUser = response.toUser();
      Logger.info('Login successful: ${response.email}');
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(_extractErrorMessage(e));
      _setLoading(false);
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await StorageService.clearAll();
      _currentUser = null;
      _clearError();
      Logger.info('User logged out');
      notifyListeners();
    } catch (e) {
      Logger.error('Logout failed', e);
    }
  }

  Future<bool> updateLicensePlate(String licensePlate) async {
    if (_currentUser == null) return false;
    try {
      _setLoading(true);
      _clearError();
      await _authRepository.updateLicensePlate(licensePlate);
      _currentUser = _currentUser!.copyWith(licensePlate: licensePlate);
      await StorageService.saveLicensePlate(licensePlate);
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(_extractErrorMessage(e));
      _setLoading(false);
      return false;
    }
  }

  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setError(String? message) {
    _errorMessage = message;
    notifyListeners();
  }

  void _clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  String _extractErrorMessage(dynamic error) {
    if (error is Exception) {
      return error.toString().replaceAll('Exception: ', '');
    }
    return error.toString();
  }
}

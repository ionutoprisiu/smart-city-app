import 'dart:io';
import 'package:flutter/foundation.dart';
import '../repositories/auth_repository.dart';
import '../repositories/verification_repository.dart';
import '../models/login_request.dart';
import '../models/register_request.dart';
import '../models/user.dart';
import '../services/storage_service.dart';
import '../utils/logger.dart';

class AuthProvider extends ChangeNotifier {
  final AuthRepository _authRepository;
  final VerificationRepository _verificationRepository;
  User? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;
  double? _verificationScore;
  String? _verificationReason;
  Map<String, dynamic>? _verificationOcrData;

  AuthProvider({AuthRepository? authRepository, VerificationRepository? verificationRepository})
      : _authRepository = authRepository ?? AuthRepository(),
        _verificationRepository = verificationRepository ?? VerificationRepository();

  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isAuthenticated => _currentUser != null;
  double? get verificationScore => _verificationScore;
  String? get verificationReason => _verificationReason;
  Map<String, dynamic>? get verificationOcrData => _verificationOcrData;

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
          );
          Logger.info('User loaded from storage: ${_currentUser!.email}');
          await refreshVerificationStatus();
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

  Future<bool> submitVerification({
    required File idCardImage,
    required File selfieImage,
  }) async {
    if (_currentUser == null) {
      _setError('You must be logged in.');
      return false;
    }
    try {
      _setLoading(true);
      _clearError();
      final result = await _verificationRepository.submit(
        userId: _currentUser!.id,
        idCardImage: idCardImage,
        selfieImage: selfieImage,
      );
      await _updateVerificationDetailsFromStatus();

      final isApproved = result.status.name == 'approved';
      _currentUser = _currentUser!.copyWith(
        isVerified: isApproved,
        verificationStatus: result.status,
      );
      _verificationScore = result.score;
      _verificationReason = result.reason;
      notifyListeners();
      _setLoading(false);
      return true;
    } catch (e) {
      _setError(_extractErrorMessage(e));
      _setLoading(false);
      return false;
    }
  }

  Future<void> refreshVerificationStatus() async {
    if (_currentUser == null) return;
    try {
      final status = await _verificationRepository.getStatus(_currentUser!.id);
      _currentUser = _currentUser!.copyWith(
        isVerified: status.status.name == 'approved',
        verificationStatus: status.status,
      );
      _verificationScore = status.score;
      _verificationReason = status.reason;
      _verificationOcrData = status.ocrData;
      notifyListeners();
    } catch (_) {
      // Non-blocking refresh.
    }
  }

  Future<void> _updateVerificationDetailsFromStatus() async {
    if (_currentUser == null) return;
    try {
      final status = await _verificationRepository.getStatus(_currentUser!.id);
      _verificationScore = status.score;
      _verificationReason = status.reason;
      _verificationOcrData = status.ocrData;
    } catch (_) {
      // Keep submit response when status fetch fails.
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

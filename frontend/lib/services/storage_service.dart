import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';
import '../common/utils/logger.dart';

class StorageService {
  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    Logger.info('StorageService initialized');
  }

  static Future<bool> saveUserId(int userId) async {
    return await _prefs?.setInt(AppConfig.userIdKey, userId) ?? false;
  }

  static int? getUserId() {
    return _prefs?.getInt(AppConfig.userIdKey);
  }

  static Future<bool> removeUserId() async {
    return await _prefs?.remove(AppConfig.userIdKey) ?? false;
  }

  static Future<bool> saveUserEmail(String email) async {
    return await _prefs?.setString(AppConfig.userEmailKey, email) ?? false;
  }

  static String? getUserEmail() {
    return _prefs?.getString(AppConfig.userEmailKey);
  }

  static Future<bool> removeUserEmail() async {
    return await _prefs?.remove(AppConfig.userEmailKey) ?? false;
  }

  static Future<bool> saveUserName(String firstName, String lastName) async {
    return await _prefs?.setString(AppConfig.userNameKey, '$firstName|$lastName') ?? false;
  }

  static String? getUserName() {
    return _prefs?.getString(AppConfig.userNameKey);
  }

  static Future<bool> removeUserName() async {
    return await _prefs?.remove(AppConfig.userNameKey) ?? false;
  }

  static Future<bool> saveUserToken(String token) async {
    return await _prefs?.setString(AppConfig.userTokenKey, token) ?? false;
  }

  static String? getUserToken() {
    return _prefs?.getString(AppConfig.userTokenKey);
  }

  static Future<bool> removeUserToken() async {
    return await _prefs?.remove(AppConfig.userTokenKey) ?? false;
  }

  static Future<bool> saveLicensePlate(String licensePlate) async {
    return await _prefs?.setString(AppConfig.licensePlateKey, licensePlate) ?? false;
  }

  static String? getLicensePlate() {
    return _prefs?.getString(AppConfig.licensePlateKey);
  }

  static Future<bool> removeLicensePlate() async {
    return await _prefs?.remove(AppConfig.licensePlateKey) ?? false;
  }

  static Future<bool> clearAll() async {
    try {
      await removeUserId();
      await removeUserEmail();
      await removeUserName();
      await removeUserToken();
      await removeLicensePlate();
      Logger.info('All user data cleared');
      return true;
    } catch (e) {
      Logger.error('Failed to clear user data', e);
      return false;
    }
  }
}

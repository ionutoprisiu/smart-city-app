import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../auth_provider.dart';
import '../models/login_request.dart';
import '../../common/utils/validators.dart';
import '../../common/widgets/custom_text_field.dart';
import '../../common/widgets/error_message.dart';
import '../../common/widgets/loading_overlay.dart';
import '../../config/app_constants.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final authProvider = context.read<AuthProvider>();
    final request = LoginRequest(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );
    final success = await authProvider.login(request);
    if (success && mounted) {
      Navigator.of(context).pushReplacementNamed('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Login'),
      ),
      body: Consumer<AuthProvider>(
        builder: (context, authProvider, _) {
          return LoadingOverlay(
            isLoading: authProvider.isLoading,
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppConstants.paddingLarge),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: AppConstants.paddingXLarge),
                    Icon(
                      Icons.login,
                      size: 80,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: AppConstants.paddingLarge),
                    Text(
                      'Welcome!',
                      style: Theme.of(context).textTheme.headlineMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppConstants.paddingXLarge),
                    CustomTextField(
                      label: 'Email',
                      hint: 'example@email.com',
                      controller: _emailController,
                      validator: Validators.email,
                      keyboardType: TextInputType.emailAddress,
                      prefixIcon: Icons.email,
                    ),
                    const SizedBox(height: AppConstants.paddingMedium),
                    CustomTextField(
                      label: 'Password',
                      hint: 'Enter your password',
                      controller: _passwordController,
                      validator: Validators.password,
                      obscureText: true,
                      prefixIcon: Icons.lock,
                    ),
                    const SizedBox(height: AppConstants.paddingMedium),
                    ErrorMessage(
                      message: authProvider.errorMessage,
                    ),
                    const SizedBox(height: AppConstants.paddingLarge),
                    ElevatedButton(
                      onPressed: authProvider.isLoading ? null : _handleLogin,
                      child: const Text('Login'),
                    ),
                    const SizedBox(height: AppConstants.paddingMedium),
                    TextButton(
                      onPressed: () => Navigator.of(context).pushNamed('/register'),
                      child: const Text("Don't have an account? Register"),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

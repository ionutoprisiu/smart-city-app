import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../models/login_request.dart';
import '../utils/validators.dart';
import '../widgets/custom_text_field.dart';
import '../widgets/error_message.dart';
import '../widgets/loading_overlay.dart';
import '../config/app_constants.dart';

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
    if (!_formKey.currentState!.validate()) return;
    final authProvider = context.read<AuthProvider>();
    final request = LoginRequest(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );
    final success = await authProvider.login(request);
    if (success && mounted) {
      final user = authProvider.currentUser;
      if (user != null && user.isVerified != true) {
        Navigator.of(context).pushReplacementNamed('/verification');
      } else {
        Navigator.of(context).pushReplacementNamed('/home');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sign in'),
      ),
      body: SafeArea(
        child: Consumer<AuthProvider>(
          builder: (context, authProvider, _) {
            return LoadingOverlay(
              isLoading: authProvider.isLoading,
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppConstants.screenPadding,
                  vertical: AppConstants.paddingMedium,
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: AppConstants.paddingLarge),
                      Center(
                        child: Container(
                          width: 88,
                          height: 88,
                          decoration: BoxDecoration(
                            color: cs.primaryContainer.withValues(alpha: 0.55),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.lock_open_rounded,
                            size: 40,
                            color: cs.primary,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppConstants.paddingXLarge),
                      Text(
                        'Welcome back',
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.3,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Sign in to explore Cluj and plan your visits.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: cs.onSurfaceVariant,
                          height: 1.4,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppConstants.paddingXLarge),
                      CustomTextField(
                        label: 'Email',
                        hint: 'you@example.com',
                        controller: _emailController,
                        validator: Validators.email,
                        keyboardType: TextInputType.emailAddress,
                        prefixIcon: Icons.mail_outline_rounded,
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
                      CustomTextField(
                        label: 'Password',
                        hint: 'Your password',
                        controller: _passwordController,
                        validator: Validators.password,
                        obscureText: true,
                        prefixIcon: Icons.lock_outline_rounded,
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
                      ErrorMessage(message: authProvider.errorMessage),
                      const SizedBox(height: AppConstants.paddingLarge),
                      FilledButton(
                        onPressed: authProvider.isLoading ? null : _handleLogin,
                        child: const Text('Sign in'),
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
                      TextButton(
                        onPressed: () => Navigator.of(context).pushNamed('/register'),
                        child: const Text('No account yet? Create one'),
                      ),
                      const SizedBox(height: AppConstants.paddingLarge),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

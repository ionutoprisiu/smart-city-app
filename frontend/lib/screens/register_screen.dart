import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../models/register_request.dart';
import '../utils/validators.dart';
import '../widgets/custom_text_field.dart';
import '../widgets/error_message.dart';
import '../widgets/loading_overlay.dart';
import '../config/app_constants.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;
    if (!mounted) return;
    final authProvider = context.read<AuthProvider>();
    final request = RegisterRequest(
      email: _emailController.text.trim(),
      password: _passwordController.text,
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      phoneNumber: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
    );
    final success = await authProvider.register(request);
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
        title: const Text('Create account'),
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
                      Center(
                        child: Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: cs.primaryContainer.withValues(alpha: 0.55),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.person_add_rounded,
                            size: 38,
                            color: cs.primary,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppConstants.paddingLarge),
                      Text(
                        'Join Smart City',
                        style: theme.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.3,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'A few details and you’re ready to explore.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: cs.onSurfaceVariant,
                          height: 1.4,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppConstants.paddingXLarge),
                      CustomTextField(
                        label: 'First name',
                        hint: 'Ion',
                        controller: _firstNameController,
                        validator: (v) => Validators.required(v, fieldName: 'First name'),
                        prefixIcon: Icons.badge_outlined,
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
                      CustomTextField(
                        label: 'Last name',
                        hint: 'Popescu',
                        controller: _lastNameController,
                        validator: (v) => Validators.required(v, fieldName: 'Last name'),
                        prefixIcon: Icons.badge_outlined,
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
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
                        hint: 'At least 6 characters',
                        controller: _passwordController,
                        validator: Validators.password,
                        obscureText: true,
                        prefixIcon: Icons.lock_outline_rounded,
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
                      CustomTextField(
                        label: 'Phone (optional)',
                        hint: '07xx xxx xxx',
                        controller: _phoneController,
                        validator: (v) => Validators.phone(v),
                        keyboardType: TextInputType.phone,
                        prefixIcon: Icons.phone_outlined,
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
                      ErrorMessage(message: authProvider.errorMessage),
                      const SizedBox(height: AppConstants.paddingLarge),
                      FilledButton(
                        onPressed: authProvider.isLoading ? null : _handleRegister,
                        child: const Text('Create account'),
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
                      TextButton(
                        onPressed: () => Navigator.of(context).pushReplacementNamed('/login'),
                        child: const Text('Already have an account? Sign in'),
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

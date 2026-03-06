import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../auth_provider.dart';
import '../models/register_request.dart';
import '../models/role.dart';
import '../../common/utils/validators.dart';
import '../../common/widgets/custom_text_field.dart';
import '../../common/widgets/error_message.dart';
import '../../common/widgets/loading_overlay.dart';
import '../../config/app_constants.dart';
import '../../services/api_service.dart';

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
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  Role _selectedRole = Role.locuitor;
  File? _idCardImage;
  final ImagePicker _picker = ImagePicker();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _pickIdCardImage() async {
    try {
      final XFile? xFile = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        imageQuality: 85,
      );
      if (xFile != null && mounted) {
        setState(() => _idCardImage = File(xFile.path));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error picking image: $e')),
        );
      }
    }
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedRole == Role.locuitor) {
      if (_addressController.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Address is required for residents')),
        );
        return;
      }
      final phoneErr = Validators.phone(_phoneController.text.trim());
      if (_phoneController.text.trim().isNotEmpty && phoneErr != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(phoneErr)));
        return;
      }
      if (_idCardImage == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please upload your ID card photo (required for residents)')),
        );
        return;
      }
    }

    String? idCardImageUrl;
    if (_selectedRole == Role.locuitor && _idCardImage != null) {
      try {
        idCardImageUrl = await ApiService().uploadImage(_idCardImage!);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error uploading photo: $e')),
          );
        }
        return;
      }
    }

    if (!mounted) return;
    final authProvider = context.read<AuthProvider>();
    final request = RegisterRequest(
      email: _emailController.text.trim(),
      password: _passwordController.text,
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      phoneNumber: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
      address: _selectedRole == Role.locuitor ? _addressController.text.trim() : null,
      idCardImageUrl: idCardImageUrl,
      role: _selectedRole,
    );
    final success = await authProvider.register(request);
    if (success && mounted) {
      Navigator.of(context).pushReplacementNamed('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isResident = _selectedRole == Role.locuitor;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Register'),
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
                    const SizedBox(height: AppConstants.paddingLarge),
                    Icon(
                      Icons.person_add,
                      size: 64,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: AppConstants.paddingMedium),
                    Text(
                      'Create an account',
                      style: Theme.of(context).textTheme.headlineSmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppConstants.paddingXLarge),
                    InputDecorator(
                      decoration: const InputDecoration(
                        labelText: 'Role',
                        prefixIcon: Icon(Icons.people),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<Role>(
                          value: _selectedRole,
                          isExpanded: true,
                          items: [Role.locuitor, Role.vizitator]
                              .map((r) => DropdownMenuItem(
                                    value: r,
                                    child: Text(r.toDisplayString()),
                                  ))
                              .toList(),
                          onChanged: (v) {
                            if (v != null) {
                              setState(() {
                                _selectedRole = v;
                                if (v == Role.vizitator) {
                                  _idCardImage = null;
                                }
                              });
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: AppConstants.paddingMedium),
                    CustomTextField(
                      label: 'First Name',
                      hint: 'Your first name',
                      controller: _firstNameController,
                      validator: (v) => Validators.required(v, fieldName: 'First name'),
                      prefixIcon: Icons.badge,
                    ),
                    const SizedBox(height: AppConstants.paddingMedium),
                    CustomTextField(
                      label: 'Last Name',
                      hint: 'Your last name',
                      controller: _lastNameController,
                      validator: (v) => Validators.required(v, fieldName: 'Last name'),
                      prefixIcon: Icons.badge,
                    ),
                    const SizedBox(height: AppConstants.paddingMedium),
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
                      hint: 'At least 6 characters',
                      controller: _passwordController,
                      validator: Validators.password,
                      obscureText: true,
                      prefixIcon: Icons.lock,
                    ),
                    if (isResident) ...[
                      const SizedBox(height: AppConstants.paddingMedium),
                      CustomTextField(
                        label: 'Address',
                        hint: 'Street, number, city, county',
                        controller: _addressController,
                        validator: Validators.address,
                        maxLines: 2,
                        prefixIcon: Icons.home,
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
                      CustomTextField(
                        label: 'Phone',
                        hint: '07xx xxx xxx',
                        controller: _phoneController,
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) {
                            return 'Phone number is required for residents';
                          }
                          return Validators.phone(v);
                        },
                        keyboardType: TextInputType.phone,
                        prefixIcon: Icons.phone,
                      ),
                      const SizedBox(height: AppConstants.paddingMedium),
                      const Text(
                        'ID card photo (will be verified by an operator)',
                        style: TextStyle(
                          fontWeight: FontWeight.w500,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: AppConstants.paddingSmall),
                      OutlinedButton.icon(
                        onPressed: _pickIdCardImage,
                        icon: Icon(_idCardImage == null ? Icons.add_photo_alternate : Icons.check_circle),
                        label: Text(_idCardImage == null ? 'Upload ID card photo' : 'Photo uploaded'),
                      ),
                      if (_idCardImage != null) ...[
                        const SizedBox(height: AppConstants.paddingSmall),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(AppConstants.borderRadiusMedium),
                          child: Image.file(
                            _idCardImage!,
                            height: 120,
                            width: double.infinity,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ],
                    ] else ...[
                      const SizedBox(height: AppConstants.paddingMedium),
                      CustomTextField(
                        label: 'Phone (optional)',
                        hint: '07xx xxx xxx',
                        controller: _phoneController,
                        validator: (v) => Validators.phone(v),
                        keyboardType: TextInputType.phone,
                        prefixIcon: Icons.phone,
                      ),
                    ],
                    const SizedBox(height: AppConstants.paddingMedium),
                    ErrorMessage(message: authProvider.errorMessage),
                    const SizedBox(height: AppConstants.paddingLarge),
                    ElevatedButton(
                      onPressed: authProvider.isLoading ? null : _handleRegister,
                      child: const Text('Register'),
                    ),
                    const SizedBox(height: AppConstants.paddingMedium),
                    TextButton(
                      onPressed: () => Navigator.of(context).pushReplacementNamed('/login'),
                      child: const Text('Already have an account? Login'),
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

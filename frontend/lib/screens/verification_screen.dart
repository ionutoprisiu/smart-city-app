import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../config/app_constants.dart';
import '../models/verification_status.dart';
import '../providers/auth_provider.dart';
import 'verification_camera_capture_screen.dart';
import '../widgets/error_message.dart';
import '../widgets/loading_overlay.dart';

class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key});

  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  final ImagePicker _picker = ImagePicker();
  File? _idCardImage;
  File? _selfieImage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<AuthProvider>().refreshVerificationStatus();
    });
  }

  Future<void> _captureFromCamera({required bool isIdCard}) async {
    final result = await Navigator.of(context).push<File>(
      MaterialPageRoute(
        builder: (_) => VerificationCameraCaptureScreen(
          captureType: isIdCard ? VerificationCaptureType.idCard : VerificationCaptureType.selfie,
        ),
      ),
    );
    if (result == null || !mounted) return;
    setState(() {
      if (isIdCard) {
        _idCardImage = result;
      } else {
        _selfieImage = result;
      }
    });
  }

  Future<void> _pickImage({required bool isIdCard}) async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    setState(() {
      if (isIdCard) {
        _idCardImage = File(picked.path);
      } else {
        _selfieImage = File(picked.path);
      }
    });
  }

  Future<void> _submit() async {
    if (_idCardImage == null || _selfieImage == null) return;
    final auth = context.read<AuthProvider>();
    final ok = await auth.submitVerification(
      idCardImage: _idCardImage!,
      selfieImage: _selfieImage!,
    );
    if (!mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verification request submitted.')),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = context.watch<AuthProvider>();
    final status = auth.currentUser?.verificationStatus ?? VerificationStatus.notSubmitted;

    return Scaffold(
      appBar: AppBar(title: const Text('Identity verification')),
      body: SafeArea(
        child: LoadingOverlay(
          isLoading: auth.isLoading,
          child: ListView(
            padding: const EdgeInsets.all(AppConstants.screenPadding),
            children: [
              Text(
                'Upload your ID card and a selfie.',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                'Status: ${_statusLabel(status)}',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: _statusColor(context, status),
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 18),
              _ImagePickCard(
                title: 'ID card image',
                file: _idCardImage,
                onPickFromGallery: () => _pickImage(isIdCard: true),
                onCaptureFromCamera: () => _captureFromCamera(isIdCard: true),
              ),
              const SizedBox(height: 12),
              _ImagePickCard(
                title: 'Selfie image',
                file: _selfieImage,
                onPickFromGallery: () => _pickImage(isIdCard: false),
                onCaptureFromCamera: () => _captureFromCamera(isIdCard: false),
              ),
              const SizedBox(height: 12),
              ErrorMessage(message: auth.errorMessage),
              if (auth.verificationReason != null || auth.verificationScore != null) ...[
                const SizedBox(height: 12),
                _AnalysisDetailsCard(
                  score: auth.verificationScore,
                  reason: auth.verificationReason,
                  ocrData: auth.verificationOcrData,
                ),
              ],
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: auth.isLoading ? null : () => auth.refreshVerificationStatus(),
                icon: const Icon(Icons.refresh),
                label: const Text('Refresh analysis data'),
              ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: (_idCardImage != null && _selfieImage != null && !auth.isLoading)
                    ? _submit
                    : null,
                icon: const Icon(Icons.verified_user_outlined),
                label: const Text('Submit verification'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _statusLabel(VerificationStatus status) {
    switch (status) {
      case VerificationStatus.approved:
        return 'Approved';
      case VerificationStatus.rejected:
        return 'Rejected';
      case VerificationStatus.manualReview:
        return 'Manual review';
      case VerificationStatus.pending:
        return 'Pending';
      case VerificationStatus.notSubmitted:
        return 'Not submitted';
    }
  }

  Color _statusColor(BuildContext context, VerificationStatus status) {
    final cs = Theme.of(context).colorScheme;
    switch (status) {
      case VerificationStatus.approved:
        return cs.primary;
      case VerificationStatus.rejected:
        return cs.error;
      case VerificationStatus.manualReview:
      case VerificationStatus.pending:
        return cs.tertiary;
      case VerificationStatus.notSubmitted:
        return cs.onSurfaceVariant;
    }
  }
}

class _AnalysisDetailsCard extends StatelessWidget {
  final double? score;
  final String? reason;
  final Map<String, dynamic>? ocrData;

  const _AnalysisDetailsCard({
    required this.score,
    required this.reason,
    required this.ocrData,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final cnp = ocrData?['cnp']?.toString();
    final serial = ocrData?['serial']?.toString();
    final preview = ocrData?['rawTextPreview']?.toString();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        color: cs.surfaceContainerHighest.withValues(alpha: 0.4),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Analysis details', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (score != null) Text('Score: ${score!.toStringAsFixed(3)}'),
          if (reason != null && reason!.isNotEmpty) Text('Reason: $reason'),
          if (cnp != null && cnp.isNotEmpty) Text('Detected CNP: ${_maskCnp(cnp)}'),
          if (serial != null && serial.isNotEmpty) Text('Detected serial: $serial'),
          if (preview != null && preview.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'OCR preview: $preview',
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(color: cs.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }

  String _maskCnp(String cnp) {
    if (cnp.length < 6) return cnp;
    final tail = cnp.substring(cnp.length - 4);
    return '${cnp.substring(0, 2)}********$tail';
  }
}

class _ImagePickCard extends StatelessWidget {
  final String title;
  final File? file;
  final VoidCallback onPickFromGallery;
  final VoidCallback onCaptureFromCamera;

  const _ImagePickCard({
    required this.title,
    required this.file,
    required this.onPickFromGallery,
    required this.onCaptureFromCamera,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              file == null ? '$title (not selected)' : file!.path.split('/').last,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            tooltip: 'Capture with camera',
            onPressed: onCaptureFromCamera,
            icon: const Icon(Icons.photo_camera_outlined),
          ),
          TextButton(onPressed: onPickFromGallery, child: const Text('Gallery')),
        ],
      ),
    );
  }
}

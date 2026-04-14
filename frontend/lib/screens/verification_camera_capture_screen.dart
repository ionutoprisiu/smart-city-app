import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

enum VerificationCaptureType {
  idCard,
  selfie,
}

class VerificationCameraCaptureScreen extends StatefulWidget {
  final VerificationCaptureType captureType;

  const VerificationCameraCaptureScreen({
    super.key,
    required this.captureType,
  });

  @override
  State<VerificationCameraCaptureScreen> createState() => _VerificationCameraCaptureScreenState();
}

class _VerificationCameraCaptureScreenState extends State<VerificationCameraCaptureScreen> {
  CameraController? _controller;
  List<CameraDescription> _cameras = const [];
  bool _isInitializing = true;
  bool _isCapturing = false;
  String? _error;

  bool get _isSelfie => widget.captureType == VerificationCaptureType.selfie;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        setState(() {
          _error = 'No camera available on this device.';
          _isInitializing = false;
        });
        return;
      }

      final selected = _pickInitialCamera();
      _controller = CameraController(
        selected,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await _controller!.initialize();

      if (!mounted) return;
      setState(() {
        _isInitializing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to initialize camera: $e';
        _isInitializing = false;
      });
    }
  }

  CameraDescription _pickInitialCamera() {
    final desired = _isSelfie ? CameraLensDirection.front : CameraLensDirection.back;
    return _cameras.firstWhere(
      (camera) => camera.lensDirection == desired,
      orElse: () => _cameras.first,
    );
  }

  Future<void> _switchCamera() async {
    if (_cameras.length < 2 || _controller == null) return;
    final current = _controller!.description;
    final next = _cameras.firstWhere(
      (camera) => camera != current,
      orElse: () => current,
    );
    await _controller!.dispose();
    final nextController = CameraController(
      next,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );
    await nextController.initialize();
    if (!mounted) {
      await nextController.dispose();
      return;
    }
    setState(() {
      _controller = nextController;
    });
  }

  Future<void> _capture() async {
    if (_controller == null || !_controller!.value.isInitialized || _isCapturing) return;
    setState(() {
      _isCapturing = true;
    });
    try {
      final file = await _controller!.takePicture();
      if (!mounted) return;
      Navigator.of(context).pop(File(file.path));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Capture failed: $e')),
      );
      setState(() {
        _isCapturing = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: _buildBody(theme),
      ),
    );
  }

  Widget _buildBody(ThemeData theme) {
    if (_isInitializing) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Text(
            _error!,
            style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    if (_controller == null) {
      return const Center(child: Text('Camera unavailable', style: TextStyle(color: Colors.white)));
    }

    final title = _isSelfie ? 'Capture selfie' : 'Capture ID card';
    final subtitle = _isSelfie
        ? 'Center your face inside the oval'
        : 'Align the ID card inside the rectangle';

    return Stack(
      children: [
        Positioned.fill(child: CameraPreview(_controller!)),
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(
              painter: _CameraGuidePainter(captureType: widget.captureType),
            ),
          ),
        ),
        Positioned(
          top: 12,
          left: 12,
          right: 12,
          child: Row(
            children: [
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back, color: Colors.white),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                    Text(subtitle, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                  ],
                ),
              ),
              if (_cameras.length > 1)
                IconButton(
                  onPressed: _switchCamera,
                  icon: const Icon(Icons.flip_camera_ios, color: Colors.white),
                ),
            ],
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 28,
          child: Column(
            children: [
              FilledButton(
                onPressed: _isCapturing ? null : _capture,
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black87,
                  shape: const CircleBorder(),
                  padding: const EdgeInsets.all(20),
                ),
                child: const Icon(Icons.camera_alt),
              ),
              const SizedBox(height: 10),
              Text(
                _isCapturing ? 'Capturing...' : 'Tap to capture',
                style: const TextStyle(color: Colors.white70),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CameraGuidePainter extends CustomPainter {
  final VerificationCaptureType captureType;

  _CameraGuidePainter({required this.captureType});

  @override
  void paint(Canvas canvas, Size size) {
    final overlay = Paint()..color = Colors.black.withValues(alpha: 0.45);
    final clearPaint = Paint()..blendMode = BlendMode.clear;
    final borderPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;

    canvas.saveLayer(Offset.zero & size, Paint());
    canvas.drawRect(Offset.zero & size, overlay);

    if (captureType == VerificationCaptureType.idCard) {
      final cardWidth = size.width * 0.86;
      final cardHeight = cardWidth * 0.63;
      final rect = Rect.fromCenter(
        center: Offset(size.width / 2, size.height / 2),
        width: cardWidth,
        height: cardHeight,
      );
      final rrect = RRect.fromRectAndRadius(rect, const Radius.circular(18));
      canvas.drawRRect(rrect, clearPaint);
      canvas.drawRRect(rrect, borderPaint);
    } else {
      final ovalRect = Rect.fromCenter(
        center: Offset(size.width / 2, size.height / 2.15),
        width: size.width * 0.64,
        height: size.width * 0.82,
      );
      canvas.drawOval(ovalRect, clearPaint);
      canvas.drawOval(ovalRect, borderPaint);
    }

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _CameraGuidePainter oldDelegate) {
    return oldDelegate.captureType != captureType;
  }
}

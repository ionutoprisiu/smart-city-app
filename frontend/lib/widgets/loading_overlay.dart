import 'package:flutter/material.dart';
import '../config/app_constants.dart';

class LoadingOverlay extends StatelessWidget {
  final bool isLoading;
  final Widget child;
  final String? message;

  const LoadingOverlay({
    super.key,
    required this.isLoading,
    required this.child,
    this.message,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Stack(
      children: [
        child,
        if (isLoading)
          Positioned.fill(
            child: Material(
              color: cs.scrim.withValues(alpha: 0.35),
              child: Center(
                child: Material(
                  elevation: 0,
                  color: cs.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(AppConstants.radiusRound),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppConstants.paddingXLarge,
                      vertical: AppConstants.paddingLarge,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 36,
                          height: 36,
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            color: cs.primary,
                          ),
                        ),
                        if (message != null) ...[
                          const SizedBox(height: AppConstants.paddingMedium),
                          Text(
                            message!,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                  color: cs.onSurfaceVariant,
                                ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

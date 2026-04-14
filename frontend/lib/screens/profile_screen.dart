import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../config/app_constants.dart';
import '../models/verification_status.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final user = context.watch<AuthProvider>().currentUser;

    if (user == null) return const SizedBox.shrink();

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(
          horizontal: AppConstants.screenPadding,
          vertical: AppConstants.paddingSmall,
        ),
        child: Column(
          children: [
            const SizedBox(height: AppConstants.paddingMedium),
            Container(
              padding: const EdgeInsets.all(AppConstants.paddingLarge),
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(AppConstants.radiusRound),
                border: Border.all(
                  color: cs.outlineVariant.withValues(alpha: 0.35),
                ),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: cs.primary.withValues(alpha: 0.35),
                        width: 2,
                      ),
                    ),
                    child: CircleAvatar(
                      radius: 44,
                      backgroundColor: cs.primaryContainer,
                      child: Text(
                        '${user.firstName[0]}${user.lastName[0]}'.toUpperCase(),
                        style: theme.textTheme.headlineSmall?.copyWith(
                          color: cs.onPrimaryContainer,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppConstants.paddingMedium),
                  Text(
                    user.fullName,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.2,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    user.email,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: cs.onSurfaceVariant,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Chip(
                    avatar: Icon(
                      user.role?.name == 'admin'
                          ? Icons.admin_panel_settings_outlined
                          : Icons.person_outline_rounded,
                      size: 18,
                      color: cs.primary,
                    ),
                    label: Text(user.role?.toDisplayString() ?? 'User'),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppConstants.paddingLarge),

            _ProfileSection(
              title: 'Account',
              children: [
                _ProfileTile(
                  icon: Icons.person_outline_rounded,
                  title: 'Personal information',
                  subtitle: '${user.firstName} ${user.lastName}',
                  onTap: () {},
                ),
                _ProfileTile(
                  icon: Icons.verified_user_outlined,
                  title: 'Verification',
                  subtitle: _verificationText(user.verificationStatus),
                  trailing: Icon(
                    user.verificationStatus == VerificationStatus.approved
                        ? Icons.check_circle_rounded
                        : Icons.pending_actions_rounded,
                    color: user.verificationStatus == VerificationStatus.approved
                        ? cs.primary
                        : cs.tertiary,
                    size: 22,
                  ),
                  onTap: () => Navigator.of(context).pushNamed('/verification'),
                ),
              ],
            ),

            const SizedBox(height: AppConstants.paddingMedium),

            _ProfileSection(
              title: 'About',
              children: [
                _ProfileTile(
                  icon: Icons.info_outline_rounded,
                  title: 'App',
                  subtitle: 'Smart City · Cluj-Napoca · v1.0',
                  onTap: () {},
                ),
              ],
            ),

            const SizedBox(height: AppConstants.paddingXLarge),

            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      icon: Icon(Icons.logout_rounded, color: cs.error, size: 28),
                      title: const Text('Sign out?'),
                      content: Text(
                        'You’ll need to sign in again to access your profile.',
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: cs.onSurfaceVariant,
                          height: 1.4,
                        ),
                      ),
                      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancel'),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          style: FilledButton.styleFrom(
                            backgroundColor: cs.error,
                            foregroundColor: cs.onError,
                          ),
                          child: const Text('Sign out'),
                        ),
                      ],
                    ),
                  );
                  if (confirmed == true && context.mounted) {
                    await context.read<AuthProvider>().logout();
                    if (context.mounted) {
                      Navigator.of(context).pushReplacementNamed('/login');
                    }
                  }
                },
                icon: Icon(Icons.logout_rounded, color: cs.error),
                label: Text('Sign out', style: TextStyle(color: cs.error, fontWeight: FontWeight.w600)),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: cs.error.withValues(alpha: 0.45)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: AppConstants.paddingLarge),
          ],
        ),
      ),
    );
  }
}

class _ProfileSection extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _ProfileSection({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 6, bottom: 10),
          child: Text(
            title.toUpperCase(),
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
              color: cs.onSurfaceVariant,
            ),
          ),
        ),
        Material(
          color: cs.surfaceContainerHighest.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(AppConstants.radiusRound),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: _withDividers(children, cs),
          ),
        ),
      ],
    );
  }

  List<Widget> _withDividers(List<Widget> tiles, ColorScheme cs) {
    final out = <Widget>[];
    for (var i = 0; i < tiles.length; i++) {
      out.add(tiles[i]);
      if (i < tiles.length - 1) {
        out.add(Divider(height: 1, indent: 56, color: cs.outline.withValues(alpha: 0.12)));
      }
    }
    return out;
  }
}

class _ProfileTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback onTap;

  const _ProfileTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: cs.primaryContainer.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: cs.primary, size: 22),
      ),
      title: Text(
        title,
        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        subtitle,
        style: theme.textTheme.bodySmall?.copyWith(
          color: cs.onSurfaceVariant,
          height: 1.3,
        ),
      ),
      trailing: trailing ?? Icon(Icons.chevron_right_rounded, color: cs.outline, size: 22),
      onTap: onTap,
    );
  }
}

String _verificationText(VerificationStatus status) {
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

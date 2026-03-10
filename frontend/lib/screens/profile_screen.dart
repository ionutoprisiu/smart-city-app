import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../config/app_constants.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = context.watch<AuthProvider>().currentUser;

    if (user == null) return const SizedBox.shrink();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppConstants.paddingMedium),
      child: Column(
        children: [
          const SizedBox(height: AppConstants.paddingLarge),
          CircleAvatar(
            radius: 48,
            backgroundColor: theme.colorScheme.primaryContainer,
            child: Text(
              '${user.firstName[0]}${user.lastName[0]}'.toUpperCase(),
              style: theme.textTheme.headlineMedium?.copyWith(
                color: theme.colorScheme.onPrimaryContainer,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(height: AppConstants.paddingMedium),
          Text(
            user.fullName,
            style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            user.email,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Chip(
            avatar: Icon(
              user.role?.name == 'admin' ? Icons.admin_panel_settings : Icons.person,
              size: 18,
            ),
            label: Text(user.role?.toDisplayString() ?? 'User'),
          ),
          const SizedBox(height: AppConstants.paddingXLarge),

          _ProfileSection(
            title: 'Account',
            children: [
              _ProfileTile(
                icon: Icons.person_outline,
                title: 'Personal Information',
                subtitle: '${user.firstName} ${user.lastName}',
                onTap: () {},
              ),
              _ProfileTile(
                icon: Icons.verified_user_outlined,
                title: 'Identity Verification',
                subtitle: user.isVerified == true ? 'Verified' : 'Not verified',
                trailing: Icon(
                  user.isVerified == true ? Icons.check_circle : Icons.warning_amber,
                  color: user.isVerified == true
                      ? theme.colorScheme.primary
                      : theme.colorScheme.error,
                  size: 20,
                ),
                onTap: () {},
              ),
            ],
          ),

          const SizedBox(height: AppConstants.paddingMedium),

          _ProfileSection(
            title: 'App',
            children: [
              _ProfileTile(
                icon: Icons.info_outline,
                title: 'About',
                subtitle: 'Smart City Cluj-Napoca v1.0',
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
                    title: const Text('Logout'),
                    content: const Text('Are you sure you want to logout?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('Cancel'),
                      ),
                      FilledButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Logout'),
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
              icon: Icon(Icons.logout, color: theme.colorScheme.error),
              label: Text('Logout', style: TextStyle(color: theme.colorScheme.error)),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: theme.colorScheme.error.withValues(alpha: 0.5)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          const SizedBox(height: AppConstants.paddingLarge),
        ],
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        Card(
          margin: EdgeInsets.zero,
          child: Column(children: children),
        ),
      ],
    );
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
    return ListTile(
      leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: trailing ?? const Icon(Icons.chevron_right, size: 20),
      onTap: onTap,
    );
  }
}

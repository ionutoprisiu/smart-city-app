import 'package:flutter/material.dart';
import 'visit_city_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  static const _screens = [
    VisitCityScreen(),
    _ProfileWrapper(),
  ];

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined, color: cs.onSurfaceVariant),
            selectedIcon: Icon(Icons.explore_rounded, color: cs.primary),
            label: 'Visit City',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded, color: cs.onSurfaceVariant),
            selectedIcon: Icon(Icons.person_rounded, color: cs.primary),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

class _ProfileWrapper extends StatelessWidget {
  const _ProfileWrapper();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        automaticallyImplyLeading: false,
      ),
      body: const ProfileScreen(),
    );
  }
}

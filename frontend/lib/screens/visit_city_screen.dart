import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/attraction.dart';
import '../providers/visit_city_provider.dart';
import '../config/app_constants.dart';
import '../services/address_service.dart';
import '../widgets/error_message.dart';
import 'map_screen.dart';

enum _QuickFilter { all, selected, culture, foodAndDrink }

class VisitCityScreen extends StatefulWidget {
  const VisitCityScreen({super.key});

  @override
  State<VisitCityScreen> createState() => _VisitCityScreenState();
}

class _VisitCityScreenState extends State<VisitCityScreen> {
  final _searchController = TextEditingController();
  Timer? _searchDebounce;
  bool _showMap = false;
  _QuickFilter _quickFilter = _QuickFilter.all;
  static const int _pageSize = 30;
  int _visibleCount = _pageSize;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VisitCityProvider>().loadAttractions();
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_showMap ? 'Map' : 'Visit City'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: Icon(_showMap ? Icons.view_list_rounded : Icons.map_outlined),
            tooltip: _showMap ? 'List' : 'Map',
            onPressed: () => setState(() => _showMap = !_showMap),
          ),
        ],
      ),
      body: _showMap ? const MapScreen() : _buildListView(),
    );
  }

  Widget _buildListView() {
    return Consumer<VisitCityProvider>(
      builder: (context, provider, _) {
        final theme = Theme.of(context);
        final cs = theme.colorScheme;
        final filteredAttractions = _applyQuickFilter(provider);
        final visibleCount = filteredAttractions.length < _visibleCount
            ? filteredAttractions.length
            : _visibleCount;
        final visibleAttractions = filteredAttractions
            .take(visibleCount)
            .toList();

        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppConstants.screenPadding,
                  AppConstants.paddingMedium,
                  AppConstants.screenPadding,
                  AppConstants.paddingSmall,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Explore Cluj-Napoca',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${filteredAttractions.length} places to discover'
                      '${filteredAttractions.length != provider.attractions.length ? ' • filtered from ${provider.attractions.length}' : ''}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: cs.onSurfaceVariant,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: AppConstants.paddingLarge),
                    _buildSearchBar(context, provider),
                    const SizedBox(height: AppConstants.paddingMedium),
                    _buildCategoryChips(provider),
                    const SizedBox(height: AppConstants.paddingSmall),
                    _buildQuickFilterChips(provider),
                  ],
                ),
              ),
            ),
            if (provider.isLoading)
              const SliverFillRemaining(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  ),
                ),
              )
            else if (provider.errorMessage != null)
              SliverFillRemaining(
                child: ErrorMessage(
                  message: provider.errorMessage,
                  onRetry: provider.loadAttractions,
                ),
              )
            else if (filteredAttractions.isEmpty)
              SliverFillRemaining(
                child: _EmptyState(
                  icon: Icons.travel_explore_outlined,
                  title: 'Nothing here yet',
                  subtitle:
                      'Try another search, change category, or clear filters.',
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(
                  AppConstants.screenPadding,
                  0,
                  AppConstants.screenPadding,
                  AppConstants.paddingXLarge,
                ),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _AttractionCard(
                        attraction: visibleAttractions[index],
                        isSelected: provider.isSelected(
                          visibleAttractions[index].id,
                        ),
                        onToggleSelection: () => provider.toggleSelection(
                          visibleAttractions[index].id,
                        ),
                      ),
                    ),
                    childCount: visibleAttractions.length,
                  ),
                ),
              ),
            if (filteredAttractions.length > visibleCount)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppConstants.screenPadding,
                    4,
                    AppConstants.screenPadding,
                    AppConstants.paddingXLarge,
                  ),
                  child: OutlinedButton.icon(
                    onPressed: () {
                      setState(() {
                        _visibleCount += _pageSize;
                      });
                    },
                    icon: const Icon(Icons.expand_more_rounded),
                    label: Text(
                      'Show more (${filteredAttractions.length - visibleCount} left)',
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildSearchBar(BuildContext context, VisitCityProvider provider) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: cs.surfaceContainerLow.withValues(alpha: 0.9),
      borderRadius: BorderRadius.circular(AppConstants.borderRadiusXLarge),
      child: TextField(
        controller: _searchController,
        onChanged: (value) => _onSearchChanged(provider, value),
        onSubmitted: (value) =>
            _onSearchChanged(provider, value, immediate: true),
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Search museums, parks…',
          prefixIcon: Icon(
            Icons.search_rounded,
            color: cs.primary.withValues(alpha: 0.85),
          ),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: Icon(Icons.close_rounded, color: cs.onSurfaceVariant),
                  onPressed: () {
                    _searchController.clear();
                    provider.clearFilters();
                    _quickFilter = _QuickFilter.all;
                    _visibleCount = _pageSize;
                    setState(() {});
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 8,
            vertical: 14,
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryChips(VisitCityProvider provider) {
    final categories = [
      AttractionCategory.museum,
      AttractionCategory.church,
      AttractionCategory.park,
      AttractionCategory.monument,
      AttractionCategory.restaurant,
      AttractionCategory.theater,
    ];

    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final cat = categories[index];
          final isSelected = provider.selectedCategory == cat;
          return FilterChip(
            label: Text('${cat.icon}  ${cat.label}'),
            selected: isSelected,
            showCheckmark: false,
            onSelected: (_) {
              provider.filterByCategory(isSelected ? null : cat);
              _visibleCount = _pageSize;
            },
          );
        },
      ),
    );
  }

  Widget _buildQuickFilterChips(VisitCityProvider provider) {
    final items = <(_QuickFilter, String)>[
      (_QuickFilter.all, 'All'),
      (_QuickFilter.selected, 'Selected (${provider.selectedCount})'),
      (_QuickFilter.culture, 'Culture'),
      (_QuickFilter.foodAndDrink, 'Food'),
    ];

    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: items.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final item = items[index];
          final selected = _quickFilter == item.$1;
          return ChoiceChip(
            label: Text(item.$2),
            selected: selected,
            showCheckmark: false,
            onSelected: (_) {
              setState(() {
                _quickFilter = item.$1;
                _visibleCount = _pageSize;
              });
            },
          );
        },
      ),
    );
  }

  List<Attraction> _applyQuickFilter(VisitCityProvider provider) {
    final source = List<Attraction>.from(provider.attractions);
    final selectedIds = provider.selectedIds;

    bool matchesQuickFilter(Attraction a) {
      switch (_quickFilter) {
        case _QuickFilter.all:
          return true;
        case _QuickFilter.selected:
          return selectedIds.contains(a.id);
        case _QuickFilter.culture:
          return a.category == AttractionCategory.museum ||
              a.category == AttractionCategory.church ||
              a.category == AttractionCategory.monument ||
              a.category == AttractionCategory.theater ||
              a.category == AttractionCategory.library ||
              a.category == AttractionCategory.square;
        case _QuickFilter.foodAndDrink:
          return a.category == AttractionCategory.restaurant ||
              a.category == AttractionCategory.cafe;
      }
    }

    final filtered = source.where(matchesQuickFilter).toList();
    filtered.sort((a, b) {
      final aSelected = selectedIds.contains(a.id);
      final bSelected = selectedIds.contains(b.id);
      if (aSelected != bSelected) return aSelected ? -1 : 1;
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });
    return filtered;
  }

  void _onSearchChanged(
    VisitCityProvider provider,
    String value, {
    bool immediate = false,
  }) {
    _searchDebounce?.cancel();
    if (immediate) {
      provider.search(value.trim());
      setState(() {
        _visibleCount = _pageSize;
      });
      return;
    }
    setState(() {});
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      provider.search(value.trim());
      if (mounted) {
        setState(() {
          _visibleCount = _pageSize;
        });
      }
    });
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppConstants.paddingXLarge),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: AppConstants.paddingLarge),
            Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: cs.onSurfaceVariant,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _AttractionCard extends StatelessWidget {
  final Attraction attraction;
  final bool isSelected;
  final VoidCallback onToggleSelection;

  const _AttractionCard({
    required this.attraction,
    required this.isSelected,
    required this.onToggleSelection,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Material(
      color: isSelected
          ? cs.primaryContainer.withValues(alpha: 0.55)
          : cs.surfaceContainerHighest.withValues(alpha: 0.55),
      borderRadius: BorderRadius.circular(AppConstants.radiusRound),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _showDetails(context),
        child: Padding(
          padding: const EdgeInsets.all(AppConstants.paddingMedium),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: cs.primaryContainer.withValues(alpha: 0.65),
                  borderRadius: BorderRadius.circular(
                    AppConstants.borderRadiusLarge,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  attraction.category.icon,
                  style: const TextStyle(fontSize: 26),
                ),
              ),
              const SizedBox(width: AppConstants.paddingMedium),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      attraction.name,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 4),
                    FutureBuilder<String>(
                      future: AddressService.streetFromCoordinates(
                        latitude: attraction.latitude,
                        longitude: attraction.longitude,
                      ),
                      builder: (context, snapshot) {
                        final street = snapshot.data ?? 'Loading street...';
                        return Text(
                          street,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: cs.onSurfaceVariant,
                            height: 1.35,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                onPressed: onToggleSelection,
                style: IconButton.styleFrom(
                  backgroundColor: isSelected
                      ? cs.primary
                      : cs.surfaceContainerLow,
                  foregroundColor: isSelected
                      ? cs.onPrimary
                      : cs.onSurfaceVariant,
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.all(8),
                ),
                icon: Icon(
                  isSelected ? Icons.check_rounded : Icons.add_rounded,
                  size: 18,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetails(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.48,
        minChildSize: 0.32,
        maxChildSize: 0.88,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.fromLTRB(
              AppConstants.screenPadding,
              8,
              AppConstants.screenPadding,
              AppConstants.paddingXLarge,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: cs.primaryContainer.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(
                          AppConstants.borderRadiusLarge,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        attraction.category.icon,
                        style: const TextStyle(fontSize: 28),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        attraction.name,
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Chip(
                  label: Text(attraction.category.label),
                  avatar: Icon(
                    Icons.category_outlined,
                    size: 18,
                    color: cs.primary,
                  ),
                ),
                const SizedBox(height: AppConstants.paddingMedium),
                Text(
                  attraction.description,
                  style: theme.textTheme.bodyLarge?.copyWith(height: 1.45),
                ),
                const SizedBox(height: AppConstants.paddingLarge),
                Wrap(
                  spacing: 16,
                  runSpacing: 12,
                  children: [
                    FutureBuilder<String>(
                      future: AddressService.streetFromCoordinates(
                        latitude: attraction.latitude,
                        longitude: attraction.longitude,
                      ),
                      builder: (context, snapshot) {
                        final street = snapshot.data ?? 'Loading street...';
                        return _detailItem(
                          context,
                          Icons.signpost_outlined,
                          street,
                        );
                      },
                    ),
                    _detailItem(
                      context,
                      Icons.location_on_outlined,
                      '${attraction.latitude.toStringAsFixed(4)}, ${attraction.longitude.toStringAsFixed(4)}',
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _detailItem(BuildContext context, IconData icon, String text) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 20, color: cs.primary),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            text,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.35),
          ),
        ),
      ],
    );
  }
}

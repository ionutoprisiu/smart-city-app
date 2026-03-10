import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/attraction.dart';
import '../providers/visit_city_provider.dart';
import '../config/app_constants.dart';
import '../widgets/error_message.dart';
import 'map_screen.dart';

class VisitCityScreen extends StatefulWidget {
  const VisitCityScreen({super.key});

  @override
  State<VisitCityScreen> createState() => _VisitCityScreenState();
}

class _VisitCityScreenState extends State<VisitCityScreen> {
  final _searchController = TextEditingController();
  bool _showMap = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VisitCityProvider>().loadAttractions();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_showMap ? 'Map' : 'Visit City'),
        actions: [
          IconButton(
            icon: Icon(_showMap ? Icons.list : Icons.map),
            tooltip: _showMap ? 'Show list' : 'Show map',
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
        return CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(AppConstants.paddingMedium),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Explore Cluj-Napoca',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${provider.attractions.length} attractions',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: AppConstants.paddingMedium),
                    _buildSearchBar(provider),
                    const SizedBox(height: AppConstants.paddingSmall),
                    _buildCategoryChips(provider),
                  ],
                ),
              ),
            ),
            if (provider.isLoading)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              )
            else if (provider.errorMessage != null)
              SliverFillRemaining(
                child: ErrorMessage(
                  message: provider.errorMessage,
                  onRetry: provider.loadAttractions,
                ),
              )
            else if (provider.attractions.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.search_off, size: 64,
                          color: Theme.of(context).colorScheme.onSurfaceVariant),
                      const SizedBox(height: 12),
                      Text('No attractions found',
                          style: Theme.of(context).textTheme.bodyLarge),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppConstants.paddingMedium,
                ),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _AttractionCard(
                      attraction: provider.attractions[index],
                    ),
                    childCount: provider.attractions.length,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildSearchBar(VisitCityProvider provider) {
    return TextField(
      controller: _searchController,
      onSubmitted: (value) => provider.search(value),
      decoration: InputDecoration(
        hintText: 'Search attractions...',
        prefixIcon: const Icon(Icons.search),
        suffixIcon: _searchController.text.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () {
                  _searchController.clear();
                  provider.clearFilters();
                },
              )
            : null,
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
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final cat = categories[index];
          final isSelected = provider.selectedCategory == cat;
          return FilterChip(
            label: Text('${cat.icon} ${cat.label}'),
            selected: isSelected,
            onSelected: (_) {
              provider.filterByCategory(isSelected ? null : cat);
            },
          );
        },
      ),
    );
  }
}

class _AttractionCard extends StatelessWidget {
  final Attraction attraction;

  const _AttractionCard({required this.attraction});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: AppConstants.paddingSmall),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppConstants.borderRadiusLarge),
        onTap: () => _showDetails(context),
        child: Padding(
          padding: const EdgeInsets.all(AppConstants.paddingMedium),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: theme.colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(AppConstants.borderRadiusMedium),
                ),
                alignment: Alignment.center,
                child: Text(
                  attraction.category.icon,
                  style: const TextStyle(fontSize: 24),
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
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      attraction.description,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                children: [
                  Icon(Icons.schedule, size: 16,
                      color: theme.colorScheme.onSurfaceVariant),
                  const SizedBox(height: 2),
                  Text(
                    '${attraction.estimatedVisitTime}m',
                    style: theme.textTheme.labelSmall,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDetails(BuildContext context) {
    final theme = Theme.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.45,
        minChildSize: 0.3,
        maxChildSize: 0.7,
        expand: false,
        builder: (context, scrollController) {
          return SingleChildScrollView(
            controller: scrollController,
            padding: const EdgeInsets.all(AppConstants.paddingLarge),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40, height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Text(attraction.category.icon, style: const TextStyle(fontSize: 32)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        attraction.name,
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Chip(label: Text(attraction.category.label)),
                const SizedBox(height: AppConstants.paddingMedium),
                Text(
                  attraction.description,
                  style: theme.textTheme.bodyLarge,
                ),
                const SizedBox(height: AppConstants.paddingLarge),
                Row(
                  children: [
                    _detailItem(context, Icons.schedule,
                        '${attraction.estimatedVisitTime} min'),
                    const SizedBox(width: 24),
                    _detailItem(context, Icons.location_on,
                        '${attraction.latitude.toStringAsFixed(4)}, ${attraction.longitude.toStringAsFixed(4)}'),
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
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 6),
        Text(text, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

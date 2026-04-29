import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { useTheme } from '../../../theme';
import { AttractionCard } from '../components/AttractionCard';
import { AttractionDetailsSheet } from '../components/AttractionDetailsSheet';
import { EmptyState } from '../components/EmptyState';
import { useVisitCityStore } from '../store/visitCityStore';
import {
  Attraction,
  AttractionCategory,
  categoryIcon,
  categoryLabel,
} from '../types';
import { MapScreen } from './MapScreen';

type QuickFilter = 'all' | 'selected' | 'culture' | 'foodAndDrink';

const PAGE_SIZE = 30;

const CATEGORY_CHIPS: AttractionCategory[] = [
  'museum',
  'church',
  'park',
  'monument',
  'restaurant',
  'theater',
];

const listSeparator10 = () => <View style={styles.separator10} />;
const listSeparator8 = () => <View style={styles.separator8} />;

const matchesQuickFilter = (
  attraction: Attraction,
  filter: QuickFilter,
  selectedIds: number[],
) => {
  switch (filter) {
    case 'all':
      return true;
    case 'selected':
      return selectedIds.includes(attraction.id);
    case 'culture':
      return (
        attraction.category === 'museum' ||
        attraction.category === 'church' ||
        attraction.category === 'monument' ||
        attraction.category === 'theater' ||
        attraction.category === 'library' ||
        attraction.category === 'square'
      );
    case 'foodAndDrink':
      return attraction.category === 'restaurant' || attraction.category === 'cafe';
  }
};

export const VisitCityScreen: React.FC = () => {
  const theme = useTheme();
  const {
    attractions,
    isLoading,
    errorMessage,
    selectedCategory,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    loadAttractions,
    filterByCategory,
    search,
    clearFilters,
  } = useVisitCityStore();

  const [showMap, setShowMap] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [details, setDetails] = useState<Attraction | null>(null);
  const themedStyles = {
    headerWrap: { paddingHorizontal: theme.spacing.screen },
    headerTop: { marginTop: theme.spacing.medium },
    headerTitle: { color: theme.colors.onSurface },
    headerSubtitle: { color: theme.colors.onSurfaceVariant, marginTop: 6, lineHeight: 18 },
    spacerLarge: { height: theme.spacing.large },
    spacerMedium: { height: theme.spacing.medium },
    searchBar: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderRadius: theme.radius.xLarge,
    },
    searchIcon: { marginHorizontal: 12 },
    searchInput: { flex: 1, color: theme.colors.onSurface, paddingVertical: 12 },
    searchClear: { padding: 8 },
    chipText: { color: theme.colors.onSurface },
    itemWrap: { marginBottom: 10, paddingHorizontal: theme.spacing.screen },
    footerWrap: { paddingHorizontal: theme.spacing.screen, paddingVertical: theme.spacing.large },
    showMoreText: { color: theme.colors.primary, marginLeft: 8 },
    appBarTitle: { color: theme.colors.onSurface },
    appBarLeftSpacer: { width: 48 },
    listContent: { paddingBottom: theme.spacing.xLarge },
  };

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadAttractions();
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAttractions = useMemo(() => {
    const next = attractions.filter((a) => matchesQuickFilter(a, quickFilter, selectedIds));
    return next.sort((a, b) => {
      const aSel = selectedIds.includes(a.id);
      const bSel = selectedIds.includes(b.id);
      if (aSel !== bSel) return aSel ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [attractions, quickFilter, selectedIds]);

  const visibleAttractions = filteredAttractions.slice(0, visibleCount);

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      search(value.trim());
      setVisibleCount(PAGE_SIZE);
    }, 350);
  };

  const onSearchSubmit = () => {
    if (debounce.current) clearTimeout(debounce.current);
    search(searchInput.trim());
    setVisibleCount(PAGE_SIZE);
  };

  const onSearchClear = () => {
    setSearchInput('');
    if (debounce.current) clearTimeout(debounce.current);
    clearFilters();
    setQuickFilter('all');
    setVisibleCount(PAGE_SIZE);
  };

  const renderHeader = () => (
    <View style={[styles.headerWrap, themedStyles.headerWrap]}>
      <View style={themedStyles.headerTop}>
        <Text style={[theme.typography.headlineSmall, themedStyles.headerTitle]}>
          Explore Cluj-Napoca
        </Text>
        <Text
          style={[
            theme.typography.bodyMedium,
            themedStyles.headerSubtitle,
          ]}
        >
          {filteredAttractions.length} places to discover
          {filteredAttractions.length !== attractions.length
            ? ` • filtered from ${attractions.length}`
            : ''}
        </Text>
      </View>

      <View style={themedStyles.spacerLarge} />
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: theme.colors.surfaceContainerLow,
            borderRadius: theme.radius.xLarge,
          }, themedStyles.searchBar,
        ]}
      >
        <Icon
          name="search"
          size={22}
          color={theme.colors.primary}
          style={themedStyles.searchIcon}
        />
        <TextInput
          value={searchInput}
          onChangeText={onSearchChange}
          onSubmitEditing={onSearchSubmit}
          placeholder="Search museums, parks…"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          returnKeyType="search"
          style={[
            theme.typography.bodyLarge,
            themedStyles.searchInput,
          ]}
        />
        {searchInput.length > 0 ? (
          <Pressable onPress={onSearchClear} hitSlop={8} style={themedStyles.searchClear}>
            <Icon name="close" size={20} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        ) : null}
      </View>

      <View style={themedStyles.spacerMedium} />
      <FlatList
        horizontal
        data={CATEGORY_CHIPS}
        keyExtractor={(c) => c}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = selectedCategory === item;
          return (
            <Pressable
              onPress={() => {
                filterByCategory(active ? null : item);
                setVisibleCount(PAGE_SIZE);
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceContainerLow,
                  borderColor: theme.colors.outlineVariant,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[theme.typography.labelLarge, themedStyles.chipText]}>
                {categoryIcon(item)}  {categoryLabel(item)}
              </Text>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={listSeparator10}
      />

      <View style={{ height: theme.spacing.small }} />
      <FlatList
        horizontal
        data={
          [
            { id: 'all', label: 'All' },
            { id: 'selected', label: `Selected (${selectedCount()})` },
            { id: 'culture', label: 'Culture' },
            { id: 'foodAndDrink', label: 'Food' },
          ] as { id: QuickFilter; label: string }[]
        }
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = quickFilter === item.id;
          return (
            <Pressable
              onPress={() => {
                setQuickFilter(item.id);
                setVisibleCount(PAGE_SIZE);
              }}
              style={({ pressed }) => [
                styles.chipSmall,
                {
                  backgroundColor: active
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceContainerLow,
                  borderColor: theme.colors.outlineVariant,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[theme.typography.labelMedium, themedStyles.chipText]}>
                {item.label}
              </Text>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={listSeparator8}
      />
      <View style={themedStyles.spacerMedium} />
    </View>
  );

  const renderItem: ListRenderItem<Attraction> = ({ item }) => (
    <View style={themedStyles.itemWrap}>
      <AttractionCard
        attraction={item}
        isSelected={isSelected(item.id)}
        onToggleSelection={() => toggleSelection(item.id)}
        onPress={() => setDetails(item)}
      />
    </View>
  );

  const renderFooter = () => {
    if (filteredAttractions.length <= visibleCount) return null;
    return (
      <View style={themedStyles.footerWrap}>
        <Pressable
          onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
          style={({ pressed }) => [
            styles.showMore,
            {
              borderColor: theme.colors.outlineVariant,
              borderRadius: theme.radius.large,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon name="expand-more" size={20} color={theme.colors.primary} />
          <Text
            style={[
              theme.typography.labelLarge,
              themedStyles.showMoreText,
            ]}
          >
            Show more ({filteredAttractions.length - visibleCount} left)
          </Text>
        </Pressable>
      </View>
    );
  };

  const renderEmptyOrLoading = () => {
    if (isLoading) {
      return (
        <View style={styles.centeredFill}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }
    if (errorMessage) {
      return (
        <View style={styles.centeredFill}>
          <ErrorMessage message={errorMessage} onRetry={loadAttractions} />
        </View>
      );
    }
    return (
      <View style={styles.centeredFill}>
        <EmptyState
          iconName="travel-explore"
          title="Nothing here yet"
          subtitle="Try another search, change category, or clear filters."
        />
      </View>
    );
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.root, { backgroundColor: theme.colors.surface }]}
    >
      <View
        style={[
          styles.appBar,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.outlineVariant + '40',
          },
        ]}
      >
        <View style={themedStyles.appBarLeftSpacer} />
        <Text style={[theme.typography.titleMedium, themedStyles.appBarTitle]}>
          {showMap ? 'Map' : 'Visit City'}
        </Text>
        <Pressable
          onPress={() => setShowMap((v) => !v)}
          hitSlop={8}
          style={({ pressed }) => [styles.appBarAction, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon
            name={showMap ? 'view-list' : 'map'}
            size={24}
            color={theme.colors.onSurface}
          />
        </Pressable>
      </View>

      {showMap ? (
        <MapScreen />
      ) : (
        <FlatList
          data={visibleAttractions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmptyOrLoading}
          contentContainerStyle={themedStyles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <AttractionDetailsSheet
        attraction={details}
        isSelected={details ? isSelected(details.id) : false}
        onToggleSelection={() => details && toggleSelection(details.id)}
        onClose={() => setDetails(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  appBar: {
    height: 56,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  appBarAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrap: {
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  separator10: {
    width: 10,
  },
  separator8: {
    width: 8,
  },
  showMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  centeredFill: {
    flex: 1,
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

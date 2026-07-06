import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@shared/components/EmptyState';
import { ErrorMessage } from '@shared/components/ErrorMessage';
import { Icon } from '@shared/components/Icon';
import { Spinner } from '@shared/components/Spinner';
import { AttractionCard } from '../components/AttractionCard';
import { AttractionDetailsSheet } from '../components/AttractionDetailsSheet';
import { SelectionDock } from '../components/SelectionDock';
import { useVisitCityStore } from '../store/visitCityStore';
import {
  ATTRACTION_CATEGORIES,
  Attraction,
  AttractionCategory,
  categoryIcon,
  categoryLabel,
} from '../types';
import { MapScreen } from './MapScreen';

type QuickFilter = 'all' | 'selected';

const LIST_BATCH = 24;

const HIDDEN_CATEGORY_CHIPS = new Set<AttractionCategory>([
  'other',
  'hotel',
  'square',
  'fortress',
  'shop',
]);

const CATEGORY_CHIPS: AttractionCategory[] = ATTRACTION_CATEGORIES.filter(
  (c) => !HIDDEN_CATEGORY_CHIPS.has(c),
);

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
  }
};

export const VisitCityPage: React.FC = () => {
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
    routeResult,
    routeStarted,
    isOptimizing,
    routingProfile,
    canOptimize,
    setRoutingProfile,
    optimizeRoute,
    clearSelection,
    clearRoute,
  } = useVisitCityStore();

  const [showMap, setShowMap] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [listBatch, setListBatch] = useState(LIST_BATCH);
  const [details, setDetails] = useState<Attraction | null>(null);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadAttractions();
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [loadAttractions]);

  // Arriving with a route already computed (e.g. a tour was just opened):
  // jump straight to the map — that is where the route lives.
  useEffect(() => {
    if (useVisitCityStore.getState().routeResult != null) {
      setShowMap(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAttractions = useMemo(() => {
    const next = attractions.filter((a) => matchesQuickFilter(a, quickFilter, selectedIds));
    return next.sort((a, b) => {
      const aSel = selectedIds.includes(a.id);
      const bSel = selectedIds.includes(b.id);
      if (aSel !== bSel) return aSel ? -1 : 1;
      if (b.importanceScore !== a.importanceScore) {
        return b.importanceScore - a.importanceScore;
      }
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }, [attractions, quickFilter, selectedIds]);

  const visibleAttractions = filteredAttractions.slice(0, listBatch);
  const hasMore = listBatch < filteredAttractions.length;

  const onListScroll = () => {
    const el = listRef.current;
    if (el == null || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) {
      setListBatch((c) => Math.min(c + LIST_BATCH, filteredAttractions.length));
    }
  };

  const onSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      search(value.trim());
      setListBatch(LIST_BATCH);
    }, 350);
  };

  const onSearchSubmit = () => {
    if (debounce.current) clearTimeout(debounce.current);
    search(searchInput.trim());
    setListBatch(LIST_BATCH);
  };

  const onSearchClear = () => {
    setSearchInput('');
    if (debounce.current) clearTimeout(debounce.current);
    clearFilters();
    setQuickFilter('all');
    setListBatch(LIST_BATCH);
  };

  const onOptimizeFromList = async () => {
    await optimizeRoute();
    if (useVisitCityStore.getState().routeResult != null) {
      setShowMap(true);
    }
  };

  const hasActiveFilters =
    searchInput.length > 0 || selectedCategory != null || quickFilter !== 'all';

  const renderEmptyOrLoading = () => {
    if (isLoading) {
      return (
        <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner size="large" />
        </div>
      );
    }
    if (errorMessage) {
      return (
        <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ErrorMessage message={errorMessage} onRetry={loadAttractions} />
        </div>
      );
    }
    return (
      <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState
          iconName="travel-explore"
          title="Nimic aici încă"
          subtitle="Încearcă altă căutare, schimbă categoria sau șterge filtrele."
        />
      </div>
    );
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div
        style={{
          height: 56,
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: showMap
            ? '1px solid color-mix(in srgb, var(--outline-variant) 25%, transparent)'
            : 'none',
          background: showMap ? 'var(--surface)' : 'transparent',
          flexShrink: 0,
          position: showMap ? 'relative' : 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
        }}
      >
        <div style={{ width: 48 }} />
        <div className="title-medium">{showMap ? 'Hartă' : ''}</div>
        {showMap ? (
          <button
            type="button"
            className="icon-button"
            onClick={() => setShowMap(false)}
            title="Înapoi la listă"
          >
            <Icon name="view-list" size={22} color="var(--primary)" />
          </button>
        ) : (
          <button
            type="button"
            className="map-toggle-pill"
            onClick={() => setShowMap(true)}
            style={{ marginTop: 12, marginRight: 10 }}
          >
            <Icon name="map" size={17} color="var(--primary)" />
            Hartă
          </button>
        )}
      </div>

      {showMap ? (
        <MapScreen />
      ) : (
        <>
          <div
            ref={listRef}
            onScroll={onListScroll}
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 120 }}
          >
            <div className="vc-hero">
              <div style={{ maxWidth: 760, margin: '0 auto' }}>
                <span className="vc-eyebrow">
                  <Icon name="location-on" size={13} />
                  Cluj-Napoca · Romania
                </span>
                <div className="headline-large" style={{ marginTop: 8 }}>
                  Explorează orașul
                </div>
                <div
                  className="body-medium"
                  style={{ color: 'var(--on-surface-variant)', marginTop: 6, lineHeight: '22px' }}
                >
                  {filteredAttractions.length} locuri
                  {attractions.length > 0 && filteredAttractions.length !== attractions.length
                    ? ` din ${attractions.length}`
                    : ''}{' '}
                  — alege opririle, apoi optimizează traseul.
                </div>

                <form
                  className="vc-search"
                  style={{ marginTop: 16 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSearchSubmit();
                  }}
                >
                  <span
                    style={{
                      width: 42,
                      height: 42,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="search" size={21} color="var(--primary)" />
                  </span>
                  <input
                    value={searchInput}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Caută muzee, parcuri, cafenele…"
                  />
                  {searchInput.length > 0 ? (
                    <button type="button" className="icon-button" onClick={onSearchClear} style={{ width: 38, height: 38 }}>
                      <Icon name="close" size={19} color="var(--on-surface-variant)" />
                    </button>
                  ) : null}
                </form>

                <div className="vc-filters">
                  <div className="vc-filters-head">
                    <span className="vc-filters-label" style={{ marginBottom: 0 }}>
                      Filtre
                    </span>
                    {hasActiveFilters ? (
                      <button type="button" className="vc-clear-filters" onClick={onSearchClear}>
                        <Icon name="filter-alt-off" size={14} />
                        Șterge
                      </button>
                    ) : null}
                  </div>
                  <div className="chip-row">
                    {(
                      [
                        { id: 'all', label: 'Toate', icon: 'apps' },
                        {
                          id: 'selected',
                          label: `Selectate (${selectedCount()})`,
                          icon: 'check-circle-outline',
                        },
                      ] as { id: QuickFilter; label: string; icon: string }[]
                    ).map((item) => {
                      const active = quickFilter === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`filter-chip${active ? ' active' : ''}`}
                          onClick={() => {
                            setQuickFilter(item.id);
                            setListBatch(LIST_BATCH);
                          }}
                        >
                          <Icon name={item.icon} size={15} />
                          {item.label}
                        </button>
                      );
                    })}
                    <span className="vc-chip-divider" aria-hidden />
                    {CATEGORY_CHIPS.map((item) => {
                      const active = selectedCategory === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          className={`filter-chip${active ? ' active' : ''}`}
                          onClick={() => {
                            filterByCategory(active ? null : item);
                            setListBatch(LIST_BATCH);
                          }}
                        >
                          <span style={{ fontSize: 15 }}>{categoryIcon(item)}</span>
                          {categoryLabel(item)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {visibleAttractions.length === 0 ? (
              renderEmptyOrLoading()
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: '12px 16px 0',
                  maxWidth: 760,
                  margin: '0 auto',
                  width: '100%',
                }}
              >
                {visibleAttractions.map((item, index) => (
                  <div
                    key={item.id}
                    className="rise-in"
                    style={{ animationDelay: `${Math.min(index, 12) * 0.025}s` }}
                  >
                    <AttractionCard
                      attraction={item}
                      isSelected={isSelected(item.id)}
                      onToggleSelection={() => toggleSelection(item.id)}
                      onPress={() => setDetails(item)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              pointerEvents: 'none',
              maxWidth: 680,
              margin: '0 auto',
            }}
          >
            <div style={{ pointerEvents: 'auto', display: 'contents' }}>
              {/* In list mode a computed route is summarized in ONE compact
                  pill — the full glass card + start bar live on the map,
                  where they do not cover the attraction list. */}
              {routeResult != null && !routeStarted ? (
                <div className="route-pill rise-in" style={{ pointerEvents: 'auto' }}>
                  <div className="rp-stats">
                    <span className="rp-title">
                      <Icon name="auto-awesome" size={13} />
                      Traseu optimizat
                    </span>
                    <span className="rp-meta">
                      {routeResult.totalDistance.toFixed(1)} km
                      <span className="sep">·</span>
                      {Math.floor(routeResult.totalTime / 60) > 0
                        ? `${Math.floor(routeResult.totalTime / 60)}h ${routeResult.totalTime % 60}m`
                        : `${routeResult.totalTime}m`}
                      {routeResult.timeBudgetMinutes != null ? (
                        <>
                          <span className="sep">·</span>
                          {routeResult.steps.length - 1} obiective în buget
                        </>
                      ) : null}
                    </span>
                  </div>
                  <button type="button" className="rp-modify" onClick={clearRoute}>
                    Modifică
                  </button>
                  <button type="button" className="rp-map" onClick={() => setShowMap(true)}>
                    <Icon name="map" size={16} color="var(--on-primary)" />
                    Vezi pe hartă
                  </button>
                </div>
              ) : null}

              {!routeStarted && routeResult == null && selectedCount() > 0 ? (
                <div style={{ pointerEvents: 'auto' }}>
                  <SelectionDock
                    count={selectedCount()}
                    profile={routingProfile}
                    isOptimizing={isOptimizing}
                    canOptimize={canOptimize()}
                    onProfileChanged={(p) => setRoutingProfile(p)}
                    onOptimize={canOptimize() ? onOptimizeFromList : undefined}
                    onClear={clearSelection}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      <AttractionDetailsSheet
        attraction={details}
        isSelected={details ? isSelected(details.id) : false}
        onToggleSelection={() => details && toggleSelection(details.id)}
        onClose={() => setDetails(null)}
      />
    </div>
  );
};

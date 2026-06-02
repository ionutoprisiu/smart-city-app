import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ActivitiesStackParamList } from '@app/navigation/types';
import { extractErrorMessage } from '@shared/api/errors';
import { ErrorMessage } from '@shared/components/ErrorMessage';
import { StorageService } from '@shared/storage/storageService';
import { useTheme } from '@theme';
import { useAuthStore } from '@features/auth/store/authStore';
import { ActivitiesApi } from '../api/activitiesApi';
import { ActivityListingCard } from '../components/ActivityListingCard';
import type { ActivitiesCardThemed } from '../activitiesCardThemed';
import { ACTIVITIES_CITY } from '../constants';
import type { ActivityEvent, ActivityListFilter, Club } from '../types';
import { buildActivityListings, filterActivityListings } from '../utils/buildActivityListings';

type Nav = NativeStackNavigationProp<ActivitiesStackParamList, 'ActivitiesHome'>;

const FILTERS: { id: ActivityListFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'event', label: 'Events' },
  { id: 'group', label: 'Groups' },
  { id: 'mine', label: 'Mine' },
];

export const ActivitiesHomeScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentUserId = currentUser?.id;
  const refreshVerificationStatus = useAuthStore((s) => s.refreshVerificationStatus);
  const setCurrentUser = useAuthStore.setState;
  const [filter, setFilter] = useState<ActivityListFilter>('all');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedScope, setLoadedScope] = useState<'mine' | 'public' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isFocused = useIsFocused();

  const fetchScope: 'mine' | 'public' =
    filter === 'mine' && currentUserId != null ? 'mine' : 'public';

  const isOrganizer = currentUser?.role === 'organizer' || currentUser?.role === 'admin';
  const canBecomeOrganizer = !isOrganizer && currentUser?.isVerified === true;

  const listings = useMemo(
    () => filterActivityListings(buildActivityListings(events, clubs), filter, currentUserId),
    [events, clubs, filter, currentUserId],
  );

  const showListLoader = isLoading && loadedScope !== fetchScope;
  const showEmptyState = loadedScope === fetchScope && listings.length === 0;

  const setActionError = useCallback((error: unknown, fallback: string) => {
    const message = extractErrorMessage(error);
    setErrorMessage(message || fallback);
  }, []);

  const themedStyles = useMemo(
    () => ({
      rootBg: { backgroundColor: theme.colors.surface },
      segmentWrap: { backgroundColor: theme.colors.surfaceContainerLow },
      segmentActive: { backgroundColor: theme.colors.primaryContainer },
      segmentInactive: { backgroundColor: 'transparent' },
      segmentTextActive: { color: theme.colors.onPrimaryContainer },
      segmentTextInactive: { color: theme.colors.onSurfaceVariant },
      cardBg: {
        backgroundColor: theme.colors.surfaceContainerHighest + '8C',
        borderRadius: theme.radius.round,
        borderColor: theme.colors.outlineVariant + '4D',
      },
      cardTitle: { color: theme.colors.onSurface },
      cardSub: { color: theme.colors.onSurfaceVariant },
      title: { color: theme.colors.onSurface },
      subtitle: { color: theme.colors.onSurfaceVariant },
      ctaBg: { backgroundColor: theme.colors.primary },
      ctaText: { color: theme.colors.onPrimary },
      ctaDisabledBg: { backgroundColor: theme.colors.surfaceContainerHigh },
      ctaDisabledText: { color: theme.colors.onSurfaceVariant },
      tagBg: { backgroundColor: theme.colors.primaryContainer + 'AA' },
      tagText: { color: theme.colors.onPrimaryContainer },
      becomeOrganizerBg: { backgroundColor: theme.colors.primaryContainer + '7A' },
      becomeOrganizerText: { color: theme.colors.onPrimaryContainer },
      organizerPanelBg: { backgroundColor: theme.colors.primaryContainer + '2B' },
      actionCardBg: { backgroundColor: theme.colors.surfaceContainerLow },
      mutedIcon: theme.colors.onSurfaceVariant,
    }),
    [theme],
  );

  const cardThemed = useMemo((): ActivitiesCardThemed => {
    return {
      cardBg: themedStyles.cardBg,
      cardTitle: themedStyles.cardTitle,
      cardSub: themedStyles.cardSub,
      tagBg: themedStyles.tagBg,
      tagText: themedStyles.tagText,
      ctaBg: themedStyles.ctaBg,
      ctaText: themedStyles.ctaText,
      ctaDisabledBg: themedStyles.ctaDisabledBg,
      ctaDisabledText: themedStyles.ctaDisabledText,
      mutedIcon: themedStyles.mutedIcon,
    };
  }, [themedStyles]);

  const loadActivities = useCallback(
    async (scope: 'mine' | 'public', cancelled?: () => boolean) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const useMine = scope === 'mine';
        const [nextEvents, nextClubs] = await Promise.all(
          useMine
            ? [ActivitiesApi.listMyEvents(), ActivitiesApi.listMyClubs()]
            : [ActivitiesApi.listEvents(), ActivitiesApi.listClubs()],
        );
        if (cancelled?.()) return;
        setEvents(nextEvents);
        setClubs(nextClubs);
        setLoadedScope(scope);
      } catch (e: unknown) {
        if (cancelled?.()) return;
        setActionError(e, 'Failed to load community activities');
      } finally {
        if (!cancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [setActionError],
  );

  useEffect(() => {
    if (!isFocused) return;
    refreshVerificationStatus().catch(() => {});
  }, [isFocused, refreshVerificationStatus]);

  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;
    loadActivities(fetchScope, () => cancelled).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isFocused, fetchScope, currentUserId, loadActivities]);

  const onBecomeOrganizer = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const auth = await ActivitiesApi.becomeOrganizer();
      setCurrentUser({
        currentUser: {
          ...currentUser,
          role: auth.role,
        },
      });
      if (auth.role) await StorageService.saveUserRole(auth.role);
      if (auth.accessToken) await StorageService.saveUserToken(auth.accessToken);
    } catch (e: unknown) {
      setActionError(e, 'Could not enable organizer role');
    } finally {
      setIsLoading(false);
    }
  };

  const onCreateActivity = () => {
    Alert.alert('Create activity', 'Add an event or a group to the community.', [
      { text: 'Event', onPress: () => navigation.navigate('CreateEvent') },
      { text: 'Group', onPress: () => navigation.navigate('CreateClub') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onJoinClub = async (clubId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.joinClub(clubId);
      setClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e: unknown) {
      setActionError(e, 'Could not join group');
    } finally {
      setIsLoading(false);
    }
  };

  const onClubUpdated = useCallback((updated: Club) => {
    setClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  const onLeaveClub = async (clubId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.leaveClub(clubId);
      if (filter === 'mine') {
        setClubs((prev) => prev.filter((c) => c.id !== clubId));
      } else {
        setClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch (e: unknown) {
      setActionError(e, 'Could not leave group');
    } finally {
      setIsLoading(false);
    }
  };

  const onCancelEvent = async (eventId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.cancelEvent(eventId);
      setEvents((prev) => prev.map((ev) => (ev.id === updated.id ? updated : ev)));
    } catch (e: unknown) {
      setActionError(e, 'Could not cancel event');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, themedStyles.rootBg]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[theme.typography.headlineSmall, themedStyles.title]}>Community</Text>
        <Text style={[theme.typography.bodyMedium, themedStyles.subtitle]}>
          Events and groups in {ACTIVITIES_CITY} — one place to discover and join.
        </Text>

        {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

        {!isOrganizer ? (
          <View style={[styles.panel, themedStyles.cardBg]}>
            <Text style={[theme.typography.titleSmall, themedStyles.cardTitle]}>Organizer access</Text>
            <Text style={[theme.typography.bodySmall, themedStyles.cardSub]}>
              After your identity is approved (Profile → Become an organizer), you can publish events and
              groups here.
            </Text>
            <Pressable
              onPress={onBecomeOrganizer}
              disabled={!canBecomeOrganizer || isLoading}
              style={[
                styles.cta,
                canBecomeOrganizer ? themedStyles.becomeOrganizerBg : themedStyles.ctaDisabledBg,
              ]}
            >
              <Text
                style={[
                  theme.typography.labelLarge,
                  canBecomeOrganizer ? themedStyles.becomeOrganizerText : themedStyles.ctaDisabledText,
                ]}
              >
                {canBecomeOrganizer ? 'Become organizer' : 'Verify identity first'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.panel, themedStyles.cardBg, themedStyles.organizerPanelBg]}>
            <Text style={[theme.typography.titleSmall, themedStyles.cardTitle]}>Organizer</Text>
            <Text style={[theme.typography.bodySmall, themedStyles.cardSub, styles.organizerSub]}>
              Publish a timed event or an ongoing group — both appear in the same feed.
            </Text>
            <Pressable
              onPress={onCreateActivity}
              style={({ pressed }) => [
                styles.createBtn,
                themedStyles.ctaBg,
                { opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Icon name="add" size={20} color={themedStyles.ctaText.color} />
              <Text style={[theme.typography.labelLarge, themedStyles.ctaText]}>Create activity</Text>
            </Pressable>
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const disabled = f.id === 'mine' && !currentUser;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                disabled={disabled}
                style={[
                  styles.filterChip,
                  active ? themedStyles.segmentActive : themedStyles.segmentInactive,
                  disabled ? styles.filterChipDisabled : null,
                ]}
              >
                <Text
                  style={[
                    theme.typography.labelMedium,
                    active ? themedStyles.segmentTextActive : themedStyles.segmentTextInactive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {showListLoader ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}

        {showEmptyState ? (
          <Text style={[theme.typography.bodyMedium, themedStyles.cardSub, styles.empty]}>
            {filter === 'mine'
              ? 'You have no events or groups here yet.'
              : 'No activities match this filter.'}
          </Text>
        ) : null}

        {listings.map((listing) => (
          <ActivityListingCard
            key={listing.kind === 'event' ? `event-${listing.event.id}` : `group-${listing.club.id}`}
            listing={listing}
            currentUser={currentUser}
            isLoading={isLoading}
            themed={cardThemed}
            onCancelEvent={onCancelEvent}
            onJoinClub={onJoinClub}
            onLeaveClub={onLeaveClub}
            onClubUpdated={onClubUpdated}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  panel: { borderWidth: 1, padding: 12, marginTop: 14 },
  organizerSub: { marginTop: 4 },
  cta: { marginTop: 10, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  createBtn: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filterScroll: { marginTop: 14 },
  filterRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipDisabled: { opacity: 0.45 },
  loader: { marginTop: 18 },
  empty: { marginTop: 20, textAlign: 'center' },
});

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { ActivitiesClubCard } from '../components/ActivitiesClubCard';
import type { ActivitiesCardThemed } from '../activitiesCardThemed';
import { ActivitiesEventCard } from '../components/ActivitiesEventCard';
import { ACTIVITIES_CITY } from '../constants';
import { ActivityEvent, Club } from '../types';

type Segment = 'events' | 'clubs';
type ActivityScope = 'all' | 'mine';

type Nav = NativeStackNavigationProp<ActivitiesStackParamList, 'ActivitiesHome'>;

export const ActivitiesHomeScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((s) => s.currentUser);
  const setCurrentUser = useAuthStore.setState;
  const [segment, setSegment] = useState<Segment>('events');
  const [scope, setScope] = useState<ActivityScope>('all');
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOrganizer = currentUser?.role === 'organizer' || currentUser?.role === 'admin';
  const canBecomeOrganizer = !isOrganizer && currentUser?.isVerified === true;

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

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const useMine = scope === 'mine' && currentUser != null;
      const [nextEvents, nextClubs] = await Promise.all(
        useMine
          ? [ActivitiesApi.listMyEvents(), ActivitiesApi.listMyClubs()]
          : [ActivitiesApi.listEvents(), ActivitiesApi.listClubs()],
      );
      setEvents(nextEvents);
      setClubs(nextClubs);
    } catch (e: unknown) {
      setActionError(e, 'Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, scope, setActionError]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

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

  const onJoinClub = async (clubId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.joinClub(clubId);
      setClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e: unknown) {
      setActionError(e, 'Could not join club');
    } finally {
      setIsLoading(false);
    }
  };

  const onLeaveClub = async (clubId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.leaveClub(clubId);
      if (scope === 'mine') {
        setClubs((prev) => prev.filter((c) => c.id !== clubId));
      } else {
        setClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch (e: unknown) {
      setActionError(e, 'Could not leave club');
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
        <Text style={[theme.typography.headlineSmall, themedStyles.title]}>Activities</Text>
        <Text style={[theme.typography.bodyMedium, themedStyles.subtitle]}>
          Events and clubs in {ACTIVITIES_CITY}.
        </Text>

        {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

        {!isOrganizer ? (
          <View style={[styles.panel, themedStyles.cardBg]}>
            <Text style={[theme.typography.titleSmall, themedStyles.cardTitle]}>Organizer access</Text>
            <Text style={[theme.typography.bodySmall, themedStyles.cardSub]}>
              Verified users can publish events and create clubs.
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
                {canBecomeOrganizer ? 'Become organizer' : 'Verification required'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.panel, themedStyles.cardBg, themedStyles.organizerPanelBg]}>
            <Text style={[theme.typography.titleSmall, themedStyles.cardTitle]}>Organizer</Text>
            <Text style={[theme.typography.bodySmall, themedStyles.cardSub, styles.organizerSub]}>
              Create a new listing on a dedicated screen with full details.
            </Text>
            <View style={styles.organizerRow}>
              <Pressable
                onPress={() => navigation.navigate('CreateEvent')}
                style={({ pressed }) => [
                  styles.organizerAction,
                  themedStyles.actionCardBg,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <View style={[styles.organizerIconWrap, { backgroundColor: theme.colors.primaryContainer + 'CC' }]}>
                  <Icon name="event-available" size={22} color={theme.colors.onPrimaryContainer} />
                </View>
                <Text style={[theme.typography.titleSmall, themedStyles.cardTitle]}>Create event</Text>
                <Text style={[theme.typography.bodySmall, themedStyles.cardSub]}>Schedule, place, category</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('CreateClub')}
                style={({ pressed }) => [
                  styles.organizerAction,
                  themedStyles.actionCardBg,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <View style={[styles.organizerIconWrap, { backgroundColor: theme.colors.primaryContainer + 'CC' }]}>
                  <Icon name="groups" size={22} color={theme.colors.onPrimaryContainer} />
                </View>
                <Text style={[theme.typography.titleSmall, themedStyles.cardTitle]}>Create club</Text>
                <Text style={[theme.typography.bodySmall, themedStyles.cardSub]}>Community & visibility</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={[styles.segmentWrap, themedStyles.segmentWrap]}>
          <Pressable
            onPress={() => setSegment('events')}
            style={[
              styles.segmentBtn,
              segment === 'events' ? themedStyles.segmentActive : themedStyles.segmentInactive,
            ]}
          >
            <Icon
              name="event"
              size={16}
              color={segment === 'events' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                theme.typography.labelLarge,
                segment === 'events' ? themedStyles.segmentTextActive : themedStyles.segmentTextInactive,
                styles.segmentText,
              ]}
            >
              Events
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSegment('clubs')}
            style={[
              styles.segmentBtn,
              segment === 'clubs' ? themedStyles.segmentActive : themedStyles.segmentInactive,
            ]}
          >
            <Icon
              name="groups"
              size={16}
              color={segment === 'clubs' ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                theme.typography.labelLarge,
                segment === 'clubs' ? themedStyles.segmentTextActive : themedStyles.segmentTextInactive,
                styles.segmentText,
              ]}
            >
              Clubs
            </Text>
          </Pressable>
        </View>

        <View style={styles.scopeRow}>
          <Pressable
            onPress={() => setScope('all')}
            style={[styles.scopeBtn, scope === 'all' ? themedStyles.segmentActive : themedStyles.segmentInactive]}
          >
            <Text
              style={[
                theme.typography.labelMedium,
                scope === 'all' ? themedStyles.segmentTextActive : themedStyles.segmentTextInactive,
              ]}
            >
              All
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setScope('mine')}
            disabled={!currentUser}
            style={[
              styles.scopeBtn,
              scope === 'mine' ? themedStyles.segmentActive : themedStyles.segmentInactive,
              !currentUser ? styles.scopeBtnDisabled : null,
            ]}
          >
            <Text
              style={[
                theme.typography.labelMedium,
                scope === 'mine' ? themedStyles.segmentTextActive : themedStyles.segmentTextInactive,
              ]}
            >
              My {segment === 'events' ? 'events' : 'clubs'}
            </Text>
          </Pressable>
        </View>

        {isLoading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}

        {segment === 'events'
          ? events.map((event) => (
              <ActivitiesEventCard
                key={`event-${event.id}`}
                event={event}
                currentUser={currentUser}
                isLoading={isLoading}
                themed={cardThemed}
                onCancelEvent={onCancelEvent}
              />
            ))
          : clubs.map((club) => (
              <ActivitiesClubCard
                key={`club-${club.id}`}
                club={club}
                currentUser={currentUser}
                isLoading={isLoading}
                themed={cardThemed}
                onJoinClub={onJoinClub}
                onLeaveClub={onLeaveClub}
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
  organizerRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  organizerAction: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 12,
    minHeight: 120,
  },
  organizerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cta: { marginTop: 10, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  segmentWrap: {
    marginTop: 14,
    borderRadius: 14,
    flexDirection: 'row',
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  segmentText: { marginLeft: 6 },
  scopeRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  scopeBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scopeBtnDisabled: {
    opacity: 0.45,
  },
  loader: { marginTop: 18 },
});

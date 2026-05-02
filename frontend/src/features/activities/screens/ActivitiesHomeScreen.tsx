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
import { ActivitiesStackParamList } from '../../../app/navigation/types';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { StorageService } from '../../../shared/storage/storageService';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../auth/store/authStore';
import { ActivitiesApi } from '../api/activitiesApi';
import { AnnouncementsSection } from '../components/AnnouncementsSection';
import { ACTIVITIES_CITY } from '../constants';
import { ActivityEvent, Club } from '../types';

type Segment = 'events' | 'clubs';
type ActivityScope = 'all' | 'mine';

type Nav = NativeStackNavigationProp<ActivitiesStackParamList, 'ActivitiesHome'>;

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const statusLabel = (status: string) => {
  const s = status.toUpperCase();
  if (s === 'PUBLISHED') return 'Live';
  if (s === 'CANCELLED') return 'Cancelled';
  if (s === 'DELETED') return 'Removed';
  return status;
};

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

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const useMine = scope === 'mine' && currentUser != null;
      const [nextEvents, nextClubs] = await Promise.all(
        useMine
          ? [ActivitiesApi.listMyEvents(currentUser.id), ActivitiesApi.listMyClubs(currentUser.id)]
          : [ActivitiesApi.listEvents(), ActivitiesApi.listClubs(currentUser?.id)],
      );
      setEvents(nextEvents);
      setClubs(nextClubs);
    } catch (e: unknown) {
      setErrorMessage(String((e as { message?: string })?.message ?? e ?? 'Failed to load activities'));
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, scope]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onBecomeOrganizer = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const auth = await ActivitiesApi.becomeOrganizer(currentUser.id);
      setCurrentUser({
        currentUser: {
          ...currentUser,
          role: auth.role,
        },
      });
      if (auth.role) await StorageService.saveUserRole(auth.role);
    } catch (e: unknown) {
      setErrorMessage(String((e as { message?: string })?.message ?? e ?? 'Could not enable organizer role'));
    } finally {
      setIsLoading(false);
    }
  };

  const onJoinClub = async (clubId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.joinClub(clubId, currentUser.id);
      setClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e: unknown) {
      setErrorMessage(String((e as { message?: string })?.message ?? e ?? 'Could not join club'));
    } finally {
      setIsLoading(false);
    }
  };

  const onLeaveClub = async (clubId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.leaveClub(clubId, currentUser.id);
      if (scope === 'mine') {
        setClubs((prev) => prev.filter((c) => c.id !== clubId));
      } else {
        setClubs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } catch (e: unknown) {
      setErrorMessage(String((e as { message?: string })?.message ?? e ?? 'Could not leave club'));
    } finally {
      setIsLoading(false);
    }
  };

  const onCancelEvent = async (eventId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.cancelEvent(eventId, currentUser.id);
      setEvents((prev) => prev.map((ev) => (ev.id === updated.id ? updated : ev)));
    } catch (e: unknown) {
      setErrorMessage(String((e as { message?: string })?.message ?? e ?? 'Could not cancel event'));
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
          ? events.map((event) => {
              const st = event.status.toUpperCase();
              const statusIsLive = st === 'PUBLISHED';
              const statusIsCancelled = st === 'CANCELLED';
              const canPostEventAnnouncement =
                !!currentUser &&
                (currentUser.role === 'admin' ||
                  (event.createdBy === currentUser.id && statusIsLive));
              return (
                <View key={`event-${event.id}`} style={[styles.card, themedStyles.cardBg]}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[theme.typography.titleSmall, themedStyles.cardTitle, styles.cardTitleFlex]}>
                      {event.title}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: statusIsCancelled
                            ? theme.colors.errorContainer + 'AA'
                            : statusIsLive
                              ? theme.colors.primaryContainer + 'AA'
                              : theme.colors.surfaceContainerHigh,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          theme.typography.labelSmall,
                          {
                            color: statusIsCancelled
                              ? theme.colors.error
                              : statusIsLive
                                ? theme.colors.onPrimaryContainer
                                : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {statusLabel(event.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[theme.typography.bodySmall, themedStyles.cardSub]}>
                    {fmtDate(event.startsAt)} • {event.city}
                  </Text>
                  {event.locationName ? (
                    <View style={styles.locRow}>
                      <Icon name="place" size={14} color={themedStyles.mutedIcon} style={styles.locIcon} />
                      <Text style={[theme.typography.bodySmall, themedStyles.cardSub, styles.locText]}>
                        {event.locationName}
                      </Text>
                    </View>
                  ) : null}
                  {event.description ? (
                    <Text style={[theme.typography.bodyMedium, themedStyles.cardSub, styles.cardDescription]}>
                      {event.description}
                    </Text>
                  ) : null}
                  <View style={[styles.tag, themedStyles.tagBg]}>
                    <Text style={[theme.typography.labelSmall, themedStyles.tagText]}>{event.category}</Text>
                  </View>
                  <AnnouncementsSection
                    kind="event"
                    resourceId={event.id}
                    currentUserId={currentUser?.id}
                    canPost={canPostEventAnnouncement}
                  />
                  {currentUser && event.createdBy === currentUser.id && event.status === 'PUBLISHED' ? (
                    <Pressable
                      onPress={() => onCancelEvent(event.id)}
                      disabled={isLoading}
                      style={[styles.joinBtn, themedStyles.ctaDisabledBg]}
                    >
                      <Text style={[theme.typography.labelMedium, themedStyles.ctaDisabledText]}>Cancel event</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          : clubs.map((club) => {
              const clubCanViewAnnouncements =
                currentUser?.role === 'admin' || club.membershipStatus === 'APPROVED';
              const canPostClubAnnouncement = !!currentUser && club.isClubAdmin;
              return (
              <View key={`club-${club.id}`} style={[styles.card, themedStyles.cardBg]}>
                <Text style={[theme.typography.titleSmall, themedStyles.cardTitle]}>{club.name}</Text>
                <Text style={[theme.typography.bodySmall, themedStyles.cardSub]}>
                  {club.membersCount} members • {club.city}
                </Text>
                <View style={styles.clubMetaRow}>
                  <View style={[styles.tag, themedStyles.tagBg]}>
                    <Text style={[theme.typography.labelSmall, themedStyles.tagText]}>{club.category}</Text>
                  </View>
                  <View style={[styles.tag, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
                    <Text style={[theme.typography.labelSmall, { color: theme.colors.onSurfaceVariant }]}>
                      {club.visibility === 'APPROVAL_REQUIRED' ? 'Approval' : 'Open'}
                    </Text>
                  </View>
                </View>
                {club.description ? (
                  <Text style={[theme.typography.bodyMedium, themedStyles.cardSub, styles.cardDescription]}>
                    {club.description}
                  </Text>
                ) : null}
                <AnnouncementsSection
                  kind="club"
                  resourceId={club.id}
                  currentUserId={currentUser?.id}
                  canPost={canPostClubAnnouncement}
                  clubCanView={clubCanViewAnnouncements}
                  clubMembershipStatus={club.membershipStatus}
                />
                <Pressable
                  onPress={() => (club.joined ? onLeaveClub(club.id) : onJoinClub(club.id))}
                  disabled={isLoading || !currentUser}
                  style={[styles.joinBtn, club.joined ? themedStyles.ctaDisabledBg : themedStyles.ctaBg]}
                >
                  <Text
                    style={[
                      theme.typography.labelMedium,
                      club.joined ? themedStyles.ctaDisabledText : themedStyles.ctaText,
                    ]}
                  >
                    {club.joined ? 'Leave club' : 'Join club'}
                  </Text>
                </Pressable>
              </View>
            );
            })}
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
  card: { marginTop: 12, borderWidth: 1, padding: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitleFlex: { flex: 1 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  locRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center' },
  locIcon: { marginRight: 4 },
  locText: { flex: 1 },
  cardDescription: { marginTop: 6 },
  clubMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  tag: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  joinBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
});

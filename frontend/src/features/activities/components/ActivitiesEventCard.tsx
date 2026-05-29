import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@theme';
import type { User } from '@shared/types/user';
import { AnnouncementsSection } from './AnnouncementsSection';
import { SupportChatSection } from './SupportChatSection';
import { activityStatusLabel, formatActivityDate } from '../utils/activitiesFormat';
import type { ActivitiesCardThemed } from '../activitiesCardThemed';
import type { ActivityEvent } from '../types';

type Props = {
  event: ActivityEvent;
  currentUser: User | null;
  isLoading: boolean;
  themed: ActivitiesCardThemed;
  onCancelEvent: (eventId: number) => void;
  /** When nested inside ActivityListingCard (kind tag is shown above). */
  embedded?: boolean;
};

export const ActivitiesEventCard: React.FC<Props> = ({
  event,
  currentUser,
  isLoading,
  themed,
  onCancelEvent,
  embedded = false,
}) => {
  const theme = useTheme();
  const st = event.status.toUpperCase();
  const statusIsLive = st === 'PUBLISHED';
  const statusIsCancelled = st === 'CANCELLED';
  const canPostEventAnnouncement =
    !!currentUser &&
    (currentUser.role === 'admin' || (event.createdBy === currentUser.id && statusIsLive));
  const canPostEventAsOrganizer =
    !!currentUser && (currentUser.role === 'admin' || event.createdBy === currentUser.id);

  return (
    <View style={[styles.card, embedded ? styles.cardEmbedded : null, themed.cardBg]}>
      <View style={styles.cardHeaderRow}>
        <Text style={[theme.typography.titleSmall, themed.cardTitle, styles.cardTitleFlex]}>{event.title}</Text>
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
            {activityStatusLabel(event.status)}
          </Text>
        </View>
      </View>
      <Text style={[theme.typography.bodySmall, themed.cardSub]}>
        {formatActivityDate(event.startsAt)} • {event.city}
      </Text>
      {event.locationName ? (
        <View style={styles.locRow}>
          <Icon name="place" size={14} color={themed.mutedIcon} style={styles.locIcon} />
          <Text style={[theme.typography.bodySmall, themed.cardSub, styles.locText]}>{event.locationName}</Text>
        </View>
      ) : null}
      {event.description ? (
        <Text style={[theme.typography.bodyMedium, themed.cardSub, styles.cardDescription]}>{event.description}</Text>
      ) : null}
      <View style={[styles.tag, themed.tagBg]}>
        <Text style={[theme.typography.labelSmall, themed.tagText]}>{event.category}</Text>
      </View>
      <AnnouncementsSection
        kind="event"
        resourceId={event.id}
        currentUserId={currentUser?.id}
        canPost={canPostEventAnnouncement}
      />
      <SupportChatSection
        kind="event"
        resourceId={event.id}
        currentUserId={currentUser?.id}
        canView={!!currentUser}
        canPostOrganizer={canPostEventAsOrganizer}
      />
      {currentUser && event.createdBy === currentUser.id && event.status === 'PUBLISHED' ? (
        <Pressable
          onPress={() => onCancelEvent(event.id)}
          disabled={isLoading}
          style={[styles.joinBtn, themed.ctaDisabledBg]}
        >
          <Text style={[theme.typography.labelMedium, themed.ctaDisabledText]}>Cancel event</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 12, borderWidth: 1, padding: 12 },
  cardEmbedded: { marginTop: 0 },
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

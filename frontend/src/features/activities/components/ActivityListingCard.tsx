import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { User } from '@shared/types/user';
import type { ActivitiesCardThemed } from '../activitiesCardThemed';
import type { ActivityListing, Club } from '../types';
import { ActivityKindTag } from './ActivityKindTag';
import { ActivitiesClubCard } from './ActivitiesClubCard';
import { ActivitiesEventCard } from './ActivitiesEventCard';

type Props = {
  listing: ActivityListing;
  currentUser: User | null;
  isLoading: boolean;
  themed: ActivitiesCardThemed;
  onCancelEvent: (eventId: number) => void;
  onJoinClub: (clubId: number) => void;
  onLeaveClub: (clubId: number) => void;
  onClubUpdated?: (club: Club) => void;
};

export const ActivityListingCard: React.FC<Props> = ({
  listing,
  currentUser,
  isLoading,
  themed,
  onCancelEvent,
  onJoinClub,
  onLeaveClub,
  onClubUpdated,
}) => (
  <View style={styles.wrap}>
    <ActivityKindTag kind={listing.kind} />
    {listing.kind === 'event' ? (
      <ActivitiesEventCard
        event={listing.event}
        currentUser={currentUser}
        isLoading={isLoading}
        themed={themed}
        onCancelEvent={onCancelEvent}
        embedded
      />
    ) : (
      <ActivitiesClubCard
        club={listing.club}
        currentUser={currentUser}
        isLoading={isLoading}
        themed={themed}
        onJoinClub={onJoinClub}
        onLeaveClub={onLeaveClub}
        onClubUpdated={onClubUpdated}
        embedded
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 8 },
});

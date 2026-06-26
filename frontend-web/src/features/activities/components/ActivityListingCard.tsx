import React from 'react';
import type { User } from '@shared/types/user';
import type { ActivityListing, Club } from '../types';
import { ActivityKindTag } from './ActivityKindTag';
import { ActivitiesClubCard } from './ActivitiesClubCard';
import { ActivitiesEventCard } from './ActivitiesEventCard';

type Props = {
  listing: ActivityListing;
  currentUser: User | null;
  isLoading: boolean;
  onParticipateEvent: (eventId: number) => void;
  onLeaveEvent: (eventId: number) => void;
  onDeleteEvent: (eventId: number) => void;
  onJoinClub: (clubId: number) => void;
  onLeaveClub: (clubId: number) => void;
  onDeleteClub: (clubId: number) => void;
  onClubUpdated?: (club: Club) => void;
};

export const ActivityListingCard: React.FC<Props> = ({
  listing,
  currentUser,
  isLoading,
  onParticipateEvent,
  onLeaveEvent,
  onDeleteEvent,
  onJoinClub,
  onLeaveClub,
  onDeleteClub,
  onClubUpdated,
}) => (
  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <ActivityKindTag kind={listing.kind} />
    {listing.kind === 'event' ? (
      <ActivitiesEventCard
        event={listing.event}
        currentUser={currentUser}
        isLoading={isLoading}
        onParticipateEvent={onParticipateEvent}
        onLeaveEvent={onLeaveEvent}
        onDeleteEvent={onDeleteEvent}
      />
    ) : (
      <ActivitiesClubCard
        club={listing.club}
        currentUser={currentUser}
        isLoading={isLoading}
        onJoinClub={onJoinClub}
        onLeaveClub={onLeaveClub}
        onDeleteClub={onDeleteClub}
        onClubUpdated={onClubUpdated}
      />
    )}
  </div>
);

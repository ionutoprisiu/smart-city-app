import React from 'react';
import { Icon } from '@shared/components/Icon';
import type { User } from '@shared/types/user';
import { CommunityHubLinks } from './CommunityHubLinks';
import { activityStatusLabel, formatActivityDate } from '../utils/activitiesFormat';
import type { ActivityEvent } from '../types';

type Props = {
  event: ActivityEvent;
  currentUser: User | null;
  isLoading: boolean;
  onParticipateEvent: (eventId: number) => void;
  onLeaveEvent: (eventId: number) => void;
  onDeleteEvent: (eventId: number) => void;
};

export const ActivitiesEventCard: React.FC<Props> = ({
  event,
  currentUser,
  isLoading,
  onParticipateEvent,
  onLeaveEvent,
  onDeleteEvent,
}) => {
  const st = event.status.toUpperCase();
  const statusIsLive = st === 'PUBLISHED';
  const statusIsCancelled = st === 'CANCELLED';
  const canAccessEvent =
    currentUser?.role === 'admin' || event.participating || event.isEventOrganizer;
  const canPostEventAnnouncement =
    !!currentUser &&
    (currentUser.role === 'admin' || (event.createdBy === currentUser.id && statusIsLive));
  const canPostEventAsOrganizer =
    !!currentUser && (currentUser.role === 'admin' || event.createdBy === currentUser.id);

  const canDeleteEvent =
    !!currentUser &&
    (currentUser.role === 'admin' || event.createdBy === currentUser.id) &&
    st !== 'DELETED';

  const showParticipateButton = statusIsLive && !event.participating && !event.isEventOrganizer;
  const showLeaveButton =
    event.participating && !event.isEventOrganizer && statusIsLive;

  const handleDelete = () => {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    onDeleteEvent(event.id);
  };

  return (
    <div
      style={{
        border: '1px solid color-mix(in srgb, var(--outline-variant) 30%, transparent)',
        borderRadius: 18,
        padding: 12,
        background: 'color-mix(in srgb, var(--surface-container-highest) 55%, transparent)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div className="title-small" style={{ flex: 1 }}>{event.title}</div>
        <span
          className="label-small"
          style={{
            borderRadius: 999,
            padding: '4px 8px',
            background: statusIsCancelled
              ? 'color-mix(in srgb, var(--error-container) 67%, transparent)'
              : statusIsLive
                ? 'color-mix(in srgb, var(--primary-container) 67%, transparent)'
                : 'var(--surface-container-high)',
            color: statusIsCancelled
              ? 'var(--error)'
              : statusIsLive
                ? 'var(--on-primary-container)'
                : 'var(--on-surface-variant)',
            whiteSpace: 'nowrap',
          }}
        >
          {activityStatusLabel(event.status)}
        </span>
      </div>
      <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 2 }}>
        {formatActivityDate(event.startsAt)} • {event.city}
        {event.participantsCount > 0 ? ` • ${event.participantsCount} participating` : ''}
      </div>
      {event.locationName ? (
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
          <Icon name="place" size={14} color="var(--on-surface-variant)" style={{ marginRight: 4 }} />
          <span className="body-small" style={{ color: 'var(--on-surface-variant)', flex: 1 }}>
            {event.locationName}
          </span>
        </div>
      ) : null}
      {event.description ? (
        <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 6 }}>
          {event.description}
        </div>
      ) : null}
      <span
        className="label-small"
        style={{
          display: 'inline-block',
          marginTop: 8,
          borderRadius: 999,
          padding: '4px 10px',
          background: 'color-mix(in srgb, var(--primary-container) 67%, transparent)',
          color: 'var(--on-primary-container)',
        }}
      >
        {event.category}
      </span>
      <CommunityHubLinks
        kind="event"
        resourceId={event.id}
        title={event.title}
        canPostAnnouncements={canPostEventAnnouncement}
        canViewAnnouncements={canAccessEvent}
        eventParticipating={event.participating}
        canViewSupport={canAccessEvent}
        canPostOrganizer={canPostEventAsOrganizer}
        supportPendingHint={
          !canAccessEvent ? 'Participate in the event to message the organizer' : undefined
        }
      />
      {showParticipateButton || showLeaveButton ? (
        <button
          type="button"
          onClick={() =>
            event.participating ? onLeaveEvent(event.id) : onParticipateEvent(event.id)
          }
          disabled={isLoading || !currentUser}
          style={{
            marginTop: 10,
            borderRadius: 10,
            padding: '9px 0',
            width: '100%',
            background: showLeaveButton ? 'var(--surface-container-high)' : 'var(--primary)',
            color: showLeaveButton ? 'var(--on-surface-variant)' : 'var(--on-primary)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {showLeaveButton ? 'Leave event' : 'Participate'}
        </button>
      ) : null}
      {canDeleteEvent ? (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isLoading}
          style={{
            marginTop: 8,
            borderRadius: 10,
            padding: '9px 0',
            width: '100%',
            background: 'color-mix(in srgb, var(--error-container) 55%, transparent)',
            color: 'var(--error)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Delete event
        </button>
      ) : null}
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '@shared/api/errors';
import { BottomSheet } from '@shared/components/BottomSheet';
import { ErrorMessage } from '@shared/components/ErrorMessage';
import { Icon } from '@shared/components/Icon';
import { Spinner } from '@shared/components/Spinner';
import { StorageService } from '@shared/storage/storageService';
import { useAuthStore } from '@features/auth/store/authStore';
import { ActivitiesApi } from '../api/activitiesApi';
import { ActivityListingCard } from '../components/ActivityListingCard';
import { ACTIVITIES_CITY } from '../constants';
import type { ActivityEvent, ActivityListFilter, Club } from '../types';
import { buildActivityListings, filterActivityListings } from '../utils/buildActivityListings';

const FILTERS: { id: ActivityListFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'event', label: 'Events', icon: 'event' },
  { id: 'group', label: 'Groups', icon: 'groups' },
  { id: 'mine', label: 'Mine', icon: 'person' },
];

export const ActivitiesHomePage: React.FC = () => {
  const navigate = useNavigate();
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
  const [createPicker, setCreatePicker] = useState(false);

  const fetchScope: 'mine' | 'public' =
    filter === 'mine' && currentUserId != null ? 'mine' : 'public';

  const isOrganizer = currentUser?.role === 'organizer' || currentUser?.role === 'admin';
  const canBecomeOrganizer = !isOrganizer && currentUser?.isVerified === true;

  const allListings = useMemo(() => buildActivityListings(events, clubs), [events, clubs]);

  const listings = useMemo(
    () => filterActivityListings(allListings, filter, currentUserId),
    [allListings, filter, currentUserId],
  );

  const counts = useMemo(
    () => ({
      all: allListings.length,
      event: allListings.filter((x) => x.kind === 'event').length,
      group: allListings.filter((x) => x.kind === 'group').length,
      mine: filterActivityListings(allListings, 'mine', currentUserId).length,
    }),
    [allListings, currentUserId],
  );

  const eventListings = useMemo(() => listings.filter((x) => x.kind === 'event'), [listings]);
  const groupListings = useMemo(() => listings.filter((x) => x.kind === 'group'), [listings]);
  const grouped = filter === 'all' && eventListings.length > 0 && groupListings.length > 0;

  const showListLoader = isLoading && loadedScope !== fetchScope;
  const showEmptyState = loadedScope === fetchScope && listings.length === 0;

  const setActionError = useCallback((error: unknown, fallback: string) => {
    const message = extractErrorMessage(error);
    setErrorMessage(message || fallback);
  }, []);

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
    refreshVerificationStatus().catch(() => {});
  }, [refreshVerificationStatus]);

  useEffect(() => {
    let cancelled = false;
    loadActivities(fetchScope, () => cancelled).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fetchScope, currentUserId, loadActivities]);

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
      if (auth.role) StorageService.saveUserRole(auth.role);
      if (auth.accessToken) StorageService.saveUserToken(auth.accessToken);
    } catch (e: unknown) {
      setActionError(e, 'Could not enable organizer role');
    } finally {
      setIsLoading(false);
    }
  };

  const onParticipateEvent = async (eventId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.participateEvent(eventId);
      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (e: unknown) {
      setActionError(e, 'Could not participate in event');
    } finally {
      setIsLoading(false);
    }
  };

  const onLeaveEvent = async (eventId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const updated = await ActivitiesApi.leaveEvent(eventId);
      if (filter === 'mine') {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
      } else {
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      }
    } catch (e: unknown) {
      setActionError(e, 'Could not leave event');
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

  const onDeleteEvent = async (eventId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await ActivitiesApi.deleteEvent(eventId);
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    } catch (e: unknown) {
      setActionError(e, 'Could not delete event');
    } finally {
      setIsLoading(false);
    }
  };

  const onDeleteClub = async (clubId: number) => {
    if (!currentUser) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await ActivitiesApi.deleteClub(clubId);
      setClubs((prev) => prev.filter((c) => c.id !== clubId));
    } catch (e: unknown) {
      setActionError(e, 'Could not delete group');
    } finally {
      setIsLoading(false);
    }
  };

  const panelStyle: React.CSSProperties = {
    border: '1px solid color-mix(in srgb, var(--outline-variant) 30%, transparent)',
    borderRadius: 18,
    padding: 12,
    marginTop: 14,
    background: 'color-mix(in srgb, var(--surface-container-highest) 55%, transparent)',
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ padding: '16px 16px 32px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <div className="headline-small">Community</div>
        <div className="body-medium" style={{ color: 'var(--on-surface-variant)' }}>
          Events and groups in {ACTIVITIES_CITY} — one place to discover and join.
        </div>

        {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

        {!isOrganizer ? (
          <div style={panelStyle}>
            <div className="title-small">Organizer access</div>
            <div className="body-small" style={{ color: 'var(--on-surface-variant)' }}>
              After identity verification (Profile → Become an organizer), you can publish events
              and groups here.
            </div>
            <button
              type="button"
              onClick={onBecomeOrganizer}
              disabled={!canBecomeOrganizer || isLoading}
              style={{
                marginTop: 10,
                borderRadius: 12,
                padding: '11px 0',
                width: '100%',
                background: canBecomeOrganizer
                  ? 'color-mix(in srgb, var(--primary-container) 48%, transparent)'
                  : 'var(--surface-container-high)',
                color: canBecomeOrganizer
                  ? 'var(--on-primary-container)'
                  : 'var(--on-surface-variant)',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {canBecomeOrganizer ? 'Become organizer' : 'Verify identity first'}
            </button>
          </div>
        ) : (
          <div
            style={{
              ...panelStyle,
              background: 'color-mix(in srgb, var(--primary-container) 17%, transparent)',
            }}
          >
            <div className="title-small">Organizer</div>
            <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
              Publish a timed event or an ongoing group — both appear in the same feed.
            </div>
            <button
              type="button"
              onClick={() => setCreatePicker(true)}
              style={{
                marginTop: 12,
                borderRadius: 12,
                padding: '12px 0',
                width: '100%',
                background: 'var(--primary)',
                color: 'var(--on-primary)',
                fontWeight: 600,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Icon name="add" size={20} color="var(--on-primary)" />
              Create activity
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14, padding: '4px 0', overflowX: 'auto' }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const disabled = f.id === 'mine' && !currentUser;
            const count = counts[f.id];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                disabled={disabled}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 999,
                  padding: '8px 14px',
                  background: active ? 'var(--primary-container)' : 'transparent',
                  opacity: disabled ? 0.45 : 1,
                  flexShrink: 0,
                }}
              >
                <Icon
                  name={f.icon}
                  size={15}
                  color={active ? 'var(--on-primary-container)' : 'var(--on-surface-variant)'}
                />
                <span
                  className="label-medium"
                  style={{
                    color: active ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                  }}
                >
                  {f.label}
                </span>
                {!disabled && count > 0 ? (
                  <span
                    className="label-small"
                    style={{
                      minWidth: 20,
                      padding: '1px 6px',
                      borderRadius: 999,
                      textAlign: 'center',
                      background: active
                        ? 'color-mix(in srgb, var(--on-primary-container) 14%, transparent)'
                        : 'var(--surface-container-highest)',
                      color: active ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
                    }}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {showListLoader ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
            <Spinner />
          </div>
        ) : null}

        {showEmptyState ? (
          <div style={{ marginTop: 36, textAlign: 'center', padding: '0 24px' }}>
            <Icon
              name={
                filter === 'event' ? 'event-busy' : filter === 'group' ? 'group-off' : 'explore-off'
              }
              size={40}
              color="var(--on-surface-variant)"
            />
            <div className="title-small" style={{ marginTop: 12 }}>
              {filter === 'mine' ? 'Nothing here yet' : 'No activities found'}
            </div>
            <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
              {filter === 'mine'
                ? 'Events you create and groups you join will show up here.'
                : 'Refresh the page, or try a different filter.'}
            </div>
          </div>
        ) : null}

        {!showListLoader && !showEmptyState ? (
          <div
            className="label-medium"
            style={{ color: 'var(--on-surface-variant)', marginTop: 16, marginBottom: 2 }}
          >
            {listings.length} {listings.length === 1 ? 'result' : 'results'}
          </div>
        ) : null}

        {grouped ? (
          <>
            {eventListings.length > 0 ? (
              <>
                <SectionHeader icon="event" label="Events" count={eventListings.length} />
                {eventListings.map((listing) => (
                  <ActivityListingCard
                    key={`event-${listing.kind === 'event' ? listing.event.id : 0}`}
                    listing={listing}
                    currentUser={currentUser}
                    isLoading={isLoading}
                    onParticipateEvent={onParticipateEvent}
                    onLeaveEvent={onLeaveEvent}
                    onDeleteEvent={onDeleteEvent}
                    onJoinClub={onJoinClub}
                    onLeaveClub={onLeaveClub}
                    onDeleteClub={onDeleteClub}
                    onClubUpdated={onClubUpdated}
                  />
                ))}
              </>
            ) : null}
            {groupListings.length > 0 ? (
              <>
                <SectionHeader icon="groups" label="Groups" count={groupListings.length} />
                {groupListings.map((listing) => (
                  <ActivityListingCard
                    key={`group-${listing.kind === 'group' ? listing.club.id : 0}`}
                    listing={listing}
                    currentUser={currentUser}
                    isLoading={isLoading}
                    onParticipateEvent={onParticipateEvent}
                    onLeaveEvent={onLeaveEvent}
                    onDeleteEvent={onDeleteEvent}
                    onJoinClub={onJoinClub}
                    onLeaveClub={onLeaveClub}
                    onDeleteClub={onDeleteClub}
                    onClubUpdated={onClubUpdated}
                  />
                ))}
              </>
            ) : null}
          </>
        ) : (
          listings.map((listing) => (
            <ActivityListingCard
              key={
                listing.kind === 'event' ? `event-${listing.event.id}` : `group-${listing.club.id}`
              }
              listing={listing}
              currentUser={currentUser}
              isLoading={isLoading}
              onParticipateEvent={onParticipateEvent}
              onLeaveEvent={onLeaveEvent}
              onDeleteEvent={onDeleteEvent}
              onJoinClub={onJoinClub}
              onLeaveClub={onLeaveClub}
              onDeleteClub={onDeleteClub}
              onClubUpdated={onClubUpdated}
            />
          ))
        )}
      </div>

      <BottomSheet open={createPicker} onClose={() => setCreatePicker(false)}>
        <div style={{ padding: '8px 20px 28px' }}>
          <div className="title-large">Create activity</div>
          <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
            Add an event or a group to the community.
          </div>
          <div style={{ height: 16 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setCreatePicker(false);
                navigate('/community/create-event');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: 14,
                border: '1px solid color-mix(in srgb, var(--outline-variant) 33%, transparent)',
                background: 'var(--surface-container-low)',
                padding: 14,
                textAlign: 'left',
              }}
            >
              <Icon name="event" size={24} color="var(--primary)" />
              <span className="title-small">Event</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatePicker(false);
                navigate('/community/create-club');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: 14,
                border: '1px solid color-mix(in srgb, var(--outline-variant) 33%, transparent)',
                background: 'var(--surface-container-low)',
                padding: 14,
                textAlign: 'left',
              }}
            >
              <Icon name="groups" size={24} color="var(--primary)" />
              <span className="title-small">Group</span>
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
};

type SectionHeaderProps = {
  icon: string;
  label: string;
  count: number;
};

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, label, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 2 }}>
    <Icon name={icon} size={18} />
    <span className="title-small">{label}</span>
    <span className="label-medium" style={{ color: 'var(--on-surface-variant)' }}>{count}</span>
  </div>
);

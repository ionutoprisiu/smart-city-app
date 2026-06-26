import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { StackHeader } from '@app/StackHeader';
import { useAuthStore } from '@features/auth/store/authStore';
import { AnnouncementsSection } from '../components/AnnouncementsSection';

type RouteState = {
  title?: string;
  canPost?: boolean;
  canView?: boolean;
  clubCanView?: boolean;
  clubMembershipStatus?: string | null;
  eventParticipating?: boolean;
};

export const ActivityAnnouncementsPage: React.FC = () => {
  const params = useParams<{ kind: string; id: string }>();
  const location = useLocation();
  const currentUser = useAuthStore((s) => s.currentUser);

  const kind: 'event' | 'club' = params.kind === 'club' ? 'club' : 'event';
  const resourceId = Number(params.id ?? 0);
  const state = (location.state ?? {}) as RouteState;
  const title = state.title ?? (kind === 'event' ? 'Event' : 'Group');
  const canPost = state.canPost ?? false;
  const canView = state.canView ?? true;
  const clubCanView = state.clubCanView ?? true;
  const clubMembershipStatus = state.clubMembershipStatus ?? null;

  return (
    <div className="app-shell">
      <StackHeader title="Announcements" />
      <div className="app-content" style={{ overflowY: 'auto' }}>
        <div style={{ padding: '8px 16px 32px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
          <div className="label-medium" style={{ color: 'var(--primary)' }}>
            {kind === 'event' ? 'Event' : 'Group'}
          </div>
          <div className="headline-small" style={{ marginTop: 4 }}>{title}</div>
          <div
            className="body-medium"
            style={{ color: 'var(--on-surface-variant)', marginTop: 8, marginBottom: 4, lineHeight: '22px' }}
          >
            One-way updates from the organizer. Members read only; organizers can post new items.
          </div>
          <AnnouncementsSection
            variant="page"
            kind={kind}
            resourceId={resourceId}
            currentUserId={currentUser?.id}
            canPost={canPost}
            canView={canView}
            clubCanView={clubCanView}
            clubMembershipStatus={clubMembershipStatus}
          />
        </div>
      </div>
    </div>
  );
};

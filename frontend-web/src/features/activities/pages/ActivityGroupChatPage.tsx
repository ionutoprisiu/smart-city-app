import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { StackHeader } from '@app/StackHeader';
import { useAuthStore } from '@features/auth/store/authStore';
import { GroupChatSection } from '../components/GroupChatSection';

type RouteState = {
  title?: string;
  canView?: boolean;
  pendingHint?: string | null;
};

export const ActivityGroupChatPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const location = useLocation();
  const currentUser = useAuthStore((s) => s.currentUser);

  const clubId = Number(params.id ?? 0);
  const state = (location.state ?? {}) as RouteState;
  const title = state.title ?? 'Group';
  const canView = state.canView ?? true;
  const pendingHint = state.pendingHint ?? null;

  return (
    <div className="app-shell">
      <StackHeader title="Group chat" />
      <div
        className="app-content"
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <div
          style={{
            padding: '8px 16px 16px',
            maxWidth: 720,
            margin: '0 auto',
            width: '100%',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="label-medium" style={{ color: 'var(--primary)' }}>
            Group
          </div>
          <div className="headline-small" style={{ marginTop: 4 }}>
            {title}
          </div>
          <div
            className="body-medium"
            style={{ color: 'var(--on-surface-variant)', marginTop: 8, marginBottom: 8, lineHeight: '22px' }}
          >
            Chat with all approved members. Messages are visible to everyone in the group.
          </div>
          <GroupChatSection
            clubId={clubId}
            currentUserId={currentUser?.id}
            canView={canView}
            pendingHint={pendingHint}
          />
        </div>
      </div>
    </div>
  );
};

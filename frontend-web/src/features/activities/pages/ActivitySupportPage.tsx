import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { StackHeader } from '@app/StackHeader';
import { useAuthStore } from '@features/auth/store/authStore';
import { SupportChatSection } from '../components/SupportChatSection';

type RouteState = {
  title?: string;
  canView?: boolean;
  canPostOrganizer?: boolean;
  pendingHint?: string | null;
};

export const ActivitySupportPage: React.FC = () => {
  const params = useParams<{ kind: string; id: string }>();
  const location = useLocation();
  const currentUser = useAuthStore((s) => s.currentUser);

  const kind: 'event' | 'club' = params.kind === 'club' ? 'club' : 'event';
  const resourceId = Number(params.id ?? 0);
  const state = (location.state ?? {}) as RouteState;
  const title = state.title ?? (kind === 'event' ? 'Event' : 'Group');
  const canView = state.canView ?? true;
  const canPostOrganizer = state.canPostOrganizer ?? false;
  const pendingHint = state.pendingHint ?? null;

  return (
    <div className="app-shell">
      <StackHeader title="Support chat" />
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
            {kind === 'event' ? 'Event' : 'Group'}
          </div>
          <div className="headline-small" style={{ marginTop: 4 }}>{title}</div>
          <div
            className="body-medium"
            style={{ color: 'var(--on-surface-variant)', marginTop: 8, marginBottom: 8, lineHeight: '22px' }}
          >
            {canPostOrganizer
              ? 'Review AI suggestions and approve them. You can also message members freely.'
              : 'Private chat with the organizer.'}
          </div>
          <SupportChatSection
            variant="page"
            kind={kind}
            resourceId={resourceId}
            currentUserId={currentUser?.id}
            canView={canView}
            canPostOrganizer={canPostOrganizer}
            pendingHint={pendingHint}
          />
        </div>
      </div>
    </div>
  );
};

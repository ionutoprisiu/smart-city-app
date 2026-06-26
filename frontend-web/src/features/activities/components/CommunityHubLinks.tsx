import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@shared/components/Icon';

type HubConfig = {
  kind: 'event' | 'club';
  resourceId: number;
  title: string;
  canPostAnnouncements: boolean;
  canViewAnnouncements?: boolean;
  eventParticipating?: boolean;
  clubCanViewGroupChat?: boolean;
  clubMembershipStatus?: string | null;
  canViewSupport: boolean;
  canPostOrganizer: boolean;
  supportPendingHint?: string;
  supportThreadCount?: number;
};

type Props = HubConfig;

export const CommunityHubLinks: React.FC<Props> = ({
  kind,
  resourceId,
  title,
  canPostAnnouncements,
  canViewAnnouncements = true,
  eventParticipating = true,
  clubCanViewGroupChat = true,
  clubMembershipStatus = null,
  canViewSupport,
  canPostOrganizer,
  supportPendingHint,
  supportThreadCount = 0,
}) => {
  const navigate = useNavigate();

  const openAnnouncements = () => {
    if (kind === 'event' && !canViewAnnouncements) return;
    navigate(`/community/${kind}/${resourceId}/announcements`, {
      state: {
        title,
        canPost: canPostAnnouncements,
        canView: canViewAnnouncements,
        eventParticipating,
      },
    });
  };

  const openGroupChat = () => {
    if (!clubCanViewGroupChat) return;
    navigate(`/community/club/${resourceId}/group-chat`, {
      state: {
        title,
        canView: clubCanViewGroupChat,
        pendingHint:
          clubMembershipStatus === 'PENDING'
            ? 'Your membership is pending. Group chat unlocks after approval.'
            : 'Join this group and get approved to open group chat.',
      },
    });
  };

  const openSupport = () => {
    if (!canViewSupport) return;
    navigate(`/community/${kind}/${resourceId}/support`, {
      state: {
        title,
        canView: canViewSupport,
        canPostOrganizer,
        pendingHint: supportPendingHint,
      },
    });
  };

  const supportSubtitle = !canViewSupport
    ? supportPendingHint ?? (kind === 'event' ? 'Participate to message the organizer' : 'Join and get approved to message the organizer')
    : canPostOrganizer
      ? 'Private inbox — one chat per member'
      : 'Ask the organizer privately';

  const announcementsSubtitle =
    kind === 'event'
      ? !canViewAnnouncements
        ? 'Participate in the event to read announcements'
        : 'News from the organizer — participants can read'
      : 'News from the organizer — everyone can read';

  const groupChatSubtitle = !clubCanViewGroupChat
    ? clubMembershipStatus === 'PENDING'
      ? 'Your membership is pending. Chat unlocks after approval.'
      : 'Join this group and get approved to chat with members'
    : 'Talk with everyone in the group';

  const tileStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    border: '1px solid color-mix(in srgb, var(--outline-variant) 33%, transparent)',
    borderRadius: 14,
    padding: 12,
    background: 'var(--surface-container-low)',
    textAlign: 'left',
    width: '100%',
  };

  const eventAnnouncementsDisabled = kind === 'event' && !canViewAnnouncements;

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {kind === 'event' ? (
        <button
          type="button"
          onClick={openAnnouncements}
          disabled={eventAnnouncementsDisabled}
          style={{ ...tileStyle, opacity: eventAnnouncementsDisabled ? 0.55 : 1 }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--primary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="campaign" size={22} color="var(--primary)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="title-small">Announcements</div>
            <div className="body-small" style={{ color: 'var(--on-surface-variant)' }}>
              {announcementsSubtitle}
            </div>
          </div>
          <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
        </button>
      ) : (
        <button
          type="button"
          onClick={openGroupChat}
          disabled={!clubCanViewGroupChat}
          style={{ ...tileStyle, opacity: !clubCanViewGroupChat ? 0.55 : 1 }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--primary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="groups" size={22} color="var(--primary)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="title-small">Group chat</div>
            <div className="body-small" style={{ color: 'var(--on-surface-variant)' }}>
              {groupChatSubtitle}
            </div>
          </div>
          <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
        </button>
      )}

      <button
        type="button"
        onClick={openSupport}
        disabled={!canViewSupport}
        style={{ ...tileStyle, opacity: !canViewSupport ? 0.55 : 1 }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--surface-container-high)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={canPostOrganizer ? 'forum' : 'chat'} size={22} color="var(--primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="title-small">Support chat</span>
            {canPostOrganizer && supportThreadCount > 0 ? (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  padding: '0 6px',
                  background: 'var(--primary)',
                  color: 'var(--on-primary)',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {supportThreadCount}
              </span>
            ) : null}
          </div>
          <div className="body-small" style={{ color: 'var(--on-surface-variant)' }}>
            {supportSubtitle}
          </div>
        </div>
        <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
      </button>
    </div>
  );
};

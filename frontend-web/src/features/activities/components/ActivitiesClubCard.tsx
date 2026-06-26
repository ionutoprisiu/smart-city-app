import React from 'react';
import type { User } from '@shared/types/user';
import { ClubPendingMembersSection } from './ClubPendingMembersSection';
import { CommunityHubLinks } from './CommunityHubLinks';
import type { Club } from '../types';

type Props = {
  club: Club;
  currentUser: User | null;
  isLoading: boolean;
  onJoinClub: (clubId: number) => void;
  onLeaveClub: (clubId: number) => void;
  onDeleteClub: (clubId: number) => void;
  onClubUpdated?: (club: Club) => void;
};

export const ActivitiesClubCard: React.FC<Props> = ({
  club,
  currentUser,
  isLoading,
  onJoinClub,
  onLeaveClub,
  onDeleteClub,
  onClubUpdated,
}) => {
  const clubCanViewGroupChat =
    currentUser?.role === 'admin' || club.membershipStatus === 'APPROVED';
  const canPostClubAnnouncement = !!currentUser && club.isClubAdmin;
  const clubCanViewChat = currentUser?.role === 'admin' || club.membershipStatus === 'APPROVED';
  const canPostClubAsOrganizer =
    !!currentUser && (currentUser.role === 'admin' || club.isClubAdmin);

  const canDeleteClub =
    !!currentUser &&
    (currentUser.role === 'admin' || club.createdBy === currentUser.id || club.isClubAdmin) &&
    club.status.toUpperCase() !== 'DELETED';

  const showJoinButton = !club.joined;
  const showLeaveButton = club.joined && !canDeleteClub;

  const handleDelete = () => {
    if (!window.confirm(`Delete "${club.name}"? This cannot be undone.`)) return;
    onDeleteClub(club.id);
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
      <div className="title-small">{club.name}</div>
      <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 2 }}>
        {club.membersCount} members • {club.city}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        <span
          className="label-small"
          style={{
            borderRadius: 999,
            padding: '4px 10px',
            background: 'color-mix(in srgb, var(--primary-container) 67%, transparent)',
            color: 'var(--on-primary-container)',
          }}
        >
          {club.category}
        </span>
        <span
          className="label-small"
          style={{
            borderRadius: 999,
            padding: '4px 10px',
            background: 'var(--surface-container-high)',
            color: 'var(--on-surface-variant)',
          }}
        >
          {club.visibility === 'APPROVAL_REQUIRED' ? 'Approval' : 'Open'}
        </span>
      </div>
      {club.description ? (
        <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 6 }}>
          {club.description}
        </div>
      ) : null}
      <ClubPendingMembersSection
        clubId={club.id}
        canManage={canPostClubAnnouncement}
        onClubUpdated={onClubUpdated}
      />
      <CommunityHubLinks
        kind="club"
        resourceId={club.id}
        title={club.name}
        canPostAnnouncements={canPostClubAnnouncement}
        clubCanViewGroupChat={clubCanViewGroupChat}
        clubMembershipStatus={club.membershipStatus}
        canViewSupport={clubCanViewChat}
        canPostOrganizer={canPostClubAsOrganizer}
        supportPendingHint={
          club.membershipStatus === 'PENDING'
            ? 'Your group membership is pending. Chat unlocks after approval.'
            : undefined
        }
      />
      {showJoinButton || showLeaveButton ? (
        <button
          type="button"
          onClick={() => (club.joined ? onLeaveClub(club.id) : onJoinClub(club.id))}
          disabled={isLoading || !currentUser}
          style={{
            marginTop: 10,
            borderRadius: 10,
            padding: '9px 0',
            width: '100%',
            background: club.joined ? 'var(--surface-container-high)' : 'var(--primary)',
            color: club.joined ? 'var(--on-surface-variant)' : 'var(--on-primary)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {club.joined ? 'Leave group' : 'Join group'}
        </button>
      ) : null}
      {canDeleteClub ? (
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
          Delete group
        </button>
      ) : null}
    </div>
  );
};

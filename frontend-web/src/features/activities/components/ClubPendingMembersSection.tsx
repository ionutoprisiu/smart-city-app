import React, { useCallback, useState } from 'react';
import { extractErrorMessage } from '@shared/api/errors';
import { Icon } from '@shared/components/Icon';
import { Spinner } from '@shared/components/Spinner';
import { ActivitiesApi } from '../api/activitiesApi';
import { Club, ClubMembershipPending } from '../types';

type Props = {
  clubId: number;
  canManage: boolean;
  onClubUpdated?: (club: Club) => void;
};

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString();
};

export const ClubPendingMembersSection: React.FC<Props> = ({
  clubId,
  canManage,
  onClubUpdated,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ClubMembershipPending[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) {
      setItems([]);
      return;
    }
    setLoading(true);
    setHint(null);
    try {
      const list = await ActivitiesApi.listPendingClubMemberships(clubId);
      setItems(list);
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not load pending requests');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [canManage, clubId]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      load().catch(() => {});
    }
  };

  const onApprove = async (membershipId: number) => {
    setActingId(membershipId);
    setHint(null);
    try {
      const updated = await ActivitiesApi.approveClubMembership(clubId, membershipId);
      setItems((prev) => prev.filter((x) => x.membershipId !== membershipId));
      onClubUpdated?.(updated);
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not approve');
    } finally {
      setActingId(null);
    }
  };

  const onReject = async (membershipId: number) => {
    setActingId(membershipId);
    setHint(null);
    try {
      const updated = await ActivitiesApi.rejectClubMembership(clubId, membershipId);
      setItems((prev) => prev.filter((x) => x.membershipId !== membershipId));
      onClubUpdated?.(updated);
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not reject');
    } finally {
      setActingId(null);
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 0',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <Icon name="group-add" size={18} color="var(--primary)" />
        <span className="label-large" style={{ color: 'var(--primary)', flex: 1 }}>
          Pending group requests{items.length > 0 ? ` (${items.length})` : ''}
        </span>
        <Icon
          name={expanded ? 'expand-less' : 'expand-more'}
          size={22}
          color="var(--on-surface-variant)"
        />
      </button>

      {expanded ? (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? <Spinner size="small" style={{ margin: '8px auto' }} /> : null}
          {hint ? (
            <div className="body-small" style={{ color: 'var(--error)' }}>{hint}</div>
          ) : null}
          {!loading && items.length === 0 && !hint ? (
            <div className="body-small" style={{ color: 'var(--on-surface-variant)' }}>
              No pending requests.
            </div>
          ) : null}
          {items.map((m) => {
            const busy = actingId === m.membershipId;
            const displayName = `${m.userFirstName} ${m.userLastName}`.trim() || m.userEmail;
            return (
              <div
                key={m.membershipId}
                style={{
                  border: '1px solid color-mix(in srgb, var(--outline-variant) 40%, transparent)',
                  borderRadius: 12,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div>
                  <div className="title-small">{displayName}</div>
                  <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 2 }}>
                    {m.userEmail} · {fmtDate(m.joinedAt)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onApprove(m.membershipId)}
                    disabled={busy}
                    style={{
                      flex: 1,
                      borderRadius: 8,
                      padding: '8px 0',
                      background: 'var(--primary-container)',
                      color: 'var(--on-primary-container)',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(m.membershipId)}
                    disabled={busy}
                    style={{
                      flex: 1,
                      borderRadius: 8,
                      padding: '8px 0',
                      background: 'var(--error-container)',
                      color: 'var(--error)',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import { extractErrorMessage } from '@shared/api/errors';
import { Icon } from '@shared/components/Icon';
import { Spinner } from '@shared/components/Spinner';
import { ActivitiesApi } from '../api/activitiesApi';
import { ActivityAnnouncement } from '../types';

type Props = {
  variant?: 'inline' | 'page';
  kind: 'event' | 'club';
  resourceId: number;
  currentUserId?: number;
  canPost: boolean;
  canView?: boolean;
  clubCanView?: boolean;
  clubMembershipStatus?: string | null;
};

const fmtAnnDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const inputStyle: React.CSSProperties = {
  borderRadius: 10,
  padding: '10px 12px',
  marginBottom: 8,
  background: 'var(--surface-container-high)',
  color: 'var(--on-surface)',
  width: '100%',
  fontSize: 14,
};

export const AnnouncementsSection: React.FC<Props> = ({
  variant = 'inline',
  kind,
  resourceId,
  currentUserId,
  canPost,
  canView = true,
  clubCanView = true,
  clubMembershipStatus = null,
}) => {
  const isPage = variant === 'page';
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ActivityAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    if (currentUserId == null) {
      setHint(kind === 'event' ? 'Sign in to see event announcements.' : 'Sign in to see club announcements.');
      setItems([]);
      return;
    }
    if (kind === 'event' && !canView) {
      setHint('Participate in the event to read announcements from the organizer.');
      setItems([]);
      return;
    }
    if (kind === 'club' && !clubCanView) {
      setHint(
        clubMembershipStatus === 'PENDING'
          ? 'Your membership is pending. You will see announcements once an organizer approves you.'
          : 'Join this group and get approved to see organizer announcements.',
      );
      setItems([]);
      return;
    }
    setLoading(true);
    setHint(null);
    try {
      const list =
        kind === 'event'
          ? await ActivitiesApi.listEventAnnouncements(resourceId)
          : await ActivitiesApi.listClubAnnouncements(resourceId);
      setItems(list);
    } catch (e: unknown) {
      const msg = extractErrorMessage(e);
      if (msg.includes('403') || msg.toLowerCase().includes('forbidden')) {
        setHint('You need to be an approved member to read announcements.');
      } else {
        setHint('Could not load announcements.');
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind, resourceId, currentUserId, canView, clubCanView, clubMembershipStatus]);

  useEffect(() => {
    if (isPage) {
      load().catch(() => {});
    }
  }, [isPage, load]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      load().catch(() => {});
    }
  };

  const showBody = isPage || expanded;
  const canSubmit = title.trim().length >= 2 && body.trim().length >= 1;

  const onPost = async () => {
    if (currentUserId == null || !canSubmit) return;
    setPosting(true);
    setHint(null);
    try {
      const created =
        kind === 'event'
          ? await ActivitiesApi.createEventAnnouncement(resourceId, {
              title: title.trim(),
              body: body.trim(),
            })
          : await ActivitiesApi.createClubAnnouncement(resourceId, {
              title: title.trim(),
              body: body.trim(),
            });
      setItems((prev) => [created, ...prev]);
      setTitle('');
      setBody('');
    } catch (e: unknown) {
      setHint(extractErrorMessage(e) || 'Could not post announcement');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{ marginTop: isPage ? 0 : 12 }}>
      {!isPage ? (
        <button
          type="button"
          onClick={toggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 0',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <Icon name="campaign" size={18} color="var(--primary)" />
          <span className="label-large" style={{ color: 'var(--primary)', marginLeft: 8, flex: 1 }}>
            {expanded ? 'Hide announcements' : 'Organizer announcements'}
          </span>
          <Icon
            name={expanded ? 'expand-less' : 'expand-more'}
            size={22}
            color="var(--on-surface-variant)"
          />
        </button>
      ) : null}

      {showBody ? (
        <div style={{ marginTop: 4 }}>
          {loading ? <Spinner size="small" style={{ margin: '8px auto' }} /> : null}
          {hint ? (
            <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginBottom: 8 }}>
              {hint}
            </div>
          ) : null}

          {items.map((a) => (
            <div
              key={`ann-${a.id}`}
              style={{
                border: '1px solid color-mix(in srgb, var(--outline-variant) 30%, transparent)',
                borderRadius: 12,
                padding: 10,
                marginBottom: 8,
                background: 'var(--surface-container-low)',
              }}
            >
              <div className="title-small">{a.title}</div>
              <div className="body-small" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
                {fmtAnnDate(a.createdAt)}
              </div>
              <div className="body-medium" style={{ marginTop: 8 }}>{a.body}</div>
            </div>
          ))}

          {canPost && currentUserId != null ? (
            <div
              style={{
                marginTop: 10,
                paddingTop: 12,
                borderTop: '1px solid color-mix(in srgb, var(--outline-variant) 25%, transparent)',
              }}
            >
              <div
                className="label-medium"
                style={{ color: 'var(--on-surface-variant)', marginBottom: 6 }}
              >
                New announcement
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                style={inputStyle}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message to participants"
                style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
              />
              <button
                type="button"
                onClick={onPost}
                disabled={posting || !canSubmit}
                style={{
                  borderRadius: 10,
                  padding: '11px 0',
                  width: '100%',
                  marginTop: 4,
                  background: canSubmit ? 'var(--primary)' : 'var(--surface-container-high)',
                  color: canSubmit ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

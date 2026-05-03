import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { extractErrorMessage } from '@shared/api/errors';
import { useTheme } from '@theme';
import { ActivitiesApi } from '../api/activitiesApi';
import { ActivityAnnouncement } from '../types';

type Props = {
  kind: 'event' | 'club';
  resourceId: number;
  currentUserId?: number;
  canPost: boolean;
  /** For clubs: user must be an approved member (or global admin) to load announcements from API */
  clubCanView?: boolean;
  /** When set with kind=club, refines the message if the user is waiting for approval */
  clubMembershipStatus?: string | null;
};

const fmtAnnDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export const AnnouncementsSection: React.FC<Props> = ({
  kind,
  resourceId,
  currentUserId,
  canPost,
  clubCanView = true,
  clubMembershipStatus = null,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<ActivityAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    if (kind === 'club' && currentUserId == null) {
      setHint('Sign in to see club announcements.');
      setItems([]);
      return;
    }
    if (kind === 'club' && !clubCanView) {
      setHint(
        clubMembershipStatus === 'PENDING'
          ? 'Your membership is pending. You will see announcements once an organizer approves you.'
          : 'Join this club and get approved to see organizer announcements.',
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
  }, [kind, resourceId, currentUserId, clubCanView, clubMembershipStatus]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      load().catch(() => {});
    }
  };

  const onPost = async () => {
    if (currentUserId == null || title.trim().length < 2 || body.trim().length < 1) return;
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
    <View style={styles.wrap}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.headerRow,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Icon name="campaign" size={18} color={theme.colors.primary} />
        <Text
          style={[
            theme.typography.labelLarge,
            styles.headerTitle,
            { color: theme.colors.primary },
          ]}
        >
          {expanded ? 'Hide announcements' : 'Organizer announcements'}
        </Text>
        <Icon name={expanded ? 'expand-less' : 'expand-more'} size={22} color={theme.colors.onSurfaceVariant} />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}
          {hint ? (
            <Text
              style={[
                theme.typography.bodySmall,
                styles.hintText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {hint}
            </Text>
          ) : null}

          {items.map((a) => (
            <View
              key={`ann-${a.id}`}
              style={[
                styles.annCard,
                {
                  backgroundColor: theme.colors.surfaceContainerLow,
                  borderColor: theme.colors.outlineVariant + '4D',
                },
              ]}
            >
              <Text style={[theme.typography.titleSmall, { color: theme.colors.onSurface }]}>{a.title}</Text>
              <Text
                style={[
                  theme.typography.bodySmall,
                  styles.annDate,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {fmtAnnDate(a.createdAt)}
              </Text>
              <Text
                style={[theme.typography.bodyMedium, styles.annBody, { color: theme.colors.onSurface }]}
              >
                {a.body}
              </Text>
            </View>
          ))}

          {canPost && currentUserId != null ? (
            <View style={[styles.compose, { borderTopColor: theme.colors.outlineVariant + '40' }]}>
              <Text
                style={[
                  theme.typography.labelMedium,
                  styles.composeLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                New announcement
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surfaceContainerHigh,
                    color: theme.colors.onSurface,
                  },
                ]}
              />
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Message to participants"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                multiline
                style={[
                  styles.input,
                  styles.inputMultiline,
                  {
                    backgroundColor: theme.colors.surfaceContainerHigh,
                    color: theme.colors.onSurface,
                  },
                ]}
              />
              <Pressable
                onPress={onPost}
                disabled={posting || title.trim().length < 2 || body.trim().length < 1}
                style={[
                  styles.postBtn,
                  {
                    backgroundColor:
                      title.trim().length >= 2 && body.trim().length >= 1
                        ? theme.colors.primary
                        : theme.colors.surfaceContainerHigh,
                  },
                ]}
              >
                <Text
                  style={[
                    theme.typography.labelLarge,
                    {
                      color:
                        title.trim().length >= 2 && body.trim().length >= 1
                          ? theme.colors.onPrimary
                          : theme.colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {posting ? 'Posting…' : 'Post'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  headerTitle: { marginLeft: 8, flex: 1 },
  hintText: { marginBottom: 8 },
  annDate: { marginTop: 4 },
  annBody: { marginTop: 8 },
  composeLabel: { marginBottom: 6 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  body: { marginTop: 4 },
  loader: { marginVertical: 8 },
  annCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  compose: {
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  postBtn: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
});

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { extractErrorMessage } from '@shared/api/errors';
import { useTheme } from '@theme';
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
  const theme = useTheme();
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
    <View style={styles.wrap}>
      <Pressable onPress={toggle} style={styles.header}>
        <Icon name="group-add" size={18} color={theme.colors.primary} />
        <Text style={[theme.typography.labelLarge, { color: theme.colors.primary, flex: 1 }]}>
          Pending group requests
          {items.length > 0 ? ` (${items.length})` : ''}
        </Text>
        <Icon
          name={expanded ? 'expand-less' : 'expand-more'}
          size={22}
          color={theme.colors.onSurfaceVariant}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
          ) : null}
          {hint ? (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.error }]}>{hint}</Text>
          ) : null}
          {!loading && items.length === 0 && !hint ? (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurfaceVariant }]}>
              No pending requests.
            </Text>
          ) : null}
          {items.map((m) => {
            const busy = actingId === m.membershipId;
            const displayName =
              `${m.userFirstName} ${m.userLastName}`.trim() || m.userEmail;
            return (
              <View
                key={m.membershipId}
                style={[
                  styles.row,
                  { borderColor: theme.colors.outlineVariant + '66' },
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={[theme.typography.titleSmall, { color: theme.colors.onSurface }]}>
                    {displayName}
                  </Text>
                  <Text style={[theme.typography.bodySmall, { color: theme.colors.onSurfaceVariant }]}>
                    {m.userEmail} · {fmtDate(m.joinedAt)}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => onApprove(m.membershipId)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: theme.colors.primaryContainer, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[theme.typography.labelMedium, { color: theme.colors.onPrimaryContainer }]}>
                      Approve
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onReject(m.membershipId)}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: theme.colors.errorContainer, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={[theme.typography.labelMedium, { color: theme.colors.error }]}>
                      Reject
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  body: { marginTop: 6, gap: 8 },
  loader: { marginVertical: 8 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  rowText: { gap: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@theme';
import type { User } from '@shared/types/user';
import { AnnouncementsSection } from './AnnouncementsSection';
import { SupportChatSection } from './SupportChatSection';
import type { ActivitiesCardThemed } from '../activitiesCardThemed';
import type { Club } from '../types';

type Props = {
  club: Club;
  currentUser: User | null;
  isLoading: boolean;
  themed: ActivitiesCardThemed;
  onJoinClub: (clubId: number) => void;
  onLeaveClub: (clubId: number) => void;
};

export const ActivitiesClubCard: React.FC<Props> = ({
  club,
  currentUser,
  isLoading,
  themed,
  onJoinClub,
  onLeaveClub,
}) => {
  const theme = useTheme();
  const clubCanViewAnnouncements = currentUser?.role === 'admin' || club.membershipStatus === 'APPROVED';
  const canPostClubAnnouncement = !!currentUser && club.isClubAdmin;
  const clubCanViewChat = currentUser?.role === 'admin' || club.membershipStatus === 'APPROVED';
  const canPostClubAsOrganizer = !!currentUser && (currentUser.role === 'admin' || club.isClubAdmin);

  return (
    <View style={[styles.card, themed.cardBg]}>
      <Text style={[theme.typography.titleSmall, themed.cardTitle]}>{club.name}</Text>
      <Text style={[theme.typography.bodySmall, themed.cardSub]}>
        {club.membersCount} members • {club.city}
      </Text>
      <View style={styles.clubMetaRow}>
        <View style={[styles.tag, themed.tagBg]}>
          <Text style={[theme.typography.labelSmall, themed.tagText]}>{club.category}</Text>
        </View>
        <View style={[styles.tag, { backgroundColor: theme.colors.surfaceContainerHigh }]}>
          <Text style={[theme.typography.labelSmall, { color: theme.colors.onSurfaceVariant }]}>
            {club.visibility === 'APPROVAL_REQUIRED' ? 'Approval' : 'Open'}
          </Text>
        </View>
      </View>
      {club.description ? (
        <Text style={[theme.typography.bodyMedium, themed.cardSub, styles.cardDescription]}>{club.description}</Text>
      ) : null}
      <AnnouncementsSection
        kind="club"
        resourceId={club.id}
        currentUserId={currentUser?.id}
        canPost={canPostClubAnnouncement}
        clubCanView={clubCanViewAnnouncements}
        clubMembershipStatus={club.membershipStatus}
      />
      <SupportChatSection
        kind="club"
        resourceId={club.id}
        currentUserId={currentUser?.id}
        canView={clubCanViewChat}
        canPostOrganizer={canPostClubAsOrganizer}
        pendingHint={
          club.membershipStatus === 'PENDING'
            ? 'Your club membership is pending. Chat unlocks after approval.'
            : undefined
        }
      />
      <Pressable
        onPress={() => (club.joined ? onLeaveClub(club.id) : onJoinClub(club.id))}
        disabled={isLoading || !currentUser}
        style={[styles.joinBtn, club.joined ? themed.ctaDisabledBg : themed.ctaBg]}
      >
        <Text
          style={[
            theme.typography.labelMedium,
            club.joined ? themed.ctaDisabledText : themed.ctaText,
          ]}
        >
          {club.joined ? 'Leave club' : 'Join club'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 12, borderWidth: 1, padding: 12 },
  clubMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  tag: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardDescription: { marginTop: 6 },
  joinBtn: {
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
});

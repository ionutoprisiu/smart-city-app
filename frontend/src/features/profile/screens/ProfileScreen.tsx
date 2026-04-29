import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme';
import { fullName } from '../../../shared/types/user';
import { roleDisplay } from '../../../shared/types/role';
import { verificationStatusLabel } from '../../../shared/types/verification';
import { AppRootStackParamList } from '../../../app/navigation/types';
import { useAuthStore } from '../../auth/store/authStore';

type Nav = NativeStackNavigationProp<AppRootStackParamList>;

export const ProfileScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { currentUser, logout } = useAuthStore();

  if (!currentUser) return null;

  const initials =
    `${currentUser.firstName[0] ?? ''}${currentUser.lastName[0] ?? ''}`.toUpperCase();

  const handleLogout = () => {
    Alert.alert(
      'Sign out?',
      "You'll need to sign in again to access your profile.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ],
    );
  };

  const themedStyles = {
    rootBg: { backgroundColor: theme.colors.surface },
    contentPad: {
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.medium,
      paddingBottom: theme.spacing.large,
    },
    headerCardBg: {
      backgroundColor: theme.colors.surfaceContainerHighest + '8C',
      borderColor: theme.colors.outlineVariant + '59',
      borderRadius: theme.radius.round,
    },
    avatarRingBorder: { borderColor: theme.colors.primary + '59' },
    avatarBg: { backgroundColor: theme.colors.primaryContainer },
    avatarText: { color: theme.colors.onPrimaryContainer },
    profileName: { color: theme.colors.onSurface, marginTop: theme.spacing.medium },
    profileEmail: { color: theme.colors.onSurfaceVariant, marginTop: 6 },
    roleChipBorder: { borderColor: theme.colors.outlineVariant, marginTop: 12 },
    roleText: { color: theme.colors.onSurface, marginLeft: 6 },
    spacerMedium: { height: theme.spacing.medium },
    spacerXLarge: { height: theme.spacing.xLarge },
    signOutText: { color: theme.colors.error, marginLeft: 8 },
  };

  return (
    <ScrollView
      style={[styles.root, themedStyles.rootBg]}
      contentContainerStyle={themedStyles.contentPad}
    >
      <View
        style={[
          styles.headerCard,
          themedStyles.headerCardBg,
        ]}
      >
        <View
          style={[
            styles.avatarRing,
            themedStyles.avatarRingBorder,
          ]}
        >
          <View
            style={[
              styles.avatar,
              themedStyles.avatarBg,
            ]}
          >
            <Text
              style={[
                theme.typography.headlineSmall,
                themedStyles.avatarText,
              ]}
            >
              {initials}
            </Text>
          </View>
        </View>
        <Text
          style={[
            theme.typography.titleLarge,
            themedStyles.profileName,
          ]}
        >
          {fullName(currentUser)}
        </Text>
        <Text
          style={[
            theme.typography.bodyMedium,
            themedStyles.profileEmail,
          ]}
        >
          {currentUser.email}
        </Text>
        <View
          style={[
            styles.roleChip,
            themedStyles.roleChipBorder,
          ]}
        >
          <Icon
            name={currentUser.role === 'admin' ? 'admin-panel-settings' : 'person'}
            size={18}
            color={theme.colors.primary}
          />
          <Text
            style={[
              theme.typography.labelLarge,
              themedStyles.roleText,
            ]}
          >
            {roleDisplay(currentUser.role)}
          </Text>
        </View>
      </View>

      <Section title="Account">
        <ProfileTile
          icon="person"
          title="Personal information"
          subtitle={`${currentUser.firstName} ${currentUser.lastName}`}
          onPress={() => {}}
        />
        <ProfileTile
          icon="verified-user"
          title="Verification"
          subtitle={verificationStatusLabel(currentUser.verificationStatus)}
          rightIcon={
            currentUser.verificationStatus === 'approved'
              ? 'check-circle'
              : 'pending-actions'
          }
          rightColor={
            currentUser.verificationStatus === 'approved'
              ? theme.colors.primary
              : theme.colors.tertiary
          }
          onPress={() => navigation.navigate('Verification')}
        />
      </Section>

      <View style={themedStyles.spacerMedium} />

      <Section title="About">
        <ProfileTile
          icon="info"
          title="App"
          subtitle="Smart City · Cluj-Napoca · v1.0"
          onPress={() => {}}
        />
      </Section>

      <View style={themedStyles.spacerXLarge} />

      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.signOutButton,
          {
            borderColor: theme.colors.error + '73',
            borderRadius: theme.radius.large,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Icon name="logout" size={20} color={theme.colors.error} />
        <Text
          style={[
            theme.typography.labelLarge,
            themedStyles.signOutText,
          ]}
        >
          Sign out
        </Text>
      </Pressable>
    </ScrollView>
  );
};

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

const Section: React.FC<SectionProps> = ({ title, children }) => {
  const theme = useTheme();
  const themedStyles = {
    sectionTop: { marginTop: theme.spacing.large },
    sectionLabel: {
      color: theme.colors.onSurfaceVariant,
      letterSpacing: 0.8,
      marginLeft: 6,
      marginBottom: 10,
    },
    sectionCard: {
      backgroundColor: theme.colors.surfaceContainerHighest + '8C',
      borderRadius: theme.radius.round,
    },
    divider: { backgroundColor: theme.colors.outline + '1F' },
  };
  return (
    <View style={themedStyles.sectionTop}>
      <Text
        style={[
          theme.typography.labelMedium,
          themedStyles.sectionLabel,
        ]}
      >
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          styles.sectionCard,
          themedStyles.sectionCard,
        ]}
      >
        {React.Children.toArray(children).map((child, idx, all) => (
          <React.Fragment key={idx}>
            {child}
            {idx < all.length - 1 ? (
              <View
                style={[
                  styles.divider,
                  themedStyles.divider,
                ]}
              />
            ) : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

type TileProps = {
  icon: string;
  title: string;
  subtitle: string;
  rightIcon?: string;
  rightColor?: string;
  onPress: () => void;
};

const ProfileTile: React.FC<TileProps> = ({
  icon,
  title,
  subtitle,
  rightIcon,
  rightColor,
  onPress,
}) => {
  const theme = useTheme();
  const themedStyles = {
    tileIconBg: { backgroundColor: theme.colors.primaryContainer + '73' },
    tileContent: { flex: 1, marginLeft: 12 },
    titleText: { color: theme.colors.onSurface },
    subtitleText: { color: theme.colors.onSurfaceVariant, marginTop: 2 },
  };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View
        style={[
          styles.tileIcon,
          themedStyles.tileIconBg,
        ]}
      >
        <Icon name={icon} size={22} color={theme.colors.primary} />
      </View>
      <View style={themedStyles.tileContent}>
        <Text
          style={[
            theme.typography.titleSmall,
            themedStyles.titleText,
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            theme.typography.bodySmall,
            themedStyles.subtitleText,
          ]}
        >
          {subtitle}
        </Text>
      </View>
      <Icon
        name={rightIcon ?? 'chevron-right'}
        size={22}
        color={rightColor ?? theme.colors.outline}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerCard: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
  },
  avatarRing: {
    padding: 3,
    borderWidth: 2,
    borderRadius: 50,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionCard: {
    overflow: 'hidden',
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginLeft: 56,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1.5,
  },
});

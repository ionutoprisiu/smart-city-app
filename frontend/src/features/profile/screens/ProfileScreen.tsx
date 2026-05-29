import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImagePickerResponse, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AppRootStackParamList } from '@app/navigation/types';
import { StorageService } from '@shared/storage/storageService';
import { fullName } from '@shared/types/user';
import { roleDisplay } from '@shared/types/role';
import { verificationStatusLabel } from '@shared/types/verification';
import { useTheme } from '@theme';
import { useAuthStore } from '@features/auth/store/authStore';

type Nav = NativeStackNavigationProp<AppRootStackParamList>;

const verificationTone = (
  status: string,
  colors: ReturnType<typeof useTheme>['colors'],
) => {
  if (status === 'approved') {
    return {
      icon: 'check-circle',
      color: colors.primary,
      bg: colors.primaryContainer + '66',
    };
  }
  if (status === 'rejected') {
    return {
      icon: 'cancel',
      color: colors.error,
      bg: colors.errorContainer + '66',
    };
  }
  return {
    icon: 'pending-actions',
    color: colors.tertiary,
    bg: colors.surfaceContainerHigh,
  };
};

export const ProfileScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { currentUser, logout } = useAuthStore();
  const setAuthState = useAuthStore.setState;

  if (!currentUser) return null;

  const initials =
    `${currentUser.firstName[0] ?? ''}${currentUser.lastName[0] ?? ''}`.toUpperCase();

  const updateProfilePhoto = async (uri: string | null) => {
    if (uri) {
      await StorageService.saveUserProfilePhotoUri(uri);
    } else {
      await StorageService.clearUserProfilePhotoUri();
    }
    setAuthState({
      currentUser: {
        ...currentUser,
        profilePhotoUri: uri,
      },
    });
  };

  const handlePickerResponse = async (res: ImagePickerResponse) => {
    if (res.didCancel) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) {
      Alert.alert('No image selected', 'Please choose another image.');
      return;
    }
    await updateProfilePhoto(uri);
  };

  const chooseFromGallery = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });
    await handlePickerResponse(res);
  };

  const takePhoto = async () => {
    const res = await launchCamera({
      mediaType: 'photo',
      cameraType: 'front',
      saveToPhotos: false,
    });
    await handlePickerResponse(res);
  };

  const openPhotoActions = () => {
    Alert.alert('Profile photo', 'Choose an action', [
      {
        text: 'Take photo',
        onPress: () => {
          takePhoto().catch(() => {});
        },
      },
      {
        text: 'Choose from gallery',
        onPress: () => {
          chooseFromGallery().catch(() => {});
        },
      },
      ...(currentUser.profilePhotoUri
        ? [
            {
              text: 'Remove photo',
              style: 'destructive' as const,
              onPress: () => {
                updateProfilePhoto(null).catch(() => {});
              },
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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

  const vTone = verificationTone(currentUser.verificationStatus, theme.colors);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.colors.surface }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: theme.spacing.screen,
          paddingTop: theme.spacing.medium,
          paddingBottom: theme.spacing.large,
        },
      ]}
    >
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: theme.colors.surfaceContainerHighest + '8C',
            borderColor: theme.colors.outlineVariant + '59',
            borderRadius: theme.radius.round,
          },
        ]}
      >
        <Pressable
          onPress={openPhotoActions}
          style={[styles.avatarRing, { borderColor: theme.colors.primary + '59' }]}
        >
          {currentUser.profilePhotoUri ? (
            <Image source={{ uri: currentUser.profilePhotoUri }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: theme.colors.primaryContainer }]}>
              <Text style={[theme.typography.headlineSmall, { color: theme.colors.onPrimaryContainer }]}>
                {initials}
              </Text>
            </View>
          )}
          <View style={[styles.avatarEditBadge, { backgroundColor: theme.colors.primary }]}>
            <Icon name="photo-camera" size={14} color={theme.colors.onPrimary} />
          </View>
        </Pressable>

        <Text style={[theme.typography.titleLarge, { color: theme.colors.onSurface, marginTop: theme.spacing.medium }]}>
          {fullName(currentUser)}
        </Text>
        <Text
          style={[
            theme.typography.bodyMedium,
            styles.emailSubtitle,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {currentUser.email}
        </Text>

        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { borderColor: theme.colors.outlineVariant }]}>
            <Icon
              name={currentUser.role === 'admin' ? 'admin-panel-settings' : 'person'}
              size={16}
              color={theme.colors.primary}
            />
            <Text
              style={[
                theme.typography.labelMedium,
                styles.metaChipLabel,
                { color: theme.colors.onSurface },
              ]}
            >
              {roleDisplay(currentUser.role)}
            </Text>
          </View>
          <View style={[styles.metaChip, styles.metaChipVerification, { backgroundColor: vTone.bg }]}>
            <Icon name={vTone.icon} size={16} color={vTone.color} />
            <Text style={[theme.typography.labelMedium, styles.metaChipLabel, { color: vTone.color }]}>
              {verificationStatusLabel(currentUser.verificationStatus)}
            </Text>
          </View>
        </View>
      </View>

      <Section title="Account">
        <ProfileTile
          icon="photo-camera"
          title="Profile photo"
          subtitle={currentUser.profilePhotoUri ? 'Tap to update or remove photo' : 'Add a profile photo'}
          onPress={openPhotoActions}
        />
        <ProfileTile
          icon="verified-user"
          title="Become an organizer"
          subtitle={verificationStatusLabel(currentUser.verificationStatus)}
          rightIcon={vTone.icon}
          rightColor={vTone.color}
          onPress={() => navigation.navigate('BecomeOrganizer')}
        />
      </Section>

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
        <Text style={[theme.typography.labelLarge, styles.signOutLabel, { color: theme.colors.error }]}>
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
  const sectionOuterStyle = useMemo(() => ({ marginTop: theme.spacing.large }), [theme]);
  const sectionTitleStyle = useMemo(
    () => [
      theme.typography.labelMedium,
      {
        color: theme.colors.onSurfaceVariant,
        letterSpacing: 0.8,
        marginLeft: 6,
        marginBottom: 10,
      },
    ],
    [theme],
  );
  const sectionCardStyle = useMemo(
    () => [
      styles.sectionCard,
      {
        backgroundColor: theme.colors.surfaceContainerHighest + '8C',
        borderRadius: theme.radius.round,
      },
    ],
    [theme],
  );
  const dividerTintStyle = useMemo(
    () => ({ backgroundColor: theme.colors.outline + '1F' }),
    [theme],
  );
  return (
    <View style={sectionOuterStyle}>
      <Text style={sectionTitleStyle}>{title.toUpperCase()}</Text>
      <View style={sectionCardStyle}>
        {React.Children.toArray(children).map((child, idx, all) => (
          <React.Fragment key={idx}>
            {child}
            {idx < all.length - 1 ? (
              <View style={[styles.divider, dividerTintStyle]} />
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: theme.colors.primaryContainer + '73' }]}>
        <Icon name={icon} size={22} color={theme.colors.primary} />
      </View>
      <View style={styles.tileContent}>
        <Text style={[theme.typography.titleSmall, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        <Text
          style={[
            theme.typography.bodySmall,
            styles.tileSubtitle,
            { color: theme.colors.onSurfaceVariant },
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
  content: {
    paddingBottom: 24,
  },
  headerCard: {
    alignItems: 'center',
    padding: 24,
    borderWidth: 1,
  },
  avatarRing: {
    width: 96,
    height: 96,
    padding: 3,
    borderWidth: 2,
    borderRadius: 48,
  },
  avatarFallback: {
    flex: 1,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 44,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  metaChip: {
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
  tileContent: {
    flex: 1,
    marginLeft: 12,
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
    marginTop: 28,
  },
  emailSubtitle: {
    marginTop: 6,
  },
  metaChipLabel: {
    marginLeft: 6,
  },
  metaChipVerification: {
    borderColor: 'transparent',
  },
  signOutLabel: {
    marginLeft: 8,
  },
  tileSubtitle: {
    marginTop: 2,
  },
});

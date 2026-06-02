import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AppButton } from '@shared/components/AppButton';
import { ErrorMessage } from '@shared/components/ErrorMessage';
import { LoadingOverlay } from '@shared/components/LoadingOverlay';
import { useTheme } from '@theme';
import {
  VerificationStatus,
  verificationStatusLabel,
} from '@shared/types/verification';
import { AppRootStackParamList } from '@app/navigation/types';
import { useAuthStore } from '@features/auth/store/authStore';

type Nav = NativeStackNavigationProp<AppRootStackParamList, 'BecomeOrganizer'>;

type PickedImage = {
  uri: string;
  fileName?: string;
  mime?: string;
};

const PICKER_LIMITS = {
  mediaType: 'photo' as const,
  quality: 0.7 as const,
  maxWidth: 1280,
  maxHeight: 1280,
  includeBase64: false,
};

const fileFromResponse = (response: ImagePickerResponse): PickedImage | null => {
  const asset = response?.assets?.[0];
  if (!asset || !asset.uri) return null;
  return { uri: asset.uri, fileName: asset.fileName, mime: asset.type };
};

export const VerificationScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const {
    currentUser,
    isLoading,
    errorMessage,
    verificationScore,
    verificationReason,
    verificationCanSubmit,
    verificationBlockedReason,
    refreshVerificationStatus,
    submitVerification,
  } = useAuthStore();

  const [idCardImage, setIdCardImage] = useState<PickedImage | null>(null);
  const [selfieImage, setSelfieImage] = useState<PickedImage | null>(null);

  const status: VerificationStatus = currentUser?.verificationStatus ?? 'notSubmitted';
  const uploadLocked = !verificationCanSubmit;

  useEffect(() => {
    refreshVerificationStatus();
  }, [refreshVerificationStatus]);

  const guardUpload = () => {
    if (!uploadLocked) return true;
    Alert.alert('Upload locked', verificationBlockedReason ?? 'You cannot upload new photos right now.');
    return false;
  };

  const showSourcePicker = (kind: 'idCard' | 'selfie') => {
    if (!guardUpload()) return;
    Alert.alert(
      kind === 'idCard' ? 'ID card image' : 'Selfie image',
      'Choose source',
      [
        { text: 'Camera', onPress: () => captureFromCamera(kind) },
        { text: 'Gallery', onPress: () => pickFromGallery(kind) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const captureFromCamera = async (kind: 'idCard' | 'selfie') => {
    if (!guardUpload()) return;
    const response = await launchCamera({
      ...PICKER_LIMITS,
      cameraType: kind === 'selfie' ? 'front' : 'back',
      saveToPhotos: false,
    });
    const file = fileFromResponse(response);
    if (!file) return;
    if (kind === 'idCard') setIdCardImage(file);
    else setSelfieImage(file);
  };

  const pickFromGallery = async (kind: 'idCard' | 'selfie') => {
    if (!guardUpload()) return;
    const response = await launchImageLibrary(PICKER_LIMITS);
    const file = fileFromResponse(response);
    if (!file) return;
    if (kind === 'idCard') setIdCardImage(file);
    else setSelfieImage(file);
  };

  const submit = async () => {
    if (uploadLocked || idCardImage == null || selfieImage == null) return;
    const ok = await submitVerification({ idCardImage, selfieImage });
    if (ok) {
      setIdCardImage(null);
      setSelfieImage(null);
      Alert.alert(
        'Documents submitted',
        'Your ID and selfie were sent for review. You cannot upload again until an admin responds.',
      );
      navigation.goBack();
    }
  };

  const statusColor = (() => {
    switch (status) {
      case 'approved':
        return theme.colors.primary;
      case 'rejected':
        return theme.colors.error;
      case 'manualReview':
      case 'pending':
        return theme.colors.tertiary;
      case 'notSubmitted':
      default:
        return theme.colors.onSurfaceVariant;
    }
  })();

  const lockedOpacity = uploadLocked ? 0.45 : 1;

  const themedStyles = {
    rootBg: { backgroundColor: theme.colors.surface },
    contentPad: { padding: theme.spacing.screen },
    introText: { color: theme.colors.onSurface },
    statusText: { color: statusColor, marginTop: 8 },
    lockedText: { color: theme.colors.onSurfaceVariant, marginTop: 8 },
    spacer18: { height: 18 },
    spacer12: { height: 12 },
    analysisCard: {
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerHighest + '66',
    },
    analysisTitle: { color: theme.colors.onSurface },
    analysisValue: { color: theme.colors.onSurface },
    spacer8: { height: 8 },
    spacer16: { height: 16 },
    spacer10: { height: 10 },
  };

  return (
    <View style={[styles.root, themedStyles.rootBg]}>
      <LoadingOverlay isLoading={isLoading}>
        <ScrollView
          contentContainerStyle={themedStyles.contentPad}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[theme.typography.titleMedium, themedStyles.introText]}>
            To become an organizer, upload your ID card and a matching selfie. After admin approval, use Activities → Become organizer.
          </Text>
          <Text style={[theme.typography.bodyMedium, themedStyles.statusText]}>
            Status: {verificationStatusLabel(status)}
          </Text>
          {uploadLocked && verificationBlockedReason ? (
            <Text style={[theme.typography.bodyMedium, themedStyles.lockedText]}>
              {verificationBlockedReason}
            </Text>
          ) : null}

          <View style={themedStyles.spacer18} />
          <View style={{ opacity: lockedOpacity }}>
            <ImagePickCard
              title="ID card image"
              file={idCardImage}
              disabled={uploadLocked}
              onPickFromGallery={() => pickFromGallery('idCard')}
              onCaptureFromCamera={() => showSourcePicker('idCard')}
            />
            <View style={themedStyles.spacer12} />
            <ImagePickCard
              title="Selfie image"
              file={selfieImage}
              disabled={uploadLocked}
              onPickFromGallery={() => pickFromGallery('selfie')}
              onCaptureFromCamera={() => showSourcePicker('selfie')}
            />
          </View>

          <View style={themedStyles.spacer12} />
          {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

          {verificationReason || verificationScore != null ? (
            <View style={[styles.analysisCard, themedStyles.analysisCard]}>
              <Text style={[theme.typography.titleSmall, themedStyles.analysisTitle]}>
                Analysis details
              </Text>
              <View style={themedStyles.spacer8} />
              {verificationScore != null ? (
                <Text style={[theme.typography.bodyMedium, themedStyles.analysisValue]}>
                  Score: {verificationScore.toFixed(3)}
                </Text>
              ) : null}
              {verificationReason ? (
                <Text style={[theme.typography.bodyMedium, themedStyles.analysisValue]}>
                  Reason: {verificationReason}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={themedStyles.spacer16} />
          <AppButton
            label="Refresh analysis data"
            variant="outlined"
            iconName="refresh"
            disabled={isLoading}
            onPress={() => refreshVerificationStatus()}
          />
          <View style={themedStyles.spacer10} />
          <AppButton
            label="Submit for organizer review"
            iconName="verified-user"
            disabled={uploadLocked || !idCardImage || !selfieImage || isLoading}
            onPress={submit}
          />
        </ScrollView>
      </LoadingOverlay>
    </View>
  );
};

type ImagePickCardProps = {
  title: string;
  file: PickedImage | null;
  disabled?: boolean;
  onPickFromGallery: () => void;
  onCaptureFromCamera: () => void;
};

const ImagePickCard: React.FC<ImagePickCardProps> = ({
  title,
  file,
  disabled = false,
  onPickFromGallery,
  onCaptureFromCamera,
}) => {
  const theme = useTheme();
  const iconColor = disabled ? theme.colors.outline : theme.colors.onSurfaceVariant;
  const galleryColor = disabled ? theme.colors.outline : theme.colors.primary;

  const themedStyles = {
    cardBorder: {
      borderColor: disabled ? theme.colors.outlineVariant : theme.colors.outlineVariant,
      backgroundColor: disabled ? theme.colors.surfaceContainerHighest + '44' : 'transparent',
    },
    fileNameText: { color: disabled ? theme.colors.outline : theme.colors.onSurface, flex: 1 },
    galleryText: { color: galleryColor },
  };

  return (
    <View style={[styles.imageCard, themedStyles.cardBorder]}>
      {file?.uri ? (
        <Image source={{ uri: file.uri }} style={styles.preview} />
      ) : null}
      <View style={styles.imageRow}>
        <Text
          style={[theme.typography.bodyMedium, themedStyles.fileNameText]}
          numberOfLines={1}
        >
          {file == null
            ? `${title} (not selected)`
            : (file.fileName ?? file.uri.split('/').pop() ?? title)}
        </Text>
        <Pressable
          onPress={disabled ? undefined : onCaptureFromCamera}
          disabled={disabled}
          hitSlop={8}
          style={({ pressed }) => ({
            padding: 8,
            opacity: disabled ? 1 : pressed ? 0.7 : 1,
          })}
        >
          <Icon name="photo-camera" size={22} color={iconColor} />
        </Pressable>
        <Pressable
          onPress={disabled ? undefined : onPickFromGallery}
          disabled={disabled}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 8,
            opacity: disabled ? 1 : pressed ? 0.7 : 1,
          })}
        >
          <Text style={[theme.typography.labelLarge, themedStyles.galleryText]}>
            Gallery
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  imageCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 10,
    resizeMode: 'cover',
  },
  analysisCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
});

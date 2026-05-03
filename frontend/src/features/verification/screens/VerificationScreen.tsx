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

type Nav = NativeStackNavigationProp<AppRootStackParamList, 'Verification'>;

type PickedImage = {
  uri: string;
  fileName?: string;
  mime?: string;
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
    verificationOcrData,
    refreshVerificationStatus,
    submitVerification,
  } = useAuthStore();

  const [idCardImage, setIdCardImage] = useState<PickedImage | null>(null);
  const [selfieImage, setSelfieImage] = useState<PickedImage | null>(null);

  const status: VerificationStatus = currentUser?.verificationStatus ?? 'notSubmitted';

  useEffect(() => {
    refreshVerificationStatus();
  }, [refreshVerificationStatus]);

  const showSourcePicker = (kind: 'idCard' | 'selfie') => {
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
    const response = await launchCamera({
      mediaType: 'photo',
      cameraType: kind === 'selfie' ? 'front' : 'back',
      quality: 0.8,
      saveToPhotos: false,
    });
    const file = fileFromResponse(response);
    if (!file) return;
    if (kind === 'idCard') setIdCardImage(file);
    else setSelfieImage(file);
  };

  const pickFromGallery = async (kind: 'idCard' | 'selfie') => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });
    const file = fileFromResponse(response);
    if (!file) return;
    if (kind === 'idCard') setIdCardImage(file);
    else setSelfieImage(file);
  };

  const submit = async () => {
    if (idCardImage == null || selfieImage == null) return;
    const ok = await submitVerification({ idCardImage, selfieImage });
    if (ok) {
      Alert.alert('Verification submitted', 'Verification request submitted.');
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

  const cnp = verificationOcrData?.cnp ? String(verificationOcrData.cnp) : null;
  const serial = verificationOcrData?.serial ? String(verificationOcrData.serial) : null;
  const preview = verificationOcrData?.rawTextPreview
    ? String(verificationOcrData.rawTextPreview)
    : null;

  const maskCnp = (value: string) => {
    if (value.length < 6) return value;
    return `${value.slice(0, 2)}********${value.slice(-4)}`;
  };

  const themedStyles = {
    rootBg: { backgroundColor: theme.colors.surface },
    contentPad: { padding: theme.spacing.screen },
    introText: { color: theme.colors.onSurface },
    statusText: { color: statusColor, marginTop: 8 },
    spacer18: { height: 18 },
    spacer12: { height: 12 },
    analysisCard: {
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerHighest + '66',
    },
    analysisTitle: { color: theme.colors.onSurface },
    analysisValue: { color: theme.colors.onSurface },
    analysisPreview: { color: theme.colors.onSurfaceVariant, marginTop: 6 },
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
          <Text
            style={[
              theme.typography.titleMedium,
              themedStyles.introText,
            ]}
          >
            Upload your ID card and a selfie.
          </Text>
          <Text
            style={[
              theme.typography.bodyMedium,
              themedStyles.statusText,
            ]}
          >
            Status: {verificationStatusLabel(status)}
          </Text>

          <View style={themedStyles.spacer18} />
          <ImagePickCard
            title="ID card image"
            file={idCardImage}
            onPickFromGallery={() => pickFromGallery('idCard')}
            onCaptureFromCamera={() => showSourcePicker('idCard')}
          />
          <View style={themedStyles.spacer12} />
          <ImagePickCard
            title="Selfie image"
            file={selfieImage}
            onPickFromGallery={() => pickFromGallery('selfie')}
            onCaptureFromCamera={() => showSourcePicker('selfie')}
          />

          <View style={themedStyles.spacer12} />
          {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

          {verificationReason || verificationScore != null ? (
            <View
              style={[
                styles.analysisCard,
                themedStyles.analysisCard,
              ]}
            >
              <Text
                style={[
                  theme.typography.titleSmall,
                  themedStyles.analysisTitle,
                ]}
              >
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
              {cnp ? (
                <Text style={[theme.typography.bodyMedium, themedStyles.analysisValue]}>
                  Detected CNP: {maskCnp(cnp)}
                </Text>
              ) : null}
              {serial ? (
                <Text style={[theme.typography.bodyMedium, themedStyles.analysisValue]}>
                  Detected serial: {serial}
                </Text>
              ) : null}
              {preview ? (
                <Text
                  style={[
                    theme.typography.bodySmall,
                    themedStyles.analysisPreview,
                  ]}
                  numberOfLines={3}
                >
                  OCR preview: {preview}
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
            label="Submit verification"
            iconName="verified-user"
            disabled={!idCardImage || !selfieImage || isLoading}
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
  onPickFromGallery: () => void;
  onCaptureFromCamera: () => void;
};

const ImagePickCard: React.FC<ImagePickCardProps> = ({
  title,
  file,
  onPickFromGallery,
  onCaptureFromCamera,
}) => {
  const theme = useTheme();
  const themedStyles = {
    cardBorder: { borderColor: theme.colors.outlineVariant },
    fileNameText: { color: theme.colors.onSurface, flex: 1 },
    galleryText: { color: theme.colors.primary },
  };
  return (
    <View
      style={[
        styles.imageCard,
        themedStyles.cardBorder,
      ]}
    >
      {file?.uri ? (
        <Image source={{ uri: file.uri }} style={styles.preview} />
      ) : null}
      <View style={styles.imageRow}>
        <Text
          style={[
            theme.typography.bodyMedium,
            themedStyles.fileNameText,
          ]}
          numberOfLines={1}
        >
          {file == null
            ? `${title} (not selected)`
            : (file.fileName ?? file.uri.split('/').pop() ?? title)}
        </Text>
        <Pressable
          onPress={onCaptureFromCamera}
          hitSlop={8}
          style={({ pressed }) => ({
            padding: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon
            name="photo-camera"
            size={22}
            color={theme.colors.onSurfaceVariant}
          />
        </Pressable>
        <Pressable
          onPress={onPickFromGallery}
          style={({ pressed }) => ({
            paddingHorizontal: 12,
            paddingVertical: 8,
            opacity: pressed ? 0.7 : 1,
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

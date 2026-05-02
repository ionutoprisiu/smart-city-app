import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ActivitiesStackParamList } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { ErrorMessage } from '../../../shared/components/ErrorMessage';
import { useTheme } from '../../../theme';
import { useAuthStore } from '../../auth/store/authStore';
import { ActivitiesApi } from '../api/activitiesApi';
import { ACTIVITIES_CITY } from '../constants';

type Nav = NativeStackNavigationProp<ActivitiesStackParamList, 'CreateClub'>;

const CLUB_CATEGORIES = ['OTHER', 'CULTURE', 'SPORTS', 'MUSIC', 'TECH', 'OUTDOORS'] as const;

type ClubVisibility = 'PUBLIC' | 'APPROVAL_REQUIRED';

export const CreateClubScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('OTHER');
  const [visibility, setVisibility] = useState<ClubVisibility>('PUBLIC');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const themedStyles = useMemo(
    () => ({
      inputBg: { backgroundColor: theme.colors.surfaceContainerLow },
      inputText: { color: theme.colors.onSurface },
      placeholder: theme.colors.onSurfaceVariant,
      label: { color: theme.colors.onSurfaceVariant },
      sectionTitle: { color: theme.colors.onSurface },
      chipActive: { backgroundColor: theme.colors.primaryContainer },
      chipInactive: { backgroundColor: theme.colors.surfaceContainerHigh },
      chipTextActive: { color: theme.colors.onPrimaryContainer },
      chipTextInactive: { color: theme.colors.onSurfaceVariant },
      visibilityBox: { backgroundColor: theme.colors.surfaceContainerLow, borderRadius: 12, padding: 4 },
    }),
    [theme],
  );

  const onSubmit = async () => {
    if (!currentUser) return;
    setErrorMessage(null);
    const n = name.trim();
    if (n.length < 3) {
      setErrorMessage('Club name must be at least 3 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ActivitiesApi.createClub({
        creatorUserId: currentUser.id,
        name: n,
        description: description.trim() || undefined,
        category,
        visibility,
      });
      navigation.goBack();
    } catch (e: unknown) {
      setErrorMessage(String((e as { message?: string })?.message ?? e ?? 'Could not create club'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.colors.surface }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

      <Text style={[theme.typography.titleSmall, themedStyles.sectionTitle]}>Club profile</Text>
      <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Urban sketchers Cluj"
        placeholderTextColor={themedStyles.placeholder}
        style={[styles.input, themedStyles.inputBg, themedStyles.inputText]}
      />
      <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="What is this club about?"
        placeholderTextColor={themedStyles.placeholder}
        multiline
        style={[styles.input, styles.inputMultiline, themedStyles.inputBg, themedStyles.inputText]}
      />

      <Text style={[theme.typography.labelMedium, themedStyles.label, styles.label]}>Category</Text>
      <View style={styles.chipWrap}>
        {CLUB_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c ? themedStyles.chipActive : themedStyles.chipInactive]}
          >
            <Text
              style={[
                theme.typography.labelMedium,
                category === c ? themedStyles.chipTextActive : themedStyles.chipTextInactive,
              ]}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.cityPill, themedStyles.inputBg, styles.cityPillMargin]}>
        <Text style={[theme.typography.labelMedium, themedStyles.inputText]}>City</Text>
        <Text style={[theme.typography.bodyMedium, themedStyles.inputText, styles.cityPillValue]}>
          {ACTIVITIES_CITY}
        </Text>
      </View>
      <Text style={[theme.typography.bodySmall, themedStyles.label, styles.cityHint]}>
        Clubs are only created for Cluj-Napoca.
      </Text>

      <Text style={[theme.typography.titleSmall, themedStyles.sectionTitle, styles.sectionSpacer]}>
        Membership
      </Text>
      <Text style={[theme.typography.bodySmall, themedStyles.label, styles.hint]}>
        Open clubs let anyone join instantly. Approval clubs require organizer review.
      </Text>
      <View style={[styles.visibilityRow, themedStyles.visibilityBox]}>
        <Pressable
          onPress={() => setVisibility('PUBLIC')}
          style={[
            styles.visibilityBtn,
            visibility === 'PUBLIC' ? themedStyles.chipActive : themedStyles.chipInactive,
          ]}
        >
          <Text
            style={[
              theme.typography.labelLarge,
              visibility === 'PUBLIC' ? themedStyles.chipTextActive : themedStyles.chipTextInactive,
            ]}
          >
            Open join
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setVisibility('APPROVAL_REQUIRED')}
          style={[
            styles.visibilityBtn,
            visibility === 'APPROVAL_REQUIRED' ? themedStyles.chipActive : themedStyles.chipInactive,
          ]}
        >
          <Text
            style={[
              theme.typography.labelLarge,
              visibility === 'APPROVAL_REQUIRED' ? themedStyles.chipTextActive : themedStyles.chipTextInactive,
            ]}
          >
            Approval required
          </Text>
        </Pressable>
      </View>

      <AppButton
        label="Create club"
        onPress={onSubmit}
        loading={isSubmitting}
        disabled={!currentUser}
        style={styles.submit}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  label: { marginTop: 10, marginBottom: 4 },
  hint: { marginBottom: 8 },
  sectionSpacer: { marginTop: 18 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  visibilityRow: { flexDirection: 'row', gap: 6 },
  visibilityBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cityPill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityPillMargin: { marginTop: 6 },
  cityPillValue: { fontWeight: '600' },
  cityHint: { marginTop: 6 },
  submit: { marginTop: 22 },
});

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@theme';
import { PreferencesForm } from '../components/PreferencesForm';
import { usePreferencesStore } from '../store/preferencesStore';

export const OnboardingScreen: React.FC = () => {
  const theme = useTheme();
  const { categories, isSaving, save } = usePreferencesStore();

  const handleSubmit = (selected: string[]) => {
    save(selected).catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: theme.spacing.screen,
            paddingVertical: theme.spacing.large,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.heroIcon,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <Icon name="interests" size={36} color={theme.colors.primary} />
        </View>

        <View style={{ height: theme.spacing.large }} />
        <Text
          style={[
            theme.typography.headlineSmall,
            { color: theme.colors.onSurface, textAlign: 'center' },
          ]}
        >
          What do you love to explore?
        </Text>
        <Text
          style={[
            theme.typography.bodyMedium,
            styles.subtitle,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Pick what interests you and tap in order of priority. We'll tailor the
          attractions in Cluj to match.
        </Text>

        <View style={{ height: theme.spacing.xLarge }} />
        <PreferencesForm
          initialCategories={categories}
          submitLabel="Continue"
          isSaving={isSaving}
          onSubmit={handleSubmit}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  heroIcon: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: 8,
  },
});

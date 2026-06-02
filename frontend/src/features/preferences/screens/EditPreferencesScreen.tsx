import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppRootStackParamList } from '@app/navigation/types';
import { useTheme } from '@theme';
import { useVisitCityStore } from '@features/visit-city/store/visitCityStore';
import { PreferencesForm } from '../components/PreferencesForm';
import { usePreferencesStore } from '../store/preferencesStore';

type Nav = NativeStackNavigationProp<AppRootStackParamList>;

export const EditPreferencesScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { categories, isSaving, save } = usePreferencesStore();
  const reloadAttractions = useVisitCityStore((s) => s.loadAttractions);

  const handleSubmit = async (selected: string[]) => {
    const ok = await save(selected);
    if (ok) {
      reloadAttractions().catch(() => {});
      navigation.goBack();
    }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.colors.surface }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: theme.spacing.screen,
          paddingVertical: theme.spacing.large,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={[theme.typography.bodyMedium, { color: theme.colors.onSurfaceVariant }]}
      >
        Choose the kinds of places you want to see more of. Tap in the order you
        care about most — your list updates to match.
      </Text>
      <View style={{ height: theme.spacing.large }} />
      <PreferencesForm
        initialCategories={categories}
        submitLabel="Save preferences"
        isSaving={isSaving}
        onSubmit={handleSubmit}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
});

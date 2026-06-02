import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@shared/components/AppButton';
import { useTheme } from '@theme';
import {
  AttractionCategory,
  categoryIcon,
  categoryLabel,
} from '@features/visit-city/types';

// Categories offered in the questionnaire (mirrors backend SELECTABLE_CATEGORIES).
export const PREFERENCE_CATEGORIES: AttractionCategory[] = [
  'museum',
  'monument',
  'church',
  'park',
  'theater',
  'square',
  'fortress',
  'library',
  'restaurant',
  'cafe',
  'shop',
];

type Props = {
  initialCategories: string[];
  submitLabel: string;
  isSaving?: boolean;
  onSubmit: (categories: string[]) => void;
};

export const PreferencesForm: React.FC<Props> = ({
  initialCategories,
  submitLabel,
  isSaving = false,
  onSubmit,
}) => {
  const theme = useTheme();
  const [selected, setSelected] = useState<AttractionCategory[]>(
    initialCategories.filter((c) =>
      PREFERENCE_CATEGORIES.includes(c as AttractionCategory),
    ) as AttractionCategory[],
  );

  const toggle = (category: AttractionCategory) => {
    setSelected((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  return (
    <View>
      <View style={styles.chipsWrap}>
        {PREFERENCE_CATEGORIES.map((category) => {
          const order = selected.indexOf(category);
          const isSelected = order >= 0;
          return (
            <Pressable
              key={category}
              onPress={() => toggle(category)}
              style={[
                styles.chip,
                {
                  borderRadius: theme.radius.large,
                  borderColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.outlineVariant,
                  backgroundColor: isSelected
                    ? theme.colors.primaryContainer
                    : theme.colors.surfaceContainerLow,
                },
              ]}
            >
              {isSelected ? (
                <View
                  style={[
                    styles.orderBadge,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      { color: theme.colors.onPrimary },
                    ]}
                  >
                    {order + 1}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.chipIcon}>{categoryIcon(category)}</Text>
              <Text
                style={[
                  theme.typography.labelLarge,
                  {
                    color: isSelected
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurface,
                  },
                ]}
              >
                {categoryLabel(category)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: theme.spacing.large }} />
      <AppButton
        label={submitLabel}
        onPress={() => onSubmit(selected)}
        loading={isSaving}
        disabled={selected.length === 0 || isSaving}
      />
      {selected.length === 0 ? (
        <Text
          style={[
            theme.typography.bodySmall,
            styles.hint,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          Pick at least one — tap in the order you care about most.
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  chipIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  orderBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  hint: {
    textAlign: 'center',
    marginTop: 10,
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@theme';
import { Attraction, categoryIcon, categoryLabel } from '../types';

type Props = {
  attraction: Attraction;
  isSelected: boolean;
  onToggleSelection: () => void;
  onPress: () => void;
};

export const AttractionCard: React.FC<Props> = ({
  attraction,
  isSelected,
  onToggleSelection,
  onPress,
}) => {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: isSelected
            ? theme.colors.primaryContainer + '66'
            : theme.colors.surfaceContainerHighest,
          borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant + '80',
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: theme.colors.primaryContainer + '99' },
        ]}
      >
        <Text style={styles.iconEmoji}>{categoryIcon(attraction.category)}</Text>
      </View>

      <View style={styles.body}>
        <Text
          style={[theme.typography.titleSmall, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {attraction.name}
        </Text>
        <Text
          style={[
            theme.typography.labelMedium,
            { color: theme.colors.onSurfaceVariant, marginTop: 2 },
          ]}
          numberOfLines={1}
        >
          {categoryLabel(attraction.category)}
        </Text>
      </View>

      <Pressable
        onPress={onToggleSelection}
        hitSlop={6}
        style={({ pressed }) => [
          styles.selectButton,
          {
            backgroundColor: isSelected
              ? theme.colors.primary
              : theme.colors.surfaceContainerLow,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Icon
          name={isSelected ? 'check' : 'add'}
          size={18}
          color={isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
        />
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 22,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  selectButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});

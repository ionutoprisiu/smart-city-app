import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AddressService } from '../../../shared/services/addressService';
import { useTheme } from '../../../theme';
import { Attraction, categoryIcon } from '../types';

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
  const [street, setStreet] = useState('Loading street...');
  const themedStyles = {
    cardBg: {
      backgroundColor: isSelected
        ? theme.colors.primaryContainer + '8C'
        : theme.colors.surfaceContainerHighest + '8C',
      borderRadius: theme.radius.round,
      padding: theme.spacing.medium,
    },
    cardPressed: { opacity: 0.92 },
    cardDefault: { opacity: 1 },
    iconBox: {
      backgroundColor: theme.colors.primaryContainer + 'A6',
      borderRadius: theme.radius.large,
    },
    title: { color: theme.colors.onSurface, lineHeight: 18 },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
      lineHeight: 18,
    },
    selectSelectedBg: { backgroundColor: theme.colors.primary },
    selectDefaultBg: { backgroundColor: theme.colors.surfaceContainerLow },
    selectPressed: { opacity: 0.85 },
    selectDefault: { opacity: 1 },
  };

  useEffect(() => {
    let cancelled = false;
    AddressService.streetFromCoordinates(
      attraction.latitude,
      attraction.longitude,
      attraction.city,
    ).then(
      (value) => {
        if (!cancelled) setStreet(value);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attraction.latitude, attraction.longitude]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        themedStyles.cardBg,
        pressed ? themedStyles.cardPressed : themedStyles.cardDefault,
      ]}
    >
      <View
        style={[
          styles.iconBox,
          themedStyles.iconBox,
        ]}
      >
        <Text style={styles.iconEmoji}>{categoryIcon(attraction.category)}</Text>
      </View>

      <View style={styles.body}>
        <Text
          style={[
            theme.typography.titleSmall,
            themedStyles.title,
          ]}
          numberOfLines={2}
        >
          {attraction.name}
        </Text>
        <Text
          style={[
            theme.typography.bodySmall,
            themedStyles.subtitle,
          ]}
          numberOfLines={2}
        >
          {street}
        </Text>
      </View>

      <Pressable
        onPress={onToggleSelection}
        style={({ pressed }) => [
          styles.selectButton,
          isSelected ? themedStyles.selectSelectedBg : themedStyles.selectDefaultBg,
          pressed ? themedStyles.selectPressed : themedStyles.selectDefault,
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
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconEmoji: {
    fontSize: 26,
  },
  body: {
    flex: 1,
  },
  selectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});

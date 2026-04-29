import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AppButton } from '../../../shared/components/AppButton';
import { AddressService } from '../../../shared/services/addressService';
import { useTheme } from '../../../theme';
import { Attraction, categoryIcon, categoryLabel } from '../types';

type Props = {
  attraction: Attraction | null;
  isSelected: boolean;
  onToggleSelection: () => void;
  onClose: () => void;
};

export const AttractionDetailsSheet: React.FC<Props> = ({
  attraction,
  isSelected,
  onToggleSelection,
  onClose,
}) => {
  const theme = useTheme();
  const [street, setStreet] = useState('Loading street...');
  const themedStyles = {
    sheetBg: {
      backgroundColor: theme.colors.surfaceContainerHigh,
      borderTopLeftRadius: theme.radius.round,
      borderTopRightRadius: theme.radius.round,
    },
    handleBg: { backgroundColor: theme.colors.onSurfaceVariant + '59' },
    contentPad: {
      paddingHorizontal: theme.spacing.screen,
      paddingBottom: theme.spacing.xLarge,
      paddingTop: 8,
    },
    iconBoxBg: {
      backgroundColor: theme.colors.primaryContainer + 'A6',
      borderRadius: theme.radius.large,
    },
    title: { color: theme.colors.onSurface },
    titleWrap: { flex: 1, marginLeft: 14 },
    chip: { borderColor: theme.colors.outlineVariant, marginTop: theme.spacing.medium },
    chipText: { color: theme.colors.onSurface, marginLeft: 6 },
    description: {
      color: theme.colors.onSurface,
      marginTop: theme.spacing.medium,
      lineHeight: 23,
    },
    metaRowLarge: { marginTop: theme.spacing.large },
    metaRowSmall: { marginTop: theme.spacing.small },
    metaText: { color: theme.colors.onSurface, marginLeft: 8 },
    bottomSpacer: { height: theme.spacing.large },
  };

  useEffect(() => {
    let cancelled = false;
    if (attraction != null) {
      setStreet('Loading street...');
      AddressService.streetFromCoordinates(
        attraction.latitude,
        attraction.longitude,
      ).then((value) => {
        if (!cancelled) setStreet(value);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [attraction]);

  return (
    <Modal
      visible={attraction != null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          themedStyles.sheetBg,
        ]}
      >
        <View
          style={[
            styles.handle,
            themedStyles.handleBg,
          ]}
        />
        {attraction != null ? (
          <ScrollView
            contentContainerStyle={themedStyles.contentPad}
          >
            <View style={styles.header}>
              <View
                style={[
                  styles.iconBox,
                  themedStyles.iconBoxBg,
                ]}
              >
                <Text style={styles.iconEmoji}>
                  {categoryIcon(attraction.category)}
                </Text>
              </View>
              <View style={themedStyles.titleWrap}>
                <Text
                  style={[
                    theme.typography.titleLarge,
                    themedStyles.title,
                  ]}
                >
                  {attraction.name}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.chip,
                themedStyles.chip,
              ]}
            >
              <Icon name="category" size={16} color={theme.colors.primary} />
              <Text
                style={[
                  theme.typography.labelLarge,
                  themedStyles.chipText,
                ]}
              >
                {categoryLabel(attraction.category)}
              </Text>
            </View>

            <Text
              style={[
                theme.typography.bodyLarge,
                themedStyles.description,
              ]}
            >
              {attraction.description}
            </Text>

            <View
              style={[
                styles.metaRow,
                themedStyles.metaRowLarge,
              ]}
            >
              <Icon name="signpost" size={20} color={theme.colors.primary} />
              <Text
                style={[
                  theme.typography.bodyMedium,
                  themedStyles.metaText,
                ]}
              >
                {street}
              </Text>
            </View>
            <View
              style={[
                styles.metaRow,
                themedStyles.metaRowSmall,
              ]}
            >
              <Icon name="location-on" size={20} color={theme.colors.primary} />
              <Text
                style={[
                  theme.typography.bodyMedium,
                  themedStyles.metaText,
                ]}
              >
                {attraction.latitude.toFixed(4)}, {attraction.longitude.toFixed(4)}
              </Text>
            </View>

            <View style={themedStyles.bottomSpacer} />
            <AppButton
              label={isSelected ? 'Remove from route' : 'Add to route'}
              variant={isSelected ? 'destructive' : 'filled'}
              iconName={isSelected ? 'remove-circle-outline' : 'add-circle-outline'}
              onPress={() => {
                onToggleSelection();
                onClose();
              }}
            />
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    paddingTop: 8,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 28,
  },
  chip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

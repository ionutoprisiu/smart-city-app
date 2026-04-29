import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme';
import { RoutingProfile } from '../types';

type Props = {
  count: number;
  profile: RoutingProfile;
  isOptimizing: boolean;
  canOptimize: boolean;
  onProfileChanged: (profile: RoutingProfile) => void;
  onOptimize?: () => void;
  onClear: () => void;
};

export const SelectionDock: React.FC<Props> = ({
  count,
  profile,
  isOptimizing,
  canOptimize,
  onProfileChanged,
  onOptimize,
  onClear,
}) => {
  const theme = useTheme();
  const themedStyles = {
    dockBg: { backgroundColor: theme.colors.surfaceContainerHighest + 'EE' },
    segmentedBorder: { borderColor: theme.colors.outlineVariant + '73' },
    segmentPressed: { opacity: 0.85 },
    segmentDefault: { opacity: 1 },
    segmentLabel: (active: boolean) => ({ color: segmentFg(active), marginLeft: 6 }),
    selectedText: { color: theme.colors.onSurfaceVariant, flex: 1, marginLeft: 10 },
    clearPressed: { opacity: 0.7 },
    clearDefault: { opacity: 1 },
    clearText: { color: theme.colors.primary },
    optimizeBg: { backgroundColor: theme.colors.primary },
    hintText: { color: theme.colors.onSurfaceVariant, marginTop: 8, marginLeft: 6 },
  };

  const segmentBg = (active: boolean) =>
    active ? theme.colors.primaryContainer : 'transparent';
  const segmentFg = (active: boolean) =>
    active ? theme.colors.onPrimaryContainer : theme.colors.onSurface;

  const renderSegment = (
    value: RoutingProfile,
    icon: string,
    label: string,
    isFirst: boolean,
  ) => {
    const active = profile === value;
    return (
      <Pressable
        key={value}
        onPress={() => !isOptimizing && onProfileChanged(value)}
        style={({ pressed }) => [
          styles.segment,
          {
            backgroundColor: segmentBg(active),
            borderTopLeftRadius: isFirst ? 12 : 0,
            borderBottomLeftRadius: isFirst ? 12 : 0,
            borderTopRightRadius: !isFirst ? 12 : 0,
            borderBottomRightRadius: !isFirst ? 12 : 0,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Icon name={icon} size={18} color={segmentFg(active)} />
        <Text
          style={[
            theme.typography.labelMedium,
            themedStyles.segmentLabel(active),
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.dock,
        themedStyles.dockBg,
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.segmented,
            themedStyles.segmentedBorder,
          ]}
        >
          {renderSegment('driving', 'directions-car', 'Drive', true)}
          {renderSegment('foot', 'directions-walk', 'Walk', false)}
        </View>

        <Text
          style={[
            theme.typography.labelLarge,
            themedStyles.selectedText,
          ]}
        >
          {count} selected
        </Text>

        <Pressable
          onPress={onClear}
          style={({ pressed }) => [
            styles.clearBtn,
            pressed ? themedStyles.clearPressed : themedStyles.clearDefault,
          ]}
        >
          <Text style={[theme.typography.labelLarge, themedStyles.clearText]}>
            Clear
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onOptimize?.()}
          disabled={isOptimizing || onOptimize == null}
          style={({ pressed }) => [
            styles.optimizeButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: isOptimizing || onOptimize == null ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {isOptimizing ? (
            <ActivityIndicator size="small" color={theme.colors.onPrimary} />
          ) : (
            <Icon name="route" size={18} color={theme.colors.onPrimary} />
          )}
        </Pressable>
      </View>
      {!canOptimize ? (
        <Text
          style={[
            theme.typography.labelSmall,
            themedStyles.hintText,
          ]}
        >
          Pick at least 2 places (or enable location for 1 place).
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  dock: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optimizeButton: {
    width: 44,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  clearBtn: {
    paddingHorizontal: 8,
  },
});

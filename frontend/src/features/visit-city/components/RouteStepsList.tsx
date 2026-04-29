import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme';
import { RouteResult } from '../types';

type Props = {
  result: RouteResult;
  compact?: boolean;
};

export const RouteStepsList: React.FC<Props> = ({ result, compact = false }) => {
  const theme = useTheme();
  const height = compact ? 104 : 148;
  const cardWidth = compact ? 112 : 128;
  const avatarSize = compact ? 32 : 40;
  const avatarIconSize = compact ? 18 : 20;
  const titleFontSize = compact ? 13 : 14;
  const themedStyles = {
    containerBg: { backgroundColor: theme.colors.surfaceContainerHighest + 'F2', height },
    contentCompact: { paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center' as const },
    contentDefault: { paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center' as const },
    card: { width: cardWidth, alignItems: 'center' as const },
    avatarShape: { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 },
    avatarStartBg: { backgroundColor: '#1A73E8' },
    avatarDefaultBg: { backgroundColor: theme.colors.primary },
    orderText: { color: theme.colors.onPrimary, fontSize: compact ? 13 : 15, fontWeight: '700' as const },
    titleText: {
      color: theme.colors.onSurface,
      marginTop: compact ? 8 : 10,
      textAlign: 'center' as const,
      fontSize: titleFontSize,
      fontWeight: '500' as const,
      lineHeight: titleFontSize * 1.25,
    },
    distanceText: { color: theme.colors.onSurfaceVariant, marginTop: 6 },
    chevron: { marginHorizontal: 4 },
  };

  return (
    <View
      style={[
        styles.container,
        themedStyles.containerBg,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={compact ? themedStyles.contentCompact : themedStyles.contentDefault}
      >
        {result.steps.map((step, index) => {
          const isStart = step.attractionId === 0;
          const showDistance = !compact;
          return (
            <React.Fragment key={`${step.order}-${step.attractionId}`}>
              <View style={themedStyles.card}>
                <View
                  style={[
                    styles.avatar,
                    themedStyles.avatarShape,
                    isStart ? themedStyles.avatarStartBg : themedStyles.avatarDefaultBg,
                  ]}
                >
                  {isStart ? (
                    <Icon name="near-me" size={avatarIconSize} color="#FFFFFF" />
                  ) : (
                    <Text style={themedStyles.orderText}>
                      {step.order}
                    </Text>
                  )}
                </View>
                <Text
                  numberOfLines={compact ? 1 : 2}
                  style={themedStyles.titleText}
                >
                  {step.attractionName}
                </Text>
                {showDistance && step.distanceToNext != null ? (
                  <Text
                    style={[
                      theme.typography.labelSmall,
                      themedStyles.distanceText,
                    ]}
                  >
                    {step.distanceToNext.toFixed(1)} km
                  </Text>
                ) : null}
              </View>
              {index < result.steps.length - 1 ? (
                <Icon
                  name="chevron-right"
                  size={compact ? 18 : 22}
                  color={theme.colors.outline + '8C'}
                  style={themedStyles.chevron}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

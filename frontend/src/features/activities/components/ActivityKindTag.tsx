import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@theme';
import type { ActivityKind } from '../types';
import { activityKindIcon, activityKindLabel } from '../utils/buildActivityListings';

type Props = {
  kind: ActivityKind;
};

export const ActivityKindTag: React.FC<Props> = ({ kind }) => {
  const theme = useTheme();
  const isEvent = kind === 'event';
  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: isEvent
            ? theme.colors.primaryContainer + 'CC'
            : theme.colors.surfaceContainerHigh,
        },
      ]}
    >
      <Icon
        name={activityKindIcon(kind)}
        size={14}
        color={isEvent ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant}
      />
      <Text
        style={[
          theme.typography.labelSmall,
          {
            color: isEvent ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant,
          },
        ]}
      >
        {activityKindLabel(kind)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

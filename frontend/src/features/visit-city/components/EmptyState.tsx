import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme';

type Props = {
  iconName: string;
  title: string;
  subtitle: string;
};

export const EmptyState: React.FC<Props> = ({ iconName, title, subtitle }) => {
  const theme = useTheme();
  const themedStyles = {
    containerPad: { padding: theme.spacing.xLarge },
    bubbleBg: { backgroundColor: theme.colors.surfaceContainerHighest + '99' },
    title: {
      color: theme.colors.onSurface,
      marginTop: theme.spacing.large,
      textAlign: 'center' as const,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
  };
  return (
    <View style={[styles.container, themedStyles.containerPad]}>
      <View
        style={[
          styles.bubble,
          themedStyles.bubbleBg,
        ]}
      >
        <Icon name={iconName} size={40} color={theme.colors.onSurfaceVariant} />
      </View>
      <Text
        style={[
          theme.typography.titleMedium,
          themedStyles.title,
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          theme.typography.bodyMedium,
          themedStyles.subtitle,
        ]}
      >
        {subtitle}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

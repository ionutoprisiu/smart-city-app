import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@theme';

type Props = {
  message?: string | null;
  onRetry?: () => void;
  iconName?: string;
};

export const ErrorMessage: React.FC<Props> = ({
  message,
  onRetry,
  iconName = 'cloud-off',
}) => {
  const theme = useTheme();
  if (!message) return null;
  const themedStyles = {
    containerPad: { padding: theme.spacing.large },
    iconBg: { backgroundColor: theme.colors.errorContainer + '73' },
    title: {
      color: theme.colors.onSurface,
      marginTop: theme.spacing.large,
      textAlign: 'center' as const,
    },
    body: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 8,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
    retryBg: {
      backgroundColor: theme.colors.primaryContainer,
      borderRadius: theme.radius.large,
      marginTop: theme.spacing.large,
    },
    retryPressed: { opacity: 0.85 },
    retryDefault: { opacity: 1 },
    retryText: { color: theme.colors.onPrimaryContainer, marginLeft: 8 },
  };

  return (
    <View style={[styles.container, themedStyles.containerPad]}>
      <View
        style={[
          styles.iconBubble,
          themedStyles.iconBg,
        ]}
      >
        <Icon name={iconName} size={40} color={theme.colors.error} />
      </View>

      <Text
        style={[
          theme.typography.titleMedium,
          themedStyles.title,
        ]}
      >
        Something went wrong
      </Text>

      <Text
        style={[
          theme.typography.bodyMedium,
          themedStyles.body,
        ]}
      >
        {message}
      </Text>

      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            themedStyles.retryBg,
            pressed ? themedStyles.retryPressed : themedStyles.retryDefault,
          ]}
        >
          <Icon name="refresh" size={18} color={theme.colors.onPrimaryContainer} />
          <Text
            style={[
              theme.typography.labelLarge,
              themedStyles.retryText,
            ]}
          >
            Try again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubble: {
    padding: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
});

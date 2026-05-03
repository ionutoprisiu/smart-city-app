import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@theme';

type Props = {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
};

export const LoadingOverlay: React.FC<Props> = ({ isLoading, children, message }) => {
  const theme = useTheme();
  const themedStyles = {
    scrim: { backgroundColor: 'rgba(0,0,0,0.35)' },
    card: {
      backgroundColor: theme.colors.surfaceContainerHigh,
      borderRadius: theme.radius.round,
      paddingHorizontal: theme.spacing.xLarge,
      paddingVertical: theme.spacing.large,
    },
    message: {
      color: theme.colors.onSurfaceVariant,
      marginTop: theme.spacing.medium,
      textAlign: 'center' as const,
    },
  };
  return (
    <View style={styles.root}>
      {children}
      {isLoading ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            themedStyles.scrim,
          ]}
        >
          <View
            style={[
              styles.card,
              themedStyles.card,
            ]}
          >
            <ActivityIndicator size="large" color={theme.colors.primary} />
            {message ? (
              <Text
                style={[
                  theme.typography.bodyMedium,
                  themedStyles.message,
                ]}
              >
                {message}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

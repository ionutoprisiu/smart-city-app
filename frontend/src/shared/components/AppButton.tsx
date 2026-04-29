import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme';

type Variant = 'filled' | 'outlined' | 'text' | 'tonal' | 'destructive';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  iconName?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export const AppButton: React.FC<Props> = ({
  label,
  onPress,
  variant = 'filled',
  iconName,
  disabled = false,
  loading = false,
  style,
}) => {
  const theme = useTheme();

  const palette = (() => {
    switch (variant) {
      case 'outlined':
        return {
          bg: 'transparent',
          fg: theme.colors.primary,
          border: theme.colors.outlineVariant,
        };
      case 'text':
        return { bg: 'transparent', fg: theme.colors.primary, border: 'transparent' };
      case 'tonal':
        return {
          bg: theme.colors.primaryContainer,
          fg: theme.colors.onPrimaryContainer,
          border: 'transparent',
        };
      case 'destructive':
        return { bg: theme.colors.error, fg: theme.colors.onError, border: 'transparent' };
      case 'filled':
      default:
        return { bg: theme.colors.primary, fg: theme.colors.onPrimary, border: 'transparent' };
    }
  })();

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'outlined' ? 1.5 : 0,
          borderRadius: theme.radius.large,
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {iconName ? <Icon name={iconName} size={20} color={palette.fg} style={styles.icon} /> : null}
          <Text style={[theme.typography.labelLarge, { color: palette.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: 48,
  },
  icon: {
    marginRight: 8,
  },
});

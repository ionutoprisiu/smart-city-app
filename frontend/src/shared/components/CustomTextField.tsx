import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme';

type Props = {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  validator?: (value: string) => string | undefined;
  obscureText?: boolean;
  keyboardType?: KeyboardTypeOptions;
  prefixIcon?: string;
  suffixIcon?: React.ReactNode;
  enabled?: boolean;
  multiline?: boolean;
  errorMessage?: string;
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

export const CustomTextField: React.FC<Props> = ({
  label,
  hint,
  value,
  onChangeText,
  validator,
  obscureText = false,
  keyboardType,
  prefixIcon,
  suffixIcon,
  enabled = true,
  multiline = false,
  errorMessage,
  autoCapitalize = 'none',
}) => {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);

  const error = touched ? validator?.(value) ?? errorMessage : errorMessage;

  const borderColor = error
    ? theme.colors.error
    : focused
    ? theme.colors.primary
    : theme.colors.outlineVariant;
  const themedStyles = {
    container: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderColor,
      borderRadius: theme.radius.input,
    },
    focusedBorder: { borderWidth: 2 },
    defaultBorder: { borderWidth: 1 },
    label: { color: focused ? theme.colors.primary : theme.colors.onSurfaceVariant },
    input: { color: theme.colors.onSurface, paddingVertical: 6 },
    error: { color: theme.colors.error, marginTop: 4 },
  };

  return (
    <View>
      <View
        style={[
          styles.container,
          themedStyles.container,
          focused || error ? themedStyles.focusedBorder : themedStyles.defaultBorder,
        ]}
      >
        {prefixIcon ? (
          <Icon
            name={prefixIcon}
            size={20}
            color={theme.colors.primary}
            style={styles.prefixIcon}
          />
        ) : null}
        <View style={styles.field}>
          <Text
            style={[
              theme.typography.labelSmall,
              styles.label,
              themedStyles.label,
            ]}
          >
            {label}
          </Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={hint}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            secureTextEntry={obscureText}
            keyboardType={keyboardType}
            editable={enabled}
            multiline={multiline}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setTouched(true);
            }}
            style={[
              theme.typography.bodyLarge,
              styles.input,
              themedStyles.input,
            ]}
          />
        </View>
        {suffixIcon ? <View style={styles.suffix}>{suffixIcon}</View> : null}
      </View>
      {error ? (
        <Text style={[theme.typography.labelSmall, themedStyles.error]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  prefixIcon: {
    marginRight: 12,
  },
  field: {
    flex: 1,
  },
  label: {
    marginBottom: 2,
  },
  input: {
    paddingHorizontal: 0,
  },
  suffix: {
    marginLeft: 8,
  },
});

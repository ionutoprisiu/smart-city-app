import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AppButton } from '@shared/components/AppButton';
import { CustomTextField } from '@shared/components/CustomTextField';
import { LoadingOverlay } from '@shared/components/LoadingOverlay';
import { Validators } from '@shared/utils/validators';
import { useTheme } from '@theme';
import { AuthStackParamList } from '@app/navigation/types';
import { useAuthStore } from '../store/authStore';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { login, isLoading, errorMessage, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const themedStyles = {
    rootBg: { backgroundColor: theme.colors.surface },
    contentPad: { paddingHorizontal: theme.spacing.screen, paddingVertical: theme.spacing.medium },
    spacerLarge: { height: theme.spacing.large },
    spacerXLarge: { height: theme.spacing.xLarge },
    spacerMedium: { height: theme.spacing.medium },
    heroBg: { backgroundColor: theme.colors.primaryContainer },
    centeredTitle: { color: theme.colors.onSurface, textAlign: 'center' as const },
    centeredSubtitle: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center' as const,
      marginTop: 8,
    },
    errorText: { color: theme.colors.error, textAlign: 'center' as const },
  };

  const emailError = showFieldErrors ? Validators.email(email) : undefined;
  const passwordError = showFieldErrors ? Validators.password(password) : undefined;

  const handleLogin = async () => {
    setShowFieldErrors(true);
    if (Validators.email(email) || Validators.password(password)) return;
    clearError();
    await login({ email: email.trim(), password });
  };

  return (
    <View style={[styles.root, themedStyles.rootBg]}>
      <LoadingOverlay isLoading={isLoading}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            themedStyles.contentPad,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={themedStyles.spacerLarge} />
          <View
            style={[
              styles.heroIcon,
              themedStyles.heroBg,
            ]}
          >
            <Icon name="lock-open" size={40} color={theme.colors.primary} />
          </View>
          <View style={themedStyles.spacerXLarge} />
          <Text
            style={[
              theme.typography.headlineSmall,
              themedStyles.centeredTitle,
            ]}
          >
            Welcome back
          </Text>
          <Text
            style={[
              theme.typography.bodyMedium,
              themedStyles.centeredSubtitle,
            ]}
          >
            Sign in to explore Cluj and plan your visits.
          </Text>
          <View style={themedStyles.spacerXLarge} />

          <CustomTextField
            label="Email"
            hint="you@example.com"
            value={email}
            onChangeText={setEmail}
            validator={Validators.email}
            keyboardType="email-address"
            prefixIcon="mail-outline"
            errorMessage={emailError}
          />
          <View style={themedStyles.spacerMedium} />
          <CustomTextField
            label="Password"
            hint="Your password"
            value={password}
            onChangeText={setPassword}
            validator={Validators.password}
            obscureText
            prefixIcon="lock-outline"
            errorMessage={passwordError}
          />
          <View style={themedStyles.spacerMedium} />

          {errorMessage ? (
            <Text
              style={[
                theme.typography.bodyMedium,
                themedStyles.errorText,
              ]}
            >
              {errorMessage}
            </Text>
          ) : null}

          <View style={themedStyles.spacerLarge} />
          <AppButton label="Sign in" onPress={handleLogin} disabled={isLoading} />
          <View style={themedStyles.spacerMedium} />
          <AppButton
            label="No account yet? Create one"
            variant="text"
            onPress={() => navigation.navigate('Register')}
          />
          <View style={themedStyles.spacerLarge} />
        </ScrollView>
      </LoadingOverlay>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  heroIcon: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

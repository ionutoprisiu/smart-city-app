import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AppButton } from '../../../shared/components/AppButton';
import { CustomTextField } from '../../../shared/components/CustomTextField';
import { LoadingOverlay } from '../../../shared/components/LoadingOverlay';
import { Validators } from '../../../shared/utils/validators';
import { useTheme } from '../../../theme';
import { AuthStackParamList } from '../../../app/navigation/types';
import { useAuthStore } from '../store/authStore';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export const RegisterScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { register, isLoading, errorMessage, clearError } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const themedStyles = {
    rootBg: { backgroundColor: theme.colors.surface },
    contentPad: {
      paddingHorizontal: theme.spacing.screen,
      paddingVertical: theme.spacing.medium,
    },
    heroBg: { backgroundColor: theme.colors.primaryContainer },
    spacerLarge: { height: theme.spacing.large },
    spacerXLarge: { height: theme.spacing.xLarge },
    spacerMedium: { height: theme.spacing.medium },
    centeredTitle: { color: theme.colors.onSurface, textAlign: 'center' as const },
    centeredSubtitle: {
      color: theme.colors.onSurfaceVariant,
      textAlign: 'center' as const,
      marginTop: 8,
    },
    errorText: { color: theme.colors.error, textAlign: 'center' as const },
  };

  const firstNameError = showFieldErrors
    ? Validators.required('First name')(firstName)
    : undefined;
  const lastNameError = showFieldErrors
    ? Validators.required('Last name')(lastName)
    : undefined;
  const emailError = showFieldErrors ? Validators.email(email) : undefined;
  const passwordError = showFieldErrors ? Validators.password(password) : undefined;
  const phoneError = showFieldErrors ? Validators.phone(phone) : undefined;

  const handleRegister = async () => {
    setShowFieldErrors(true);
    if (
      Validators.required('First name')(firstName) ||
      Validators.required('Last name')(lastName) ||
      Validators.email(email) ||
      Validators.password(password) ||
      Validators.phone(phone)
    ) {
      return;
    }
    clearError();
    await register({
      email: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phoneNumber: phone.trim() || undefined,
    });
  };

  return (
    <View style={[styles.root, themedStyles.rootBg]}>
      <LoadingOverlay isLoading={isLoading}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, themedStyles.contentPad]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.heroIcon, themedStyles.heroBg]}>
            <Icon name="person-add" size={38} color={theme.colors.primary} />
          </View>
          <View style={themedStyles.spacerLarge} />
          <Text style={[theme.typography.headlineSmall, themedStyles.centeredTitle]}>
            Join Smart City
          </Text>
          <Text style={[theme.typography.bodyMedium, themedStyles.centeredSubtitle]}>
            A few details and you're ready to explore.
          </Text>
          <View style={themedStyles.spacerXLarge} />

          <CustomTextField
            label="First name"
            hint="Ion"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            prefixIcon="badge"
            errorMessage={firstNameError}
          />
          <View style={themedStyles.spacerMedium} />
          <CustomTextField
            label="Last name"
            hint="Popescu"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            prefixIcon="badge"
            errorMessage={lastNameError}
          />
          <View style={themedStyles.spacerMedium} />
          <CustomTextField
            label="Email"
            hint="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            prefixIcon="mail-outline"
            errorMessage={emailError}
          />
          <View style={themedStyles.spacerMedium} />
          <CustomTextField
            label="Password"
            hint="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            obscureText
            prefixIcon="lock-outline"
            errorMessage={passwordError}
          />
          <View style={themedStyles.spacerMedium} />
          <CustomTextField
            label="Phone (optional)"
            hint="07xx xxx xxx"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            prefixIcon="phone"
            errorMessage={phoneError}
          />
          <View style={themedStyles.spacerMedium} />

          {errorMessage ? (
            <Text style={[theme.typography.bodyMedium, themedStyles.errorText]}>
              {errorMessage}
            </Text>
          ) : null}

          <View style={themedStyles.spacerLarge} />
          <AppButton label="Create account" onPress={handleRegister} disabled={isLoading} />
          <View style={themedStyles.spacerMedium} />
          <AppButton
            label="Already have an account? Sign in"
            variant="text"
            onPress={() => navigation.navigate('Login')}
          />
          <View style={themedStyles.spacerLarge} />
        </ScrollView>
      </LoadingOverlay>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  heroIcon: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

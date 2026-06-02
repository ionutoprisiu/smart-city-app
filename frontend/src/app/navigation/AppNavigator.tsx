import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme as NavTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { SplashScreen } from '@features/auth/screens/SplashScreen';
import { useAuthStore } from '@features/auth/store/authStore';
import { EditPreferencesScreen } from '@features/preferences/screens/EditPreferencesScreen';
import { OnboardingScreen } from '@features/preferences/screens/OnboardingScreen';
import { usePreferencesStore } from '@features/preferences/store/preferencesStore';
import { VerificationScreen } from '@features/verification/screens/VerificationScreen';
import { useTheme } from '@theme';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { AppRootStackParamList } from './types';

const RootStack = createNativeStackNavigator<AppRootStackParamList>();

const buildNavTheme = (
  appTheme: ReturnType<typeof useTheme>,
  base: NavTheme,
): NavTheme => ({
  ...base,
  colors: {
    ...base.colors,
    background: appTheme.colors.surface,
    card: appTheme.colors.surface,
    primary: appTheme.colors.primary,
    text: appTheme.colors.onSurface,
    border: appTheme.colors.outlineVariant,
  },
});

export const AppNavigator: React.FC = () => {
  const theme = useTheme();
  const { initialize, isInitializing, currentUser } = useAuthStore();
  const {
    status: prefsStatus,
    completed: prefsCompleted,
    load: loadPreferences,
    reset: resetPreferences,
  } = usePreferencesStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const isAuthenticated = currentUser != null;

  useEffect(() => {
    if (isAuthenticated) {
      loadPreferences();
    } else {
      resetPreferences();
    }
  }, [isAuthenticated, loadPreferences, resetPreferences]);

  if (isInitializing) return <SplashScreen />;
  if (isAuthenticated && prefsStatus !== 'ready') return <SplashScreen />;

  const needsOnboarding = isAuthenticated && !prefsCompleted;

  const navTheme = buildNavTheme(theme, theme.isDark ? DarkTheme : DefaultTheme);

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTitleStyle: { ...theme.typography.titleMedium, color: theme.colors.onSurface },
          headerTintColor: theme.colors.onSurface,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.surface },
        }}
      >
        {!isAuthenticated ? (
          <RootStack.Screen
            name="Auth"
            component={AuthStack}
            options={{ headerShown: false }}
          />
        ) : needsOnboarding ? (
          <RootStack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <RootStack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="BecomeOrganizer"
              component={VerificationScreen}
              options={{ title: 'Become an organizer' }}
            />
            <RootStack.Screen
              name="EditPreferences"
              component={EditPreferencesScreen}
              options={{ title: 'Your preferences' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

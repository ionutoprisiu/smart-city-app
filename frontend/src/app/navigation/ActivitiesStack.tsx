import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivitiesHomeScreen } from '@features/activities/screens/ActivitiesHomeScreen';
import { CreateClubScreen } from '@features/activities/screens/CreateClubScreen';
import { CreateEventScreen } from '@features/activities/screens/CreateEventScreen';
import { useTheme } from '@theme';
import { ActivitiesStackParamList } from './types';

const Stack = createNativeStackNavigator<ActivitiesStackParamList>();

export const ActivitiesStack: React.FC = () => {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: { ...theme.typography.titleMedium, color: theme.colors.onSurface },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.surface },
      }}
    >
      <Stack.Screen
        name="ActivitiesHome"
        component={ActivitiesHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'New event' }} />
      <Stack.Screen name="CreateClub" component={CreateClubScreen} options={{ title: 'New club' }} />
    </Stack.Navigator>
  );
};

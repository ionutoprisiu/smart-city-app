import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileScreen } from '../../features/profile/screens/ProfileScreen';
import { VisitCityScreen } from '../../features/visit-city/screens/VisitCityScreen';
import { useTheme } from '../../theme';
import { MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

const visitCityTabIcon = ({
  color,
  size,
  focused,
}: {
  color: string;
  size: number;
  focused: boolean;
}) => <Icon name={focused ? 'explore' : 'travel-explore'} size={size ?? 24} color={color} />;

const profileTabIcon = ({
  color,
  size,
  focused,
}: {
  color: string;
  size: number;
  focused: boolean;
}) => <Icon name={focused ? 'person' : 'person-outline'} size={size ?? 24} color={color} />;

export const MainTabs: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name === 'Profile',
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTitleStyle: {
          ...theme.typography.titleMedium,
          color: theme.colors.onSurface,
        },
        headerTintColor: theme.colors.onSurface,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceContainerLow,
          borderTopColor: theme.colors.outlineVariant + '40',
          height: 60 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 6,
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarLabelStyle: {
          ...theme.typography.labelMedium,
          fontSize: 12,
        },
      })}
    >
      <Tab.Screen
        name="VisitCity"
        component={VisitCityScreen}
        options={{
          title: 'Visit City',
          headerShown: false,
          tabBarIcon: visitCityTabIcon,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: profileTabIcon,
        }}
      />
    </Tab.Navigator>
  );
};

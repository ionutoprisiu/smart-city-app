import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type ActivitiesStackParamList = {
  ActivitiesHome: undefined;
  CreateEvent: undefined;
  CreateClub: undefined;
};

export type MainTabsParamList = {
  VisitCity: undefined;
  Activities: NavigatorScreenParams<ActivitiesStackParamList>;
  Profile: undefined;
};

export type AppRootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabsParamList>;
  Verification: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends AppRootStackParamList {}
  }
}

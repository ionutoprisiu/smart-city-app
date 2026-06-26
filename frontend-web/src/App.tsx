import React, { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@features/auth/store/authStore';
import { LoginPage } from '@features/auth/pages/LoginPage';
import { RegisterPage } from '@features/auth/pages/RegisterPage';
import { SplashScreen } from '@features/auth/pages/SplashScreen';
import { VisitCityPage } from '@features/visit-city/pages/VisitCityPage';
import { ActivitiesHomePage } from '@features/activities/pages/ActivitiesHomePage';
import { CreateEventPage } from '@features/activities/pages/CreateEventPage';
import { CreateClubPage } from '@features/activities/pages/CreateClubPage';
import { ActivityAnnouncementsPage } from '@features/activities/pages/ActivityAnnouncementsPage';
import { ActivityGroupChatPage } from '@features/activities/pages/ActivityGroupChatPage';
import { ActivitySupportPage } from '@features/activities/pages/ActivitySupportPage';
import { ProfilePage } from '@features/profile/pages/ProfilePage';
import { VerificationPage } from '@features/verification/pages/VerificationPage';
import { MainLayout } from '@app/MainLayout';

export const App: React.FC = () => {
  const { initialize, isInitializing, currentUser } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isInitializing) return <SplashScreen />;

  const isAuthenticated = currentUser != null;

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/visit-city" element={<VisitCityPage />} />
        <Route path="/community" element={<ActivitiesHomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="/community/create-event" element={<CreateEventPage />} />
      <Route path="/community/create-club" element={<CreateClubPage />} />
      <Route path="/community/:kind/:id/announcements" element={<ActivityAnnouncementsPage />} />
      <Route path="/community/club/:id/group-chat" element={<ActivityGroupChatPage />} />
      <Route path="/community/:kind/:id/support" element={<ActivitySupportPage />} />
      <Route path="/become-organizer" element={<VerificationPage />} />
      <Route path="*" element={<Navigate to="/visit-city" replace />} />
    </Routes>
  );
};

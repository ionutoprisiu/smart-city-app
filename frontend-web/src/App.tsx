import React, { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@features/auth/store/authStore';
import { LoginPage } from '@features/auth/pages/LoginPage';
import { RegisterPage } from '@features/auth/pages/RegisterPage';
import { SplashScreen } from '@features/auth/pages/SplashScreen';
import { VisitCityPage } from '@features/visit-city/pages/VisitCityPage';
import { ToursPage } from '@features/tours/pages/ToursPage';
import { CreateTourPage } from '@features/tours/pages/CreateTourPage';
import { ProfilePage } from '@features/profile/pages/ProfilePage';
import { VerificationPage } from '@features/verification/pages/VerificationPage';
import AdminApp from '@features/admin/AdminApp';
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
        <Route path="/tours" element={<ToursPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="/become-guide" element={<VerificationPage />} />
      <Route
        path="/tours/create"
        element={
          currentUser?.role === 'guide' || currentUser?.role === 'admin' ? (
            <CreateTourPage />
          ) : (
            <Navigate to="/tours" replace />
          )
        }
      />
      <Route
        path="/admin/*"
        element={
          currentUser?.role === 'admin' ? <AdminApp /> : <Navigate to="/visit-city" replace />
        }
      />
      <Route path="*" element={<Navigate to="/visit-city" replace />} />
    </Routes>
  );
};

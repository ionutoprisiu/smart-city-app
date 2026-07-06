import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AlgorithmsPage } from "./pages/AlgorithmsPage";
import { UsersPage } from "./pages/UsersPage";
import { VerificationsPage } from "./pages/VerificationsPage";

// Admin panel (former control-web), mounted at /admin for ADMIN users only.
// Styles are scoped under `.admin-root` so they never leak into the main app.
export default function AdminApp() {
  return (
    <div className="admin-root">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="verifications" replace />} />
          <Route path="verifications" element={<VerificationsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="algorithms" element={<AlgorithmsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/verifications" replace />} />
      </Routes>
    </div>
  );
}

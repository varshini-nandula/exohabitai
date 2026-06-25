import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../auth/ProtectedRoute';
import AdminRoute from '../auth/AdminRoute';
import AdminLayout from '../layouts/AdminLayout';

// Pages
import HomePage from '../pages/HomePage';
import PredictPage from '../pages/PredictPage';
import RankingsPage from '../pages/RankingsPage';
import AboutPage from '../pages/AboutPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import AddPlanetPage from '../pages/AddPlanetPage';
import HistoryPage from '../pages/HistoryPage';
import ProfilePage from '../pages/ProfilePage';

// Admin Pages
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import ModerationPage from '../pages/admin/ModerationPage';
import UserManagementPage from '../pages/admin/UserManagementPage';
import ModelsPage from '../pages/admin/ModelsPage';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/predict" element={<PredictPage />} />
      <Route path="/rankings" element={<RankingsPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/add-planet" element={<AddPlanetPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Admin Protected Routes */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/moderation" element={<ModerationPage />} />
          <Route path="/admin/users" element={<UserManagementPage />} />
          <Route path="/admin/models" element={<ModelsPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

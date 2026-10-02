import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../auth/ProtectedRoute';
import AdminRoute from '../auth/AdminRoute';
import MainLayout from '../layouts/MainLayout';
import AdminLayout from '../layouts/AdminLayout';

// Pages
import HomePage from '../pages/HomePage';
import PredictPage from '../pages/PredictPage';
import RankingsPage from '../pages/RankingsPage';
import AboutPage from '../pages/AboutPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import UserDashboardPage from '../pages/UserDashboardPage';
import AddPlanetPage from '../pages/AddPlanetPage';
import NotFoundPage from '../pages/NotFoundPage';

// Admin Pages
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import ModerationPage from '../pages/admin/ModerationPage';
import UserManagementPage from '../pages/admin/UserManagementPage';
import ModelsPage from '../pages/admin/ModelsPage';
import DatasetsPage from '../pages/admin/DatasetsPage';
import TrainingPage from '../pages/admin/TrainingPage';
import AuditLogsPage from '../pages/admin/AuditLogsPage';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public & Regular User Routes (Main App Shell) */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/predict" element={<PredictPage />} />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected User Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<UserDashboardPage />} />
          {/* Backwards Compatibility Redirects */}
          <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
          <Route path="/history" element={<Navigate to="/dashboard" replace />} />
          <Route path="/my-predictions" element={<Navigate to="/dashboard" replace />} />
          <Route path="/add-planet" element={<AddPlanetPage />} />
        </Route>
      </Route>

      {/* Admin Protected Routes (Dedicated Operations Console Shell) */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/moderation" element={<ModerationPage />} />
          <Route path="/admin/users" element={<UserManagementPage />} />
          <Route path="/admin/models" element={<ModelsPage />} />
          <Route path="/admin/datasets" element={<DatasetsPage />} />
          <Route path="/admin/training" element={<TrainingPage />} />
          <Route path="/admin/logs" element={<AuditLogsPage />} />
        </Route>
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}


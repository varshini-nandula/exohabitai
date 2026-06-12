import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../auth/ProtectedRoute';

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

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

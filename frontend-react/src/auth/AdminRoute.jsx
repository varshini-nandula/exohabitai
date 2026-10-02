/**
 * ExoHabitAI — Admin Route Guard
 * ================================
 * Protects /admin/* routes by verifying:
 *   1. User is authenticated (has valid JWT)
 *   2. User has role === "admin"
 *
 * Non-admins are redirected to the homepage.
 * Unauthenticated users are redirected to /login.
 *
 * Extends the pattern from ProtectedRoute.jsx but adds role checking.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner message="Verifying admin access..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/admin" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

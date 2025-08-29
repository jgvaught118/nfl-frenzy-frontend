import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Usage:
 * <ProtectedRoute> ... </ProtectedRoute>
 * <ProtectedRoute requireAdmin> ... </ProtectedRoute>
 */
export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, bootLoading } = useAuth();

  if (bootLoading) return <div className="p-6">Loading…</div>;

  // Not logged in → go to login
  if (!user) return <Navigate to="/" replace />;

  // Deactivated accounts are blocked
  if (user.deactivated) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h2 className="text-xl font-bold mb-2">Account Deactivated</h2>
        <p>Your account is currently deactivated. Please contact an admin.</p>
      </div>
    );
  }

  // Not approved yet → send to pending page
  if (!user.approved) {
    return <Navigate to="/pending" replace />;
  }

  // Admin-only pages
  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

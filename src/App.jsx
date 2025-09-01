// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Leaderboard from "./components/Leaderboard";
import WeeklyLeaderboard from "./pages/WeeklyLeaderboard";

// NOTE: your files are lowercase (login.jsx, dashboard.jsx)
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";

import HowToPlay from "./pages/HowToPlay";
import PicksForm from "./pages/PicksForm";
import Admin from "./pages/Admin";
import AdminUsers from "./pages/AdminUsers";
import AdminEmail from "./pages/AdminEmail";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppNav from "./components/AppNav";

/** Scroll to top on route change */
function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Public entry:
 *  - If logged in, push to /dashboard
 *  - Else show <Login />
 */
function PublicEntry() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Login />;
}

function AppContent() {
  const location = useLocation();
  const { user, bootLoading } = useAuth();

  // Show nav on any route except the login page
  const showNav = !!user && location.pathname !== "/";

  if (bootLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-100 text-gray-700">
        <div className="text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-6">
      {showNav && <AppNav />}

      <Routes>
        {/* Public root (auto-redirects to /dashboard if already logged in) */}
        <Route path="/" element={<PublicEntry />} />

        {/* Public: How to Play / Rules */}
        <Route path="/how-to-play" element={<HowToPlay />} />
        {/* Nice alias */}
        <Route path="/rules" element={<Navigate to="/how-to-play" replace />} />

        {/* Picks (default -> week 1) */}
        <Route
          path="/picks/:week"
          element={
            <ProtectedRoute>
              <PicksForm />
            </ProtectedRoute>
          }
        />
        <Route path="/picks" element={<Navigate to="/picks/1" replace />} />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Leaderboards */}
        <Route
          path="/leaderboard/overall"
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard/week/:week"
          element={
            <ProtectedRoute>
              <WeeklyLeaderboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={<Navigate to="/leaderboard/overall" replace />}
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/email"
          element={
            <ProtectedRoute>
              <AdminEmail />
            </ProtectedRoute>
          }
        />

        {/* Legal */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Simple footer with legal links */}
      <footer className="mt-8 text-center text-sm text-gray-500">
        <a href="/privacy" className="underline hover:text-gray-700">Privacy</a>
        {" • "}
        <a href="/terms" className="underline hover:text-gray-700">Terms</a>
        {" • "}
        <a href="/how-to-play" className="underline hover:text-gray-700">How to Play</a>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

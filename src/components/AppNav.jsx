// src/components/AppNav.jsx
import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function AppNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide nav on the login page
  const showNav = !!user && location.pathname !== "/";

  const [currentWeek, setCurrentWeek] = React.useState(1);

  const axiosAuth = React.useMemo(
    () => ({
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
    []
  );

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/admin/current_week`,
          axiosAuth
        );
        const cw = Number(res.data?.current_week ?? 1) || 1;
        if (alive) setCurrentWeek(cw);
      } catch {
        if (alive) setCurrentWeek(1);
      }
    })();
    return () => {
      alive = false;
    };
  }, [axiosAuth]);

  if (!showNav) return null;

  // Unified tab styling; active state comes from aria-current="page"
  const TabLink = ({ to, children }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          // layout
          "inline-flex items-center whitespace-nowrap",
          // size & shape
          "px-3 py-2 rounded-xl text-sm font-medium",
          // ring/hover/visited reset handled in index.css; keep color classes here
          isActive
            ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600"
            : "bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50",
          // smooth transition + focus
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b">
      <div className="max-w-6xl mx-auto px-3">
        {/* Top bar */}
        <div className="h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900"
            title="Dashboard"
          >
            <span role="img" aria-label="football">🏈</span>
            <span>NFL Frenzy</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:inline">
              Hi, <b>{user?.first_name || user?.name || "User"}</b>
            </span>
            <button
              onClick={logout}
              className="text-sm bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="pb-3">
          <div className="tab-strip flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
            <TabLink to="/dashboard">Dashboard</TabLink>
            <TabLink to={`/picks/${currentWeek}`}>Picks (Week {currentWeek})</TabLink>
            <TabLink to={`/leaderboard/week/${currentWeek}`}>Weekly Leaderboard</TabLink>
            <TabLink to="/leaderboard/overall">Overall Leaderboard</TabLink>

            {user?.is_admin && (
              <>
                {/* subtle divider for admin group */}
                <div className="hidden sm:block mx-1 h-5 w-px bg-gray-200" />
                <TabLink to="/admin">Admin</TabLink>
                <TabLink to="/admin/users">Manage Users</TabLink>
                <TabLink to="/admin/email">Email</TabLink>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

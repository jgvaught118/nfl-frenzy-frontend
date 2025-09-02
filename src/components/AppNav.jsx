// src/components/AppNav.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

function pill(isActive) {
  return [
    "inline-flex items-center rounded-full px-3 py-2 text-sm font-medium tab-link",
    "no-underline visited:no-underline visited:text-gray-800",
    isActive
      ? "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600"
      : "bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50",
    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
  ].join(" ");
}

export default function AppNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || location.pathname === "/") return null;

  const [currentWeek, setCurrentWeek] = useState(1);

  const axiosAuth = useMemo(
    () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
    []
  );

  useEffect(() => {
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
    return () => { alive = false; };
  }, [axiosAuth]);

  const baseLinks = [
    { to: "/dashboard", label: "Dashboard" },
    { to: `/picks/${currentWeek}`, label: "Weekly Picks" },
    { to: `/leaderboard/week/${currentWeek}`, label: "Weekly Leaderboard" },
    { to: "/leaderboard/overall", label: "Overall Leaderboard" },
    { to: "/how-to-play", label: "How to Play" },
  ];

  const adminLinks = user?.is_admin
    ? [
        { to: "/admin", label: "Admin" },
        { to: "/admin/users", label: "Manage Users" },
        { to: "/admin/email", label: "Email" },
      ]
    : [];

  return (
    <header className="appnav-header sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3">
        {/* Top Row */}
        <div className="flex h-14 items-center justify-between gap-3">
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
            <span className="text-sm text-gray-600">
              Hi, <b>{user?.first_name || user?.name || "Player"}</b>
            </span>
            <button
              onClick={logout}
              className="text-sm bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Single responsive pill strip (scrolls on small screens, wraps on larger) */}
        <nav className="pb-3">
          <div className="tab-strip flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar flex-wrap">
            {baseLinks.map(l => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => pill(isActive)}>
                {l.label}
              </NavLink>
            ))}

            {adminLinks.length > 0 && <div className="mx-1 h-5 w-px bg-gray-200" />}

            {adminLinks.map(l => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => pill(isActive)}>
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}

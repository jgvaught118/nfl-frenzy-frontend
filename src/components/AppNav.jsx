// src/components/AppNav.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

function pill(isActive) {
  return [
    "inline-flex items-center rounded-full px-3 py-2 text-sm font-medium",
    "no-underline visited:no-underline visited:text-gray-800",
    isActive
      ? "bg-blue-600 text-white shadow-sm"
      : "bg-white text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50",
    "transition-colors",
  ].join(" ");
}

export default function AppNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user || location.pathname === "/") return null;

  const [currentWeek, setCurrentWeek] = useState(1);
  const [open, setOpen] = useState(false);

  const axiosAuth = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
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
    return () => {
      alive = false;
    };
  }, [axiosAuth]);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-3">
        {/* Top Row */}
        <div className="flex h-14 items-center justify-between gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900"
            title="Dashboard"
          >
            <span role="img" aria-label="football">🏈</span>
            <span>NFL Frenzy</span>
          </button>

          {/* Right side (desktop) */}
          <div className="hidden items-center gap-3 md:flex">
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

          {/* Mobile toggle */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" />
              </svg>
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>

        {/* Tabs */}
        <nav className="pb-3">
          {/* Desktop pills */}
          <div className="hidden md:flex flex-wrap items-center gap-2 sm:gap-3">
            <NavLink to="/dashboard" className={({ isActive }) => pill(isActive)}>
              Dashboard
            </NavLink>
            <NavLink
              to={`/picks/${currentWeek}`}
              className={({ isActive }) => pill(isActive)}
            >
              Weekly Picks
            </NavLink>
            <NavLink
              to={`/leaderboard/week/${currentWeek}`}
              className={({ isActive }) => pill(isActive)}
            >
              Weekly Leaderboard
            </NavLink>
            <NavLink
              to="/leaderboard/overall"
              className={({ isActive }) => pill(isActive)}
            >
              Overall Leaderboard
            </NavLink>
            <NavLink
              to="/how-to-play"
              className={({ isActive }) => pill(isActive)}
            >
              How to Play
            </NavLink>

            {user?.is_admin && (
              <>
                <div className="mx-1 hidden h-5 w-px bg-gray-200 md:block" />
                <NavLink to="/admin" className={({ isActive }) => pill(isActive)}>
                  Admin
                </NavLink>
                <NavLink to="/admin/users" className={({ isActive }) => pill(isActive)}>
                  Manage Users
                </NavLink>
                <NavLink to="/admin/email" className={({ isActive }) => pill(isActive)}>
                  Email
                </NavLink>
              </>
            )}
          </div>

          {/* Mobile list */}
          <div
            className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${
              open ? "max-h-80" : "max-h-0"
            }`}
          >
            <div className="grid gap-2 pt-2 pb-3">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 no-underline visited:no-underline ${
                    isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                Dashboard
              </NavLink>
              <NavLink
                to={`/picks/${currentWeek}`}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 no-underline visited:no-underline ${
                    isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                Weekly Picks
              </NavLink>
              <NavLink
                to={`/leaderboard/week/${currentWeek}`}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 no-underline visited:no-underline ${
                    isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                Weekly Leaderboard
              </NavLink>
              <NavLink
                to="/leaderboard/overall"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 no-underline visited:no-underline ${
                    isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                Overall Leaderboard
              </NavLink>
              <NavLink
                to="/how-to-play"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 no-underline visited:no-underline ${
                    isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                How to Play
              </NavLink>

              {user?.is_admin && (
                <>
                  <div className="mt-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Admin
                  </div>
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 no-underline visited:no-underline ${
                        isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                      }`
                    }
                    onClick={() => setOpen(false)}
                  >
                    Admin Home
                  </NavLink>
                  <NavLink
                    to="/admin/users"
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 no-underline visited:no-underline ${
                        isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                      }`
                    }
                    onClick={() => setOpen(false)}
                  >
                    Manage Users
                  </NavLink>
                  <NavLink
                    to="/admin/email"
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 no-underline visited:no-underline ${
                        isActive ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                      }`
                    }
                    onClick={() => setOpen(false)}
                  >
                    Email Tools
                  </NavLink>
                </>
              )}

              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="mt-1 mx-3 rounded-lg bg-red-600 px-3 py-2 text-left text-sm text-white hover:bg-red-700"
              >
                Log Out
              </button>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}

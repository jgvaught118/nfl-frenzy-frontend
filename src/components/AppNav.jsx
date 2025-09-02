// src/components/AppNav.jsx
import React, { useState, useMemo, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function linkClasses(isActive) {
  return cx(
    "inline-flex items-center rounded-xl px-3 py-2 text-sm no-underline visited:no-underline",
    isActive
      ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
      : "text-gray-700 hover:text-gray-900 hover:bg-white/60"
  );
}

export default function AppNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide nav on the login page
  const showNav = !!user && location.pathname !== "/";

  const [open, setOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);

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

  if (!showNav) return null;

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60">
      <nav className="mx-auto max-w-6xl px-4">
        {/* Top bar */}
        <div className="flex h-14 items-center justify-between gap-3">
          {/* Brand */}
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-gray-900"
            title="Dashboard"
          >
            <span className="inline-grid h-8 w-8 place-items-center rounded-xl bg-emerald-600 text-white text-sm font-bold">
              NF
            </span>
            <span>NFL Frenzy</span>
          </button>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 md:flex">
            <NavLink to="/dashboard" className={({ isActive }) => linkClasses(isActive)}>
              Dashboard
            </NavLink>

            <NavLink
              to={`/picks/${currentWeek}`}
              className={({ isActive }) => linkClasses(isActive)}
            >
              Weekly Picks
            </NavLink>

            <NavLink
              to={`/leaderboard/week/${currentWeek}`}
              className={({ isActive }) => linkClasses(isActive)}
            >
              Weekly Leaderboard
            </NavLink>

            <NavLink
              to="/leaderboard/overall"
              className={({ isActive }) => linkClasses(isActive)}
            >
              Overall Leaderboard
            </NavLink>

            <NavLink
              to="/how-to-play"
              className={({ isActive }) => linkClasses(isActive)}
            >
              How to Play
            </NavLink>

            {/* Admin group (only if admin) */}
            {user?.is_admin && (
              <div className="relative group">
                <button
                  type="button"
                  className={cx(
                    "inline-flex items-center rounded-xl px-3 py-2 text-sm no-underline visited:no-underline",
                    "text-gray-700 hover:text-gray-900 hover:bg-white/60"
                  )}
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  Admin
                  <svg
                    className="ml-1 h-4 w-4 opacity-70"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.586l3.71-3.354a.75.75 0 111.02 1.1l-4.24 3.834a.75.75 0 01-1.02 0L5.25 8.33a.75.75 0 01-.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {/* Dropdown */}
                <div
                  className="invisible absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-1 text-sm shadow-lg opacity-0 transition-all group-hover:visible group-hover:opacity-100"
                  role="menu"
                >
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      cx(
                        "block rounded-lg px-3 py-2 no-underline visited:no-underline",
                        isActive ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"
                      )
                    }
                    onClick={close}
                    role="menuitem"
                  >
                    Admin Home
                  </NavLink>
                  <NavLink
                    to="/admin/users"
                    className={({ isActive }) =>
                      cx(
                        "block rounded-lg px-3 py-2 no-underline visited:no-underline",
                        isActive ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"
                      )
                    }
                    onClick={close}
                    role="menuitem"
                  >
                    Manage Users
                  </NavLink>
                  <NavLink
                    to="/admin/email"
                    className={({ isActive }) =>
                      cx(
                        "block rounded-lg px-3 py-2 no-underline visited:no-underline",
                        isActive ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"
                      )
                    }
                    onClick={close}
                    role="menuitem"
                  >
                    Email Tools
                  </NavLink>
                </div>
              </div>
            )}
          </div>

          {/* Right side: greeting + logout (desktop) */}
          <div className="hidden md:flex items-center gap-3">
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

          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl p-2 text-gray-700 hover:bg-white/60 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <svg className={cx("h-6 w-6", open ? "hidden" : "block")} viewBox="0 0 24 24" fill="none">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
            </svg>
            <svg className={cx("h-6 w-6", open ? "block" : "hidden")} viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {/* Mobile panel */}
        <div
          className={cx(
            "md:hidden overflow-hidden transition-[max-height] duration-300",
            open ? "max-h-96" : "max-h-0"
          )}
        >
          <div className="grid gap-2 pb-3">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                cx("rounded-lg px-3 py-2 no-underline visited:no-underline", isActive ? "bg-white" : "hover:bg-white/60")
              }
              onClick={close}
            >
              Dashboard
            </NavLink>
            <NavLink
              to={`/picks/${currentWeek}`}
              className={({ isActive }) =>
                cx("rounded-lg px-3 py-2 no-underline visited:no-underline", isActive ? "bg-white" : "hover:bg-white/60")
              }
              onClick={close}
            >
              Weekly Picks
            </NavLink>
            <NavLink
              to={`/leaderboard/week/${currentWeek}`}
              className={({ isActive }) =>
                cx("rounded-lg px-3 py-2 no-underline visited:no-underline", isActive ? "bg-white" : "hover:bg-white/60")
              }
              onClick={close}
            >
              Weekly Leaderboard
            </NavLink>
            <NavLink
              to="/leaderboard/overall"
              className={({ isActive }) =>
                cx("rounded-lg px-3 py-2 no-underline visited:no-underline", isActive ? "bg-white" : "hover:bg-white/60")
              }
              onClick={close}
            >
              Overall Leaderboard
            </NavLink>
            <NavLink
              to="/how-to-play"
              className={({ isActive }) =>
                cx("rounded-lg px-3 py-2 no-underline visited:no-underline", isActive ? "bg-white" : "hover:bg-white/60")
              }
              onClick={close}
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
                    cx("rounded-lg px-3 py-2 no-underline visited:no-underline", isActive ? "bg-white" : "hover:bg-white/60")
                  }
                  onClick={close}
                >
                  Admin Home
                </NavLink>
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    cx("rounded-lg px-3 py-2 no-underline visited:no-underline", isActive ? "bg-white" : "hover:bg-white/60")
                  }
                  onClick={close}
                >
                  Manage Users
                </NavLink>
                <NavLink
                  to="/admin/email"
                  className={({ isActive }) =>
                    cx("rounded-lg px-3 py-2 no-underline visited:no-underline", isActive ? "bg-white" : "hover:bg-white/60")
                  }
                  onClick={close}
                >
                  Email Tools
                </NavLink>
              </>
            )}

            {/* Mobile: logout */}
            <button
              onClick={() => {
                close();
                logout();
              }}
              className="mt-1 mx-3 rounded-lg bg-red-600 px-3 py-2 text-left text-sm text-white hover:bg-red-700"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}

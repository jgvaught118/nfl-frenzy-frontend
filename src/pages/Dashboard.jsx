// nfl-frenzy-frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const TOTAL_WEEKS = 18;
const TOOLTIP_DURATION = 4000; // 4 seconds

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [currentWeekDisplay, setCurrentWeekDisplay] = useState(1); // computed “current” week based on first Sunday
  const [weekRows, setWeekRows] = useState([]);                    // [{week_number, is_locked, is_current}]
  const [userPicks, setUserPicks] = useState({});
  const [tooltipWeek, setTooltipWeek] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const axiosAuth = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
    []
  );

  const kickoffDate = (g) => {
    const val = g.kickoff ?? g.start_time ?? g.kickoff_time;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };
  const firstSundayKickoff = (games) => {
    const sundays = (games || [])
      .map(kickoffDate)
      .filter((d) => d && d.getUTCDay() === 0) // Sunday in UTC
      .sort((a, b) => a - b);
    return sundays[0] || null;
  };

  useEffect(() => {
    if (!user?.id) return;

    const run = async () => {
      setLoading(true);
      try {
        // --- A) Season picks for this user (for chips & tooltip) ---
        const picksRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/picks/season/private`,
          { params: { user_id: user.id }, ...axiosAuth }
        );
        const byWeek = {};
        (picksRes.data || []).forEach((p) => {
          if (p && typeof p.week !== "undefined") byWeek[p.week] = p;
        });
        setUserPicks(byWeek);

        // --- B) (Optional) backend current week as fallback only ---
        let backendCurrentWeek = 1;
        try {
          const wkRes = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/admin/current_week`
          );
          const payload = wkRes.data || {};
          const cw =
            payload.current_week !== undefined ? payload.current_week : payload;
          backendCurrentWeek =
            Number(typeof cw === "object" ? cw.week_number || cw.week : cw) || 1;
        } catch {
          backendCurrentWeek = 1;
        }

        // --- C) Compute each week’s first-Sunday kickoff (all 18) ---
        const now = new Date();
        const meta = await Promise.all(
          Array.from({ length: TOTAL_WEEKS }, async (_, idx) => {
            const w = idx + 1;
            try {
              const res = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/games/week/${w}`
              );
              const games = Array.isArray(res.data) ? res.data : [];
              const first = firstSundayKickoff(games);
              if (!first) {
                // No Sunday game → treat as not globally locked
                return { week: w, firstSunday: null, locked: false };
              }
              return { week: w, firstSunday: first.toISOString(), locked: now >= first };
            } catch {
              // If fetch fails, fall back to a simple rule: weeks < backend current are locked
              return { week: w, firstSunday: null, locked: w < backendCurrentWeek };
            }
          })
        );

        // --- D) Choose the display “current” week:
        // The first week whose first Sunday is still in the future (locked=false).
        // If none match (late season), fall back to backend current or last unlocked rule.
        let displayCurrent =
          meta.find((m) => m.locked === false)?.week ??
          backendCurrentWeek ??
          1;

        // Guard: if backend says 2 but Week 1’s Sunday hasn’t happened (locked=false),
        // the find() above will return 1 — perfect for your Week 1 case.
        setCurrentWeekDisplay(displayCurrent);

        // --- E) Build rows with is_current & is_locked per week ---
        const rows = meta.map((m) => ({
          week_number: m.week,
          is_locked: !!m.locked,
          is_current: m.week === displayCurrent,
        }));
        setWeekRows(rows);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user?.id, axiosAuth]);

  const goToWeek = (weekNumber) => navigate(`/picks/${weekNumber}`);
  const goToOverallLeaderboard = () => navigate("/leaderboard/overall");
  const goToWeeklyLeaderboard = () => {
    const qs = window.location.search || "";
    navigate(`/leaderboard/week/${currentWeekDisplay}${qs}`);
  };
  const goToAdmin = () => navigate("/admin");

  const showTooltip = (weekNumber) => {
    setTooltipWeek(weekNumber);
    setTooltipVisible(true);
    setTimeout(() => {
      setTooltipVisible(false);
      setTimeout(() => setTooltipWeek(null), 300);
    }, TOOLTIP_DURATION);
  };

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">
        Welcome, {user?.first_name || "User"}!
      </h2>

      <p className="mb-4 text-gray-700">
        Make or edit your weekly pick. Past weeks lock after their first Sunday
        kickoff; the Picks page enforces the actual lock time.
      </p>

      {/* Week Selector */}
      <div className="flex flex-col gap-3 mb-6">
        {weekRows.map((wk) => {
          const pick = userPicks[wk.week_number];
          const canClick = !wk.is_locked;

          const baseClasses =
            "px-4 py-2 rounded border transition-all duration-200 font-medium flex justify-between items-center relative";
          let bgClass = "bg-gray-100 text-black";
          if (wk.is_locked) bgClass = "bg-gray-300 text-gray-500";
          else if (wk.is_current) bgClass = "bg-green-600 text-white";

          let label = `Week ${wk.week_number}`;
          if (wk.is_locked) label += " 🔒";
          if (wk.is_current && !wk.is_locked) label += " 🟢";

          // Chip logic:
          // - If unlocked and you have a pick:
          //     - current week → “Submitted — Edit”
          //     - non-current → “Submitted”
          // - If unlocked and no pick → “Make Pick”
          // - If locked → no chip (button disabled)
          let chip = null;
          if (!wk.is_locked) {
            if (pick) {
              chip = wk.is_current ? "Submitted — Edit" : "Submitted";
            } else {
              chip = "Make Pick";
            }
          }

          return (
            <div key={wk.week_number} className="relative">
              <button
                onClick={() => {
                  if (canClick) {
                    goToWeek(wk.week_number);
                    if (pick) showTooltip(wk.week_number);
                  }
                }}
                className={`${baseClasses} ${bgClass} ${
                  canClick ? "cursor-pointer" : "cursor-not-allowed"
                }`}
                disabled={!canClick}
                title={
                  wk.is_locked
                    ? "Past week — locked"
                    : pick
                    ? "Edit your pick"
                    : "Make your pick"
                }
              >
                <span>{label}</span>
                {chip && (
                  <span
                    className={[
                      "ml-3 text-xs px-2 py-0.5 rounded",
                      pick
                        ? (wk.is_current
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800")
                        : "bg-gray-200 text-gray-700",
                    ].join(" ")}
                  >
                    {chip}
                  </span>
                )}
              </button>

              {/* Tooltip snapshot of your pick */}
              {pick && tooltipWeek === wk.week_number && (
                <div
                  className={`absolute left-full ml-2 top-0 w-64 p-3 bg-gray-800 text-white text-sm rounded shadow-lg z-50 transition-opacity duration-300 ${
                    tooltipVisible ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="font-bold mb-1">Your Picks:</div>
                  <ul className="list-disc list-inside">
                    {Object.entries(pick).map(([key, value]) => {
                      if (["id", "user_id", "week"].includes(key)) return null;
                      return (
                        <li key={key}>
                          <strong>{key.replace(/_/g, " ")}:</strong> {String(value)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={goToOverallLeaderboard}
          className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Overall Leaderboard
        </button>

        <button
          onClick={goToWeeklyLeaderboard}
          className="px-5 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition"
        >
          Weekly Leaderboard
        </button>

        {user?.is_admin && (
          <button
            onClick={goToAdmin}
            className="px-5 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
            title="Admin tools: set GOTW/POTW"
          >
            Admin
          </button>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
      >
        Log Out
      </button>
    </div>
  );
}

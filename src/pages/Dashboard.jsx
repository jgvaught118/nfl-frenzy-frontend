// nfl-frenzy-frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const TOTAL_WEEKS = 18;
const TOOLTIP_DURATION = 4000; // 4 seconds

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [userPicks, setUserPicks] = useState({});
  const [tooltipWeek, setTooltipWeek] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const axiosAuth = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }),
    []
  );

  // Helpers to compute first Sunday kickoff for a week’s games
  const kickoffDate = (g) => {
    const val = g.kickoff ?? g.start_time ?? g.kickoff_time;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };
  const firstSundayKickoff = (games) => {
    const sundays = (games || [])
      .map(kickoffDate)
      .filter((d) => d && d.getUTCDay() === 0) // 0 = Sunday (UTC-safe)
      .sort((a, b) => a - b);
    return sundays[0] || null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.id) return;

        // 1) Current week number (ignore “locked” flags coming from here)
        const wkRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/admin/current_week`
        );
        const payload = wkRes.data || {};
        const cw =
          payload.current_week !== undefined ? payload.current_week : payload;
        const weekNumber =
          (typeof cw === "object" ? cw.week_number || cw.week : cw) || 1;
        const cur = Number(weekNumber) || 1;
        setCurrentWeek(cur);

        // 2) Build initial display — past weeks locked, current/future unlocked
        const list = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
          const w = i + 1;
          return {
            week_number: w,
            is_current: w === cur,
            is_locked: w < cur, // provisional; we’ll override below using real kickoff when we can
          };
        });

        // 3) Fetch your season picks (so we can show the “Submitted — Edit” chip)
        const picksRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/picks/season/private`,
          { params: { user_id: user.id }, ...axiosAuth }
        );
        const byWeek = {};
        (picksRes.data || []).forEach((p) => {
          if (p && typeof p.week !== "undefined") byWeek[p.week] = p;
        });
        setUserPicks(byWeek);

        // 4) Refine locks with REAL first-Sunday times for:
        //    - the current week
        //    - the previous week (e.g., Week 1 when backend already rolled to Week 2)
        const weeksToCheck = [cur, cur - 1].filter((w) => w >= 1 && w <= TOTAL_WEEKS);

        const overrides = await Promise.all(
          weeksToCheck.map(async (w) => {
            try {
              const res = await axios.get(
                `${import.meta.env.VITE_BACKEND_URL}/games/week/${w}`
              );
              const games = Array.isArray(res.data) ? res.data : [];
              const first = firstSundayKickoff(games);
              if (!first) return { week: w, locked: false }; // no Sunday => don’t lock
              const locked = new Date() >= first;
              return { week: w, locked };
            } catch {
              return { week: w, locked: w < cur }; // fallback to provisional
            }
          })
        );

        // Apply overrides to the two weeks we just checked
        const refined = list.map((row) => {
          const ov = overrides.find((o) => o.week === row.week_number);
          if (!ov) return row;
          return {
            ...row,
            is_locked: ov.locked && row.week_number < cur ? true : ov.locked,
            // logic note: for previous week, ov.locked accurately reflects whether its first Sunday passed
            // for current week, ov.locked will be false before Sunday (so stays editable)
          };
        });

        setWeeks(refined);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        // Safe fallback UI
        const fallbackWeeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => ({
          week_number: i + 1,
          is_locked: false,
          is_current: i + 1 === 1,
        }));
        setWeeks(fallbackWeeks);
        setCurrentWeek(1);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.id, axiosAuth]);

  const goToWeek = (weekNumber) => navigate(`/picks/${weekNumber}`);
  const goToOverallLeaderboard = () => navigate("/leaderboard/overall");
  const goToWeeklyLeaderboard = () => {
    const qs = window.location.search || "";
    navigate(`/leaderboard/week/${currentWeek}${qs}`);
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
        Make or edit your weekly pick. Past weeks lock after the first Sunday
        kickoff; the Picks page always enforces the actual lock time.
      </p>

      {/* Week Selector */}
      <div className="flex flex-col gap-3 mb-6">
        {weeks.map((wk) => {
          const pick = userPicks[wk.week_number];
          const baseClasses =
            "px-4 py-2 rounded border transition-all duration-200 font-medium flex justify-between items-center relative";

          let bgClass = "bg-gray-100 text-black";
          if (wk.is_locked) bgClass = "bg-gray-300 text-gray-500";
          else if (wk.is_current) bgClass = "bg-green-600 text-white";

          let label = `Week ${wk.week_number}`;
          if (wk.is_locked) label += " 🔒";
          if (wk.is_current && !wk.is_locked) label += " 🟢";

          const canClick = !wk.is_locked;

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
                {!wk.is_locked && (
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
                    {pick ? (wk.is_current ? "Submitted — Edit" : "Submitted") : "Make Pick"}
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
};

export default Dashboard;

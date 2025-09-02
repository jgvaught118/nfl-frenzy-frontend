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

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.id) return;

        // 1) Current week number (we intentionally ignore any "locked" flag here,
        //    because we want the Dashboard to remain editable until the *actual*
        //    global lock time; the Picks page enforces that for real).
        const wkRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/admin/current_week`
        );

        const payload = wkRes.data || {};
        const cw =
          payload.current_week !== undefined ? payload.current_week : payload;
        const weekNumber =
          (typeof cw === "object" ? cw.week_number || cw.week : cw) || 1;

        setCurrentWeek(Number(weekNumber));

        // 2) Build display list for all weeks
        //    Past weeks are locked; current/future weeks are unlocked from Dashboard perspective.
        const generatedWeeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
          const weekNum = i + 1;
          const isPast = weekNum < weekNumber;
          const isCurrent = weekNum === weekNumber;

          return {
            week_number: weekNum,
            is_locked: isPast,   // ✅ only past weeks locked here
            is_current: isCurrent,
          };
        });
        setWeeks(generatedWeeks);

        // 3) Your season picks (private)
        const picksRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/picks/season/private`,
          { params: { user_id: user.id }, ...axiosAuth }
        );

        const byWeek = {};
        (picksRes.data || []).forEach((p) => {
          if (p && typeof p.week !== "undefined") {
            byWeek[p.week] = p;
          }
        });
        setUserPicks(byWeek);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        // Safe fallback UI so the page still renders
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

  const goToWeek = (weekNumber) => {
    navigate(`/picks/${weekNumber}`);
  };

  const goToOverallLeaderboard = () => {
    navigate("/leaderboard/overall");
  };

  const goToWeeklyLeaderboard = () => {
    const qs = window.location.search || "";
    navigate(`/leaderboard/week/${currentWeek}${qs}`);
  };

  const goToAdmin = () => {
    navigate("/admin");
  };

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
        Make or edit your weekly pick. Past weeks are locked; current week remains editable here until the official lock. The Picks page always enforces the actual lock time.
      </p>

      {/* Week Selector */}
      <div className="flex flex-col gap-3 mb-6">
        {weeks.map((wk) => {
          const pick = userPicks[wk.week_number];
          const baseClasses =
            "px-4 py-2 rounded border transition-all duration-200 font-medium flex justify-between items-center relative";

          // Styling
          let bgClass = "bg-gray-100 text-black";
          if (wk.is_locked) bgClass = "bg-gray-300 text-gray-500";
          else if (wk.is_current) bgClass = "bg-green-600 text-white";

          // Label
          let label = `Week ${wk.week_number}`;
          if (wk.is_locked) label += " 🔒";
          if (wk.is_current && !wk.is_locked) label += " 🟢";

          return (
            <div key={wk.week_number} className="relative">
              <button
                onClick={() => {
                  // Past weeks aren't clickable; current/future are always clickable from Dashboard.
                  if (!wk.is_locked) {
                    goToWeek(wk.week_number);
                    if (pick) showTooltip(wk.week_number);
                  }
                }}
                className={`${baseClasses} ${bgClass} ${wk.is_locked ? "cursor-not-allowed" : "cursor-pointer"}`}
                disabled={wk.is_locked}
                title={
                  wk.is_locked
                    ? "Past week — locked"
                    : pick
                    ? "Edit your pick"
                    : "Make your pick"
                }
              >
                <span>{label}</span>

                {/* Right side chip: Submitted / Edit */}
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

              {/* Tooltip w/ your pick snapshot */}
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

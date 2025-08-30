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

        // 1) Current week info
        const wkRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/admin/current_week`
        );

        // Handle multiple possible shapes gracefully
        const payload = wkRes.data || {};
        const cw =
          payload.current_week !== undefined ? payload.current_week : payload;
        const weekNumber =
          (typeof cw === "object" ? cw.week_number || cw.week : cw) || 1;

        const firstSundayLock =
          payload.first_sunday_game_locked ??
          payload.is_locked ??
          false;

        setCurrentWeek(Number(weekNumber));

        // 2) Build display list for all weeks
        const generatedWeeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
          const weekNum = i + 1;
          let is_locked = false;
          let is_current = false;

          if (weekNum < weekNumber) is_locked = true;
          else if (weekNum === weekNumber) {
            is_current = true;
            is_locked = !!firstSundayLock;
          }

          return { week_number: weekNum, is_locked, is_current };
        });
        setWeeks(generatedWeeks);

        // 3) Your season picks (private) — replaces old /picks/week/all
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
    // preserve any query params (e.g., ?debug_unlocked=1 during QA)
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
      <p className="mb-6 text-gray-700">
        This is your dashboard. View your picks and the leaderboard below.
      </p>

      {/* Week Selector */}
      <div className="flex flex-col gap-3 mb-6">
        {weeks.map((week) => {
          const pick = userPicks[week.week_number];
          const baseClasses =
            "px-4 py-2 rounded border transition-all duration-200 font-medium flex justify-between items-center relative";
          let bgClass = "bg-gray-100 text-black cursor-pointer";

          if (week.is_locked) bgClass = "bg-gray-300 text-gray-500 cursor-not-allowed";
          else if (week.is_current) bgClass = "bg-green-600 text-white";

          let label = `Week ${week.week_number}`;
          if (week.is_locked) label += " 🔒";
          if (week.is_current && !week.is_locked) label += " 🟢";

          return (
            <div key={week.week_number} className="relative">
              <button
                onClick={() => {
                  if (!week.is_locked) goToWeek(week.week_number);
                  if (pick) showTooltip(week.week_number);
                }}
                className={`${baseClasses} ${bgClass}`}
                disabled={week.is_locked}
              >
                <span>{label}</span>
              </button>

              {/* Tooltip */}
              {pick && tooltipWeek === week.week_number && (
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

        {/* Admin button (only visible to admins) */}
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

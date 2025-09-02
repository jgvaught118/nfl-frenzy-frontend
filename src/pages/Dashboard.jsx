// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [week, setWeek] = useState(null);
  const [games, setGames] = useState([]);
  const [pick, setPick] = useState(null); // { team, gotw_prediction, potw_prediction }
  const [loading, setLoading] = useState(true);

  // lock state
  const [globalLocked, setGlobalLocked] = useState(false);
  const [countdown, setCountdown] = useState("");
  const countdownRef = useRef(null);

  const axiosAuth = useMemo(
    () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
    []
  );

  // ----- helpers -----
  const kickoffDate = (g) => {
    const val = g.kickoff ?? g.start_time ?? g.kickoff_time;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const computeFirstSundayKickoff = (gamesList) => {
    const sundays = gamesList
      .map(kickoffDate)
      .filter((d) => d && d.getUTCDay() === 0) // 0 = Sunday (UTC)
      .sort((a, b) => a - b);
    return sundays[0] || null;
  };

  const fmtTimeLeft = (msLeft) => {
    const sec = Math.max(0, Math.floor(msLeft / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const startCountdown = (target) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const tick = () => {
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) {
        setGlobalLocked(true);
        setCountdown("Picks are now locked!");
        clearInterval(countdownRef.current);
        return;
      }
      setCountdown(`Time until first Sunday kickoff: ${fmtTimeLeft(diff)}`);
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
  };

  // ----- load on mount -----
  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        // 1) current week number (ignore any lock flag from this API)
        const cwRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/admin/current_week`,
          axiosAuth
        );
        const payload = cwRes.data || {};
        const cw =
          payload.current_week !== undefined ? payload.current_week : payload;
        const wk = (typeof cw === "object" ? cw.week_number || cw.week : cw) || 1;
        const currentWeek = Number(wk) || 1;
        if (!alive) return;
        setWeek(currentWeek);

        // 2) games for that week (to compute true lock)
        const gamesRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/games/week/${currentWeek}`,
          axiosAuth
        );
        const gamesData = Array.isArray(gamesRes.data) ? gamesRes.data : [];
        if (!alive) return;
        setGames(gamesData);

        // 3) your private pick for that week
        const pickRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/picks/week/${currentWeek}/private`,
          { params: { user_id: user.id }, ...axiosAuth }
        );
        const existing = (pickRes.data || [])[0] || null;
        if (!alive) return;
        setPick(
          existing
            ? {
                team: existing.team || "",
                gotw_prediction:
                  existing.gotw_prediction == null
                    ? ""
                    : String(existing.gotw_prediction),
                potw_prediction:
                  existing.potw_prediction == null
                    ? ""
                    : String(existing.potw_prediction),
              }
            : null
        );

        // 4) compute true global lock from first Sunday kickoff
        const firstSunday = computeFirstSundayKickoff(gamesData);
        const now = new Date();
        if (firstSunday) {
          if (now >= firstSunday) {
            setGlobalLocked(true);
            setCountdown("Picks are now locked!");
          } else {
            setGlobalLocked(false);
            startCountdown(firstSunday);
          }
        } else {
          // If no Sunday games, rely on per-game locks only (not handled on dashboard)
          setGlobalLocked(false);
          setCountdown("");
        }
      } catch (e) {
        console.error("Dashboard load failed:", e);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [user, navigate, axiosAuth]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  const isDouble = week === 13 || week === 17;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="text-sm text-gray-600">Week <b>{week}</b></div>
      </div>

      {/* Double points banner */}
      {isDouble && (
        <div className="rounded-md border border-purple-200 bg-purple-50 text-purple-900 px-3 py-2">
          🔥 This is a <b>Double Points</b> week (×2).
        </div>
      )}

      {/* Countdown */}
      {!!countdown && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 text-yellow-900 px-3 py-2">
          {countdown}
        </div>
      )}

      {/* Your pick card */}
      <div className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Your Week {week} Pick</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/leaderboard/week/${week}${window.location.search || ""}`)}
              className="px-3 py-1.5 rounded-md text-sm bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Weekly Leaderboard
            </button>
            <button
              onClick={() => navigate(`/leaderboard/overall`)}
              className="px-3 py-1.5 rounded-md text-sm bg-gray-800 text-white hover:bg-black"
            >
              Overall Leaderboard
            </button>
          </div>
        </div>

        {!pick ? (
          <div className="flex items-center justify-between">
            <p className="text-gray-700">
              You haven’t submitted a pick for Week {week} yet.
            </p>
            <button
              onClick={() => navigate(`/picks/${week}`)}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              disabled={globalLocked}
              title={globalLocked ? "Picks are locked" : "Make your pick"}
            >
              Make Your Pick
            </button>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded border p-3">
                <div className="text-sm text-gray-500 mb-1">Team</div>
                <div className="text-lg font-semibold">{pick.team || "—"}</div>
              </div>
              <div className="rounded border p-3">
                <div className="text-sm text-gray-500 mb-1">GOTW Total Points</div>
                <div className="text-lg font-semibold">
                  {pick.gotw_prediction !== "" ? pick.gotw_prediction : "—"}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="text-sm text-gray-500 mb-1">POTW Yards</div>
                <div className="text-lg font-semibold">
                  {pick.potw_prediction !== "" ? pick.potw_prediction : "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {globalLocked ? (
                  <span className="text-red-600 font-medium">Locked</span>
                ) : (
                  <span className="text-emerald-700 font-medium">
                    Submitted — you can still edit
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate(`/picks/${week}`)}
                className={`px-4 py-2 rounded-md text-white ${
                  globalLocked
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
                disabled={globalLocked}
                title={globalLocked ? "Picks are locked" : "Edit your pick"}
              >
                {globalLocked ? "Locked" : "Edit Pick"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Quick links */}
      <div className="rounded-lg border bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold mb-2">Quick Links</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/picks/${week}`)}
            className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Go to Weekly Picks
          </button>
          <button
            onClick={() => navigate(`/leaderboard/week/${week}${window.location.search || ""}`)}
            className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Week {week} Leaderboard
          </button>
          <button
            onClick={() => navigate(`/leaderboard/overall`)}
            className="px-3 py-2 rounded-md bg-gray-800 text-white hover:bg-black"
          >
            Overall Leaderboard
          </button>
          <button
            onClick={() => navigate(`/how-to-play`)}
            className="px-3 py-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300"
          >
            How to Play
          </button>
        </div>
      </div>

      {/* Logout */}
      <div className="pt-2">
        <button
          onClick={logout}
          className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}

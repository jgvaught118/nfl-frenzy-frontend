// src/pages/WeeklyLeaderboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import LeaderboardTabs from "../components/LeaderboardTabs";

const badgeClass = {
  winner: "bg-amber-500 text-white",
  gotw1: "bg-green-600 text-white",
  gotw2: "bg-yellow-500 text-black",
  gotw3: "bg-orange-600 text-white",
  potwExact: "bg-sky-500 text-white",
};

function rowClasses(p) {
  if (p.is_correct_pick === true) {
    return p.is_favorite === true
      ? "bg-yellow-100 ring-1 ring-yellow-300"
      : "bg-green-100 ring-1 ring-green-300";
  }
  if (p.is_correct_pick === false) {
    return "bg-red-100 ring-1 ring-red-300";
  }
  return "bg-white";
}

export default function WeeklyLeaderboard() {
  const { week: weekParam } = useParams();
  const navigate = useNavigate();

  const [week, setWeek] = useState(null); // numeric week once normalized
  const [data, setData] = useState({
    locked: false,
    picks: [],
    qa_mode: false,
    unlock_at_iso: null,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 1) Normalize the route param
  useEffect(() => {
    // If the param is literally "overall", send them to the overall page
    if (weekParam === "overall") {
      navigate("/leaderboard/overall", { replace: true });
      return;
    }

    const n = Number(weekParam);
    if (Number.isFinite(n) && n >= 1 && n <= 18) {
      setWeek(n);
      return;
    }

    // If not a valid number, fetch current week from the server and normalize the URL
    (async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/admin/current_week`
        );
        const payload = res.data || {};
        const cw = payload.current_week !== undefined ? payload.current_week : payload;
        const wk = (typeof cw === "object" ? cw.week_number || cw.week : cw) || 1;
        const n2 = Number(wk) || 1;
        setWeek(n2);
        const qs = window.location.search || "";
        navigate(`/leaderboard/week/${n2}${qs}`, { replace: true });
      } catch (e) {
        setWeek(1);
        const qs = window.location.search || "";
        navigate(`/leaderboard/week/1${qs}`, { replace: true });
      }
    })();
  }, [weekParam, navigate]);

  // 2) Fetch weekly public picks once we have a numeric week
  useEffect(() => {
    if (week == null) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setErr("");
        const qs = window.location.search || ""; // e.g., ?debug_unlocked=1 for QA
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/picks/week/${week}/public${qs}`
        );
        setData(res.data || { locked: false, picks: [], qa_mode: false });
      } catch (e) {
        console.error(e);
        setErr(e.response?.data?.error || "Failed to load weekly picks");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [week]);

  const sorted = useMemo(() => {
    const arr = [...(data.picks || [])];
    arr.sort((a, b) => {
      if (a.is_weekly_winner && !b.is_weekly_winner) return -1;
      if (!a.is_weekly_winner && b.is_weekly_winner) return 1;
      if ((b.total_points ?? 0) !== (a.total_points ?? 0))
        return (b.total_points ?? 0) - (a.total_points ?? 0);
      return (a.first_name || "").localeCompare(b.first_name || "");
    });
    return arr;
  }, [data.picks]);

  if (loading) return <div className="p-6">Loading weekly leaderboard…</div>;
  if (err) return <div className="p-6 text-red-600">{err}</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Tabs: Overall + W1…W18 (active highlights current week) */}
      <LeaderboardTabs active={Number(week)} />

      <h2 className="text-2xl font-bold mb-3">Week {week} Leaderboard</h2>

      {data.locked && (
        <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-900">
          Public picks are hidden until Sunday 11:00 AM (Arizona).
          {data.unlock_at_iso && (
            <>
              {" "}
              Unlocks at{" "}
              <strong>{new Date(data.unlock_at_iso).toLocaleString()}</strong>.
            </>
          )}
        </div>
      )}

      {!data.locked && (
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-3 py-2 border-b">#</th>
                <th className="text-left px-3 py-2 border-b">Name</th>
                <th className="text-left px-3 py-2 border-b">Team Pick</th>
                <th className="text-left px-3 py-2 border-b">GOTW Pick</th>
                <th className="text-left px-3 py-2 border-b">POTW Pick</th>
                <th className="text-left px-3 py-2 border-b">Points</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => {
                const classes =
                  rowClasses(p) + (p.is_weekly_winner ? " font-semibold" : "");
                return (
                  <tr key={`${p.first_name}-${idx}`} className={classes}>
                    <td className="px-3 py-2 border-b align-top">
                      {idx + 1}
                      {p.is_weekly_winner && (
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded ${badgeClass.winner}`}
                        >
                          ⭐ Winner
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-b align-top">
                      {p.first_name || "—"}
                    </td>
                    <td className="px-3 py-2 border-b align-top">
                      <div className="flex items-center gap-2">
                        <span>{p.team}</span>
                        {p.is_favorite === true && (
                          <span className="text-xs rounded bg-yellow-200 px-1">
                            Favorite
                          </span>
                        )}
                        {p.is_favorite === false && (
                          <span className="text-xs rounded bg-green-200 px-1">
                            Underdog
                          </span>
                        )}
                        {p.is_correct_pick === true && (
                          <span className="text-xs">✔️</span>
                        )}
                        {p.is_correct_pick === false && (
                          <span className="text-xs">❌</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b align-top">
                      <div className="flex items-center gap-2">
                        <span>{p.gotw_prediction ?? "—"}</span>
                        {p.gotw_rank === 1 && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${badgeClass.gotw1}`}
                          >
                            GOTW 1st
                          </span>
                        )}
                        {p.gotw_rank === 2 && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${badgeClass.gotw2}`}
                          >
                            GOTW 2nd
                          </span>
                        )}
                        {p.gotw_rank === 3 && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${badgeClass.gotw3}`}
                          >
                            GOTW 3rd
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b align-top">
                      <div className="flex items-center gap-2">
                        <span>{p.potw_prediction ?? "—"}</span>
                        {p.potw_exact && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${badgeClass.potwExact}`}
                          >
                            Exact
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-b align-top">
                      <span className="inline-block min-w-8 text-center font-bold">
                        {p.total_points ?? 0}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-gray-500"
                  >
                    No public picks to show yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {data.qa_mode && (
            <div className="mt-3 text-xs text-gray-500">QA Mode is ON</div>
          )}
        </div>
      )}
    </div>
  );
}
